/**
 * 内置生命周期钩子
 *
 * 注册系统默认的生命周期钩子：
 * - UI 状态同步钩子
 * - 事件发射钩子
 * - 会话同步钩子
 * - 开发日志钩子（仅开发模式）
 */

import type { SubagentLifecycleHooks } from './hooks';
import { lifecycleManager } from './hooks';
import { useSubagentStore } from '../state/store';
import { emitEvent } from '../state/events';
import type { SubagentStatus } from '../types';

// ============================================================
// UI 状态同步钩子
// ============================================================

const uiStateHooks: SubagentLifecycleHooks = {
  onStart: (ctx, statusInfo) => {
    useSubagentStore.getState().updateStatus(ctx.toolCallId, statusInfo);
  },

  onBeforeStep: (ctx) => {
    useSubagentStore.getState().updateStatus(ctx.toolCallId, {
      step: ctx.step,
      status: 'running' as SubagentStatus,
    });
  },

  onBeforeToolCall: (ctx) => {
    const store = useSubagentStore.getState();
    const existing = store.statuses[ctx.toolCallId];
    const toolCalls = existing?.toolCalls || [];

    // 更新状态为 waiting_tool，并添加新的工具调用记录
    store.updateStatus(ctx.toolCallId, {
      status: 'waiting_tool' as SubagentStatus,
      toolCalls: [
        ...toolCalls,
        {
          toolCallId: ctx.toolId,
          toolName: ctx.toolName,
          startTime: Date.now(),
        },
      ],
    });
  },

  onAfterToolCall: (ctx) => {
    const store = useSubagentStore.getState();
    const existing = store.statuses[ctx.toolCallId];
    const toolCalls = existing?.toolCalls || [];

    // 更新对应的工具调用记录的 endTime，并恢复状态为 running
    const updatedToolCalls = toolCalls.map((tc) =>
      tc.toolCallId === ctx.toolId ? { ...tc, endTime: Date.now() } : tc,
    );

    store.updateStatus(ctx.toolCallId, {
      status: 'running' as SubagentStatus,
      toolCalls: updatedToolCalls,
    });
  },

  onError: (ctx, error) => {
    // 立即将状态更新为 failed 并携带错误信息，供 UI 展示 Retry/Stop 按钮
    useSubagentStore.getState().updateStatus(ctx.toolCallId, {
      status: 'failed' as SubagentStatus,
      errorMessage: error.message,
      endTime: Date.now(),
    });
  },

  onComplete: (ctx) => {
    const finalStatus: SubagentStatus = ctx.success
      ? 'completed'
      : ctx.isAborted
        ? 'aborted'
        : 'failed';

    useSubagentStore.getState().updateStatus(ctx.toolCallId, {
      step: ctx.step,
      status: finalStatus,
      endTime: Date.now(),
    });
  },
};

// ============================================================
// 事件发射钩子
// ============================================================

const eventEmitHooks: SubagentLifecycleHooks = {
  onStart: (ctx) => {
    emitEvent('status_change', ctx.taskId, {
      from: undefined,
      to: 'pending',
      step: 0,
    });
  },

  onBeforeStep: (ctx) => {
    emitEvent('status_change', ctx.taskId, {
      // from: ctx.step === 1 ? 'pending' : 'running',
      from: 'pending',
      to: 'running',
      step: ctx.step,
    });
  },

  onComplete: (ctx) => {
    const finalStatus = ctx.success
      ? 'completed'
      : ctx.isAborted
        ? 'aborted'
        : 'failed';

    emitEvent('status_change', ctx.taskId, {
      from: 'running',
      to: finalStatus,
      step: ctx.step,
    });
  },

  onError: (ctx, error) => {
    emitEvent('error', ctx.taskId, {
      message: error.message,
      severity: 'fatal',
    });
  },
};

// ============================================================
// 开发日志钩子（仅开发模式）
// ============================================================

const devLogHooks: SubagentLifecycleHooks = {
  onStart: (ctx) => {
    console.log(`[Subagent] Started: ${ctx.taskId} (agent: ${ctx.agentName})`);
  },

  onBeforeStep: (ctx) => {
    console.log(
      `[Subagent] ${ctx.taskId} starting step ${ctx.step}/${ctx.maxSteps}`,
    );
  },

  onComplete: (ctx) => {
    const status = ctx.success
      ? 'completed'
      : ctx.isAborted
        ? 'aborted'
        : 'failed';
    console.log(
      `[Subagent] ${ctx.taskId} ${status} at step ${ctx.step}${ctx.error ? `: ${ctx.error}` : ''}`,
    );
  },

  onResume: (ctx, historyMessageCount) => {
    console.log(
      `[Subagent] Resumed session ${ctx.taskId} with ${historyMessageCount} history messages`,
    );
  },

  onCompression: (ctx, tokensBefore, tokensAfter) => {
    console.log(
      `[Subagent] ${ctx.taskId} compression complete: ${tokensBefore} → ${tokensAfter} tokens`,
    );
  },
};

// ============================================================
// 注册内置钩子
// ============================================================

let registered = false;

/**
 * 注册所有内置钩子。
 * 应在模块初始化时调用一次。
 */
export function registerBuiltinHooks(): void {
  if (registered) {
    return;
  }
  registered = true;

  // UI 状态同步钩子
  lifecycleManager.register(uiStateHooks);

  // 事件发射钩子
  lifecycleManager.register(eventEmitHooks);

  // 开发日志钩子（仅开发模式）
  if (import.meta.env.DEV) {
    lifecycleManager.register(devLogHooks);
  }
}

/**
 * 重置注册状态（仅用于测试）。
 */
export function resetBuiltinHooksRegistration(): void {
  registered = false;
  lifecycleManager.clear();
}