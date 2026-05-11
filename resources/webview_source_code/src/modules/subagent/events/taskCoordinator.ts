/**
 * TaskCoordinator - Subagent 任务中央协调器
 *
 * 监听所有 task 事件，管理 watchdog 定时器，
 * 在所有 task 完成时发出 SESSION_ALL_TASKS_COMPLETE 事件。
 *
 * @module subagent/events/taskCoordinator
 */

import {
  taskEventBus,
  emitSessionAllTasksComplete,
  type TaskRegisteredEvent,
  type TaskCompletedEvent,
  type TaskFailedEvent,
  type TaskTimeoutEvent,
  type TaskCancelledEvent,
} from './taskEventBus';
import {
  useTaskCompletionStore,
  TaskCompletionStatus,
  COMPLETION_WATCHDOG_TIMEOUT_MS,
} from '../state/taskCompletionTracker';
import { debugLog, debugWarn } from '../../../utils/debugLog';
import type { TaskResult } from '../types';

const MODULE = 'Subagent/Event';

// =====================
// Coordinator Class
// =====================

/**
 * TaskCoordinator - 任务协调器
 *
 * 负责：
 * 1. 监听所有 task 事件并更新 TaskCompletionStore
 * 2. 管理 session 级别的 watchdog 定时器
 * 3. 当所有 task 完成时发出 SESSION_ALL_TASKS_COMPLETE 事件
 */
class TaskCoordinator {
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;

  /** 存储每个 task 的结果，用于最终汇总 */
  private taskResults: Map<
    string,
    Map<string, TaskResult | { error: string } | { timeout: true }>
  > = new Map();

  /**
   * 原子注册状态管理：标记每个 session 是否已完成所有 task 的注册
   * 只有注册完成后才会进行完成检查
   */
  private registrationComplete: Map<string, boolean> = new Map();

  /**
   * 记录每个 session 预期的 task 数量
   */
  private expectedTaskCounts: Map<string, number> = new Map();

  /**
   * 并发完成检查锁：防止多个 task 同时完成时重复检查
   */
  private checkingLock: Map<string, boolean> = new Map();

  /**
   * 初始化协调器，开始监听事件
   */
  init(): void {
    if (this.isInitialized) {
      debugWarn(MODULE, 'TaskCoordinator already initialized');
      return;
    }

    this.unsubscribe = taskEventBus.subscribe({
      TASK_REGISTERED: this.handleTaskRegistered.bind(this),
      TASK_COMPLETED: this.handleTaskCompleted.bind(this),
      TASK_FAILED: this.handleTaskFailed.bind(this),
      TASK_TIMEOUT: this.handleTaskTimeout.bind(this),
      TASK_CANCELLED: this.handleTaskCancelled.bind(this),
    });

    this.isInitialized = true;

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'TaskCoordinator initialized');
    }
  }

  /**
   * 销毁协调器，停止监听事件
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.taskResults.clear();
    this.isInitialized = false;

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'TaskCoordinator destroyed');
    }
  }

  /**
   * 处理 TASK_REGISTERED 事件
   */
  private handleTaskRegistered(event: TaskRegisteredEvent): void {
    const { sessionId, toolCallId, agentName, description } = event;
    const store = useTaskCompletionStore.getState();

    // 注册 task
    store.registerTask(sessionId, toolCallId, { agentName, description });

    // 初始化 session 的结果存储
    if (!this.taskResults.has(sessionId)) {
      this.taskResults.set(sessionId, new Map());
    }

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'Task registered', {
        sessionId,
        toolCallId,
        agentName,
      });
    }
  }

  /**
   * 处理 TASK_COMPLETED 事件
   */
  private handleTaskCompleted(event: TaskCompletedEvent): void {
    const { sessionId, toolCallId, result } = event;
    const store = useTaskCompletionStore.getState();

    // 更新 task 状态（只存储简短摘要）
    store.updateTaskStatus(
      sessionId,
      toolCallId,
      TaskCompletionStatus.Completed,
      { output: result.output ? result.output.split('\n')[0].substring(0, 100) : undefined },
    );

    // 存储完整结果（用于最终汇总）
    const sessionResults = this.taskResults.get(sessionId);
    if (sessionResults) {
      sessionResults.set(toolCallId, result);
    }

    // 检查是否所有 task 都完成
    this.checkAndEmitAllComplete(sessionId);
  }

  /**
   * 处理 TASK_FAILED 事件
   */
  private handleTaskFailed(event: TaskFailedEvent): void {
    const { sessionId, toolCallId, error } = event;
    const store = useTaskCompletionStore.getState();

    // 更新 task 状态
    store.updateTaskStatus(
      sessionId,
      toolCallId,
      TaskCompletionStatus.Failed,
      { error },
    );

    // 存储结果
    const sessionResults = this.taskResults.get(sessionId);
    if (sessionResults) {
      sessionResults.set(toolCallId, { error });
    }

    // 检查是否所有 task 都完成
    this.checkAndEmitAllComplete(sessionId);
  }

  /**
   * 处理 TASK_TIMEOUT 事件
   */
  private handleTaskTimeout(event: TaskTimeoutEvent): void {
    const { sessionId, toolCallId, elapsed } = event;
    const store = useTaskCompletionStore.getState();

    // 更新 task 状态
    store.updateTaskStatus(
      sessionId,
      toolCallId,
      TaskCompletionStatus.Timeout,
      { error: `Task timeout after ${elapsed}ms` },
    );

    // 存储结果
    const sessionResults = this.taskResults.get(sessionId);
    if (sessionResults) {
      sessionResults.set(toolCallId, { timeout: true });
    }

    // 检查是否所有 task 都完成
    this.checkAndEmitAllComplete(sessionId);
  }

  /**
   * 处理 TASK_CANCELLED 事件
   */
  private handleTaskCancelled(event: TaskCancelledEvent): void {
    const { sessionId, toolCallId, reason } = event;
    const store = useTaskCompletionStore.getState();

    // 更新 task 状态
    store.updateTaskStatus(
      sessionId,
      toolCallId,
      TaskCompletionStatus.Cancelled,
      { error: reason || 'Task cancelled' },
    );

    // 存储结果
    const sessionResults = this.taskResults.get(sessionId);
    if (sessionResults) {
      sessionResults.set(toolCallId, { error: reason || 'Task cancelled' });
    }

    // 检查是否所有 task 都完成
    this.checkAndEmitAllComplete(sessionId);
  }

  /**
   * 标记 session 的所有 task 注册已完成
   *
   * 在所有 task 的 TASK_REGISTERED 事件发出后调用，
   * 防止快速完成的 task 在其他 task 注册前触发 SESSION_ALL_TASKS_COMPLETE
   *
   * @param sessionId 会话 ID
   * @param toolCallIds 所有 task 的 toolCallId 列表
   */
  markRegistrationComplete(sessionId: string, toolCallIds: string[]): void {
    this.registrationComplete.set(sessionId, true);
    this.expectedTaskCounts.set(sessionId, toolCallIds.length);

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'Registration complete', {
        sessionId,
        expectedCount: toolCallIds.length,
      });
    }

    // 注册完成后立即检查一次，处理所有 task 都已完成的情况
    this.checkAndEmitAllComplete(sessionId);
  }

  /**
   * 检查并发出 SESSION_ALL_TASKS_COMPLETE 事件
   *
   * 增强：
   * 1. 原子注册检查：只有注册完成后才进行完成检查
   * 2. 并发锁机制：防止多个 task 同时完成时重复检查
   */
  private checkAndEmitAllComplete(sessionId: string): void {
    // ========== 并发锁检查 ==========
    if (this.checkingLock.get(sessionId)) {
      if (import.meta.env.DEV) {
        debugLog(MODULE, 'Skipping check: already checking', {
          sessionId,
        });
      }
      return;
    }

    // ========== 原子注册检查 ==========
    if (!this.registrationComplete.get(sessionId)) {
      if (import.meta.env.DEV) {
        debugLog(MODULE, 'Skipping check: registration not complete', {
          sessionId,
        });
      }
      return;
    }

    // 获取锁
    this.checkingLock.set(sessionId, true);

    try {
      const store = useTaskCompletionStore.getState();

      // 验证已注册的 task 数量是否达到预期
      const expectedCount = this.expectedTaskCounts.get(sessionId) || 0;
      const sessionTasks = store.sessionTasks.get(sessionId);
      const registeredCount = sessionTasks?.size || 0;

      if (registeredCount < expectedCount) {
        if (import.meta.env.DEV) {
          debugLog(MODULE, 'Not all tasks registered yet', {
            sessionId,
            registeredCount,
            expectedCount,
          });
        }
        return;
      }

      if (store.isSessionComplete(sessionId)) {
        const sessionResults = this.taskResults.get(sessionId);
        if (sessionResults) {
          // 将 Map 转换为 Record
          const results: Record<
            string,
            TaskResult | { error: string } | { timeout: true }
          > = {};
          for (const [toolCallId, result] of sessionResults) {
            results[toolCallId] = result;
          }

          if (import.meta.env.DEV) {
            debugLog(MODULE, 'All tasks complete, emitting event', {
              sessionId,
              taskCount: sessionResults.size,
            });
          }

          // 发出完成事件
          emitSessionAllTasksComplete(sessionId, results);

          // 清理结果存储和注册状态
          this.taskResults.delete(sessionId);
          this.registrationComplete.delete(sessionId);
          this.expectedTaskCounts.delete(sessionId);
        }
      }
    } finally {
      // 释放锁
      this.checkingLock.delete(sessionId);
    }
  }

  /**
   * 为 session 启动 watchdog
   * 通常在检测到 task tool calls 时调用
   */
  startSessionWatchdog(
    sessionId: string,
    toolCallIds: string[],
    maxWaitMs: number = COMPLETION_WATCHDOG_TIMEOUT_MS,
  ): void {
    const store = useTaskCompletionStore.getState();

    store.startCompletionWatchdog(
      sessionId,
      toolCallIds,
      maxWaitMs,
      (timedOutToolCallIds) => {
        // 超时回调：为每个超时的 task 发出 TASK_TIMEOUT 事件
        for (const toolCallId of timedOutToolCallIds) {
          taskEventBus.emit({
            type: 'TASK_TIMEOUT',
            sessionId,
            toolCallId,
            elapsed: maxWaitMs,
            timestamp: Date.now(),
          });
        }
      },
    );
  }

  /**
   * 清除 session 的 watchdog
   */
  clearSessionWatchdog(sessionId: string): void {
    const store = useTaskCompletionStore.getState();
    store.clearCompletionWatchdog(sessionId);
  }

  /**
   * 清理 session 相关的所有数据
   */
  cleanupSession(sessionId: string): void {
    const store = useTaskCompletionStore.getState();
    store.cleanupSession(sessionId);
    this.taskResults.delete(sessionId);
    this.registrationComplete.delete(sessionId);
    this.expectedTaskCounts.delete(sessionId);
    this.checkingLock.delete(sessionId);

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'Session cleaned up', { sessionId });
    }
  }
}

// =====================
// Singleton Instance
// =====================

/** 全局单例协调器 */
export const taskCoordinator = new TaskCoordinator();

// =====================
// Auto-initialization
// =====================

// 自动初始化协调器
// 注意：这会在模块加载时执行
if (typeof window !== 'undefined') {
  taskCoordinator.init();
}