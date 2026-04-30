/**
 * 错误分类与重试逻辑
 *
 * 提供错误严重性分类和带指数退避的重试包装器。
 */

import { ErrorSeverity } from '../types';

/**
 * 根据错误消息内容分类错误严重性。
 */
export function classifyError(error: Error): ErrorSeverity {
  const msg = (error.message || '').toLowerCase();

  // 瞬态错误：网络超时、rate limit、网络错误、fetch 失败
  const transientPatterns = [
    'timeout',
    'rate limit',
    'network error',
    'failed to fetch',
  ];
  if (transientPatterns.some((pattern) => msg.includes(pattern))) {
    return ErrorSeverity.Transient;
  }

  // 可恢复错误：token limit、上下文长度超限
  const recoverablePatterns = ['token limit', 'maximum context length'];
  if (recoverablePatterns.some((pattern) => msg.includes(pattern))) {
    return ErrorSeverity.Recoverable;
  }

  // 其他所有为致命错误
  return ErrorSeverity.Fatal;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  abortSignal?: AbortSignal;
}

/**
 * 带指数退避的重试包装器。仅对 Transient 错误进行重试。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    abortSignal,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 每次重试前检查 abort 状态
    if (abortSignal?.aborted) {
      throw new Error('Aborted during retry');
    }

    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const severity = classifyError(error);

      // 非瞬态错误立即抛出，不重试
      if (severity !== ErrorSeverity.Transient) {
        throw error;
      }

      // 已达到最大重试次数
      if (attempt >= maxRetries) {
        break;
      }

      // 计算退避延迟：指数退避 + 抖动
      const rawDelay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay,
      );
      const delay = Math.floor(rawDelay * (0.5 + Math.random() * 0.5));

      console.log(
        `[Subagent] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${error.message}`,
      );

      // 等待退避延迟，同时监听 abort
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);

        if (abortSignal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new Error('Aborted during retry delay'));
          };
          if (abortSignal.aborted) {
            clearTimeout(timer);
            reject(new Error('Aborted during retry delay'));
            return;
          }
          abortSignal.addEventListener('abort', onAbort, { once: true });
          // 在 timer 结束后移除 abort 监听
          const originalResolve = resolve;
          // eslint-disable-next-line no-param-reassign
          resolve = () => {
            abortSignal.removeEventListener('abort', onAbort);
            originalResolve();
          };
        }
      });
    }
  }

  throw lastError || new Error('withRetry exhausted all attempts');
}