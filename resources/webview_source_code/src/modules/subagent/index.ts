/**
 * Subagent 模块 —— 统一导出入口（Facade）
 *
 * 外部消费者统一从 '@/modules/subagent' 导入，不直接引用子模块路径。
 *
 * 导出内容：
 * - 类型定义（types.ts）
 * - 常量定义（constants.ts）
 * - 生命周期管理（lifecycle/）
 * - 状态管理（state/）
 * - Agent 注册表（agents/）
 * - 核心执行引擎（core/）
 * - 工具函数（utils/）
 */

// ============================================================
// 类型导出
// ============================================================

export type {
  Agent,
  PendingToolCall,
  SubagentRunnerState,
  TaskParams,
  TaskResult,
  RunSubagentContext,
  LLMCallUsage,
  LLMCallResult,
  SubagentStatus,
  SubagentToolCall,
  SubagentStatusInfo,
  SubagentSession,
  SubagentSessionMetadata,
} from './types';

export { ErrorSeverity } from './types';

// ============================================================
// 常量导出
// ============================================================

export {
  TOOL_TIMEOUT_MS,
  MAX_CONCURRENT_RUNNERS,
  MAX_QUEUE_SIZE,
  DEFAULT_MAX_STEPS,
  MAX_EVENTS,
  COMPRESSION_THRESHOLD,
} from './constants';

// ============================================================
// 生命周期导出
// ============================================================

export type {
  HookContext,
  StepHookContext,
  ToolCallHookContext,
  ToolResultHookContext,
  CompleteHookContext,
  TokenUsageHookContext,
  SubagentLifecycleHooks,
} from './lifecycle/hooks';

export { LifecycleManager, lifecycleManager } from './lifecycle/hooks';
export { RunnerManager, runnerManager } from './lifecycle/manager';
export { SubagentScheduler, subagentScheduler } from './lifecycle/scheduler';
export type { QueuedTaskInfo } from './lifecycle/scheduler';
export {
  SubagentCoordinator,
  subagentCoordinator,
  type AbortResult,
  type BatchAbortResult
} from './lifecycle/coordinator';
export {
  registerBuiltinHooks,
  resetBuiltinHooksRegistration,
} from './lifecycle/builtin-hooks';

// ============================================================
// State 导出
// ============================================================

export { useSubagentStore } from './state/store';

// TaskCompletionTracker - 统一任务完成状态管理
export {
  useTaskCompletionStore,
  TaskCompletionStatus,
  PERSIST_TIMEOUT_MS,
  COMPLETION_WATCHDOG_TIMEOUT_MS,
  USER_ACTION_TIMEOUT_MS,
  selectIsSessionComplete,
  selectPendingTaskCount,
} from './state/taskCompletionTracker';
export type {
  PendingPersistEntry,
  PendingTask,
} from './state/taskCompletionTracker';

// ============================================================
// Agents 导出
// ============================================================

export {
  BUILTIN_AGENTS,
  EXPLORE_AGENT,
  GENERAL_AGENT,
  getAgent,
} from './agents';

// ============================================================
// Core 导出
// ============================================================

export { runSubagent, retrySubagent, stopFailedSubagent } from './core/executor';

export {
  createNewSession,
  resumeSession,
  syncSession,
} from './core/session';

export {
  streamChat,
  createEmptyUsage,
  mergeUsage,
} from './core/llm';

export { checkAndCompress } from './core/compression';
export type {
  CompressionAnalysis,
  CompressionResult,
} from './core/compression';

// ============================================================
// Components 导出
// ============================================================

export { default as SubagentToolConfirmationPanel } from './components/SubagentToolConfirmationPanel';

// ============================================================
// Store 导出
// ============================================================

export { useToolConfirmationStore } from './store/toolConfirmation';
export type { ToolConfirmationRequest } from './store/toolConfirmation';

// ============================================================
// Utils 导出
// ============================================================

export {
  getToolsForAgent,
  buildInitialMessages,
  formatTaskResult,
  validateToolResults,
  TaskStatus,
  classifyError,
  withRetry,
} from './utils';
export type { Tool, ChatMessage, RetryOptions, TaskResultFormatOptions } from './utils';

// ============================================================
// Events 导出 - 事件驱动完成通知机制
// ============================================================

export {
  // Event bus
  taskEventBus,
  emitTaskRegistered,
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
  emitTaskTimeout,
  emitTaskCancelled,
  emitSessionAllTasksComplete,
  // Event creators
  createTaskRegisteredEvent,
  createTaskStartedEvent,
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createTaskTimeoutEvent,
  createTaskCancelledEvent,
  createSessionAllTasksCompleteEvent,
  // Coordinator
  taskCoordinator,
  // Pending Event Queue
  pendingEventQueue,
  PENDING_EVENT_EXPIRY_MS,
} from './events';

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
} from './events';

// ============================================================
// 模块初始化：自动注册内置钩子
// ============================================================

import { registerBuiltinHooks } from './lifecycle/builtin-hooks';

// 模块加载时自动注册内置钩子
registerBuiltinHooks();