/**
 * Subagent Completion 验证工具
 *
 * 用于在开发环境中验证事件驱动完成通知机制是否正常工作。
 *
 * 使用方法：
 * 1. 在浏览器控制台中执行: window.__subagentCompletionDebug.enable()
 * 2. 触发一个包含 task 工具的对话
 * 3. 观察控制台输出，验证事件流程
 * 4. 完成后执行: window.__subagentCompletionDebug.disable()
 *
 * 验证清单：
 * - [ ] TASK_REGISTERED 事件在 task tool call 被识别时触发
 * - [ ] TASK_STARTED 事件在 subagent 开始执行时触发
 * - [ ] TASK_COMPLETED/TASK_FAILED 事件在 subagent 完成时触发
 * - [ ] SESSION_ALL_TASKS_COMPLETE 事件在所有 task 完成时触发
 * - [ ] handleAutoExecute 被正确调用
 * - [ ] Watchdog 超时机制正常工作（可通过模拟超时测试）
 */

import {
  taskEventBus,
  useTaskCompletionStore,
} from '../modules/subagent';
import type { TaskEvent } from '../modules/subagent';
import {
  debugLog,
  debugSuccess,
  debugWarn,
  debugError,
  debugInfo,
} from './debugLog';

const MODULE = 'SubagentCompletion';

interface DebugState {
  enabled: boolean;
  unsubscribe: (() => void) | null;
  eventLog: Array<{
    timestamp: number;
    event: TaskEvent;
  }>;
}

const debugState: DebugState = {
  enabled: false,
  unsubscribe: null,
  eventLog: [],
};

/**
 * 启用调试模式
 */
function enable(): void {
  if (debugState.enabled) {
    debugWarn(MODULE, 'Already enabled');
    return;
  }

  debugState.enabled = true;
  debugState.eventLog = [];

  // 订阅所有事件
  debugState.unsubscribe = taskEventBus.on('*', (event: TaskEvent) => {
    const entry = {
      timestamp: Date.now(),
      event,
    };
    debugState.eventLog.push(entry);

    // 根据事件类型选择日志级别
    const baseData = {
      sessionId: event.sessionId,
      toolCallId: 'toolCallId' in event ? event.toolCallId : undefined,
      taskId: 'taskId' in event ? event.taskId : undefined,
      time: new Date(event.timestamp).toISOString(),
    };

    switch (event.type) {
      case 'TASK_REGISTERED':
        debugInfo(MODULE, `📝 ${event.type}`, {
          ...baseData,
          agentName: event.agentName,
          description: event.description,
        });
        break;

      case 'TASK_STARTED':
        debugInfo(MODULE, `🚀 ${event.type}`, {
          ...baseData,
          agentName: event.agentName,
        });
        break;

      case 'TASK_COMPLETED':
        debugSuccess(MODULE, `✅ ${event.type}`, {
          ...baseData,
          result: event.result,
        });
        break;

      case 'TASK_FAILED':
        debugError(MODULE, `❌ ${event.type}`, {
          ...baseData,
          error: event.error,
        });
        break;

      case 'TASK_TIMEOUT':
        debugWarn(MODULE, `⏰ ${event.type}`, {
          ...baseData,
          elapsed: event.elapsed,
        });
        break;

      case 'TASK_CANCELLED':
        debugWarn(MODULE, `🚫 ${event.type}`, {
          ...baseData,
          reason: event.reason,
        });
        break;

      case 'SESSION_ALL_TASKS_COMPLETE':
        debugSuccess(MODULE, `🎉 ${event.type}`, {
          ...baseData,
          resultsCount: Object.keys(event.results).length,
        });
        break;

      default:
        debugLog(MODULE, (event as any).type, baseData);
    }
  });

  debugSuccess(MODULE, 'Enabled - monitoring all task events');
  debugInfo(MODULE, 'Available commands', {
    disable: 'window.__subagentCompletionDebug.disable()',
    getEventLog: 'window.__subagentCompletionDebug.getEventLog()',
    getState: 'window.__subagentCompletionDebug.getState()',
    clearEventLog: 'window.__subagentCompletionDebug.clearEventLog()',
    simulateTimeout: 'window.__subagentCompletionDebug.simulateTimeout(sessionId)',
    validateEventFlow: 'window.__subagentCompletionDebug.validateEventFlow()',
  });
}

/**
 * 禁用调试模式
 */
function disable(): void {
  if (!debugState.enabled) {
    debugWarn(MODULE, 'Not enabled');
    return;
  }

  if (debugState.unsubscribe) {
    debugState.unsubscribe();
    debugState.unsubscribe = null;
  }

  debugState.enabled = false;
  debugWarn(MODULE, 'Disabled');
}

/**
 * 获取事件日志
 */
function getEventLog(): Array<{ timestamp: number; event: TaskEvent }> {
  return [...debugState.eventLog];
}

/**
 * 清除事件日志
 */
function clearEventLog(): void {
  debugState.eventLog = [];
  debugInfo(MODULE, 'Event log cleared');
}

/**
 * 获取当前 TaskCompletionTracker 状态
 */
function getState(): {
  tasks: Record<string, any>;
  sessionTasks: Record<string, string[]>;
  watchdogs: Record<string, any>;
} {
  const store = useTaskCompletionStore.getState();

  const tasks: Record<string, any> = {};
  for (const [id, task] of store.tasks.entries()) {
    tasks[id] = { ...task };
  }

  const sessionTasks: Record<string, string[]> = {};
  for (const [sessionId, taskSet] of store.sessionTasks.entries()) {
    sessionTasks[sessionId] = Array.from(taskSet);
  }

  const watchdogs: Record<string, any> = {};
  for (const [sessionId, watchdog] of store.watchdogs.entries()) {
    watchdogs[sessionId] = {
      sessionId: watchdog.sessionId,
      toolCallIds: watchdog.toolCallIds,
      startTime: new Date(watchdog.startTime).toISOString(),
      maxWaitMs: watchdog.maxWaitMs,
      elapsed: Date.now() - watchdog.startTime,
    };
  }

  return { tasks, sessionTasks, watchdogs };
}

/**
 * 模拟超时（用于测试 watchdog）
 */
function simulateTimeout(sessionId: string): void {
  debugInfo(MODULE, `Simulating timeout for session: ${sessionId}`);

  const store = useTaskCompletionStore.getState();
  const taskIds = store.sessionTasks.get(sessionId);

  if (!taskIds || taskIds.size === 0) {
    debugWarn(MODULE, 'No tasks found for session');
    return;
  }

  // 触发超时检查
  const timedOutIds = store.checkAndCleanupTimeouts(sessionId);

  if (timedOutIds.length > 0) {
    debugSuccess(MODULE, 'Forced timeout for tasks', {
      timedOutIds: timedOutIds as unknown as Record<string, unknown>,
    });
  } else {
    debugWarn(
      MODULE,
      'No tasks eligible for timeout (may not have exceeded threshold)',
    );
  }
}

/**
 * 验证事件流程是否完整
 */
function validateEventFlow(): {
  valid: boolean;
  issues: string[];
  summary: Record<string, number>;
} {
  const issues: string[] = [];
  const summary: Record<string, number> = {
    TASK_REGISTERED: 0,
    TASK_STARTED: 0,
    TASK_COMPLETED: 0,
    TASK_FAILED: 0,
    TASK_TIMEOUT: 0,
    SESSION_ALL_TASKS_COMPLETE: 0,
  };

  for (const entry of debugState.eventLog) {
    const type = entry.event.type;
    if (type in summary) {
      summary[type]++;
    }
  }

  // 验证规则
  if (summary.TASK_REGISTERED === 0) {
    issues.push(
      'No TASK_REGISTERED events - tasks may not be properly registered',
    );
  }

  if (summary.TASK_REGISTERED > 0 && summary.TASK_STARTED === 0) {
    issues.push(
      'Tasks registered but never started - subagent execution may be failing',
    );
  }

  const completions =
    summary.TASK_COMPLETED + summary.TASK_FAILED + summary.TASK_TIMEOUT;
  if (summary.TASK_STARTED > completions) {
    issues.push(
      `${summary.TASK_STARTED - completions} tasks started but not completed`,
    );
  }

  if (completions > 0 && summary.SESSION_ALL_TASKS_COMPLETE === 0) {
    issues.push('Tasks completed but SESSION_ALL_TASKS_COMPLETE not fired');
  }

  debugInfo(MODULE, 'Event flow validation summary', summary);

  if (issues.length > 0) {
    debugWarn(MODULE, 'Issues found', {
      count: issues.length,
      issues: issues as unknown as Record<string, unknown>,
    });
  } else {
    debugSuccess(MODULE, 'Event flow looks healthy!');
  }

  return {
    valid: issues.length === 0,
    issues,
    summary,
  };
}

// 导出调试接口到 window 对象
const debugInterface = {
  enable,
  disable,
  getEventLog,
  clearEventLog,
  getState,
  simulateTimeout,
  validateEventFlow,
  get isEnabled() {
    return debugState.enabled;
  },
};

// 仅在开发环境下注册到 window
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__subagentCompletionDebug = debugInterface;
  debugLog(
    MODULE,
    'Debug tools available at window.__subagentCompletionDebug',
  );
}

export default debugInterface;