/**
 * Subagent Events Module
 *
 * 导出事件驱动架构的所有公共 API。
 *
 * @module subagent/events
 */

// Constants
/** 模块名称，用于调试日志 */
export const MODULE = 'Subagent/Event';

// Types
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
} from './types';

// Event creators
export {
  createTaskRegisteredEvent,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createTaskTimeoutEvent,
  createTaskCancelledEvent,
  createSessionAllTasksCompleteEvent,
} from './types';

// Event bus
export {
  taskEventBus,
  emitTaskRegistered,
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
  emitTaskTimeout,
  emitTaskCancelled,
  emitSessionAllTasksComplete,
} from './taskEventBus';

// Coordinator
export { taskCoordinator } from './taskCoordinator';

// Pending Event Queue - 事件持久化队列
export {
  pendingEventQueue,
  PENDING_EVENT_EXPIRY_MS,
} from './pendingEventQueue';