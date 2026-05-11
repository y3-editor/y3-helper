/**
 * TaskCompletionTracker - 统一管理 subagent task 的完成状态
 *
 * 用于解决原有 pendingTaskToolPersist + subagentStore.statuses + tool_result 三状态源不一致的问题。
 * 提供单一状态源查询，支持超时检测和事件驱动的完成通知。
 *
 * @module subagent/state/taskCompletionTracker
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =====================
// Constants
// =====================

/** 单个 task persist 超时时间 (ms) */
export const PERSIST_TIMEOUT_MS = 30_000; // 30 秒

/** 整体完成 watchdog 超时时间 (ms) */
export const COMPLETION_WATCHDOG_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟

/** 用户操作等待超时时间 (ms) */
export const USER_ACTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

// =====================
// Types
// =====================

/** Pending task 持久化条目 */
export interface PendingPersistEntry {
  toolCallId: string;
  sessionId: string;
  startTime: number;
  /** 可选的 agent 名称，用于调试 */
  agentName?: string;
}

/** Task 状态枚举 */
export enum TaskCompletionStatus {
  /** 已注册，等待执行 */
  Registered = 'registered',
  /** 正在执行 */
  Running = 'running',
  /** 执行成功 */
  Completed = 'completed',
  /** 执行失败 */
  Failed = 'failed',
  /** 执行超时 */
  Timeout = 'timeout',
  /** 已取消 */
  Cancelled = 'cancelled',
}

/**
 * Pending task 信息（精简版）
 *
 * 设计原则：只保留完成判断所需的核心字段
 * - 不存储完整 XML 结果（由 tool_result 负责）
 * - 不存储 UI 展示数据（由 subagentStore 负责）
 */
export interface PendingTask {
  // ========== 身份信息 ==========
  toolCallId: string;
  sessionId: string;
  agentName: string;
  description?: string;

  // ========== 核心状态 ==========
  status: TaskCompletionStatus;

  // ========== 时间戳 ==========
  registeredAt: number;
  startedAt?: number;
  completedAt?: number;

  // ========== 结果摘要 ==========
  output?: string;  // 简短摘要（用于日志和事件，非完整 XML）
  error?: string;   // 错误信息
}

/** Watchdog 定时器信息 */
interface WatchdogTimer {
  timerId: ReturnType<typeof setTimeout>;
  sessionId: string;
  toolCallIds: string[];
  startTime: number;
  maxWaitMs: number;
}

/** Store 状态定义 */
interface TaskCompletionState {
  /** 所有 pending tasks，key = toolCallId */
  tasks: Map<string, PendingTask>;

  /** 按 session 分组的 task IDs，key = sessionId */
  sessionTasks: Map<string, Set<string>>;

  /** Watchdog 定时器，key = sessionId */
  watchdogs: Map<string, WatchdogTimer>;
}

/** Store actions 定义 */
interface TaskCompletionActions {
  /**
   * 注册一个待完成的 task
   */
  registerTask: (
    sessionId: string,
    toolCallId: string,
    options?: {
      agentName?: string;
      description?: string;
    },
  ) => void;

  /**
   * 更新 task 状态
   *
   * @param status 新状态
   * @param extra.output 成功时的简短输出摘要（非完整 XML）
   * @param extra.error 失败时的错误信息
   */
  updateTaskStatus: (
    sessionId: string,
    toolCallId: string,
    status: TaskCompletionStatus,
    extra?: {
      output?: string;
      error?: string;
    },
  ) => void;

  /**
   * 判断 session 内所有 task 是否完成
   * 完成定义：所有 task 都是 Completed/Failed/Timeout/Cancelled 状态
   */
  isSessionComplete: (sessionId: string) => boolean;

  /**
   * 获取 session 内所有 task
   */
  getSessionTasks: (sessionId: string) => PendingTask[];

  /**
   * 获取 session 内未完成的 task 数量
   */
  getPendingTaskCount: (sessionId: string) => number;

  /**
   * 清理已完成的 session 数据
   */
  cleanupSession: (sessionId: string) => void;

  /**
   * 启动完成 Watchdog 定时器
   */
  startCompletionWatchdog: (
    sessionId: string,
    toolCallIds: string[],
    maxWaitMs?: number,
    onTimeout?: (timedOutToolCallIds: string[]) => void,
  ) => void;

  /**
   * 清除完成 Watchdog 定时器
   */
  clearCompletionWatchdog: (sessionId: string) => void;

  /**
   * 检查并清理超时的 pending tasks
   * @returns 超时的 toolCallIds
   */
  checkAndCleanupTimeouts: (sessionId: string) => string[];

  /**
   * 重置 store（用于测试和清理）
   */
  reset: () => void;
}

// =====================
// Initial State
// =====================

const createInitialState = (): TaskCompletionState => ({
  tasks: new Map(),
  sessionTasks: new Map(),
  watchdogs: new Map(),
});

// =====================
// Store Implementation
// =====================

export const useTaskCompletionStore = create<
  TaskCompletionState & TaskCompletionActions
>()(
  immer((set, get) => ({
    ...createInitialState(),

    registerTask(sessionId, toolCallId, options) {
      set((state) => {
        const now = Date.now();
        const task: PendingTask = {
          toolCallId,
          sessionId,
          agentName: options?.agentName || 'unknown',  // 必需字段，默认值
          description: options?.description,
          status: TaskCompletionStatus.Registered,
          registeredAt: now,
        };

        state.tasks.set(toolCallId, task);

        // 更新 session 分组
        if (!state.sessionTasks.has(sessionId)) {
          state.sessionTasks.set(sessionId, new Set());
        }
        state.sessionTasks.get(sessionId)!.add(toolCallId);
      });

      if (import.meta.env.DEV) {
        console.log('[TaskCompletionTracker] Task registered:', {
          sessionId,
          toolCallId,
          agentName: options?.agentName,
        });
      }
    },

    updateTaskStatus(sessionId, toolCallId, status, extra) {
      set((state) => {
        const task = state.tasks.get(toolCallId);
        if (!task) {
          console.warn(
            `[TaskCompletionTracker] Task not found: ${toolCallId}`,
          );
          return;
        }

        const now = Date.now();
        task.status = status;

        if (
          status === TaskCompletionStatus.Running &&
          !task.startedAt
        ) {
          task.startedAt = now;
        }

        if (
          status === TaskCompletionStatus.Completed ||
          status === TaskCompletionStatus.Failed ||
          status === TaskCompletionStatus.Timeout ||
          status === TaskCompletionStatus.Cancelled
        ) {
          task.completedAt = now;
        }

        if (extra?.output !== undefined) {
          task.output = extra.output;
        }
        if (extra?.error !== undefined) {
          task.error = extra.error;
        }
      });

      if (import.meta.env.DEV) {
        console.log('[TaskCompletionTracker] Task status updated:', {
          sessionId,
          toolCallId,
          status,
        });
      }

      // 检查是否所有 task 都完成
      const isComplete = get().isSessionComplete(sessionId);
      if (isComplete) {
        // 清除 watchdog
        get().clearCompletionWatchdog(sessionId);

        if (import.meta.env.DEV) {
          console.log(
            '[TaskCompletionTracker] Session all tasks complete:',
            sessionId,
          );
        }
      }
    },

    isSessionComplete(sessionId) {
      const state = get();
      const taskIds = state.sessionTasks.get(sessionId);
      if (!taskIds || taskIds.size === 0) {
        return true; // 没有 task 视为完成
      }

      for (const toolCallId of taskIds) {
        const task = state.tasks.get(toolCallId);
        if (!task) continue;

        if (
          task.status === TaskCompletionStatus.Registered ||
          task.status === TaskCompletionStatus.Running
        ) {
          return false;
        }
      }
      return true;
    },

    getSessionTasks(sessionId) {
      const state = get();
      const taskIds = state.sessionTasks.get(sessionId);
      if (!taskIds) return [];

      const tasks: PendingTask[] = [];
      for (const toolCallId of taskIds) {
        const task = state.tasks.get(toolCallId);
        if (task) {
          tasks.push({ ...task });
        }
      }
      return tasks;
    },

    getPendingTaskCount(sessionId) {
      const state = get();
      const taskIds = state.sessionTasks.get(sessionId);
      if (!taskIds) return 0;

      let count = 0;
      for (const toolCallId of taskIds) {
        const task = state.tasks.get(toolCallId);
        if (
          task &&
          (task.status === TaskCompletionStatus.Registered ||
            task.status === TaskCompletionStatus.Running)
        ) {
          count++;
        }
      }
      return count;
    },

    cleanupSession(sessionId) {
      set((state) => {
        const taskIds = state.sessionTasks.get(sessionId);
        if (taskIds) {
          for (const toolCallId of taskIds) {
            state.tasks.delete(toolCallId);
          }
          state.sessionTasks.delete(sessionId);
        }

        // 清除 watchdog
        const watchdog = state.watchdogs.get(sessionId);
        if (watchdog) {
          clearTimeout(watchdog.timerId);
          state.watchdogs.delete(sessionId);
        }
      });

      if (import.meta.env.DEV) {
        console.log('[TaskCompletionTracker] Session cleaned up:', sessionId);
      }
    },

    startCompletionWatchdog(
      sessionId,
      toolCallIds,
      maxWaitMs = COMPLETION_WATCHDOG_TIMEOUT_MS,
      onTimeout,
    ) {
      const state = get();

      // 清除已有的 watchdog
      const existingWatchdog = state.watchdogs.get(sessionId);
      if (existingWatchdog) {
        clearTimeout(existingWatchdog.timerId);
      }

      const timerId = setTimeout(() => {
        if (import.meta.env.DEV) {
          console.warn(
            `[TaskCompletionTracker] Watchdog timeout for session ${sessionId}`,
          );
        }

        // 找出未完成的 task
        const timedOutToolCallIds: string[] = [];
        const currentState = get();

        for (const toolCallId of toolCallIds) {
          const task = currentState.tasks.get(toolCallId);
          if (
            task &&
            (task.status === TaskCompletionStatus.Registered ||
              task.status === TaskCompletionStatus.Running)
          ) {
            timedOutToolCallIds.push(toolCallId);
            // 更新状态为超时
            currentState.updateTaskStatus(
              sessionId,
              toolCallId,
              TaskCompletionStatus.Timeout,
              { error: 'Task completion watchdog timeout' },
            );
          }
        }

        // 触发回调
        if (onTimeout && timedOutToolCallIds.length > 0) {
          onTimeout(timedOutToolCallIds);
        }

        // 清除 watchdog
        set((s) => {
          s.watchdogs.delete(sessionId);
        });
      }, maxWaitMs);

      set((s) => {
        s.watchdogs.set(sessionId, {
          timerId,
          sessionId,
          toolCallIds,
          startTime: Date.now(),
          maxWaitMs,
        });
      });

      if (import.meta.env.DEV) {
        console.log('[TaskCompletionTracker] Watchdog started:', {
          sessionId,
          toolCallIds,
          maxWaitMs,
        });
      }
    },

    clearCompletionWatchdog(sessionId) {
      set((state) => {
        const watchdog = state.watchdogs.get(sessionId);
        if (watchdog) {
          clearTimeout(watchdog.timerId);
          state.watchdogs.delete(sessionId);

          if (import.meta.env.DEV) {
            console.log(
              '[TaskCompletionTracker] Watchdog cleared:',
              sessionId,
            );
          }
        }
      });
    },

    checkAndCleanupTimeouts(sessionId) {
      const state = get();
      const taskIds = state.sessionTasks.get(sessionId);
      if (!taskIds) return [];

      const now = Date.now();
      const timedOutIds: string[] = [];

      for (const toolCallId of taskIds) {
        const task = state.tasks.get(toolCallId);
        if (!task) continue;

        // 只检查 Registered 或 Running 状态的 task
        if (
          task.status !== TaskCompletionStatus.Registered &&
          task.status !== TaskCompletionStatus.Running
        ) {
          continue;
        }

        // 检查是否超时
        const elapsed = now - task.registeredAt;
        if (elapsed > PERSIST_TIMEOUT_MS) {
          timedOutIds.push(toolCallId);
          state.updateTaskStatus(
            sessionId,
            toolCallId,
            TaskCompletionStatus.Timeout,
            { error: `Task persist timeout after ${elapsed}ms` },
          );

          console.error(
            `[TaskCompletionTracker] Task timeout: ${toolCallId}, elapsed: ${elapsed}ms`,
          );
        }
      }

      return timedOutIds;
    },

    reset() {
      // 清除所有 watchdogs
      const state = get();
      for (const watchdog of state.watchdogs.values()) {
        clearTimeout(watchdog.timerId);
      }

      set(createInitialState());

      if (import.meta.env.DEV) {
        console.log('[TaskCompletionTracker] Store reset');
      }
    },
  })),
);

// =====================
// Selectors (for React components)
// =====================

/**
 * 选择器：获取 session 是否完成
 */
export const selectIsSessionComplete = (sessionId: string) =>
  useTaskCompletionStore.getState().isSessionComplete(sessionId);

/**
 * 选择器：获取 session 待完成的 task 数量
 */
export const selectPendingTaskCount = (sessionId: string) =>
  useTaskCompletionStore.getState().getPendingTaskCount(sessionId);