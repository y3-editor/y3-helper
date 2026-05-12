/**
 * Subagent Abort 管理
 *
 * 设计理念：
 * 1. 统一的 abort 异常类型，便于识别和处理
 * 2. 自动检查机制，减少手动判断
 * 3. 集中管理 abort 逻辑，避免散落各处
 */

import { ABORT_REASON_FINISHED } from '../../../utils/abort';

/**
 * Subagent 中止异常
 * 用于在 Subagent 执行过程中传播中止信号
 */
export class SubagentAbortError extends Error {
  readonly isSubagentAbort = true;
  readonly stage: string;

  constructor(stage: string, message = 'Subagent was aborted') {
    super(`${message} at stage: ${stage}`);
    this.name = 'SubagentAbortError';
    this.stage = stage;
  }
}

/**
 * Abort 管理器
 * 封装 AbortController，提供统一的 abort 检查和处理
 */
export class SubagentAbortManager {
  private abortController: AbortController;
  private parentCleanup?: () => void;

  constructor(parentAbortSignal?: AbortSignal) {
    this.abortController = new AbortController();

    // 监听父级 abort 信号
    if (parentAbortSignal) {
      const onParentAbort = () => {
        this.abortController.abort();
      };
      parentAbortSignal.addEventListener('abort', onParentAbort, { once: true });
      this.parentCleanup = () => {
        parentAbortSignal.removeEventListener('abort', onParentAbort);
      };
    }
  }

  /**
   * 获取 AbortSignal（用于传递给 API 调用）
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * 检查是否被中止
   * 如果被中止且不是正常完成，则抛出异常
   *
   * @param stage 当前执行阶段，用于错误信息
   * @throws {SubagentAbortError} 如果被真正中止
   */
  checkAbort(stage: string): void {
    if (!this.abortController.signal.aborted) {
      return;
    }

    const abortReason = (this.abortController.signal as any).reason;
    const isNormalFinish =
      typeof abortReason === 'object' &&
      abortReason !== null &&
      'name' in abortReason &&
      abortReason.name === ABORT_REASON_FINISHED;

    if (!isNormalFinish) {
      throw new SubagentAbortError(stage);
    }
  }

  /**
   * 判断是否已中止（包括正常完成）
   */
  isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * 判断是否是真正的中止（排除正常完成）
   */
  isActuallyAborted(): boolean {
    if (!this.abortController.signal.aborted) {
      return false;
    }

    const abortReason = (this.abortController.signal as any).reason;
    return !(
      typeof abortReason === 'object' &&
      abortReason !== null &&
      'name' in abortReason &&
      abortReason.name === ABORT_REASON_FINISHED
    );
  }

  /**
   * 手动触发 abort
   */
  abort(reason?: any): void {
    this.abortController.abort(reason);
  }

  /**
   * 重置 abort controller（用于 retry）
   *
   * @param parentAbortSignal 新的父级 abort 信号（如果有）
   * @returns 新的 AbortManager 实例
   */
  reset(parentAbortSignal?: AbortSignal): SubagentAbortManager {
    // 清理旧的监听器
    this.cleanup();

    // 创建新的管理器
    return new SubagentAbortManager(parentAbortSignal);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.parentCleanup) {
      this.parentCleanup();
      this.parentCleanup = undefined;
    }
  }

  /**
   * 创建一个可中止的 Promise 包装器
   * 自动在 abort 时拒绝 Promise
   */
  async wrapPromise<T>(
    promise: Promise<T>,
    stage: string,
  ): Promise<T> {
    if (this.isActuallyAborted()) {
      throw new SubagentAbortError(stage);
    }

    let onAbort: (() => void) | undefined;

    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => {
        // 只在真正中止时 reject
        if (this.isActuallyAborted()) {
          reject(new SubagentAbortError(stage));
        }
      };
      this.abortController.signal.addEventListener('abort', onAbort, {
        once: true,
      });
      // 注册监听器后立即补检查一次，防止 addEventListener 注册期间的竞态窗口：
      // 若 abort 在提前检查通过后、监听器注册完成前触发，abort 事件已错过，
      // 此处补检可确保该情况下仍能正确 reject。
      onAbort();
    });

    try {
      return await Promise.race([promise, abortPromise]);
    } finally {
      // 无论 promise 还是 abortPromise 先完成，都清理监听器，防止内存泄漏
      if (onAbort) {
        this.abortController.signal.removeEventListener('abort', onAbort);
      }
    }
  }
}

/**
 * 类型守卫：判断是否是 SubagentAbortError
 */
export function isSubagentAbortError(error: unknown): error is SubagentAbortError {
  return (
    error instanceof Error &&
    'isSubagentAbort' in error &&
    (error as any).isSubagentAbort === true
  );
}

/**
 * 创建 AbortController 兼容适配器
 * 用于向后兼容期望 AbortController 对象的代码
 */
export function createAbortControllerAdapter(
  manager: SubagentAbortManager,
): AbortController {
  return {
    signal: manager.signal,
    abort: (reason?: any) => manager.abort(reason),
  } as AbortController;
}