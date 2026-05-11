import { debugLog, debugWarn } from './debugLog';

const MODULE = 'AsyncLock';

export class AsyncLock {
  private locks = new Map<string, Promise<void>>();
  private waitingCount = new Map<string, number>();

  /**
   * 获取锁
   *
   * @param key - 锁的键（通常是资源ID，如 sessionId）
   * @param timeout - 可选的超时时间（毫秒），默认无超时
   * @returns 释放锁的函数
   * @throws 如果超时则抛出错误
   */
  async acquire(key: string, timeout?: number): Promise<() => void> {
    // 增加等待计数
    this.waitingCount.set(key, (this.waitingCount.get(key) || 0) + 1);

    if (import.meta.env.DEV) {
      const waitCount = this.waitingCount.get(key) || 0;
      if (waitCount > 1) {
        debugLog(MODULE, `Key "${key}" has ${waitCount} waiting operations`);
      }
    }

    // 等待当前锁释放
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      if (timeout) {
        // 带超时的等待
        await Promise.race([
          this._waitForLock(key),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new Error(
                  `AsyncLock timeout for key "${key}" after ${timeout}ms`,
                ),
              );
            }, timeout);
          }),
        ]);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      } else {
        // 无超时等待
        await this._waitForLock(key);
      }
    } catch (err) {
      // 等待失败，减少等待计数
      this.waitingCount.set(key, (this.waitingCount.get(key) || 1) - 1);
      throw err;
    }

    // 创建新的锁
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lockPromise);

    // 减少等待计数
    this.waitingCount.set(key, (this.waitingCount.get(key) || 1) - 1);

    if (import.meta.env.DEV) {
      debugLog(MODULE, `Lock acquired for key "${key}"`);
    }

    // 返回释放函数
    return () => {
      this.locks.delete(key);
      release!();

      if (import.meta.env.DEV) {
        debugLog(MODULE, `Lock released for key "${key}"`);
      }
    };
  }

  /**
   * 等待指定 key 的锁释放
   *
   * 注意：必须先获取 Promise 引用再判断是否存在，
   * 避免在 has() 和 get() 之间发生竞态条件。
   */
  private async _waitForLock(key: string): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const lockPromise = this.locks.get(key);
      if (!lockPromise) break;
      await lockPromise;
    }
  }

  /**
   * 检查指定 key 是否已被锁定
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * 获取指定 key 的等待操作数量
   */
  getWaitingCount(key: string): number {
    return this.waitingCount.get(key) || 0;
  }

  /**
   * 清除所有锁（谨慎使用！）
   * 通常用于测试或紧急情况
   */
  clearAll(): void {
    if (import.meta.env.DEV) {
      debugWarn(MODULE, 'Clearing all locks!');
    }
    this.locks.clear();
    this.waitingCount.clear();
  }

  /**
   * 获取当前锁的数量
   */
  get size(): number {
    return this.locks.size;
  }
}

/**
 * 单例实例 - 用于全局共享
 */
export const globalAsyncLock = new AsyncLock();