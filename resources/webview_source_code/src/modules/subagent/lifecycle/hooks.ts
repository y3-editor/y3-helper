/**
 * SubagentLifecycleManager —— 生命周期钩子系统
 *
 * 职责：
 * - 管理 subagent 执行过程中的生命周期事件
 * - 解耦核心执行逻辑与副作用（状态同步、事件发射、日志）
 * - 支持多个钩子注册，按顺序串行执行
 *
 * 设计决策：
 * - 钩子失败不阻断主流程（catch + console.error）
 * - register() 返回反注册函数
 * - 使用单例模式，与 RunnerManager 保持一致
 */

import type {
  SubagentStatusInfo,
  TaskParams,
  LLMCallUsage,
  RunSubagentContext,
} from '../types';

// ============================================================
// 钩子上下文类型
// ============================================================

/** 钩子上下文：传递给钩子函数的公共信息 */
export interface HookContext {
  /** 子会话 ID（task_id） */
  taskId: string;
  /** 主会话 tool_call ID（UI 状态主键） */
  toolCallId: string;
  /** Agent 名称 */
  agentName: string;
  /** 父会话 ID */
  parentSessionId: string;
}

/** 步骤钩子上下文 */
export interface StepHookContext extends HookContext {
  /** 当前步数 */
  step: number;
  /** 最大步数 */
  maxSteps: number;
}

/** 工具调用钩子上下文 */
export interface ToolCallHookContext extends HookContext {
  /** 工具调用 ID */
  toolId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数（JSON 字符串） */
  toolArguments: string;
}

/** 工具结果钩子上下文 */
export interface ToolResultHookContext extends ToolCallHookContext {
  /** 工具执行耗时（毫秒） */
  duration: number;
}

/** 完成钩子上下文 */
export interface CompleteHookContext extends HookContext {
  /** 是否成功 */
  success: boolean;
  /** 最终步数 */
  step: number;
  /** 错误信息（失败时） */
  error?: string;
  /** 是否被中止 */
  isAborted?: boolean;
}

/** Token 用量钩子上下文 */
export interface TokenUsageHookContext extends HookContext {
  /** 累计用量 */
  usage: LLMCallUsage;
}

// ============================================================
// 钩子接口
// ============================================================

/**
 * 子代理生命周期钩子接口。
 * 所有方法均为可选，实现者按需提供。
 */
export interface SubagentLifecycleHooks {
  /** 启动前验证（可 throw 中止启动） */
  onBeforeStart?: (
    params: TaskParams,
    context: RunSubagentContext,
  ) => void | Promise<void>;

  /** 启动时创建会话 */
  onStart?: (ctx: HookContext, statusInfo: SubagentStatusInfo) => void | Promise<void>;

  /** 每步开始前 */
  onBeforeStep?: (ctx: StepHookContext) => void | Promise<void>;

  /** 每步结束后同步 */
  onAfterStep?: (
    ctx: StepHookContext,
    usage: LLMCallUsage,
  ) => void | Promise<void>;

  /** 完成时 */
  onComplete?: (ctx: CompleteHookContext) => void | Promise<void>;

  /** 中止时 */
  onAbort?: (ctx: HookContext) => void | Promise<void>;

  /** 失败时 */
  onError?: (ctx: HookContext, error: Error) => void | Promise<void>;

  /** 工具调用前 */
  onBeforeToolCall?: (ctx: ToolCallHookContext) => void | Promise<void>;

  /** 工具调用后 */
  onAfterToolCall?: (ctx: ToolResultHookContext) => void | Promise<void>;

  /** 工具超时 */
  onToolTimeout?: (ctx: ToolCallHookContext, timeoutMs: number) => void | Promise<void>;

  /** 上下文压缩触发 */
  onCompression?: (
    ctx: HookContext,
    tokensBefore: number,
    tokensAfter: number,
  ) => void | Promise<void>;

  /** 会话恢复 */
  onResume?: (
    ctx: HookContext,
    historyMessageCount: number,
  ) => void | Promise<void>;

  /** Token 用量更新 */
  onTokenUsage?: (ctx: TokenUsageHookContext) => void | Promise<void>;
}

// ============================================================
// 生命周期管理器
// ============================================================

export class LifecycleManager {
  private hooks: SubagentLifecycleHooks[] = [];

  /**
   * 注册一组钩子。
   * @param hooks 钩子对象
   * @returns 反注册函数
   */
  register(hooks: SubagentLifecycleHooks): () => void {
    this.hooks.push(hooks);
    return () => {
      const index = this.hooks.indexOf(hooks);
      if (index !== -1) {
        this.hooks.splice(index, 1);
      }
    };
  }

  /**
   * 触发指定生命周期事件。
   * 按注册顺序串行执行所有钩子的对应方法。
   * 钩子失败不阻断后续钩子和主流程。
   *
   * @param event 事件名称（钩子方法名）
   * @param args 传递给钩子的参数
   */
  async trigger<K extends keyof SubagentLifecycleHooks>(
    event: K,
    ...args: Parameters<NonNullable<SubagentLifecycleHooks[K]>>
  ): Promise<void> {
    for (const hook of this.hooks) {
      const fn = hook[event];
      if (typeof fn === 'function') {
        try {
          await (fn as (...a: any[]) => any)(...args);
        } catch (err) {
          console.error(
            `[Subagent] Lifecycle hook "${event}" failed:`,
            err,
          );
        }
      }
    }
  }

  /**
   * 清空所有已注册的钩子。
   * 主要用于测试场景。
   */
  clear(): void {
    this.hooks = [];
  }

  /**
   * 获取当前注册的钩子数量。
   */
  get count(): number {
    return this.hooks.length;
  }
}

/** 全局单例 */
export const lifecycleManager = new LifecycleManager();