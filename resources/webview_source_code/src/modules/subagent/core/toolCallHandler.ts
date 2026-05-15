/**
 * toolCallHandler.ts
 *
 * 子代理工具执行循环的核心分发模块。
 *
 * 将 executor.ts 主循环中的工具执行逻辑（原 ~506 行）提取到此文件，
 * executor 只保留对 handleToolCall 的调用（~20 行）。
 *
 * 包含 7 条工具分支：
 *   1. search_tool          — 前端本地执行，不经 IDE
 *   2. on-demand 激活验证   — use_mcp_tool / access_mcp_resource 前检查
 *   3. 文件编辑工具检测     — write / edit / replace_in_file / reapply
 *   4. 策略判定 + 用户确认  — shouldAutoExecute + Promise.race
 *   5. IDE 工具调用         — postMessage TOOL_CALL + waitForTool
 *   6. 文件编辑后续处理     — waitForAcceptEdit + userReporter
 *   7. 工具结果处理         — enhancedProcessor.process + message 记录
 */

import { nanoid } from 'nanoid';
import { ChatRole } from '../../../types/chat';
import type { Agent } from '../types';
import type {
  ToolResultInput,
  ToolResultProcessContext,
} from '../../tool-result-processor';
import { createSubagentProcessor } from '../../tool-result-processor';
import { debugLog } from '../../../utils/debugLog';
import { useMCPStore } from '../../../store/mcp';
import { useSubagentStore } from '../state/store';
import { useChatApplyStore } from '../../../store/chatApply';
import { useChatConfig } from '../../../store/chat-config';
import { useWorkspaceStore } from '../../../store/workspace';
import { runnerManager } from '../lifecycle/manager';
import { lifecycleManager } from '../lifecycle/hooks';
import type {
  HookContext,
  ToolCallHookContext,
  ToolResultHookContext,
} from '../lifecycle/hooks';
import {
  startToolCallSpan,
  stopToolCallSpan,
} from '../../../telemetry/otel';
import { getReportEventByToolName } from '../../../utils/toolCall';
import userReporter from '../../../utils/report';
import {
  executeSearchTool,
  resolveOnDemandUseMcpToolCall,
  SEARCH_TOOL_NAME,
} from '../../../utils/mcpToolSearch';
import type { MCPServer } from '../../../store/mcp';
import type { ChatMessage, ToolCall } from '../../../services';
import type { SubagentAbortManager } from './abortManager';
import type { SubagentSpanContext } from '../types';
import { ChatModel } from '../../../services/chatModel';

/** auth 扩展信息（对应 useAuthStore.getState().authExtends） */
type AuthExtends = {
  c_unrestrict?: boolean;
  department?: string;
  department_code?: string;
  [key: string]: any;
};

const MODULE = 'Subagent/ToolCallHandler';

// ────────────────────────────────────────────────────────────────────────────
// 接口定义
// ────────────────────────────────────────────────────────────────────────────

/**
 * handleToolCall 执行所需的上下文。
 * 所有引用类型（messages、store 引用）均以引用方式传入，handler 内部直接 push/mutate，
 * 与 executor 内联时行为完全一致。
 */
export interface ToolCallContext {
  // 标识
  taskId: string;
  agent: Agent;
  hookCtx: HookContext;
  // 运行时状态（引用，handler 内部直接 push）
  messages: ChatMessage[];
  abortManager: SubagentAbortManager;
  // MCP
  visibleMCPServers: MCPServer[];
  isOnDemandMode: boolean;
  // 模型
  llmModel: ChatModel;
  isPrivateModel: boolean;
  subagentAuthExtends: AuthExtends;
  // 处理器
  enhancedProcessor: ReturnType<typeof createSubagentProcessor>;
  subagentSpanContext: SubagentSpanContext | undefined;
}

/**
 * handleToolCall 的返回值。
 * - shouldContinue: true  → executor 对此 toolCall 执行 continue（分支 1、2、4 拒绝时）
 * - shouldContinue: false → executor 继续处理下一个 toolCall 或检查 success
 * - success: false        → 工具执行失败，executor 应置 success=false 并 break 主循环
 */
export interface ToolCallHandleResult {
  shouldContinue: boolean;
  success: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 执行单个工具调用的完整流程。
 *
 * 包含所有工具分支的判定、执行、结果记录。
 * 调用方（executor）只需根据返回值决定 continue / success。
 */
export async function handleToolCall(
  toolCall: ToolCall,
  ctx: ToolCallContext,
): Promise<ToolCallHandleResult> {
  const {
    taskId,
    agent,
    hookCtx,
    messages,
    abortManager,
    visibleMCPServers,
    isOnDemandMode,
    llmModel,
    isPrivateModel,
    subagentAuthExtends,
    enhancedProcessor,
    subagentSpanContext,
  } = ctx;

  // ── 解析工具参数 ──────────────────────────────────────────────────────────
  let toolParams: Record<string, any>;
  try {
    toolParams = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    toolParams = {};
  }

  // ── 生命周期钩子：onBeforeToolCall ────────────────────────────────────────
  const toolCallCtx: ToolCallHookContext = {
    ...hookCtx,
    toolId: toolCall.id,
    toolName: toolCall.function.name,
    toolArguments: toolCall.function.arguments || '',
  };
  const toolStartTime = Date.now();
  await lifecycleManager.trigger('onBeforeToolCall', toolCallCtx);

  // ── 分支 1：search_tool 前端本地执行，不经过 IDE ──────────────────────────
  if (toolCall.function.name === SEARCH_TOOL_NAME) {
    const { activatedToolKeys, content } = executeSearchTool({
      servers: visibleMCPServers,
      query: toolParams.query,
      limit: toolParams.limit,
    });

    if (activatedToolKeys.length > 0) {
      useMCPStore.getState().activateToolKeys(taskId, activatedToolKeys);
    }

    const searchToolMessage: ChatMessage = {
      role: ChatRole.Tool,
      content,
      tool_call_id: toolCall.id,
    };
    messages.push(searchToolMessage);

    useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
      draft.messages.push({
        id: nanoid(),
        role: ChatRole.Tool,
        content,
        tool_call_id: toolCall.id,
        createdAt: Date.now(),
      } as ChatMessage);
    });

    debugLog(MODULE, 'search_tool executed locally', {
      taskId,
      toolId: toolCall.id,
      activatedCount: activatedToolKeys.length,
    });

    const toolResultCtxSearch: ToolResultHookContext = {
      ...toolCallCtx,
      duration: Date.now() - toolStartTime,
    };
    await lifecycleManager.trigger('onAfterToolCall', toolResultCtxSearch);
    return { shouldContinue: true, success: true };
  }

  // ── 分支 2：on-demand 模式下 use_mcp_tool / access_mcp_resource 激活验证 ──
  if (
    isOnDemandMode &&
    (toolCall.function.name === 'use_mcp_tool' ||
      toolCall.function.name === 'access_mcp_resource')
  ) {
    const resolution = resolveOnDemandUseMcpToolCall({
      params: {
        server_name: toolParams.server_name,
        tool_name: toolParams.tool_name,
      },
      servers: visibleMCPServers,
      activatedToolKeys: useMCPStore.getState().getActivatedToolKeys(taskId),
    });

    if (!resolution.ok) {
      const rejectionMessage: ChatMessage = {
        role: ChatRole.Tool,
        content:
          resolution.errorMessage || 'Tool not activated. Call search_tool first.',
        tool_call_id: toolCall.id,
      };
      messages.push(rejectionMessage);

      useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
        draft.messages.push({
          id: nanoid(),
          role: ChatRole.Tool,
          content: rejectionMessage.content as string,
          tool_call_id: toolCall.id,
          createdAt: Date.now(),
        } as ChatMessage);
      });

      debugLog(MODULE, 'use_mcp_tool rejected: not activated', {
        taskId,
        toolId: toolCall.id,
        rejectReason: resolution.rejectReason,
      });

      const toolResultCtxRejected: ToolResultHookContext = {
        ...toolCallCtx,
        duration: Date.now() - toolStartTime,
      };
      await lifecycleManager.trigger('onAfterToolCall', toolResultCtxRejected);
      return { shouldContinue: true, success: true };
    }
  }

  // ── 分支 3：文件编辑工具检测（write / edit / replace_in_file / reapply） ──
  const isFileEditTool = [
    'edit_file',
    'replace_in_file',
    'reapply',
    'write',
    'edit',
  ].includes(toolCall.function.name);

  if (isFileEditTool) {
    let filePath: string;
    let updateSnippet: string;
    let replaceSnippet: string;
    let isCreateFile: boolean;
    if (toolCall.function.name === 'write') {
      filePath = toolParams.file_path || '';
      updateSnippet = toolParams.content || '';
      replaceSnippet = '';
      isCreateFile = toolParams.is_create_file !== false;
    } else if (toolCall.function.name === 'edit') {
      filePath = toolParams.file_path || '';
      updateSnippet =
        toolParams.new_string || toolParams.code_edit || toolParams.diff || '';
      replaceSnippet = toolParams.old_string || toolParams.diff || '';
      isCreateFile = toolParams.is_create_file === true;
    } else {
      filePath = toolParams.target_file || toolParams.path || '';
      updateSnippet = toolParams.code_edit || toolParams.diff || '';
      replaceSnippet = toolParams.diff || '';
      isCreateFile = toolParams.is_create_file === true;
    }
    useChatApplyStore.getState().setChatApplyItem(toolCall.id, {
      filePath,
      originalContent: '',
      updateSnippet,
      replaceSnippet,
      type: toolCall.function.name,
      toolCallId: toolCall.id,
      applying: true,
      accepted: false,
      isCreateFile,
    });
  }

  // ── 终端工具特殊参数处理 ──────────────────────────────────────────────────
  const isTerminalTool = toolCall.function.name === 'run_terminal_cmd';
  const extraToolParams = isTerminalTool
    ? { ...toolParams, messageId: toolCall.id }
    : toolParams;

  // ── Telemetry：开启工具调用 span ─────────────────────────────────────────
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
      useSavedContext: false,
    });
    toolSpan.setAttribute('subagent.tool.parent_task_id', taskId);
  }

  // ── 分支 4：执行策略判定 + 用户确认 ─────────────────────────────────────
  const { getExecutionStrategy } =
    await import('../../../services/toolExecution/ToolExecutionStrategy');
  const { createSubagentContext } =
    await import('../../../types/executionContext');

  const executionContext = createSubagentContext(toolCall.id, taskId);
  const strategy = getExecutionStrategy(executionContext);
  const shouldAutoExecute = strategy.shouldAutoExecute(toolCall, executionContext);

  let userConfirmed = true;
  if (!shouldAutoExecute) {
    debugLog(MODULE, 'Requesting user confirmation', {
      taskId,
      toolId: toolCall.id,
      toolName: toolCall.function.name,
    });

    const { useToolConfirmationStore } =
      await import('../store/toolConfirmation');

    if (abortManager.signal.aborted) {
      userConfirmed = false;
    } else {
      try {
        const abortCleanup: { current: (() => void) | null } = { current: null };
        try {
          userConfirmed = await Promise.race([
            useToolConfirmationStore.getState().requestConfirmation({
              taskId,
              toolId: toolCall.id,
              toolName: toolCall.function.name,
              toolParams: toolParams,
              isDangerous: true,
              timestamp: Date.now(),
            }),
            new Promise<boolean>((resolve) => {
              const onAbort = () => {
                useToolConfirmationStore.getState().clear();
                resolve(false);
              };
              abortManager.signal.addEventListener('abort', onAbort, {
                once: true,
              });
              abortCleanup.current = () => {
                abortManager.signal.removeEventListener('abort', onAbort);
              };
            }),
          ]);
        } finally {
          abortCleanup.current?.();
        }

        debugLog(MODULE, 'User confirmation result', {
          taskId,
          toolId: toolCall.id,
          confirmed: userConfirmed,
        });
      } catch (error) {
        debugLog(MODULE, 'Failed to get user confirmation', {
          taskId,
          toolId: toolCall.id,
          error: error instanceof Error ? error.message : String(error),
        });
        userConfirmed = false;
      }
    }

    if (!userConfirmed) {
      const rejectionMessage: ChatMessage = {
        role: ChatRole.Tool,
        tool_call_id: toolCall.id,
        content: 'User rejected the tool call',
      };
      messages.push(rejectionMessage);
      return { shouldContinue: true, success: true };
    }
  }

  const finalApproval = shouldAutoExecute || userConfirmed;

  // ── 分支 5：IDE 工具调用发送 + 结果等待 ──────────────────────────────────
  // waitForTool 必须在 postMessage 之前注册，确保不会漏接 IDE 的回调。
  // 但必须在确认决策之后调用，避免：
  //   1. 用户拒绝时 pending 条目悬空 7 分钟后超时
  //   2. 计时器将用户确认等待时间计入工具超时预算
  const toolResultPromise = runnerManager.waitForTool(
    taskId,
    toolCall.id,
    abortManager.signal,
    toolCall.function.name,
  );

  debugLog(MODULE, 'Registered waitForTool, sending TOOL_CALL', {
    taskId,
    toolId: toolCall.id,
    toolName: toolCall.function.name,
  });

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
    debugLog(MODULE, 'User confirmed tool execution', {
      taskId,
      toolId: toolCall.id,
      toolName: toolCall.function.name,
    });
  }

  const toolResult = await toolResultPromise;

  // ── Telemetry：关闭工具调用 span ─────────────────────────────────────────
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

  // ── 分支 6：文件编辑后续处理（waitForAcceptEdit + userReporter） ──────────
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
        abortManager.signal,
      );
      useChatApplyStore.getState().acceptEdit(toolCall.id);

      try {
        const acceptResult = await acceptPromise;

        if (!acceptResult?.success) {
          debugLog(MODULE, 'Accept edit failed', {
            message: acceptResult?.message,
          });
          useChatApplyStore.getState().updateChatApplyItem(toolCall.id, {
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
            useChatApplyStore.getState().handleAcceptEditSuccess(applyItem);
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
        abortManager.checkAbort('after-accept-edit-error');
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

  // ── 生命周期钩子：onAfterToolCall ─────────────────────────────────────────
  const toolResultCtx: ToolResultHookContext = {
    ...toolCallCtx,
    duration: Date.now() - toolStartTime,
  };
  await lifecycleManager.trigger('onAfterToolCall', toolResultCtx);

  // ── 分支 7：工具结果处理 + 消息记录 ─────────────────────────────────────
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

    const rawFallback = toolResult?.tool_result?.content ?? toolResult;
    try {
      const fallbackContent =
        typeof rawFallback === 'string'
          ? rawFallback
          : JSON.stringify(rawFallback);
      processedContent = fallbackContent || '[处理失败]';
    } catch {
      processedContent = '[内容序列化失败]';
    }
  }

  const toolMessage: ChatMessage = {
    role: ChatRole.Tool,
    content: processedContent,
    tool_call_id: toolCall.id,
  };
  messages.push(toolMessage);

  // 实时更新 store：追加工具调用结果 message
  useSubagentStore.getState().updateSubagentSession(taskId, (draft) => {
    draft.messages.push({
      id: nanoid(),
      role: ChatRole.Tool,
      content: processedContent,
      tool_call_id: toolCall.id,
      createdAt: Date.now(),
    } as ChatMessage);
  });

  return { shouldContinue: false, success: true };
}