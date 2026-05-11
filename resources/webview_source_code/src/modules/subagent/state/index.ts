/**
 * State 子模块导出入口
 *
 * 状态管理：Zustand store
 */

// 主 Store（UI 展示层）
export { useSubagentStore } from './store';

// TaskCompletionTracker - 统一任务完成状态管理（业务逻辑层）
export {
  useTaskCompletionStore,
  TaskCompletionStatus,
  PERSIST_TIMEOUT_MS,
  COMPLETION_WATCHDOG_TIMEOUT_MS,
  USER_ACTION_TIMEOUT_MS,
  selectIsSessionComplete,
  selectPendingTaskCount,
} from './taskCompletionTracker';
export type {
  PendingPersistEntry,
  PendingTask,
} from './taskCompletionTracker';