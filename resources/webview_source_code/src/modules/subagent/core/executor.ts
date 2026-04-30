/**
 * Subagent Executor —— 子代理主执行循环
 *
 * 负责：
 * - 查找 Agent 定义
 * - 创建/恢复后端子会话
 * - 注册运行时状态
 * - 构建 messages 和 tools
 * - 循环调用 LLM，处理 tool_calls
 * - 通过 LifecycleManager 触发生命周期钩子
 * - 格式化返回 <task_result>
 */

import type {
  TaskParams,
  TaskResult,
  RunSubagentContext,
  SubagentRunnerState,
  LLMCallUsage,
  Agent,
  SubagentStatus,
} from '../types';
import type { SessionCompressionState } from '../../../types/contextCompression';

// ============================================================
// 用户操作等待池（Retry / Stop）
// ============================================================

/**
 * 等待用户对 failed subagent 的操作（retry 或 stop）。
 * key = toolCallId
 */
const pendingUserActions = new Map<
  string,
  { resolve: (doRetry: boolean) => void }
>();

/**
 * 触发指定 subagent 重试（基于现有 task_id 恢复会话继续执行）。
 * 由 UI Retry 按钮调用。
 */
export function retrySubagent(toolCallId: string): void {
  const pending = pendingUserActions.get(toolCallId);
  if (pending) {
    pending.resolve(true);
    pendingUserActions.delete(toolCallId);
  }
}

/**
 * 触发指定 subagent 停止（标记为 aborted，主 agent 继续）。
 * 由 UI Stop 按钮调用。
 */
export function stopFailedSubagent(toolCallId: string): void {
  const pending = pendingUserActions.get(toolCallId);
  if (pending) {
    pending.resolve(false);
    pendingUserActions.delete(toolCallId);
  }
}
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
  validateToolResults,
  ChatRole,
} from '../utils';
import type { ChatMessage } from '../utils';
import { createNewSession, resumeSession, syncSession } from './session';
import { callSubagentLLM, createEmptyUsage, addUsage } from './llm';
import {
  createEmptySubagentTokens,
  mergeSubagentUsageIntoTokens,
  estimateSubagentSystemTokens,
} from '../../../utils/subagentTokens';
import { checkAndCompress } from './compression';
import { useChatConfig } from '../../../store/chat-config';
import { useAuthStore } from '../../../store/auth';
import { useWorkspaceStore } from '../../../store/workspace';
import { useChatStore } from '../../../store/chat';
import { useChatApplyStore } from '../../../store/chatApply';
import { ChatModel } from '../../../services/chatModel';
import {
  createSubagentProcessor,
  type ToolResultInput,
  type ToolResultProcessContext,
  type TerminalUpdateCallbacks
} from '../../tool-result-processor';
import { normalizeSystemContent, SystemPromptFormatter } from '../utils/systemPromptFormatter';
import {
  preprocessSubagentMessages,
  buildSubagentChatPromptBody,
  type MessagePreprocessOptions,
} from './message-preprocessor';
import userReporter from '../../../utils/report';
import { UserEvent } from '../../../types/report';
import { getAIGWModelWithFallback, getAIGWModel } from './../../../store/chat-config';
import { promptBuilder } from './prompt-builder';

// ============================================================
// Subagent System Prompt 前置注入
// ============================================================

/**
 * 为 Subagent 的 system prompt 追加运行时上下文片段：
 * - search_and_reading
 * - making_code_changes
 * - run_terminal_cmd
 * - user_info
 *
 * 参考 constructRemixPrompt.ts 中的对应实现。
 */
function buildSubagentSystemPrompt(
  basePrompt: string,
  agentType?: string,
): string {
  return promptBuilder.buildSystemPrompt(basePrompt, agentType);
}

/**
 * 转换 Claude 简化模型名称到具体的 ChatModel 代码
 * @param modelName 可能是简化名称（sonnet, opus, haiku, inherit）或完整的模型代码
 * @returns 转换后的模型代码，如果不是简化名称则原样返回
 */
function resolveClaudeModelName(modelName: string): string {
  const claudeModelMap: Record<string, ChatModel> = {
    sonnet: ChatModel.Claude45Sonnet20250929,
    opus: ChatModel.Claude45Opus20251101,
    haiku: ChatModel.Claude45Haiku20251001,
  };

  // 如果是预定义的简化名称，返回对应的完整模型代码
  if (claudeModelMap[modelName]) {
    return claudeModelMap[modelName];
  }

  // 如果是 inherit，返回空字符串，表示使用系统配置
  if (modelName === 'inherit') {
    return '';
  }

  // 否则原样返回（可能已经是完整的模型代码）
  return modelName;
}

// ============================================================
// 主执行入口
// ============================================================

/**
 * 运行子代理的完整对话循环。
 */
export async function runSubagent(
  params: TaskParams,
  context: RunSubagentContext,
): Promise<TaskResult> {
  // 检查 Subagent 功能是否启用
  const subagentEnable = useExtensionStore.getState().subagentEnable;
  if (!subagentEnable) {
    return {
      taskId: '',
      output: 'Subagent functionality is disabled',
      success: false,
      error: 'Subagent functionality is disabled',
    };
  }

  // 1. 查找 Agent 定义 - 使用 store 中的完整列表（包括自定义 agent）
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

  // 整体通过调度器控制并发，传入任务信息用于 UI 展示排队状态
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

/**
 * 子代理内部执行逻辑，由 scheduler.schedule() 调度。
 */
async function runSubagentInner(
  params: TaskParams,
  agent: Agent,
  context: RunSubagentContext,
): Promise<TaskResult> {
  const { parentSessionId, parentAbortSignal, toolCallId } = context;

  // 优先使用 agent 定义的 model，否则使用用户配置
  let llmModel: ChatModel;
  const agentDefinedModel = agent.model
    ? resolveClaudeModelName(agent.model)
    : '';

  if (!agentDefinedModel) {
    // agent 未指定模型或指定了 inherit，使用系统配置的模型
    // 先通过 getAIGWModel 把 code 转换为实际使用的模型（useModel）
    const actualModel = getAIGWModel(useChatConfig.getState().config.model);
    llmModel = getAIGWModelWithFallback(
      actualModel,
      ChatModel.Claude45Sonnet20250929, // 使用最新的 Claude 4.5 Sonnet 作为默认
    );
  } else {
    // agent 指定了具体模型（已经过 Claude 名称转换）
    // agentDefinedModel 已经是实际使用的模型格式，直接传入
    llmModel = getAIGWModelWithFallback(
      agentDefinedModel as ChatModel,
      ChatModel.Claude45Sonnet20250929,
    );
  }

  // Cache 支持检测
  let cacheEnable = false;
  const chatModels = useChatConfig.getState().chatModels;
  const codebaseModelMaxTokens = useChatConfig.getState().codebaseModelMaxTokens;
  if (chatModels[llmModel]?.hasTokenCache) {
    if (codebaseModelMaxTokens[llmModel] > 64 * 1000) {
      cacheEnable = true;
    }
  }

  console.log(`[Subagent] ${params.subagent_type} cache configuration:`, {
    model: llmModel,
    hasTokenCache: chatModels[llmModel]?.hasTokenCache,
    maxTokens: codebaseModelMaxTokens[llmModel],
    cacheEnable,
  });

  // 会话恢复 or 新建
  let taskId: string;
  let resumedMessages: ChatMessage[] | null = null;

  if (params.task_id) {
    // 尝试从后端恢复历史会话
    const historyMessages = await resumeSession(params.task_id);
    if (historyMessages) {
      // 验证工具结果是否过期
      resumedMessages = validateToolResults(historyMessages);
      taskId = params.task_id;

      // 触发 onResume 钩子
      const hookCtx: HookContext = {
        taskId,
        toolCallId,
        agentName: agent.name,
        parentSessionId,
      };
      await lifecycleManager.trigger(
        'onResume',
        hookCtx,
        resumedMessages.length,
      );
    } else {
      taskId = await createNewSession(agent, params, parentSessionId, llmModel);
    }
  } else {
    taskId = await createNewSession(agent, params, parentSessionId, llmModel);
  }

  // 3. 创建 AbortController 并注册运行时状态
  // 使用 let 以便 Retry 时可以创建新的 controller
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

  // 创建钩子上下文
  const hookCtx: HookContext = {
    taskId,
    toolCallId,
    agentName: agent.name,
    parentSessionId,
  };

  // 触发 onStart 钩子
  await lifecycleManager.trigger('onStart', hookCtx, {
    taskId,
    agentName: agent.name,
    step: 0,
    maxSteps,
    status: 'pending' as SubagentStatus,
    description: params.description,
    model: llmModel,
    startTime: Date.now(),
    toolCalls: [],
  });

  // 子代理状态应该由 subagent store 管理，不再在这里维护全局计数

  // 主 agent 中止时联动中止子代理
  // 使用间接引用，以便 Retry 时 abortController 更新后仍能正确中止
  const onParentAbort = () => {
    abortController.abort();
  };
  if (parentAbortSignal) {
    parentAbortSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  // 4. 构建 messages 和 tools
  // 对 agent 的 prompt 做前置处理，注入 search_and_reading / making_code_changes /
  // run_terminal_cmd / user_info 等上下文片段
  const enhancedAgent: Agent = {
    ...agent,
    prompt: buildSubagentSystemPrompt(agent.prompt, agent.name),
  };
  let messages: ChatMessage[];
  if (resumedMessages) {
    // Resume 时需要规范化 system message 格式，确保与当前 cacheEnable 配置一致
    messages = [...resumedMessages, { role: ChatRole.User, content: params.prompt }];

    const firstSystemMsg = messages.find((m) => m.role === ChatRole.System);
    if (firstSystemMsg) {
      const originalContent = firstSystemMsg.content;
      firstSystemMsg.content = normalizeSystemContent(originalContent, cacheEnable);

      // 日志：格式转换统计
      if (cacheEnable && typeof originalContent === 'string') {
        const stats = SystemPromptFormatter.getStats(firstSystemMsg.content);
        if (stats.format === 'tiered') {
          console.log(`[Subagent Cache] ${taskId} Normalized resumed system message:`, stats);
        }
      }
    }
  } else {
    messages = buildInitialMessages(enhancedAgent, params, cacheEnable);
  }
  const allTools = useWorkspaceStore.getState().getCodebaseChatTools() || [];

  const subagentTools = getToolsForAgent(allTools, agent);

  // 获取认证信息和模型配置
  const subagentAuthExtends = useAuthStore.getState().authExtends;
  const subagentChatModels = useChatConfig.getState().chatModels;
  const modelName = (llmModel as any).model || (llmModel as any).name || llmModel;
  const isPrivateModel = subagentChatModels[modelName]?.isPrivate || false;

  const terminalCallbacks: TerminalUpdateCallbacks = {
    updateTerminalResult: (params) => {
      // Subagent 的终端结果通过事件系统通知主 agent
      console.log(`[Subagent] Terminal result for ${params.terminalId}:`, {
        status: params.terminalStatus,
        messageId: params.messageId,
        hasShellIntegration: params.hasShellIntegration,
      });

      // 这里可以通过 runnerManager 发送事件到主 agent
      // 或者直接通过 IDE 的消息系统处理
      // 目前先记录日志，具体的终端状态同步可以通过现有的 TOOL_CALL_RESULT 机制处理
    },
    updateTerminals: (terminalId, status) => {
      console.log(`[Subagent] Terminal status update for ${terminalId}:`, status);
      // 同样通过事件系统或现有机制处理
    },
  };

  const enhancedProcessor = createSubagentProcessor(undefined, terminalCallbacks);

  let step = 0;
  let success = true;
  let error: string | undefined;

  // Token 用量累计器
  const totalUsage: LLMCallUsage = createEmptyUsage();

  // ── 外层循环：支持用户 Retry ──────────────────────────────
  // 正常执行时只跑一轮；用户点击 Retry 后重置状态，重新进入内层循环。
  let retrying = false;
  do {
  retrying = false;
  try {
    // 5. 主循环
    while (step < maxSteps) {
      // 检查是否已中止
      if (abortController.signal.aborted) {
        error = 'Subagent was aborted';
        success = false;
        break;
      }

      step++;

      // 触发 onBeforeStep 钩子
      const stepCtx: StepHookContext = {
        ...hookCtx,
        step,
        maxSteps,
      };
      await lifecycleManager.trigger('onBeforeStep', stepCtx);

      // 使用统一的消息预处理逻辑
      const preprocessOptions: MessagePreprocessOptions = {
        messages,
        agent,
        model: llmModel,
        tools: subagentTools,
        cacheEnable,
        taskId,
      };

      const preprocessResult = await preprocessSubagentMessages(preprocessOptions);

      // 更新缓存状态（可能在预处理过程中被禁用）
      cacheEnable = preprocessResult.cacheEnable;

      // 构建标准的 ChatPromptBody
      const promptData = buildSubagentChatPromptBody(
        preprocessResult,
        llmModel,
        subagentTools,
        {
          stream: true,
          tool_choice: 'auto',
          temperature: 1,
        }
      );

      // 验证预处理结果
      console.log(`[Subagent] ${taskId} Sending messages to LLM:`, {
        totalMessages: promptData.messages.length,
        systemMessages: promptData.messages.filter(m => m.role === ChatRole.System).length,
        userMessages: promptData.messages.filter(m => m.role === ChatRole.User).length,
        assistantMessages: promptData.messages.filter(m => m.role === ChatRole.Assistant).length,
        toolMessages: promptData.messages.filter(m => m.role === ChatRole.Tool).length,
      });

      // 调用 LLM
      const llmResult = await callSubagentLLM(promptData, abortController);

      if (abortController.signal.aborted) {
        error = 'Subagent was aborted during LLM call';
        success = false;
        break;
      }

      // 累计本轮 token 用量
      addUsage(totalUsage, llmResult.usage);

      // Cache 性能日志
      if (cacheEnable) {
        const { cacheCreationInputTokens, cacheReadInputTokens } = llmResult.usage;
        if (cacheCreationInputTokens > 0 || cacheReadInputTokens > 0) {
          console.log(`[Subagent Cache] ${taskId} Step ${step}:`, {
            cacheCreation: cacheCreationInputTokens,
            cacheRead: cacheReadInputTokens,
            promptTokens: llmResult.usage.promptTokens,
            completionTokens: llmResult.usage.completionTokens,
            cacheHitRate: cacheReadInputTokens > 0
              ? `${((cacheReadInputTokens / (cacheReadInputTokens + llmResult.usage.promptTokens)) * 100).toFixed(1)}%`
              : '0%',
          });
        }
      }

      // 将 assistant 消息追加到 messages
      const assistantMessage: ChatMessage = {
        role: ChatRole.Assistant,
        content: llmResult.text,
      };
      if (llmResult.toolCalls.length > 0) {
        assistantMessage.tool_calls = llmResult.toolCalls;
      }
      messages.push(assistantMessage);

      // 如果没有 tool_calls，子代理完成
      if (llmResult.toolCalls.length === 0) {
        break;
      }

      // 6. 处理工具调用
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

        console.log(`[Subagent] ${taskId} Processing tool call:`, {
          toolId: toolCall.id,
          toolName: toolCall.function.name,
        });

        // 构建工具调用钩子上下文
        const toolCallCtx: ToolCallHookContext = {
          ...hookCtx,
          toolId: toolCall.id,
          toolName: toolCall.function.name,
          toolArguments: toolCall.function.arguments || '',
        };

        // 触发 onBeforeToolCall 钩子
        const toolStartTime = Date.now();
        await lifecycleManager.trigger('onBeforeToolCall', toolCallCtx);

        // 对文件编辑类工具，在发送 TOOL_CALL 前预注册 ChatApplyItem（applying: true）
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
              toolCall.function.name === 'replace_in_file' ? 'replace' : 'edit',
            toolCallId: toolCall.id,
            applying: true,
            accepted: false,
            isCreateFile,
          });
        }

        // terminal 命令需要注入 messageId（用 toolCall.id），IDE 凭此追踪终端状态
        const isTerminalTool = toolCall.function.name === 'run_terminal_cmd';
        const extraToolParams = isTerminalTool
          ? { ...toolParams, messageId: toolCall.id }
          : toolParams;

        // 通过 PostMessage 发送工具调用到 IDE
        // 注意：必须先注册 waitForTool，再发送 TOOL_CALL，
        // 否则 IDE 可能在同一个事件循环内返回 TOOL_CALL_RESULT，
        // 导致 pendingToolResults 中找不到对应的 toolId
        const toolResultPromise = runnerManager.waitForTool(
          taskId,
          toolCall.id,
          abortController.signal,
          toolCall.function.name,
          toolCall.function.arguments || '',
        );

        window.parent.postMessage(
          {
            type: 'TOOL_CALL',
            data: {
              tool_name: toolCall.function.name,
              tool_params: {
                ...extraToolParams,
                is_approve: true, // 子代理的工具调用默认通过，不需要用户二次确认
              },
              tool_id: toolCall.id,
              task_id: taskId,
            },
          },
          '*',
        );

        // 等待工具结果返回
        const toolResult = await toolResultPromise;

        // 对文件编辑类工具，在收到工具结果后更新 ChatApplyItem 状态（applying: false）
        // 完整对应 CodeChat.tsx 中 TOOL_CALL_RESULT 对 edit_file/replace_in_file/reapply 的处理逻辑
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
            // Subagent 是自动执行流程，工具成功后需要主动触发 acceptEdit，
            // 将文件变更真正写入磁盘（等价于 CodeChat.tsx 中 autoApply 时的 ACCEPT_EDIT 广播）
            // 注意：必须先注册 waitForAcceptEdit，再发送 acceptEdit，
            // 否则 IDE 可能在同一个事件循环内返回 ACCEPT_EDIT_RESULT，
            // 导致 pendingAcceptResults 中找不到对应的 toolCallId
            const acceptPromise = runnerManager.waitForAcceptEdit(
              toolCall.id,
              abortController.signal,
            );
            useChatApplyStore.getState().acceptEdit(toolCall.id);

            // 等待 IDE 返回 ACCEPT_EDIT_RESULT，确认文件是否真正写入成功
            try {
              const acceptResult = await acceptPromise;

              if (!acceptResult?.success) {
                console.error(
                  '[Subagent] Accept edit failed:',
                  acceptResult?.message,
                );
                // 文件编辑失败，更新状态并上报
                useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
                  applying: false,
                });
                userReporter.report({
                  event:
                    toolCall.function.name === 'replace_in_file'
                      ? UserEvent.CODE_CHAT_REPLACE_IN_FILE_FAILED
                      : UserEvent.CODE_CHAT_EDIT_FILE_FAILED,
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
                // 继续执行，让 LLM 知道编辑失败
              } else {
                console.log('[Subagent] Accept edit success for:', toolCall.id);
                // 调用 handleAcceptEditSuccess 设置 accepted: true，
                // 触发 chatFileInfo 填充，使 ChatApplyPanel 显示修改
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
              // 超时或被 abort
              console.error('[Subagent] Accept edit error:', acceptError);
              useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
                applying: false,
              });
              // 如果是 abort，抛出错误终止执行
              if (abortController.signal.aborted) {
                throw acceptError;
              }
              // 超时情况，继续执行让 LLM 知道有问题
            }

            // 5.3 文件编辑成功上报
            userReporter.report({
              event:
                toolCall.function.name === 'replace_in_file'
                  ? UserEvent.CODE_CHAT_REPLACE_IN_FILE_SUCCESS
                  : UserEvent.CODE_CHAT_EDIT_FILE_SUCCESS,
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

            // 5.3 文件编辑失败上报
            userReporter.report({
              event:
                toolCall.function.name === 'replace_in_file'
                  ? UserEvent.CODE_CHAT_REPLACE_IN_FILE_FAILED
                  : UserEvent.CODE_CHAT_EDIT_FILE_FAILED,
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

        // 触发 onAfterToolCall 钩子
        const toolResultCtx: ToolResultHookContext = {
          ...toolCallCtx,
          duration: Date.now() - toolStartTime,
        };
        await lifecycleManager.trigger('onAfterToolCall', toolResultCtx);

        // 5.2 通过增强的工具结果处理器处理工具结果
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

          const processed = await enhancedProcessor.process(toolResultInput, processContext);
          processedContent = processed?.content || '';
        } catch (processingError) {
          console.error('[Subagent] Tool result processing error:', processingError);

          // 兜底处理：使用原始内容
          const fallbackContent =
            toolResult?.tool_result?.content ?? JSON.stringify(toolResult);
          processedContent =
            typeof fallbackContent === 'string'
              ? fallbackContent
              : JSON.stringify(fallbackContent);
        }

        // 将工具结果作为 tool 消息追加到 messages
        const toolMessage: ChatMessage = {
          role: ChatRole.Tool,
          content: processedContent,
          tool_call_id: toolCall.id,
        };
        messages.push(toolMessage);
      }

      if (!success) break;

      // 上下文压缩检测
      const maxTokens = useChatConfig.getState().config.max_tokens || 60000;
      const compressionResult = await checkAndCompress(
        messages,
        llmModel,
        taskId,
        maxTokens,
        subagentTools,
      );

      if (compressionResult.compressed) {
        // 替换 messages 内容
        messages.length = 0;
        messages.push(...compressionResult.messages);

        // 构建压缩状态（参考主agent逻辑）
        const compressionState: SessionCompressionState = {
          enabled: true,
          compressionHistory: [{
            timestamp: Date.now(),
            originalMessageCount: compressionResult.tokensBefore || 0,
            tokensSaved: (compressionResult.tokensBefore || 0) - (compressionResult.tokensAfter || 0),
            compressionRatio: compressionResult.tokensBefore && compressionResult.tokensAfter
              ? compressionResult.tokensBefore / compressionResult.tokensAfter
              : 1,
          }],
          totalTokensSaved: (compressionResult.tokensBefore || 0) - (compressionResult.tokensAfter || 0),
          totalCompressionsCount: 1,
          pendingSavedTokens: (compressionResult.tokensBefore || 0) - (compressionResult.tokensAfter || 0),
          messagesCountAtCompression: messages.length,
        };

        // 立即同步压缩状态到后端
        // 构建增强的 usage，包含系统 token 估算，以确保后端 session 数据结构与主 agent 一致
        const systemPromptContent = messages
          .filter(msg => msg.role === ChatRole.System)
          .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
          .join('\n');

        // 从 subagent 自己的系统 prompt 中解析 skills/rules/mcp 相关内容进行独立估算
        const skillsMatch = systemPromptContent.match(/<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g);
        const rulesMatch = systemPromptContent.match(/<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g);
        const mcpMatch = systemPromptContent.match(/<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g);

        const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
        const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
        const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

        const systemTokenEstimation = estimateSubagentSystemTokens(
          systemPromptContent,
          skillsContent ? [skillsContent] : [], // 从 subagent prompt 中提取的 skills
          rulesContent ? [rulesContent] : [],   // 从 subagent prompt 中提取的 rules
          mcpContent ? [mcpContent] : []        // 从 subagent prompt 中提取的 mcp
        );

        const compressionEnhancedUsage = {
          ...totalUsage,
          systemTokens: systemTokenEstimation.systemTokens,
          skillTokens: systemTokenEstimation.skillTokens,
          ruleTokens: systemTokenEstimation.ruleTokens,
          mcpTokens: systemTokenEstimation.mcpTokens,
        };

        await syncSession(
          taskId,
          agent.name,
          params.description,
          messages,
          llmModel,
          compressionEnhancedUsage,
          compressionState,
        );

        console.log(`[Subagent] ${taskId} Compression completed:`, {
          tokensBefore: compressionResult.tokensBefore,
          tokensAfter: compressionResult.tokensAfter,
          tokensSaved: compressionState.totalTokensSaved,
          messagesAfterCompression: messages.length,
        });

        // 压缩后，禁用后续的 cache，因为消息结构已变化
        if (cacheEnable) {
          console.log(`[Subagent] ${taskId} disabling cache due to compression`);
          cacheEnable = false;
        }

        // 触发 onCompression 钩子
        await lifecycleManager.trigger(
          'onCompression',
          hookCtx,
          compressionResult.tokensBefore || 0,
          compressionResult.tokensAfter || 0,
        );
      }

      // 触发 onAfterStep 钩子
      await lifecycleManager.trigger('onAfterStep', stepCtx, totalUsage);

      // 每轮结束后同步 messages 到后端（不传递压缩状态，因为没有新的压缩）
      // 构建增强的 usage，包含系统 token 估算，以确保后端 session 数据结构与主 agent 一致
      const systemPromptContent = messages
        .filter(msg => msg.role === ChatRole.System)
        .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
        .join('\n');

      // 从 subagent 自己的系统 prompt 中解析 skills/rules/mcp 相关内容进行独立估算
      const skillsMatch = systemPromptContent.match(/<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g);
      const rulesMatch = systemPromptContent.match(/<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g);
      const mcpMatch = systemPromptContent.match(/<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g);

      const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
      const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
      const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

      const systemTokenEstimation = estimateSubagentSystemTokens(
        systemPromptContent,
        skillsContent ? [skillsContent] : [], // 从 subagent prompt 中提取的 skills
        rulesContent ? [rulesContent] : [],   // 从 subagent prompt 中提取的 rules
        mcpContent ? [mcpContent] : []        // 从 subagent prompt 中提取的 mcp
      );

      const enhancedUsage = {
        ...totalUsage,
        systemTokens: systemTokenEstimation.systemTokens,
        skillTokens: systemTokenEstimation.skillTokens,
        ruleTokens: systemTokenEstimation.ruleTokens,
        mcpTokens: systemTokenEstimation.mcpTokens,
      };

      await syncSession(
        taskId,
        agent.name,
        params.description,
        messages,
        llmModel,
        enhancedUsage,
      );
    }

    // 步数达到上限
    if (step >= maxSteps && success) {
      console.log(`[Subagent] ${taskId} reached maxSteps (${maxSteps})`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Subagent] ${taskId} error:`, err);
    error = errorMsg;
    success = false;

    // 如果是 abort 导致的错误
    if (abortController.signal.aborted) {
      error = 'Subagent was aborted';
    }

    // 触发 onError 钩子（将状态更新为 failed，并携带错误信息）
    await lifecycleManager.trigger(
      'onError',
      hookCtx,
      err instanceof Error ? err : new Error(String(err)),
    );

    // ── 非 abort 错误：等待用户 Retry 或 Stop ───────────────
    if (!abortController.signal.aborted) {
      const doRetry = await new Promise<boolean>((resolve) => {
        pendingUserActions.set(toolCallId, { resolve });
      });

      if (doRetry) {
        // 用户选择 Retry：重置执行状态，基于现有 taskId 继续
        // 更新 store 状态：failed → running（store 已允许此转换）
        useSubagentStore.getState().updateStatus(toolCallId, {
          status: 'running' as SubagentStatus,
          errorMessage: undefined,
        });
        // 重置循环控制变量，外层 while(true) 会重新进入内层循环
        success = true;
        error = undefined;
        // 重新创建 AbortController（旧的 controller 可能已有状态）
        const newAbortController = new AbortController();
        abortController = newAbortController;
        runnerState.abortController = newAbortController;
        // 重新注册 runner state（manager 内部通过 taskId 索引）
        runnerManager.register(taskId, {
          ...runnerState,
          abortController: newAbortController,
        });
        // 重新监听父 abort 信号
        if (parentAbortSignal) {
          parentAbortSignal.removeEventListener('abort', onParentAbort);
          parentAbortSignal.addEventListener('abort', () => newAbortController.abort(), { once: true });
        }
        // 标记 retrying，让 finally 跳过清理，外层 while(true) 继续下一轮
        retrying = true;
      } else {
        // 用户选择 Stop：abortController 中止，走正常 finally 清理流程
        abortController.abort();
      }
    }

  } finally {
    // 最终同步到后端（不传递压缩状态，因为这是最终同步）
    // 构建增强的 usage，包含系统 token 估算，以确保后端 session 数据结构与主 agent 一致
    const systemPromptContent = messages
      .filter(msg => msg.role === ChatRole.System)
      .map(msg => typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
      .join('\n');

    // 从 subagent 自己的系统 prompt 中解析 skills/rules/mcp 相关内容进行独立估算
    const skillsMatch = systemPromptContent.match(/<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g);
    const rulesMatch = systemPromptContent.match(/<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g);
    const mcpMatch = systemPromptContent.match(/<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g);

    const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
    const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
    const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

    const systemTokenEstimation = estimateSubagentSystemTokens(
      systemPromptContent,
      skillsContent ? [skillsContent] : [], // 从 subagent prompt 中提取的 skills
      rulesContent ? [rulesContent] : [],   // 从 subagent prompt 中提取的 rules
      mcpContent ? [mcpContent] : []        // 从 subagent prompt 中提取的 mcp
    );

    const finalEnhancedUsage = {
      ...totalUsage,
      systemTokens: systemTokenEstimation.systemTokens,
      skillTokens: systemTokenEstimation.skillTokens,
      ruleTokens: systemTokenEstimation.ruleTokens,
      mcpTokens: systemTokenEstimation.mcpTokens,
    };

    await syncSession(
      taskId,
      agent.name,
      params.description,
      messages,
      llmModel,
      finalEnhancedUsage,
    );

    // 将子代理 token 用量写入主会话独立的 subagentTokens 字段
    // 不混入 main agent 的 systemTokens / skillTokens / ruleTokens 等分类
    if (totalUsage.promptTokens > 0 || totalUsage.completionTokens > 0) {
      const chatStoreState = useChatStore.getState();
      const curSession = chatStoreState.sessions.get(parentSessionId);
      if (curSession?.data?.consumedTokens) {
        const ct = curSession.data.consumedTokens;
        if (!ct.subagentTokens) {
          ct.subagentTokens = createEmptySubagentTokens();
        }
        const modelCostInfo =
          useChatConfig.getState().chatModels?.[llmModel as ChatModel]
            ?.priceInfo;

        // 估算系统相关的 token
        // 从 messages 中提取系统 prompt 内容进行估算
        const systemMessages = messages.filter(m => m.role === ChatRole.System);
        const systemPromptContent = systemMessages.map(m =>
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join('\n');

        // 从 subagent 自己的系统 prompt 中解析 skills/rules/mcp 相关内容进行独立估算
        const skillsMatch = systemPromptContent.match(/<skill[^>]*>[\s\S]*?<\/skill[^>]*>/g);
        const rulesMatch = systemPromptContent.match(/<rule-\d+[^>]*>[\s\S]*?<\/rule-\d+>/g);
        const mcpMatch = systemPromptContent.match(/<mcp_tool_call>[\s\S]*?<\/mcp_tool_call>/g);

        const skillsContent = skillsMatch ? skillsMatch.join('\n') : '';
        const rulesContent = rulesMatch ? rulesMatch.join('\n') : '';
        const mcpContent = mcpMatch ? mcpMatch.join('\n') : '';

        const systemTokenEstimation = estimateSubagentSystemTokens(
          systemPromptContent,
          skillsContent ? [skillsContent] : [], // 从 subagent prompt 中提取的 skills
          rulesContent ? [rulesContent] : [],   // 从 subagent prompt 中提取的 rules
          mcpContent ? [mcpContent] : []        // 从 subagent prompt 中提取的 mcp
        );

        // 构建增强的 usage 对象，包含系统 token 估算
        const enhancedUsage = {
          ...totalUsage,
          systemTokens: systemTokenEstimation.systemTokens,
          skillTokens: systemTokenEstimation.skillTokens,
          ruleTokens: systemTokenEstimation.ruleTokens,
          mcpTokens: systemTokenEstimation.mcpTokens,
        };

        mergeSubagentUsageIntoTokens(
          ct.subagentTokens,
          agent.name,
          taskId,
          enhancedUsage,
          modelCostInfo,
        );
        console.log('🤖 %cSubagent Token Merged to Main Agent:', 'color: #8B5CF6; font-weight: bold; font-size: 14px;', {
          '🏷️ Agent': agent.name,
          '🆔 Task ID': taskId.substring(0, 8) + '...',
          '📊 Total Subagent Tokens': ct.subagentTokens.total,
          '💾 Cache Enabled': cacheEnable,
          '🏪 Model Has Token Cache': !!chatModels[llmModel]?.hasTokenCache,
          '📈 This Task Usage': {
            '📥 Prompt': totalUsage.promptTokens,
            '✅ Completion': totalUsage.completionTokens,
            '🎯 System': systemTokenEstimation.systemTokens,
            '⚡ Skill': systemTokenEstimation.skillTokens,
            '📏 Rule': systemTokenEstimation.ruleTokens,
            '🔌 MCP': systemTokenEstimation.mcpTokens,
            '🆕 Cache Creation': totalUsage.cacheCreationInputTokens,
            '💾 Cache Read': totalUsage.cacheReadInputTokens,
            '📊 Total': totalUsage.promptTokens + totalUsage.completionTokens,
          }
        });
      } else {
        console.warn(
          `[Subagent] Session not found for token update: ${parentSessionId}`,
        );
      }
    }

    // retrying 时跳过最终清理，外层循环会继续下一轮
    if (!retrying) {
      // 输出总体 Cache 性能统计
      if (cacheEnable) {
        console.log(`[Subagent Cache Summary] ${taskId}:`, {
          totalSteps: step,
          totalCacheCreation: totalUsage.cacheCreationInputTokens,
          totalCacheRead: totalUsage.cacheReadInputTokens,
          totalPromptTokens: totalUsage.promptTokens,
          totalCompletionTokens: totalUsage.completionTokens,
          overallCacheHitRate: totalUsage.cacheReadInputTokens > 0
            ? `${((totalUsage.cacheReadInputTokens / (totalUsage.cacheReadInputTokens + totalUsage.promptTokens)) * 100).toFixed(1)}%`
            : '0%',
          estimatedSavings: totalUsage.cacheReadInputTokens > 0
            ? `${totalUsage.cacheReadInputTokens} tokens (90% discount)`
            : '0 tokens',
        });
      }

      // 触发 onComplete 钩子（先更新状态）
      const completeCtx: CompleteHookContext = {
        ...hookCtx,
        success,
        step,
        error,
        isAborted: abortController.signal.aborted,
      };
      await lifecycleManager.trigger('onComplete', completeCtx);

      // 清理运行时状态（状态更新完成后再清理）
      runnerManager.remove(taskId);

      // 移除 parentAbort 监听
      if (parentAbortSignal) {
        parentAbortSignal.removeEventListener('abort', onParentAbort);
      }

      // 子代理状态应该由 subagent store 管理，不再在这里维护全局计数
    }
  }
  } while (retrying); // end do-while outer retry loop

  // 格式化返回
  // 如果执行失败且没有 assistant 消息，将错误信息添加到 messages 中
  let messagesForFormatting = messages;
  if (!success && !abortController.signal.aborted && error) {
    // 检查最后一条消息是否是 assistant 消息
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== ChatRole.Assistant) {
      messagesForFormatting = [
        ...messages,
        {
          role: ChatRole.Assistant,
          content: `Error: ${error}`,
        },
      ];
    }
  }

  const output = formatTaskResult(
    taskId,
    abortController.signal.aborted
      ? [
          {
            role: ChatRole.Assistant,
            content: '[Request interrupted by user for tool use]',
          },
        ]
      : messagesForFormatting,
  );

  return {
    taskId,
    output,
    success,
    error,
    isAborted: abortController.signal.aborted,
  };
}