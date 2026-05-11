/**
 * TaskEventBus - Subagent 任务事件总线
 *
 * 提供基于 EventEmitter 模式的事件发布/订阅机制，
 * 用于解耦任务状态生产者和消费者。
 *
 * @module subagent/events/taskEventBus
 */

import type {
  TaskEvent,
  TaskEventType,
  TaskEventHandler,
  TaskEventHandlerMap,
  TaskRegisteredEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskTimeoutEvent,
  TaskCancelledEvent,
  SessionAllTasksCompleteEvent,
} from './types';
import { debugLog, debugError } from '../../../utils/debugLog';

const MODULE = 'Subagent/Event';

// =====================
// Event Bus Class
// =====================

/**
 * TaskEventBus - 任务事件总线
 *
 * 基于 EventEmitter 模式，提供类型安全的事件发布/订阅。
 * 支持同步和异步事件处理器。
 */
class TaskEventBus {
  private handlers: Map<TaskEventType | '*', Set<TaskEventHandler<any>>> =
    new Map();

  private debugEnabled: boolean = import.meta.env.DEV;

  /**
   * 订阅事件
   * @param eventType 事件类型，'*' 表示订阅所有事件
   * @param handler 事件处理器
   * @returns 取消订阅的函数
   */
  on<T extends TaskEventType>(
    eventType: T,
    handler: TaskEventHandler<Extract<TaskEvent, { type: T }>>,
  ): () => void;
  on(eventType: '*', handler: TaskEventHandler): () => void;
  on(
    eventType: TaskEventType | '*',
    handler: TaskEventHandler<any>,
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // 返回取消订阅的函数
    return () => {
      this.off(eventType, handler);
    };
  }

  /**
   * 取消订阅事件
   */
  off(eventType: TaskEventType | '*', handler: TaskEventHandler<any>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * 一次性订阅事件
   */
  once<T extends TaskEventType>(
    eventType: T,
    handler: TaskEventHandler<Extract<TaskEvent, { type: T }>>,
  ): () => void {
    const wrappedHandler = (event: Extract<TaskEvent, { type: T }>) => {
      this.off(eventType, wrappedHandler as TaskEventHandler<any>);
      handler(event);
    };
    return this.on(eventType, wrappedHandler);
  }

  /**
   * 发布事件
   * @param event 事件对象
   */
  emit(event: TaskEvent): void {
    if (this.debugEnabled) {
      debugLog(MODULE, `Emitting event: ${event.type}`, {
        sessionId: event.sessionId,
        toolCallId: 'toolCallId' in event ? event.toolCallId : undefined,
      });
    }

    // 先触发具体事件类型的处理器
    const specificHandlers = this.handlers.get(event.type);
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        this.safeCall(handler, event);
      }
    }

    // 再触发通配符处理器
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        this.safeCall(handler, event);
      }
    }
  }

  /**
   * 批量订阅事件
   */
  subscribe(handlerMap: TaskEventHandlerMap): () => void {
    const unsubscribes: Array<() => void> = [];

    for (const [eventType, handler] of Object.entries(handlerMap)) {
      if (handler) {
        // 区分通配符和具体事件类型
        if (eventType === '*') {
          unsubscribes.push(this.on('*', handler as TaskEventHandler));
        } else {
          unsubscribes.push(
            this.on(eventType as TaskEventType, handler as TaskEventHandler<any>),
          );
        }
      }
    }

    // 返回批量取消订阅的函数
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }

  /**
   * 等待特定事件（Promise 形式）
   * @param eventType 事件类型
   * @param filter 可选的过滤函数
   * @param timeoutMs 超时时间（毫秒），默认不超时
   */
  waitFor<T extends TaskEventType>(
    eventType: T,
    filter?: (event: Extract<TaskEvent, { type: T }>) => boolean,
    timeoutMs?: number,
  ): Promise<Extract<TaskEvent, { type: T }>> {
    return new Promise((resolve, reject) => {
      let timerId: ReturnType<typeof setTimeout> | undefined;

      const handler = (event: Extract<TaskEvent, { type: T }>) => {
        if (!filter || filter(event)) {
          if (timerId) {
            clearTimeout(timerId);
          }
          this.off(eventType, handler as TaskEventHandler<any>);
          resolve(event);
        }
      };

      this.on(eventType, handler);

      if (timeoutMs) {
        timerId = setTimeout(() => {
          this.off(eventType, handler as TaskEventHandler<any>);
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * 获取指定事件类型的处理器数量
   */
  listenerCount(eventType: TaskEventType | '*'): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * 清除所有事件处理器
   */
  clear(): void {
    this.handlers.clear();
    if (this.debugEnabled) {
      debugLog(MODULE, 'All handlers cleared');
    }
  }

  /**
   * 启用/禁用调试日志
   */
  setDebug(enabled: boolean): void {
    this.debugEnabled = enabled;
  }

  /**
   * 安全调用处理器（捕获异常）
   */
  private safeCall(handler: TaskEventHandler<any>, event: TaskEvent): void {
    try {
      const result = handler(event);
      // 如果是 Promise，捕获异步错误
      if (result instanceof Promise) {
        result.catch((err) => {
          debugError(MODULE, `Async handler error for ${event.type}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    } catch (err) {
      debugError(MODULE, `Handler error for ${event.type}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// =====================
// Singleton Instance
// =====================

/** 全局单例事件总线 */
export const taskEventBus = new TaskEventBus();

// =====================
// Convenience Emit Functions
// =====================

/**
 * 发射 TASK_REGISTERED 事件
 */
export function emitTaskRegistered(
  sessionId: string,
  toolCallId: string,
  agentName: string,
  description?: string,
): void {
  taskEventBus.emit({
    type: 'TASK_REGISTERED',
    sessionId,
    toolCallId,
    agentName,
    description,
    timestamp: Date.now(),
  });
}

/**
 * 发射 TASK_STARTED 事件
 */
export function emitTaskStarted(
  sessionId: string,
  toolCallId: string,
  taskId: string,
  agentName: string,
): void {
  taskEventBus.emit({
    type: 'TASK_STARTED',
    sessionId,
    toolCallId,
    taskId,
    agentName,
    timestamp: Date.now(),
  });
}

/**
 * 发射 TASK_COMPLETED 事件
 */
export function emitTaskCompleted(
  sessionId: string,
  toolCallId: string,
  taskId: string,
  result: import('../types').TaskResult,
): void {
  taskEventBus.emit({
    type: 'TASK_COMPLETED',
    sessionId,
    toolCallId,
    taskId,
    result,
    timestamp: Date.now(),
  });
}

/**
 * 发射 TASK_FAILED 事件
 */
export function emitTaskFailed(
  sessionId: string,
  toolCallId: string,
  error: string,
  taskId?: string,
): void {
  taskEventBus.emit({
    type: 'TASK_FAILED',
    sessionId,
    toolCallId,
    taskId,
    error,
    timestamp: Date.now(),
  });
}

/**
 * 发射 TASK_TIMEOUT 事件
 */
export function emitTaskTimeout(
  sessionId: string,
  toolCallId: string,
  elapsed: number,
  taskId?: string,
): void {
  taskEventBus.emit({
    type: 'TASK_TIMEOUT',
    sessionId,
    toolCallId,
    taskId,
    elapsed,
    timestamp: Date.now(),
  });
}

/**
 * 发射 TASK_CANCELLED 事件
 */
export function emitTaskCancelled(
  sessionId: string,
  toolCallId: string,
  reason?: string,
  taskId?: string,
): void {
  taskEventBus.emit({
    type: 'TASK_CANCELLED',
    sessionId,
    toolCallId,
    taskId,
    reason,
    timestamp: Date.now(),
  });
}

/**
 * 发射 SESSION_ALL_TASKS_COMPLETE 事件
 */
export function emitSessionAllTasksComplete(
  sessionId: string,
  results: Record<
    string,
    import('../types').TaskResult | { error: string } | { timeout: true }
  >,
): void {
  taskEventBus.emit({
    type: 'SESSION_ALL_TASKS_COMPLETE',
    sessionId,
    results,
    timestamp: Date.now(),
  });
}

// Re-export types for convenience
export type {
  TaskEvent,
  TaskEventType,
  TaskEventHandler,
  TaskEventHandlerMap,
  TaskRegisteredEvent,
  TaskStartedEvent,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskTimeoutEvent,
  TaskCancelledEvent,
  SessionAllTasksCompleteEvent,
};