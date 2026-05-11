import type {
  TaskParams,
  TaskResult,
  RunSubagentContext,
  SubagentRunnerState,
  LLMCallUsage,
  Agent,
  SubagentStatus,
} from '../types';
import type { ConsumedTokens } from '../../../utils/consumedTokensCalculator';
import { DEFAULT_MAX_STEPS } from '../constants';
import { useSubagentStore } from '../state/store';
import { runnerManager } from '../lifecycle/manager';
import { subagentScheduler } from '../lifecycle/scheduler';
import { lifecycleManager } from '../lifecycle/hooks';
import type {
  HookContext,
  StepHookContext,
  CompleteHookContext,
  ToolCallHookContext,
  ToolResultHookContext,
} from '../lifecycle/hooks';
import { useExtensionStore } from '../../../store/extension';
import {
  buildInitialMessages,
  formatTaskResult,
  getToolsForAgent,
  TaskStatus,
} from '../utils';
import type { ChatMessage } from '../utils';
import { createNewSession, syncSession } from './session';
import { checkAndCompress } from './compression';
import type { SessionCompressionState } from '../../../types/contextCompression';
import { debugLog } from '../../../utils/debugLog';
import { ABORT_REASON_FINISHED } from '../../../utils/abort';

const MODULE = 'Subagent/Executor';
import { streamChat, createEmptyUsage, mergeUsage } from './llm';
import { nanoid } from 'nanoid';
import {
  createEmptyChildSessions,
  updateChildSession,
  SessionType,
  type TokenIncrement,
  createInitialConsumedTokens,
} from '../../../utils/consumedTokensCalculator';
import { estimateTokens } from '../../../utils/tokenEstimate';
import { useChatConfig } from '../../../store/chat-config';
import { useAuthStore } from '../../../store/auth';
import { useWorkspaceStore, SpecFramework } from '../../../store/workspace';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { useChatApplyStore } from '../../../store/chatApply';
import { ChatModel } from '../../../services/chatModel';
import {
  createSubagentProcessor,
  type ToolResultInput,
  type ToolResultProcessContext,
  type TerminalUpdateCallbacks,
} from '../../tool-result-processor';
import {
  preprocessSubagentMessages,
  buildSubagentChatPromptBody,
  type MessagePreprocessOptions,
} from './message-preprocessor';
import userReporter from '../../../utils/report';
import {
  getAIGWModelWithFallback,
  getAIGWModel,
} from './../../../store/chat-config';
import { promptBuilder } from './prompt-builder';
import type { SubagentSpanContext } from '../types';
import {
  startSubagentTaskSpan,
  startToolCallSpan,
  stopToolCallSpan,
  SpanStatusCode,
  trace,
  context as otelContext,
} from '../../../telemetry/otel';
import { ChatRole } from '../../../types/chat';
import { getReportEventByToolName } from '../../../utils/toolCall';

import {
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
} from '../events/taskEventBus';

/**
 * 等待用户对 failed subagent 的操作（retry 或 stop）。
 * key = toolCallId
 */
const pendingUserActions = new Map<
  string,
  { resolve: (doRetry: boolean) => void }
>();

/** 由 UI Retry 按钮调用，触发指定 subagent 重试。 */
export function retrySubagent(toolCallId: string): void {
  const pending = pendingUserActions.get(toolCallId);
  if (pending) {
    pending.resolve(true);
    pendingUserActions.delete(toolCallId);
  }
}

/** 由 UI Stop 按钮调用，用户选择不重试失败的 subagent。 */
export function stopFailedSubagent(toolCallId: string): void {
  const pending = pendingUserActions.get(toolCallId);
  if (pending) {
    // 用户选择 Stop，任务保持 failed 状态，不做重试
    pending.resolve(false);
    pendingUserActions.delete(toolCallId);
  }
}

/** 估算子会话系统 prompt 的 token 数 */
function estimateChildSessionSystemTokens(
  agentPrompt: string,
  skillPrompts: string[] = [],
  rulePrompts: string[] = [],
  mcpPrompts: string[] = [],
): {
  systemTokens: number;
  skillTokens: number;
  ruleTokens: number;
  mcpTokens: number;
} {
  const systemTokens = estimateTokens(agentPrompt);
  const skillTokens = skillPrompts.reduce(
    (sum, prompt) => sum + estimateTokens(prompt),
    0,
  );
  const ruleTokens = rulePrompts.reduce(
    (sum, prompt) => sum + estimateTokens(prompt),
    0,
  );
  const mcpTokens = mcpPrompts.reduce(
    (sum, prompt) => sum + estimateTokens(prompt),
    0,
  );

  return {
    systemTokens,
    skillTokens,
    ruleTokens,
    mcpTokens,
  };
}

/** Claude 简化别名 → 完整模型代码 */
const CLAUDE_ALIAS_MAP: Record<string, ChatModel> = {
  sonnet: ChatModel.Claude45Sonnet20250929,
  opus: ChatModel.Claude45Opus20251101,
  haiku: ChatModel.Claude45Haiku20251001,
};

/** 魔法值：表示"继承主 agent 模型" */
const INHERIT_SENTINEL = 'inherit';

/** 默认兜底模型 */
const DEFAULT_FALLBACK_MODEL = ChatModel.Claude45Sonnet20250929;

/**
 * 按优先级策略推导出 agent 最终使用的模型：
 *  1. 用户在 AgentSettingModal 中配置的模型
 *  2. 自定义 agent 定义中的 model 字段（支持 Claude 短别名，'inherit' 视为空）
 *  3. 特殊成本优化规则（Opus 主模型 + explore agent → 降级至 Sonnet）
 *  4. 继承主 agent 模型
 */
function determineAgentModel(
  agentName: string,
  agentModel?: string,
): ChatModel {
  const chatConfig = useChatConfig.getState();

  const userModel = chatConfig.subagentModelConfig?.[agentName];
  if (userModel) {
    return getAIGWModelWithFallback(
      CLAUDE_ALIAS_MAP[userModel] ?? (userModel as ChatModel),
      DEFAULT_FALLBACK_MODEL,
    );
  }

  const isInherit = !agentModel || agentModel === INHERIT_SENTINEL;
  if (!isInherit) {
    const resolved = CLAUDE_ALIAS_MAP[agentModel] ?? (agentModel as ChatModel);
    return getAIGWModelWithFallback(resolved, DEFAULT_FALLBACK_MODEL);
  }

  const primaryModelCode = chatConfig.config.model;
  if (agentName === 'explore') {
    return 'claude-haiku-4-5-20251001' as ChatModel;
  }

  const primaryModel = getAIGWModel(primaryModelCode);
  return getAIGWModelWithFallback(primaryModel, DEFAULT_FALLBACK_MODEL);
}

/** 运行子代理的完整对话循环。 */
export async function runSubagent(
  params: TaskParams,
  context: RunSubagentContext,
): Promise<TaskResult> {
  const subagentEnable = useExtensionStore.getState().subagentEnable;
  if (!subagentEnable) {
    return {
      taskId: '',
      output: 'Subagent functionality is disabled',
      success: false,
      error: 'Subagent functionality is disabled',
    };
  }

  const subagentStore = useSubagentStore.getState();
  const agent = subagentStore.getAgent(params.subagent_type);
  if (!agent) {
    const availableAgents = subagentStore.agents.map((a) => a.name).join(', ');
    return {
      taskId: '',
      output: `Error: Agent "${params.subagent_type}" not found. Available agents: ${availableAgents}`,
      success: false,
      error: `Agent "${params.subagent_type}" not found`,
    };
  }

  return subagentScheduler.schedule(
    () => runSubagentInner(params, agent, context),
    {
      toolCallId: context.toolCallId,
      agentName: agent.name,
      description: params.description,
      parentSessionId: context.parentSessionId,
    },
  );
}

async function runSubagentInner(
  params: TaskParams,
  agent: Agent,
  context: RunSubagentContext,
): Promise<TaskResult> {
  const { parentSessionId, parentAbortSignal, toolCallId, round } = context;

  let subagentSpanContext: SubagentSpanContext | undefined;
  if (round?.submitContext) {
    const subagentAssociation = {
      ...round.association,
      agentType: 'sub_agent' as const,
      agentName: agent.name,
    };
    const taskSpan = startSubagentTaskSpan(
      agent.name,
      round.submitContext,
      subagentAssociation,
    );
    const taskContext = trace.setSpan(otelContext.active(), taskSpan.span);
    subagentSpanContext = {
      taskSpan,
      taskContext,
      association: subagentAssociation,
    };
  }

  const llmModel: ChatModel = determineAgentModel(agent.name, agent.model);

  let cacheEnable = false;
  const chatModels = useChatConfig.getState().chatModels;
  const codebaseModelMaxTokens =
    useChatConfig.getState().codebaseModelMaxTokens;

  for (const key in chatModels) {
    if (!Object.hasOwn(chatModels, key)) continue;
    const model = chatModels[key];
    if (model.useModel === llmModel && model.hasTokenCache) {
      const token = codebaseModelMaxTokens[key as ChatModel];
      if (token > 64 * 1000) {
        cacheEnable = true;
      }
    }
  }

  debugLog(MODULE, 'Cache Enable Check', {
    agentName: agent.name,
    model: llmModel,
    hasTokenCache: chatModels[llmModel]?.hasTokenCache,
    maxTokens: codebaseModelMaxTokens[llmModel],
    threshold: 64 * 1000,
    cacheEnable,
  });

  const taskId = await createNewSession(
    agent,
    params,
    parentSessionId,
    llmModel,
  );

  if (subagentSpanContext) {
    subagentSpanContext.taskSpan.setAttribute('subagent.task_id', taskId);
    subagentSpanContext.taskSpan.setAttribute(
      'subagent.parent_session_id',
      parentSessionId,
    );
    subagentSpanContext.taskSpan.setAttribute('subagent.model', llmModel);
  }

  let localConsumedTokens: ConsumedTokens = createInitialConsumedTokens();

  let abortController = new AbortController();
  const runnerState: SubagentRunnerState = {
    taskId,
    agentName: agent.name,
    abortController,
    pendingToolResults: new Map(),
    parentSessionId,
  };

  runnerManager.register(taskId, runnerState);

  const maxSteps = agent.maxSteps || DEFAULT_MAX_STEPS;

  if (subagentSpanContext) {
    subagentSpanContext.taskSpan.setAttribute('subagent.max_steps', maxSteps);
  }

  const hookCtx: HookContext = {
    taskId,
    toolCallId,
    agentName: agent.name,
    parentSessionId,
  };

  await lifecycleManager.trigger('onStart', hookCtx, {
    taskId,
    parentSessionId,
    agentName: agent.name,
    step: 0,
    maxSteps,
    status: 'pending' as SubagentStatus,
    description: params.description,
    model: llmModel,
    startTime: Date.now(),
    toolCalls: [],
  });

  // ✅ 发射 TASK_STARTED 事件
  emitTaskStarted(parentSessionId, toolCallId, taskId, agent.name);

  // ✅ 使用 let 声明，以便在 retry 时可以重新赋值
  let onParentAbort = () => {
    abortController.abort();
  };
  if (parentAbortSignal) {
    parentAbortSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  // 获取 OpenSpec 相关配置
  const codebaseChatMode = useChatStore.getState().codebaseChatMode;
  const openspecVersion = useWorkspaceStore
    .getState()
    .getFrameworkSpecInfo(SpecFramework.OpenSpec)?.version;

  const enhancedPrompt = await promptBuilder.buildSystemPrompt(
    agent.prompt,
    agent.name,
    {
      config: {
        codebaseChatMode,
        openspecVersion,
      },
    },
  );
  const enhancedAgent: Agent = {
    ...agent,
    prompt: enhancedPrompt,
  };

  const messages: ChatMessage[] = buildInitialMessages(
    enhancedAgent,
    params,
    cacheEnable,
  );
  const allTools = useWorkspaceStore.getState().getCodebaseChatTools() || [];

  const subagentTools = getToolsForAgent(allTools, agent);

  const compressionState: SessionCompressionState = {
    enabled: true,
    compressionHistory: [],
    totalTokensSaved: 0,
    totalCompressionsCount: 0,
  };

  // const resumeResult = await resumeSession(taskId);
  // if (resumeResult) {
  //   // 关键：session.messages 现在包含初始的 user message
  //   // 所以直接替换 messages[1] 之后的所有消息（保留 system prompt）
  //   // 不需要 .slice(1)，因为 resumeResult.messages[0] 就是初始的 user message
  //   messages.splice(1, messages.length - 1, ...resumeResult.messages);
  //   if (resumeResult.compressionState) {
  //     compressionState = resumeResult.compressionState;
  //   }
  // }

  const subagentAuthExtends = useAuthStore.getState().authExtends;
  const subagentChatModels = useChatConfig.getState().chatModels;
  const modelName =
    (llmModel as any).model || (llmModel as any).name || llmModel;
  const isPrivateModel = subagentChatModels[modelName]?.isPrivate || false;

  const terminalCallbacks: TerminalUpdateCallbacks = {
    updateTerminalResult: (params) => {
      debugLog(MODULE, `Terminal result for ${params.terminalId}`, {
        status: params.terminalStatus,
        messageId: params.messageId,
        hasShellIntegration: params.hasShellIntegration,
      });
    },
    updateTerminals: (terminalId, status) => {
      debugLog(MODULE, `Terminal status update for ${terminalId}`, status);
    },
  };

  const enhancedProcessor = createSubagentProcessor(
    undefined,
    terminalCallbacks,
  );

  let step = 0;
  let success = true;
  let error: string | undefined;
  let isTruncated = false;
  let retryCount = 0; // 记录重试次数

  // Token 用量累计器
  const totalUsage: LLMCallUsage = createEmptyUsage();

  // ============ 双重事件发射保证 ============
  // 幂等标记：确保 TASK_COMPLETED 或 TASK_FAILED 事件只发射一次
  let eventEmitted = false;

  /**
   * 幂等事件发射辅助函数
   * 确保事件只发射一次，防止重复发射
   */
  const emitCompletionEvent = (
    isSuccess: boolean,
    taskResult?: TaskResult,
    errorMsg?: string,
  ) => {
    if (eventEmitted) {
      if (import.meta.env.DEV) {
        console.log('[Subagent] Event already emitted, skipping');
      }
      return;
    }
    eventEmitted = true;

    if (isSuccess && taskResult) {
      emitTaskCompleted(parentSessionId, toolCallId, taskId, taskResult);
    } else {
      emitTaskFailed(
        parentSessionId,
        toolCallId,
        errorMsg || 'Unknown error',
        taskId,
      );
    }
  };

  // 外层循环：支持用户 Retry
  let retrying = false;
  do {
    retrying = false;
    try {
      // 主循环
      while (step < maxSteps) {
        // 检查是否已中止
        if (abortController.signal.aborted) {
          error = 'Subagent was aborted';
          success = false;
          break;
        }

        step++;

        const stepCtx: StepHookContext = {
          ...hookCtx,
          step,
          maxSteps,
        };
        await lifecycleManager.trigger('onBeforeStep', stepCtx);

        const preprocessOptions: MessagePreprocessOptions = {
          messages,
          agent,
          model: llmModel,
          tools: subagentTools,
          cacheEnable,
          taskId,
          compressionState,
        };

        const preprocessResult =
          await preprocessSubagentMessages(preprocessOptions);

        const promptData = buildSubagentChatPromptBody(
          preprocessResult,
          llmModel,
          {
            stream: true,
            tool_choice: 'auto',
            temperature: 0,
            taskId,
          },
        );

        const llmResult = await streamChat(
          promptData,
          abortController,
          subagentSpanContext,
        );

        // 检查是否被中断，但要排除正常完成时的 abort（ABORT_REASON_FINISHED）
        // streamChat 返回后，finish() 会调用 abort()，这是正常的资源清理
        // 只有在非 FINISHED 原因的 abort 才认为是真正的中断
        if (abortController.signal.aborted) {
          const abortReason = (abortController.signal as any).reason;
          const isNormalFinish =
            typeof abortReason === 'object' &&
            abortReason !== null &&
            'name' in abortReason &&
            abortReason.name === ABORT_REASON_FINISHED;

          if (!isNormalFinish) {
            error = 'Subagent was aborted during LLM call';
            success = false;
            break;
          }
          // 如果是 ABORT_REASON_FINISHED，说明流正常结束，继续处理结果
        }

        mergeUsage(totalUsage, llmResult.usage);

        const assistantMessage: ChatMessage = {
          role: ChatRole.Assistant,
          content: llmResult.text,
          usage: {
            prompt_tokens: llmResult.usage.promptTokens,
            completion_tokens: llmResult.usage.completionTokens,
            total_tokens: llmResult.usage.totalTokens,
            cache_creation_input_tokens:
              llmResult.usage.cacheCreationInputTokens,
            cache_read_input_tokens: llmResult.usage.cacheReadInputTokens,
          },
        };
        if (llmResult.toolCalls.length > 0) {
          assistantMessage.tool_calls = llmResult.toolCalls;
        }
        // Gemini 模型需要保留 thinking_signature 以支持后续的 function call
        if (llmResult.thinkingSignature) {
          assistantMessage.thinking_signature = llmResult.thinkingSignature;
        }
        messages.push(assistantMessage);

        // 实时更新 store: 追加 LLM 响应的 assistant message
        useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
          const storeMessage: ChatMessage = {
            id: nanoid(),
            role: ChatRole.Assistant,
            content: llmResult.text,
            tool_calls: llmResult.toolCalls?.length > 0 ? llmResult.toolCalls : undefined,
            createdAt: Date.now(),
          } as ChatMessage;
          // Gemini 模型需要保留 thinking_signature
          if (llmResult.thinkingSignature) {
            storeMessage.thinking_signature = llmResult.thinkingSignature;
          }
          draft.messages.push(storeMessage);
        });

        if (llmResult.toolCalls.length === 0) {
          break;
        }

        for (const toolCall of llmResult.toolCalls) {
          if (abortController.signal.aborted) {
            error = 'Subagent was aborted during tool execution';
            success = false;
            break;
          }

          let toolParams: Record<string, any>;
          try {
            toolParams = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            toolParams = {};
          }

          const toolCallCtx: ToolCallHookContext = {
            ...hookCtx,
            toolId: toolCall.id,
            toolName: toolCall.function.name,
            toolArguments: toolCall.function.arguments || '',
          };

          const toolStartTime = Date.now();
          await lifecycleManager.trigger('onBeforeToolCall', toolCallCtx);

          const isFileEditTool = [
            'edit_file',
            'replace_in_file',
            'reapply',
          ].includes(toolCall.function.name);
          if (isFileEditTool) {
            const filePath: string =
              toolParams.target_file || toolParams.path || '';
            const updateSnippet: string =
              toolParams.code_edit || toolParams.diff || '';
            const replaceSnippet: string = toolParams.diff || '';
            const isCreateFile: boolean = toolParams.is_create_file === true;
            useChatApplyStore.getState().setChatApplyItem(toolCall.id, {
              filePath,
              originalContent: '',
              updateSnippet,
              replaceSnippet,
              type:
                toolCall.function.name === 'replace_in_file'
                  ? 'replace'
                  : 'edit',
              toolCallId: toolCall.id,
              applying: true,
              accepted: false,
              isCreateFile,
            });
          }

          const isTerminalTool = toolCall.function.name === 'run_terminal_cmd';
          const extraToolParams = isTerminalTool
            ? { ...toolParams, messageId: toolCall.id }
            : toolParams;

          const toolResultPromise = runnerManager.waitForTool(
            taskId,
            toolCall.id,
            abortController.signal,
            toolCall.function.name,
          );

          debugLog(MODULE, `Registered waitForTool, sending TOOL_CALL`, {
            taskId,
            toolId: toolCall.id,
            toolName: toolCall.function.name,
          });

          let toolSpan: ReturnType<typeof startToolCallSpan> | undefined;
          if (subagentSpanContext) {
            const agentName =
              subagentSpanContext.association?.agentName || 'unknown';
            toolSpan = startToolCallSpan({
              toolName: toolCall.function.name,
              toolId: toolCall.id,
              toolArgs: toolCall.function.arguments || '',
              agentName,
              parentContext: subagentSpanContext.taskContext,
              association: subagentSpanContext.association,
              useSavedContext: false, // subagent 不使用 toolContextDataMap
            });
            toolSpan.setAttribute('subagent.tool.parent_task_id', taskId);
          }

          const { getExecutionStrategy } =
            await import('../../../services/toolExecution/ToolExecutionStrategy');
          const { createSubagentContext } =
            await import('../../../types/executionContext');

          const executionContext = createSubagentContext(toolCall.id, taskId);
          const strategy = getExecutionStrategy(executionContext);
          const shouldAutoExecute = strategy.shouldAutoExecute(
            toolCall,
            executionContext,
          );

          let userConfirmed = true;
          if (!shouldAutoExecute) {
            debugLog(MODULE, `Requesting user confirmation`, {
              taskId,
              toolId: toolCall.id,
              toolName: toolCall.function.name,
            });

            const { useToolConfirmationStore } =
              await import('../store/toolConfirmation');

            try {
              userConfirmed = await useToolConfirmationStore
                .getState()
                .requestConfirmation({
                  taskId,
                  toolId: toolCall.id,
                  toolName: toolCall.function.name,
                  toolParams: toolParams,
                  isDangerous: true,
                  timestamp: Date.now(),
                });

              debugLog(MODULE, `User confirmation result`, {
                taskId,
                toolId: toolCall.id,
                confirmed: userConfirmed,
              });
            } catch (error) {
              debugLog(MODULE, `Failed to get user confirmation`, {
                taskId,
                error: error instanceof Error ? error.message : String(error),
              });
              userConfirmed = false;
            }

            if (!userConfirmed) {
              const rejectionMessage: ChatMessage = {
                role: ChatRole.Tool,
                tool_call_id: toolCall.id,
                content: 'User rejected the tool call',
              };
              messages.push(rejectionMessage);

              continue;
            }
          }

          const finalApproval = shouldAutoExecute || userConfirmed;

          window.parent.postMessage(
            {
              type: 'TOOL_CALL',
              data: {
                tool_name: toolCall.function.name,
                tool_params: {
                  ...extraToolParams,
                  is_approve: finalApproval,
                },
                tool_id: toolCall.id,
                task_id: taskId,
              },
            },
            '*',
          );

          if (!shouldAutoExecute && userConfirmed) {
            debugLog(MODULE, `User confirmed tool execution`, {
              taskId,
              toolId: toolCall.id,
              toolName: toolCall.function.name,
            });
          }

          const toolResult = await toolResultPromise;

          if (toolSpan) {
            const resultContent =
              toolResult?.tool_result?.content || String(toolResult);
            stopToolCallSpan(toolSpan, {
              content: resultContent,
              isError: toolResult?.tool_result?.isError,
              errorMessage: toolResult?.tool_result?.isError
                ? 'Tool execution failed'
                : undefined,
            });
          }

          if (isFileEditTool) {
            const toolResultData = toolResult?.tool_result;
            const extra = toolResult?.extra;
            if (!toolResultData?.isError) {
              useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
                filePath: toolResultData?.path,
                finalResult: extra?.finalResult || '',
                beforeEdit: extra?.beforeEdit,
                diffPatch: extra?.diffPatch || '',
                taskId: extra?.taskId,
                applying: false,
                autoApply: useChatConfig.getState().autoApply,
              });
              const acceptPromise = runnerManager.waitForAcceptEdit(
                toolCall.id,
                abortController.signal,
              );
              useChatApplyStore.getState().acceptEdit(toolCall.id);

              try {
                const acceptResult = await acceptPromise;

                if (!acceptResult?.success) {
                  debugLog(MODULE, 'Accept edit failed', {
                    message: acceptResult?.message,
                  });
                  useChatApplyStore
                    .getState()
                    .updateChatApplyItem(toolCall.id, {
                      applying: false,
                    });
                  userReporter.report({
                    event: getReportEventByToolName({
                      toolName: toolCall.function.name,
                      status: 1,
                    }),
                    extends: {
                      filePath: toolResultData?.path,
                      beforeEdit: extra?.beforeEdit,
                      editSnippet: extra?.editSnippet,
                      replaceSnippet: extra?.replaceSnippet,
                      taskId: extra?.taskId,
                      tool_id: toolCall.id,
                      tool_name: toolCall.function.name,
                      source: 'subagent',
                      agent_name: agent.name,
                      error: acceptResult?.message,
                    },
                  });
                } else {
                  const applyItem = useChatApplyStore
                    .getState()
                    .getChatApplyItem(toolCall.id);
                  if (applyItem) {
                    useChatApplyStore
                      .getState()
                      .handleAcceptEditSuccess(applyItem);
                  }
                }
              } catch (acceptError) {
                debugLog(MODULE, 'Accept edit error', {
                  error:
                    acceptError instanceof Error
                      ? acceptError.message
                      : String(acceptError),
                });
                useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
                  applying: false,
                });
                if (abortController.signal.aborted) {
                  throw acceptError;
                }
              }

              userReporter.report({
                event: getReportEventByToolName({
                  toolName: toolCall.function.name,
                  status: 1,
                }),
                extends: {
                  filePath: toolResultData?.path,
                  finalResult: extra?.finalResult || '',
                  beforeEdit: extra?.beforeEdit,
                  editSnippet: extra?.editSnippet,
                  replaceSnippet: extra?.replaceSnippet,
                  taskId: extra?.taskId,
                  tool_id: toolCall.id,
                  tool_name: toolCall.function.name,
                  source: 'subagent',
                  agent_name: agent.name,
                },
              });
            } else {
              useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
                applying: false,
              });

              userReporter.report({
                event: getReportEventByToolName({
                  toolName: toolCall.function.name,
                  status: 1,
                }),
                extends: {
                  filePath: toolResult?.tool_result?.path,
                  beforeEdit: toolResult?.extra?.beforeEdit,
                  editSnippet: toolResult?.extra?.editSnippet,
                  replaceSnippet: toolResult?.extra?.replaceSnippet,
                  taskId: toolResult?.extra?.taskId,
                  tool_id: toolCall.id,
                  tool_name: toolCall.function.name,
                  source: 'subagent',
                  agent_name: agent.name,
                },
              });
            }
          }

          const toolResultCtx: ToolResultHookContext = {
            ...toolCallCtx,
            duration: Date.now() - toolStartTime,
          };
          await lifecycleManager.trigger('onAfterToolCall', toolResultCtx);

          let processedContent: string;

          try {
            const toolResultInput: ToolResultInput = {
              tool_id: toolCall.id,
              tool_name: toolCall.function.name,
              tool_result: {
                content: toolResult?.tool_result?.content,
                path: toolResult?.tool_result?.path,
                isError: toolResult?.tool_result?.isError,
              },
              extra: toolResult?.extra,
              task_id: taskId,
            };

            const processContext: ToolResultProcessContext = {
              session: {
                _id: taskId,
                data: {
                  enablePlanMode: false,
                  messages,
                },
              } as any,
              model: llmModel,
              source: 'subagent',
              cUnrestrict: subagentAuthExtends?.c_unrestrict || false,
              isPrivateModel,
              allowPublicModelAccess:
                useWorkspaceStore.getState().devSpace.allow_public_model_access,
              authExtends: subagentAuthExtends,
            };

            const processed = await enhancedProcessor.process(
              toolResultInput,
              processContext,
            );
            processedContent = processed?.content || '';
          } catch (processingError) {
            debugLog(MODULE, 'Tool result processing error', {
              error:
                processingError instanceof Error
                  ? processingError.message
                  : String(processingError),
            });

            const fallbackContent =
              toolResult?.tool_result?.content ?? JSON.stringify(toolResult);
            processedContent =
              typeof fallbackContent === 'string'
                ? fallbackContent
                : JSON.stringify(fallbackContent);
          }

          const toolMessage: ChatMessage = {
            role: ChatRole.Tool,
            content: processedContent,
            tool_call_id: toolCall.id,
          };
          messages.push(toolMessage);

          // 实时更新 store: 追加工具调用结果 message
          useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
            draft.messages.push({
              id: nanoid(),
              role: ChatRole.Tool,
              content: processedContent,
              tool_call_id: toolCall.id,
              createdAt: Date.now(),
            } as ChatMessage);
          });
        }

        if (!success) break;

        // ============================================================
        // 压缩检查：与主 agent 保持一致
        // ============================================================
        // 关键设计：
        // 1. 从 store 获取 session.messages（不含 system prompt）
        // 2. checkAndCompress 分析的是原始 session.messages，不含 cache marks
        // 3. 压缩后需要同步更新 session.messages 和 messages 数组

        // 从 store 获取最新的 session.messages
        const session = useSubagentStore.getState().getSubagentSession(taskId);
        const sessionMessages = session?.messages || [];

        const compressionCheck = await checkAndCompress(
          sessionMessages, // 使用 session.messages，不含 system prompt
          llmModel,
          taskId,
          codebaseModelMaxTokens[llmModel] ?? 200000,
          subagentTools,
          compressionState,
          subagentSpanContext,
          abortController.signal, // 传递 abort signal，支持中止压缩
        );

        debugLog(MODULE, 'Compression check result', {
          taskId,
          result: compressionCheck,
        });

        if (compressionCheck.compressed) {
          // 步骤2：标记被压缩的消息 isCompressed=true / isOutdatedTokens=true
          // 与主 agent markMessagesAsCompressed 逻辑保持一致
          // 对消息数组做浅拷贝，避免直接修改被 Immer/freeze 冻结的对象
          const finalMessages = compressionCheck.messages.map((msg) => ({
            ...msg,
          }));
          if (compressionCheck.compressedMessageIds?.size) {
            let maxCompressedIdx = 0;
            for (let i = 0; i < finalMessages.length; i++) {
              const key = `${finalMessages[i].id}-${finalMessages[i].role}`;
              if (compressionCheck.compressedMessageIds.has(key)) {
                finalMessages[i].isCompressed = true;
                finalMessages[i].isOutdatedTokens = true;
                maxCompressedIdx = i;
              }
            }
            // 步骤3：被压缩消息之后的消息也标记 isOutdatedTokens=true
            for (let i = maxCompressedIdx + 1; i < finalMessages.length; i++) {
              finalMessages[i].isOutdatedTokens = true;
            }
          }

          // 同步更新 session.messages（已标记 isCompressed / isOutdatedTokens）
          useSubagentStore.getState().updateSubagentSession(taskId, {
            messages: finalMessages,
          });

          // 同步更新运行时 messages 数组
          // 1. 保留 system prompt（第一条消息，role === 'system'）
          // 2. 保留第一条 user message（如果被压缩了，避免丢失任务上下文）
          // 3. 用压缩后的 session.messages 替换后续所有消息
          const systemMessage = messages.find(
            (msg) => msg.role === ChatRole.System,
          );
          const firstUserMessage = messages.find(
            (msg) => msg.role === ChatRole.User && !msg.tool_result,
          );

          // 检查第一条 user message 是否在 finalMessages 中
          const firstUserInFinal =
            firstUserMessage &&
            finalMessages.some(
              (msg) =>
                msg.id === firstUserMessage.id ||
                (msg.role === ChatRole.User &&
                  !msg.tool_result &&
                  !msg.isCompressionSummary),
            );

          if (systemMessage && firstUserMessage && !firstUserInFinal) {
            // 第一条 user message 被压缩了，需要保留
            messages.splice(
              0,
              messages.length,
              systemMessage,
              firstUserMessage,
              ...finalMessages,
            );
          } else if (systemMessage) {
            messages.splice(
              0,
              messages.length,
              systemMessage,
              ...finalMessages,
            );
          } else {
            // 没有 system prompt（理论上不应该发生，但做防御性处理）
            messages.splice(0, messages.length, ...finalMessages);
          }

          // 更新压缩状态
          compressionState.totalCompressionsCount += 1;
          const tokensSaved =
            (compressionCheck.tokensBefore ?? 0) -
            (compressionCheck.tokensAfter ?? 0);
          compressionState.totalTokensSaved += tokensSaved;
          compressionState.compressionHistory.push({
            timestamp: Date.now(),
            originalMessageCount: sessionMessages.length,
            tokensSaved,
            compressionRatio: compressionCheck.tokensBefore
              ? (compressionCheck.tokensAfter ?? 0) /
                compressionCheck.tokensBefore
              : 1,
          });
        }

        debugLog(MODULE, `Step ${step} completed`, {
          taskId,
          totalMessages: messages.length,
          lastFiveRoles: messages.slice(-5).map((m) => m.role),
          hasToolCalls: llmResult.toolCalls.length > 0,
          compressed: compressionCheck.compressed,
        });

        const systemPromptContent = messages
          .filter((msg) => msg.role === ChatRole.System)
          .map((msg) =>
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content),
          )
          .join('\n');

        const skillsMatch = systemPromptContent.match(
          /<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g,
        );
        const rulesMatch = systemPromptContent.match(
          /<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g,
        );
        const mcpMatch = systemPromptContent.match(
          /<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g,
        );

        const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
        const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
        const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

        const systemTokenEstimation = estimateChildSessionSystemTokens(
          systemPromptContent,
          skillsContent ? [skillsContent] : [],
          rulesContent ? [rulesContent] : [],
          mcpContent ? [mcpContent] : [],
        );

        const enhancedUsage = {
          ...totalUsage,
          systemTokens: systemTokenEstimation.systemTokens,
          skillTokens: systemTokenEstimation.skillTokens,
          ruleTokens: systemTokenEstimation.ruleTokens,
          mcpTokens: systemTokenEstimation.mcpTokens,
        };

        localConsumedTokens = await syncSession(
          taskId,
          agent.name,
          params.description,
          messages,
          llmModel,
          enhancedUsage,
          createInitialConsumedTokens(),
          compressionState,
        );

        // 同步 consumedTokens 到 store，使 UI 能实时显示 token 统计
        useSubagentStore.getState().updateSubagentSession(taskId, {
          consumedTokens: localConsumedTokens,
        });

        await lifecycleManager.trigger('onAfterStep', stepCtx, totalUsage);
      }

      if (step >= maxSteps && success) {
        debugLog(
          MODULE,
          `Reached maxSteps (${maxSteps}), initiating force summary`,
          { taskId },
        );
        isTruncated = true;

        try {
          const summaryRequestMessage: ChatMessage = {
            role: ChatRole.User,
            hidden: true,
            content: `You have reached the maximum number of steps (${maxSteps}) while working on the task below.



Now provide a structured handoff summary so that another agent can seamlessly continue your work. Follow this format EXACTLY:

---

## Status: [COMPLETED / PARTIALLY_COMPLETED / BARELY_STARTED]

## Completion Estimate: [X]%

## What Has Been Accomplished
For each sub-task or requirement listed in the original task, state what was done:
- **[Sub-task name/topic]**: [What was found, decided, or produced. Include specific file paths, code snippets, key data points, or conclusions. Do NOT paraphrase vaguely — be concrete.]
- ...
(Cover every sub-task that was touched, even partially. If you read a file and learned something relevant, include that finding here.)

## Key Discoveries & Context
List specific, non-obvious findings that would be lost if not recorded here:
- [Finding 1: e.g., "src/store/chat.ts uses a flat array for messages, not normalized — this means compression must happen at the array level"]
- [Finding 2: ...]
(These are facts, observations, or gotchas discovered during exploration. Only include things that are NOT obvious from reading the task description alone.)

## What Remains To Be Done
For each sub-task or requirement NOT yet completed:
- **[Sub-task name/topic]**: [What specifically still needs to happen. If you already have a partial plan or know the right approach, state it.]
- ...

## Recommended Next Steps (Ordered)
Provide a concrete, actionable sequence that the next agent should follow:
1. [First action — be specific: which file to read, which search to run, which function to implement]
2. [Second action]
3. ...
(These should be immediately executable instructions, not general advice.)

## Artifacts Produced
List any files created, modified, or code written during this session:
- [File path or artifact]: [Current state — complete/partial/draft]
(If none, write "None".)

---

IMPORTANT RULES:
- Reference specific file paths, function names, variable names, and line numbers whenever possible.
- Do NOT repeat the original task requirements back to me — only report on actual progress and findings.
- Do NOT pad with generic observations. Every sentence should contain information that would be LOST if not captured here.
- Keep the total response under 800 words. Prioritize information density over completeness of prose.`,
          };
          messages.push(summaryRequestMessage);

          const preprocessOptions: MessagePreprocessOptions = {
            messages,
            agent,
            model: llmModel,
            tools: subagentTools,
            cacheEnable,
            taskId,
            compressionState,
          };

          const preprocessResult =
            await preprocessSubagentMessages(preprocessOptions);

          const summaryPromptData = buildSubagentChatPromptBody(
            preprocessResult,
            llmModel,
            {
              stream: true,
              tool_choice: 'none',
              temperature: 0,
              taskId,
            },
          );

          const summaryResult = await streamChat(
            summaryPromptData,
            abortController,
          );

          mergeUsage(totalUsage, summaryResult.usage);

          const summaryAssistantMessage: ChatMessage = {
            id: nanoid(),
            role: ChatRole.Assistant,
            content: summaryResult.text,
            createdAt: Date.now(),
            usage: {
              prompt_tokens: summaryResult.usage.promptTokens,
              completion_tokens: summaryResult.usage.completionTokens,
              total_tokens: summaryResult.usage.totalTokens,
              cache_creation_input_tokens:
                summaryResult.usage.cacheCreationInputTokens,
              cache_read_input_tokens: summaryResult.usage.cacheReadInputTokens,
            },
          };
          messages.push(summaryAssistantMessage);

          // 实时更新 store: 追加强制摘要的 assistant message（使用相同的消息对象）
          useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
            draft.messages.push(summaryAssistantMessage);
          });

          debugLog(MODULE, `Force summary completed`, {
            taskId,
            summaryLength: summaryResult.text.length,
            usage: summaryResult.usage,
          });
        } catch (summaryError) {
          debugLog(
            MODULE,
            `Force summary failed, falling back to last assistant message`,
            {
              taskId,
              error:
                summaryError instanceof Error
                  ? summaryError.message
                  : String(summaryError),
            },
          );
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      debugLog(MODULE, `Error`, {
        taskId,
        error: err instanceof Error ? err.message : String(err),
      });
      error = errorMsg;
      success = false;

      if (abortController.signal.aborted) {
        error = 'Subagent was aborted';
      }

      // 将错误信息保存到 session messages 中，确保 UI 能持久显示错误
      const finalErrorMsg = abortController.signal.aborted
        ? 'Subagent was aborted'
        : errorMsg;

      // 构造错误消息
      const errorMessage: ChatMessage = {
        id: nanoid(),
        role: ChatRole.Assistant,
        content: `[Error] ${finalErrorMsg}`,
        createdAt: Date.now(),
        isError: true,
      } as ChatMessage;

      // 更新 store
      useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
        draft.messages.push(errorMessage);
        draft.error = finalErrorMsg;
        draft.status = 'failed';
      });

      // 同步到后端（关键：确保错误信息持久化）
      messages.push(errorMessage);
      try {
        await syncSession(
          taskId,
          agent.name,
          params.description,
          messages,
          llmModel,
          totalUsage,
          localConsumedTokens,
          compressionState,
        );
      } catch (syncErr) {
        console.warn(
          '[Subagent] Failed to sync error state to backend:',
          syncErr,
        );
      }

      if (subagentSpanContext) {
        subagentSpanContext.taskSpan.setStatus(SpanStatusCode.ERROR, errorMsg);
      }

      await lifecycleManager.trigger(
        'onError',
        hookCtx,
        err instanceof Error ? err : new Error(String(err)),
      );

      if (!abortController.signal.aborted) {
        // ✅ 用户操作等待超时（30 分钟），超时后默认选择 Stop
        const USER_ACTION_TIMEOUT_MS = 30 * 60 * 1000;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const doRetry = await Promise.race([
          new Promise<boolean>((resolve) => {
            // 包装 resolve，在用户操作完成时清除超时定时器并清理 Map
            const wrappedResolve = (value: boolean) => {
              // 清理 pendingUserActions 中的条目
              pendingUserActions.delete(toolCallId);
              // 清除超时定时器
              if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              resolve(value);
            };
            pendingUserActions.set(toolCallId, { resolve: wrappedResolve });
          }),
          new Promise<boolean>((resolve) => {
            timeoutId = setTimeout(() => {
              timeoutId = null;
              // 超时时清理 pending 状态
              if (pendingUserActions.has(toolCallId)) {
                pendingUserActions.delete(toolCallId);
                console.warn(
                  `[Subagent] User action timeout for ${toolCallId}, defaulting to Stop`,
                );
              }
              resolve(false); // 超时默认选择 Stop
            }, USER_ACTION_TIMEOUT_MS);
          }),
        ]);

        if (doRetry) {
          // 用户选择 Retry，清除错误状态和错误消息
          retryCount++;

          debugLog(MODULE, 'User chose to retry, cleaning up error state', {
            taskId,
            toolCallId,
            retryCount,
            currentStep: step,
            messagesBeforeCleanup: messages.length,
          });

          // 1. 从本地 messages 数组中移除最后添加的错误消息
          // 注意：只移除最后一条错误消息（刚刚添加的那条）
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.isError) {
            messages.pop();
          }

          // 2. 从 store 中移除错误消息和错误状态
          useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
            // 移除最后一条错误消息
            const lastMsg = draft.messages[draft.messages.length - 1];
            if (lastMsg && lastMsg.isError) {
              draft.messages.pop();
            }
            // 清除错误状态
            draft.error = undefined;
            draft.status = 'running';
          });

          // 3. 更新 UI 状态
          useSubagentStore.getState().updateStatus(toolCallId, {
            parentSessionId,
            status: 'running' as SubagentStatus,
            errorMessage: undefined,
          });

          // 4. 重置变量（保持 step 累加，防止无限重试）
          success = true;
          error = undefined;
          // 注意：step 不重置，继续累加以防止无限重试
          // 如果需要重置 step，可以在这里设置 step = 0

          // 5. 创建新的 AbortController
          const newAbortController = new AbortController();
          abortController = newAbortController;
          runnerState.abortController = newAbortController;
          runnerManager.register(taskId, {
            ...runnerState,
            abortController: newAbortController,
          });

          // 6. 重新绑定父级 abort（使用具名函数避免监听器泄漏）
          // ✅ 更新 onParentAbort 引用指向新的 controller
          if (parentAbortSignal) {
            parentAbortSignal.removeEventListener('abort', onParentAbort);
            // 重新定义 onParentAbort 以使用新的 abortController
            onParentAbort = () => {
              newAbortController.abort();
            };
            parentAbortSignal.addEventListener('abort', onParentAbort, {
              once: true,
            });
          }

          debugLog(MODULE, 'Retry setup complete', {
            taskId,
            retryCount,
            messagesAfterCleanup: messages.length,
            willContinueFromStep: step + 1,
          });

          retrying = true;
        } else {
          // 用户选择 Stop，更新主 agent 的 tool_result
          const errorTaskStatus = TaskStatus.Failed;
          const errorOutput = formatTaskResult({
            id: taskId,
            description: params.description || params.prompt,
            status: errorTaskStatus,
            messages,
            error: finalErrorMsg,
            abortReason: undefined,
            agent: agent.name,
            steps: step,
          });

          useChatStreamStore.getState().updateToolCallResults({
            [toolCallId]: {
              path: '',
              content: errorOutput,
              isError: true,
              extra: {
                isTruncated: false,
              },
            },
          });

          abortController.abort();
        }
      } else {
        // 已经被中断（用户主动中止），更新主 agent 的 tool_result
        const errorTaskStatus = TaskStatus.Aborted;
        const errorOutput = formatTaskResult({
          id: taskId,
          description: params.description || params.prompt,
          status: errorTaskStatus,
          messages,
          error: finalErrorMsg,
          abortReason: 'Request interrupted by user for tool use.',
          agent: agent.name,
          steps: step,
        });

        useChatStreamStore.getState().updateToolCallResults({
          [toolCallId]: {
            path: '',
            content: errorOutput,
            isError: true,
            extra: {
              isTruncated: false,
            },
          },
        });
      }
    } finally {
      if (subagentSpanContext && !retrying) {
        subagentSpanContext.taskSpan.setAttribute(
          'subagent.actual_steps',
          step,
        );
        subagentSpanContext.taskSpan.setAttribute(
          'subagent.is_truncated',
          isTruncated,
        );
        if (!error) {
          subagentSpanContext.taskSpan.setStatus(SpanStatusCode.OK);
        }
        subagentSpanContext.taskSpan.end();
      }

      if (!retrying) {
        const systemPromptContent = messages
          .filter((msg) => msg.role === ChatRole.System)
          .map((msg) =>
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content),
          )
          .join('\n');

        const skillsMatch = systemPromptContent.match(
          /<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g,
        );
        const rulesMatch = systemPromptContent.match(
          /<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g,
        );
        const mcpMatch = systemPromptContent.match(
          /<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g,
        );

        const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
        const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
        const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

        const systemTokenEstimation = estimateChildSessionSystemTokens(
          systemPromptContent,
          skillsContent ? [skillsContent] : [],
          rulesContent ? [rulesContent] : [],
          mcpContent ? [mcpContent] : [],
        );

        const finalEnhancedUsage = {
          ...totalUsage,
          systemTokens: systemTokenEstimation.systemTokens,
          skillTokens: systemTokenEstimation.skillTokens,
          ruleTokens: systemTokenEstimation.ruleTokens,
          mcpTokens: systemTokenEstimation.mcpTokens,
        };

        localConsumedTokens = await syncSession(
          taskId,
          agent.name,
          params.description,
          messages,
          llmModel,
          finalEnhancedUsage,
          createInitialConsumedTokens(),
          compressionState,
        );

        // 同步 consumedTokens 到 store，使 UI 能实时显示 token 统计
        useSubagentStore.getState().updateSubagentSession(taskId, {
          consumedTokens: localConsumedTokens,
        });

        if (
          finalEnhancedUsage.promptTokens > 0 ||
          finalEnhancedUsage.completionTokens > 0
        ) {
          const chatStoreState = useChatStore.getState();
          const curSession = chatStoreState.sessions.get(parentSessionId);
          if (curSession?.data?.consumedTokens) {
            const ct = curSession.data.consumedTokens;
            if (!ct.children) {
              ct.children = createEmptyChildSessions();
            }
            const modelCostInfo =
              useChatConfig.getState().chatModels?.[llmModel as ChatModel]
                ?.priceInfo;

            const tokenIncrement: TokenIncrement = {
              promptTokens: finalEnhancedUsage.promptTokens,
              completionTokens: finalEnhancedUsage.completionTokens,
              cacheCreationInputTokens:
                finalEnhancedUsage.cacheCreationInputTokens,
              cacheReadInputTokens: finalEnhancedUsage.cacheReadInputTokens,
              systemTokens: finalEnhancedUsage.systemTokens,
              skillTokens: finalEnhancedUsage.skillTokens,
              ruleTokens: finalEnhancedUsage.ruleTokens,
              mcpTokens: finalEnhancedUsage.mcpTokens,
            };

            ct.children = updateChildSession(
              ct.children,
              taskId,
              SessionType.SUBAGENT,
              agent.name,
              tokenIncrement,
              {
                agentType: agent.name,
                model: llmModel,
                steps: step,
                description: params.description,
              },
              llmModel,
              modelCostInfo,
            );
          } else {
            debugLog(MODULE, `Session not found for token update`, {
              parentSessionId,
            });
          }
        }

        if (cacheEnable) {
          debugLog(MODULE, `Cache summary`, {
            taskId,
            totalSteps: step,
            totalCacheCreation: totalUsage.cacheCreationInputTokens,
            totalCacheRead: totalUsage.cacheReadInputTokens,
            totalPromptTokens: totalUsage.promptTokens,
            totalCompletionTokens: totalUsage.completionTokens,
            overallCacheHitRate:
              totalUsage.cacheReadInputTokens > 0
                ? `${((totalUsage.cacheReadInputTokens / (totalUsage.cacheReadInputTokens + totalUsage.promptTokens)) * 100).toFixed(1)}%`
                : '0%',
            estimatedSavings:
              totalUsage.cacheReadInputTokens > 0
                ? `${totalUsage.cacheReadInputTokens} tokens (90% discount)`
                : '0 tokens',
          });
        }

        const completeCtx: CompleteHookContext = {
          ...hookCtx,
          success,
          step,
          error,
          isAborted: abortController.signal.aborted,
        };
        await lifecycleManager.trigger('onComplete', completeCtx);

        runnerManager.remove(taskId);

        if (parentAbortSignal) {
          parentAbortSignal.removeEventListener('abort', onParentAbort);
        }
      }
    }
  } while (retrying);

  // ============ 包装在 try-finally 中确保事件必定发出 ============
  try {
    let taskStatus: TaskStatus;
    // 检查 abort 状态，但要区分正常完成（ABORT_REASON_FINISHED）和真正中断
    if (abortController.signal.aborted) {
      const abortReason = (abortController.signal as any).reason;
      const isNormalFinish = abortReason?.name === ABORT_REASON_FINISHED;

      if (isNormalFinish && success) {
        // 如果是正常完成的 abort 且成功，按成功处理
        taskStatus = isTruncated ? TaskStatus.Truncated : TaskStatus.Success;
      } else if (!success && error) {
        // 执行报错后用户点击"停止"，保留失败状态和错误信息
        taskStatus = TaskStatus.Failed;
      } else {
        // 其他情况才是真正的中断（如执行中用户主动中止）
        taskStatus = TaskStatus.Aborted;
      }
    } else if (!success && error) {
      taskStatus = TaskStatus.Failed;
    } else if (isTruncated) {
      taskStatus = TaskStatus.Truncated;
    } else {
      taskStatus = TaskStatus.Success;
    }

    const output = formatTaskResult({
      id: taskId,
      description: params.description || params.prompt,
      status: taskStatus,
      messages,
      error,
      abortReason:
        abortController.signal.aborted && taskStatus === TaskStatus.Aborted
          ? 'Request interrupted by user for tool use.'
          : undefined,
      agent: agent.name,
      steps: step,
    });

    const result: TaskResult = {
      taskId,
      output,
      success,
      error,
      isAborted: abortController.signal.aborted,
      isTruncated,
      agentName: agent.name,
      description: params.description,
    };

    // ✅ 使用幂等辅助函数发射完成/失败事件
    emitCompletionEvent(success, result, error);

    return result;
  } finally {
    // ============ 双重事件发射保证：finally 块兜底 ============
    // 如果到达这里事件还没发射，说明发生了意外情况
    if (!eventEmitted) {
      console.error(
        '[Subagent] Event not emitted in normal flow, forcing failure event',
        { taskId, toolCallId, parentSessionId },
      );
      emitCompletionEvent(
        false,
        undefined,
        error || 'Unexpected execution termination',
      );
    }
  }
}