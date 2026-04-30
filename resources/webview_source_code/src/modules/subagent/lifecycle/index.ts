/**
 * Lifecycle 子模块导出入口
 *
 * 生命周期管理：RunnerManager、Scheduler、LifecycleManager、内置钩子
 */

// 生命周期钩子系统
export {
  LifecycleManager,
  lifecycleManager,
} from './hooks';
export type {
  HookContext,
  StepHookContext,
  ToolCallHookContext,
  ToolResultHookContext,
  CompleteHookContext,
  TokenUsageHookContext,
  SubagentLifecycleHooks,
} from './hooks';

// Runner 管理器
export { RunnerManager, runnerManager } from './manager';

// 并发调度器
export { SubagentScheduler, subagentScheduler } from './scheduler';

// 内置钩子注册
export {
  registerBuiltinHooks,
  resetBuiltinHooksRegistration,
} from './builtin-hooks';