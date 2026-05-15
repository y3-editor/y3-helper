import type {
  TaskParams,
  TaskResult,
  RunSubagentContext,
  SubagentRunnerState,
  LLMCallUsage,
  Agent,
  SubagentStatus,
} from '../types';
import { convertAgentMCPServers, waitForMCPServers } from '../utils/mcp';
import { BroadcastActions } from '../../../PostMessageProvider';
import type { ConsumedTokens } from '../../../utils/consumedTokensCalculator';
import {
  DEFAULT_MAX_STEPS,
  SUBAGENT_TOTAL_TIMEOUT_MS,
  USER_ACTION_TIMEOUT_MS,
  CLAUDE_ALIAS_MAP,
} from '../constants';
import { useSubagentStore } from '../state/store';
import { runnerManager } from '../lifecycle/manager';
import { subagentScheduler } from '../lifecycle/scheduler';
import { lifecycleManager } from '../lifecycle/hooks';
import type {
  HookContext,
  StepHookContext,
  CompleteHookContext,
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
import {
  SubagentAbortManager,
  isSubagentAbortError,
  createAbortControllerAdapter,
} from './abortManager';

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
import { useMCPStore } from '../../../store/mcp';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { ChatModel, IChatModelConfig } from '../../../services/chatModel';
import {
  createSubagentProcessor,
  type TerminalUpdateCallbacks,
} from '../../tool-result-processor';
import {
  preprocessSubagentMessages,
  buildSubagentChatPromptBody,
  type MessagePreprocessOptions,
} from './message-preprocessor';
import {
  getAIGWModelWithFallback,
  getAIGWModel,
} from './../../../store/chat-config';
import { configureThinkingSignature } from '../../../utils/chatThinkingHandler';
import { promptBuilder } from './prompt-builder';
import type { SubagentSpanContext } from '../types';
import { startSubagentTaskSpan } from '../../../telemetry/otel';
import { TRACING_DEFAULT_TRACER } from '../../../telemetry/const';
import {
  SpanStatusCode,
  trace,
  context as otelContext,
} from '../../../telemetry/otel';
import {
  AGENT_TASK_ID,
  AGENT_PARENT_SESSION_ID,
  AGENT_MAX_STEPS,
  AGENT_ACTUAL_STEPS,
  AGENT_IS_TRUNCATED,
  AGENT_CURRENT_STEP,
  AGENT_RETRY_COUNT,
  AGENT_RESULT_SYNCED_TO_PARENT,
  AGENT_FINAL_STEPS,
  AGENT_SYNC_STEP,
  AGENT_SYNC_MESSAGE_COUNT,
  AGENT_SYNC_IS_FINAL,
  AGENT_SYNC_IS_ERROR_SYNC,
  GEN_AI_OPERATION_NAME,
  GEN_AI_CONVERSATION_ID,
  GEN_AI_REQUEST_MODEL,
  GenAiOperationName,
  ERROR_TYPE,
} from '../../../telemetry/attributes';
import { ChatRole } from '../../../types/chat';
import {
  isMcpFailureRetryExceeded,
  shouldUseOnDemandMCPTools,
  getVisibleMCPToolCount,
  SEARCH_TOOL_NAME,
} from '../../../utils/mcpToolSearch';
import { handleToolCall } from './toolCallHandler';
import { clearPruneState } from '../../../services/compressionService';

import {
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
} from '../events/taskEventBus';

/**
 * 将 Subagent 消息格式（工具结果为独立 role:'tool' 消息）转换为
 * isMcpFailureRetryExceeded 期望的格式（tool_result 附在 assistant message 上），
 * 然后执行失败重试上限判定。
 */
function isMcpFailureRetryExceededForSubagent(
  messages: ChatMessage[],
): boolean {
  // 构建 tool_call_id → tool 消息内容 的映射
  const toolResultMap = new Map<
    string,
    { isError?: boolean; content?: unknown }
  >();
  for (const msg of messages) {
    if (msg.role === ChatRole.Tool && msg.tool_call_id) {
      toolResultMap.set(msg.tool_call_id, { isError: msg.isError, content: msg.content });
    }
  }

  // 将 assistant 消息转换为 isMcpFailureRetryExceeded 期望的格式
  const adapted = messages
    .filter(
      (msg) =>
        msg.role === ChatRole.Assistant ||
        msg.role === ChatRole.Tool ||
        msg.role === 'system',
    )
    .map((msg) => {
      if (msg.role !== ChatRole.Assistant || !msg.tool_calls?.length)
        return msg;
      const tool_result: Record<
        string,
        { isError?: boolean; content?: unknown }
      > = {};
      for (const tc of msg.tool_calls) {
        if (tc.id && toolResultMap.has(tc.id)) {
          tool_result[tc.id] = toolResultMap.get(tc.id)!;
        }
      }
      return { ...msg, tool_result };
    });

  return isMcpFailureRetryExceeded(adapted as any);
}

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

/**
 * Wraps a syncSession() call with an agent.sync_session span for observability.
 */
async function wrapSyncSessionSpan<T>(
  spanContext: SubagentSpanContext | undefined,
  taskId: string,
  step: number,
  messageCount: number,
  options: { isFinal?: boolean; isErrorSync?: boolean },
  fn: () => Promise<T>,
): Promise<T> {
  if (!spanContext) {
    return fn();
  }
  const tracer = trace.getTracer(TRACING_DEFAULT_TRACER);
  const syncSpan = tracer.startSpan(
    'agent.sync_session',
    undefined,
    spanContext.taskContext,
  );
  syncSpan.setAttribute(AGENT_TASK_ID, taskId);
  syncSpan.setAttribute(AGENT_SYNC_STEP, step);
  syncSpan.setAttribute(AGENT_SYNC_MESSAGE_COUNT, messageCount);
  if (options.isFinal) syncSpan.setAttribute(AGENT_SYNC_IS_FINAL, true);
  if (options.isErrorSync)
    syncSpan.setAttribute(AGENT_SYNC_IS_ERROR_SYNC, true);

  // 将 syncSpan 设置为活跃上下文，确保 fn() 内部产生的子 span 能正确关联到该父 span
  const ctx = trace.setSpan(otelContext.active(), syncSpan);
  try {
    const result = await otelContext.with(ctx, () => fn());
    syncSpan.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    syncSpan.setStatus({ code: SpanStatusCode.ERROR, message: msg });
    syncSpan.setAttribute(ERROR_TYPE, '_OTHER');
    throw e;
  } finally {
    syncSpan.end();
  }
}

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
  const enableSubagent = useChatConfig.getState().enableSubagent;
  if (!enableSubagent) {
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
    const availableAgents = subagentStore.validAgents
      .map((a) => a.name)
      .join(', ');
    return {
      taskId: '',
      output: `Error: Agent "${params.subagent_type}" not found. Available agents: ${availableAgents}`,
      success: false,
      error: `Agent "${params.subagent_type}" not found`,
    };
  }

  return subagentScheduler.schedule(
    async () => {
      // ✅ 包装 runSubagentInner，添加总超时机制
      // 使用 AbortController 在超时时主动取消 runSubagentInner，避免其在后台继续运行
      const timeoutAbortController = new AbortController();

      // 若外部已有 parentAbortSignal，则将其与超时信号合并：
      // 任意一方 abort 都会触发 timeoutAbortController 中止
      if (context.parentAbortSignal) {
        context.parentAbortSignal.addEventListener(
          'abort',
          () => timeoutAbortController.abort(context.parentAbortSignal!.reason),
          { once: true },
        );
      }

      const timeoutId = setTimeout(() => {
        timeoutAbortController.abort(
          new Error(
            `Subagent total execution timeout after ${SUBAGENT_TOTAL_TIMEOUT_MS}ms (10 minutes)`,
          ),
        );
      }, SUBAGENT_TOTAL_TIMEOUT_MS);

      try {
        return await runSubagentInner(params, agent, {
          ...context,
          parentAbortSignal: timeoutAbortController.signal,
        });
      } catch (e) {
        // 若是因超时 abort 导致的错误，转换为更清晰的超时错误信息
        if (
          timeoutAbortController.signal.aborted &&
          timeoutAbortController.signal.reason instanceof Error
        ) {
          throw timeoutAbortController.signal.reason;
        }
        throw e;
      } finally {
        // 正常完成或发生其他错误时，清理定时器，防止定时器泄漏
        clearTimeout(timeoutId);
      }
    },
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

  let chatModelConfig: IChatModelConfig | undefined;
  for (const key in chatModels) {
    if (!Object.hasOwn(chatModels, key)) continue;
    const model = chatModels[key];
    if (model.useModel === llmModel && model.hasTokenCache) {
      const token = codebaseModelMaxTokens[key as ChatModel];
      if (token > 64 * 1000) {
        cacheEnable = true;
      }
    }
    if (model.useModel === llmModel) {
      // chatModelConfig = model;
      chatModelConfig = model;
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

  // 将 __pending__ scope 中的激活工具迁移到 subagent 会话，确保 on-demand 模式下
  // resolveOnDemandUseMcpToolCall 能从 taskId scope 查到已激活的工具 keys
  useMCPStore.getState().adoptPendingToolKeys(taskId);

  if (subagentSpanContext) {
    // @deprecated - use agent.task_id (will be removed in next major cleanup)
    subagentSpanContext.taskSpan.setAttribute('subagent.task_id', taskId);
    subagentSpanContext.taskSpan.setAttribute(AGENT_TASK_ID, taskId);
    // @deprecated - use agent.parent_session_id (will be removed in next major cleanup)
    subagentSpanContext.taskSpan.setAttribute(
      'subagent.parent_session_id',
      parentSessionId,
    );
    subagentSpanContext.taskSpan.setAttribute(
      AGENT_PARENT_SESSION_ID,
      parentSessionId,
    );
    subagentSpanContext.taskSpan.setAttribute(
      GEN_AI_CONVERSATION_ID,
      parentSessionId,
    );
    // @deprecated - use gen_ai.request.model (will be removed in next major cleanup)
    subagentSpanContext.taskSpan.setAttribute('subagent.model', llmModel);
    subagentSpanContext.taskSpan.setAttribute(GEN_AI_REQUEST_MODEL, llmModel);
    subagentSpanContext.taskSpan.setAttribute(
      GEN_AI_OPERATION_NAME,
      GenAiOperationName.InvokeAgent,
    );
  }

  let localConsumedTokens: ConsumedTokens = createInitialConsumedTokens();

  // ✅ 使用 AbortManager 替代原始 AbortController
  let abortManager = new SubagentAbortManager(parentAbortSignal);
  const runnerState: SubagentRunnerState = {
    taskId,
    agentName: agent.name,
    abortController: createAbortControllerAdapter(abortManager), // 向后兼容
    pendingToolResults: new Map(),
    parentSessionId,
  };

  runnerManager.register(taskId, runnerState);

  const maxSteps = agent.maxSteps || DEFAULT_MAX_STEPS;

  if (subagentSpanContext) {
    // @deprecated - use agent.max_steps (will be removed in next major cleanup)
    subagentSpanContext.taskSpan.setAttribute('subagent.max_steps', maxSteps);
    subagentSpanContext.taskSpan.setAttribute(AGENT_MAX_STEPS, maxSteps);
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

  // MCP server 注册列表：在循环外声明，供循环内注册和最终清理使用
  let agentMCPServerNames: string[] = [];
  const instanceId = nanoid(8);

  const codeMakerVersion =
    useExtensionStore.getState().codeMakerVersion || undefined;
  // 获取 OpenSpec 相关配置
  const codebaseChatMode = useChatStore.getState().codebaseChatMode;
  const openspecVersion = useWorkspaceStore
    .getState()
    .getFrameworkSpecInfo(SpecFramework.OpenSpec)?.version;

  // enhancedAgent / messages / subagentTools 在 do-loop 内、MCP 注册就绪后构建，此处仅占位
  let enhancedAgent: Agent = agent;
  let messages: ChatMessage[] = [];
  let subagentTools: ReturnType<typeof getToolsForAgent> = [];

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

    // ============================================================
    // 每次（含重试）重新注册 Agent 专属 MCP servers
    // 注意：重试前需先清理上一轮已注册的 servers，防止重复注册和资源泄漏
    // ============================================================
    if (agentMCPServerNames.length > 0) {
      debugLog(MODULE, 'Cleaning up MCP servers at loop start', {
        agentName: agent.name,
        instanceId,
        servers: agentMCPServerNames,
      });
      for (const serverName of agentMCPServerNames) {
        window.parent.postMessage(
          {
            type: BroadcastActions.REMOVE_MCP_SERVERS,
            data: { name: serverName },
          },
          '*',
        );
      }
    }
    agentMCPServerNames = [];

    if (agent.mcpServers && Object.keys(agent.mcpServers).length > 0) {
      const agentServers = convertAgentMCPServers(
        agent.name,
        instanceId,
        agent.mcpServers,
      );

      if (agentServers.length > 0) {
        agentMCPServerNames.push(...agentServers.map((s) => s.name));

        debugLog(MODULE, 'Registering agent-specific MCP servers', {
          agentName: agent.name,
          instanceId,
          servers: agentMCPServerNames,
        });

        for (const mcpServer of agentServers) {
          window.parent.postMessage(
            {
              type: BroadcastActions.ADD_MCP_SERVERS,
              data: { ...mcpServer },
            },
            '*',
          );
        }

        // 等待所有专属 server 连接就绪（超时后降级继续执行）
        await waitForMCPServers(agentMCPServerNames, abortManager.signal);
      }
    }

    // MCP 注册就绪后构建 prompt，确保自定义 Agent 的专属 MCP servers 已在 MCPStore 中
    // 自定义 Agent 只注入其 .md 声明的 MCP servers（按隔离名称匹配），内置 Agent 注入全局 MCPStore
    // 自定义 Agent：始终覆盖 mcpServers，避免注入全局 MCP servers
    //   - 若声明了 mcpServers，则仅注入已注册且已连接的专属 servers
    //   - 若未声明 mcpServers（为空），则传空数组，不注入任何 server
    const agentMCPServersOverride =
      agent.source === 'custom'
        ? agent.mcpServers && Object.keys(agent.mcpServers).length > 0
          ? useMCPStore
              .getState()
              .MCPServers.filter(
                (s) =>
                  s.status === 'connected' &&
                  !s.disabled &&
                  agentMCPServerNames.includes(s.name),
              )
          : []
        : undefined;

    // MCP 注册就绪后构建 tools：
    // - visibleMCPServers 与 agentMCPServersOverride 使用同一时刻的 MCPStore 状态
    // - 自定义 Agent 用其专属 servers，内置 Agent 用全局 visibleMCPServers
    const visibleMCPServersForTools =
      agentMCPServersOverride !== undefined
        ? agentMCPServersOverride
        : useMCPStore
            .getState()
            .MCPServers.filter((s) => s.status === 'connected' && !s.disabled);

    const isOnDemandModeForTools = shouldUseOnDemandMCPTools({
      totalToolCount: getVisibleMCPToolCount(visibleMCPServersForTools),
    });
    const allTools =
      useWorkspaceStore.getState().getCodebaseChatTools({
        mcpSnapshot: {
          visibleMCPServers: visibleMCPServersForTools,
          isOnDemandMode: isOnDemandModeForTools,
        },
      }) || [];
    subagentTools = getToolsForAgent(allTools, agent);

    const enhancedPrompt = await promptBuilder.buildSystemPrompt(
      agent.prompt,
      agent.name,
      {
        config: {
          codeMakerVersion,
          codebaseChatMode,
          openspecVersion,
        },
        ...(agentMCPServersOverride !== undefined && {
          mcpServers: agentMCPServersOverride,
        }),
      },
    );
    enhancedAgent = { ...agent, prompt: enhancedPrompt };
    messages = buildInitialMessages(enhancedAgent, params, cacheEnable);

    try {
      // 主循环
      while (step < maxSteps) {
        // ✅ 检查是否已中止（自动抛出异常）
        abortManager.checkAbort('main-loop-start');

        step++;
        if (subagentSpanContext) {
          subagentSpanContext.taskSpan.setAttribute(AGENT_CURRENT_STEP, step);
        }

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

        if (chatModelConfig) {
          configureThinkingSignature(chatModelConfig, promptData);
        }

        promptData.mode_type = `${agent.name || 'unknown'}.agent`;

        const llmResult = await streamChat(
          promptData,
          createAbortControllerAdapter(abortManager),
          subagentSpanContext,
        );

        // ✅ 检查 LLM 调用后是否被中止（自动排除 ABORT_REASON_FINISHED）
        abortManager.checkAbort('after-llm-call');

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
            tool_calls:
              llmResult.toolCalls?.length > 0 ? llmResult.toolCalls : undefined,
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

        // MCP 失败重试上限判定：连续 4 次 MCP 工具失败则终止主循环。
        // Subagent 消息格式：工具结果为独立的 role:'tool' 消息，需先转换为
        // isMcpFailureRetryExceeded 期望的格式（tool_result 附在 assistant message 上）
        if (isMcpFailureRetryExceededForSubagent(messages)) {
          debugLog(MODULE, 'MCP failure retry exceeded, stopping loop', {
            taskId,
          });
          break;
        }

        // search_tool 优先排序：同轮 tool_calls 中 search_tool 必须在 use_mcp_tool 之前执行
        const sortedToolCalls = [...(llmResult.toolCalls || [])].sort((a, b) => {
          const aIsSearch = a.function.name === SEARCH_TOOL_NAME ? 0 : 1;
          const bIsSearch = b.function.name === SEARCH_TOOL_NAME ? 0 : 1;
          return aIsSearch - bIsSearch;
        });

        // 复用 do-loop 顶部已计算的 visibleMCPServersForTools：
        // - 自定义 Agent 只路由到其专属 servers（agentMCPServersOverride），保持隔离
        // - 内置 Agent 使用全局 connected servers
        // - 与构建 subagentTools / prompt 时保持同一快照，避免不一致

        for (const toolCall of sortedToolCalls) {
          // ✅ 每个工具执行前检查是否中止
          abortManager.checkAbort('tool-execution-start');

          const result = await handleToolCall(toolCall, {
            taskId,
            agent,
            hookCtx,
            messages,
            abortManager,
            visibleMCPServers: visibleMCPServersForTools,
            isOnDemandMode: isOnDemandModeForTools,
            llmModel,
            isPrivateModel,
            subagentAuthExtends,
            enhancedProcessor,
            subagentSpanContext,
          });

          if (result.shouldContinue) continue;
          if (!result.success) {
            success = false;
            break;
          }
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
          abortManager.signal, // 传递 abort signal，支持中止压缩
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

        localConsumedTokens = await wrapSyncSessionSpan(
          subagentSpanContext,
          taskId,
          step,
          messages.length,
          {},
          () =>
            syncSession(
              taskId,
              agent.name,
              params.description,
              messages,
              llmModel,
              enhancedUsage,
              createInitialConsumedTokens(),
              compressionState,
            ),
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
            createAbortControllerAdapter(abortManager),
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
      // ✅ 统一处理 abort 异常
      if (isSubagentAbortError(err)) {
        error = `Subagent was aborted at ${err.stage}`;
        success = false;
        debugLog(MODULE, `Subagent aborted`, {
          taskId,
          stage: err.stage,
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        debugLog(MODULE, `Error`, {
          taskId,
          error: err instanceof Error ? err.message : String(err),
        });
        error = errorMsg;
        success = false;
      }

      // 将错误信息保存到 session messages 中，确保 UI 能持久显示错误
      const finalErrorMsg = error || 'Unknown error';

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
        await wrapSyncSessionSpan(
          subagentSpanContext,
          taskId,
          step,
          messages.length,
          { isErrorSync: true },
          () =>
            syncSession(
              taskId,
              agent.name,
              params.description,
              messages,
              llmModel,
              totalUsage,
              localConsumedTokens,
              compressionState,
            ),
        );
      } catch (syncErr) {
        console.warn(
          '[Subagent] Failed to sync error state to backend:',
          syncErr,
        );
      }

      if (subagentSpanContext) {
        subagentSpanContext.taskSpan.setStatus(
          SpanStatusCode.ERROR,
          finalErrorMsg,
        );
      }

      await lifecycleManager.trigger(
        'onError',
        hookCtx,
        err instanceof Error ? err : new Error(String(err)),
      );

      if (!abortManager.isActuallyAborted()) {
        // ✅ 用户操作等待超时（5 分钟），超时后默认选择 Stop
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        // 将 onAbort 和对应的 signal 引用提升到 race 外部，
        // 确保无论哪个 Promise 先完成，都能在 finally 中清理监听器，防止内存泄漏
        let abortCleanup: (() => void) | undefined;

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
          // 监听 abort 信号：主界面点"中止生成"时立即响应，不再等待用户在子代理 UI 操作
          new Promise<boolean>((resolve) => {
            if (abortManager.isActuallyAborted()) {
              // 信号已终止时，清理已创建的资源后立即返回
              pendingUserActions.delete(toolCallId);
              if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              resolve(false);
              return;
            }
            const onAbort = () => {
              pendingUserActions.delete(toolCallId);
              if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              resolve(false);
            };
            const currentSignal = abortManager.signal;
            currentSignal.addEventListener('abort', onAbort, { once: true });
            // 保存清理函数，使用捕获时的 signal 引用，
            // 防止 retry 重置 abortManager 后 signal 引用变化导致 removeEventListener 失效
            abortCleanup = () =>
              currentSignal.removeEventListener('abort', onAbort);
          }),
        ]).finally(() => {
          // 无论哪个 Promise 先决议，都清理 abort 监听器，防止内存泄漏
          abortCleanup?.();
        });

        if (doRetry) {
          // 用户选择 Retry，清除错误状态和错误消息
          retryCount++;
          if (subagentSpanContext) {
            subagentSpanContext.taskSpan.setAttribute(
              AGENT_RETRY_COUNT,
              retryCount,
            );
          }

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

          // ✅ 5. 使用 AbortManager 重置（一行代码完成）
          abortManager = abortManager.reset(parentAbortSignal);
          runnerState.abortController =
            createAbortControllerAdapter(abortManager);
          runnerManager.register(taskId, runnerState);

          debugLog(MODULE, 'Retry setup complete', {
            taskId,
            retryCount,
            messagesAfterCleanup: messages.length,
            willContinueFromStep: step + 1,
          });

          // ✅ 6. 清理本轮已注册的 MCP servers，防止重试时重复注册导致资源泄漏
          // 下一次循环迭代会在顶部重新注册
          if (agentMCPServerNames.length > 0) {
            debugLog(MODULE, 'Cleaning up MCP servers before retry', {
              agentName: agent.name,
              instanceId,
              servers: agentMCPServerNames,
            });
            for (const serverName of agentMCPServerNames) {
              window.parent.postMessage(
                {
                  type: BroadcastActions.REMOVE_MCP_SERVERS,
                  data: { name: serverName },
                },
                '*',
              );
            }
            agentMCPServerNames = [];
          }

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

          if (subagentSpanContext) {
            subagentSpanContext.taskSpan.setAttribute(
              AGENT_RESULT_SYNCED_TO_PARENT,
              true,
            );
            subagentSpanContext.taskSpan.setAttribute(AGENT_FINAL_STEPS, step);
          }
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

          abortManager.abort();
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

        if (subagentSpanContext) {
          subagentSpanContext.taskSpan.setAttribute(
            AGENT_RESULT_SYNCED_TO_PARENT,
            true,
          );
          subagentSpanContext.taskSpan.setAttribute(AGENT_FINAL_STEPS, step);
        }
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
        // @deprecated - use agent.actual_steps (will be removed in next major cleanup)
        subagentSpanContext.taskSpan.setAttribute(
          'subagent.actual_steps',
          step,
        );
        subagentSpanContext.taskSpan.setAttribute(AGENT_ACTUAL_STEPS, step);
        // @deprecated - use agent.is_truncated (will be removed in next major cleanup)
        subagentSpanContext.taskSpan.setAttribute(
          'subagent.is_truncated',
          isTruncated,
        );
        subagentSpanContext.taskSpan.setAttribute(
          AGENT_IS_TRUNCATED,
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

        localConsumedTokens = await wrapSyncSessionSpan(
          subagentSpanContext,
          taskId,
          step,
          messages.length,
          { isFinal: true },
          () =>
            syncSession(
              taskId,
              agent.name,
              params.description,
              messages,
              llmModel,
              finalEnhancedUsage,
              createInitialConsumedTokens(),
              compressionState,
            ),
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
          isAborted: abortManager.isActuallyAborted(),
        };
        await lifecycleManager.trigger('onComplete', completeCtx);

        runnerManager.remove(taskId);

        // ✅ 清理 AbortManager 资源
        abortManager.cleanup();
      }
    }
  } while (retrying);

  clearPruneState(`subagent:${taskId}`);

  // ============ 包装在 try-finally 中确保事件必定发出 ============
  try {
    let taskStatus: TaskStatus;
    // ✅ 检查 abort 状态（使用 AbortManager）
    if (abortManager.isAborted()) {
      if (!abortManager.isActuallyAborted() && success) {
        // 如果是正常完成的 abort（ABORT_REASON_FINISHED）且成功，按成功处理
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
        abortManager.isActuallyAborted() && taskStatus === TaskStatus.Aborted
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
      isAborted: abortManager.isActuallyAborted(),
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

    // ============================================================
    // 清理 Agent 专属 MCP servers
    // ============================================================
    // 无论执行成功、失败还是被取消，都清理本次注册的专属 server，
    // 避免污染全局 MCP server 状态。
    if (agentMCPServerNames.length > 0) {
      debugLog(MODULE, 'Cleaning up agent-specific MCP servers', {
        agentName: agent.name,
        instanceId,
        servers: agentMCPServerNames,
      });

      for (const serverName of agentMCPServerNames) {
        window.parent.postMessage(
          {
            type: BroadcastActions.REMOVE_MCP_SERVERS,
            data: { name: serverName },
          },
          '*',
        );
      }
    }
  }
}