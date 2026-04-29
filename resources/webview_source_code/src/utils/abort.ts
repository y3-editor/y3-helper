/**
 * Abort 相关常量和工具函数。
 *
 * - ABORT_REASON_* 常量用于区分不同的 abort 场景
 * - createAbortReason() 创建结构化的 abort reason，配合 __ABORT_LOC__ 编译时注入源码位置
 * - isAbortError() 判断错误是否为 abort 类错误，用于过滤不需要上报的错误
 */

const ABORT_ERROR_NAME = 'AbortError';

// Abort reason 常量
export const ABORT_REASON_FINISHED = 'StreamFinished';
export const ABORT_REASON_USER_CANCELLED = 'UserCancelled';
export const ABORT_REASON_CLEANUP = 'Cleanup';
export const REQUEST_TIMEOUT_NAME = 'RequestTimeout';

/**
 * 创建结构化的 abort reason，携带源码位置信息。
 * @param name   abort 类型常量（如 ABORT_REASON_FINISHED）
 * @param source 由 __ABORT_LOC__ 编译时注入的 '文件名:行号'
 *
 * @example
 * abortController.abort(createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__));
 * // 编译后: createAbortReason('Cleanup', 'src/components/Foo.tsx:42')
 */
export function createAbortReason(
  name: string,
  source: string,
): { name: string; message: string } {
  return { name, message: source };
}

/**
 * 判断错误是否为 abort 类错误（包括正常完成、用户取消、清理等场景）。
 * 用于在 onError 中过滤不需要上报的 abort 错误。
 */
export function isAbortError(error: any): boolean {
  if (!error) return false;
  // 浏览器原生 AbortError（signal is aborted without reason）
  if (error.name === ABORT_ERROR_NAME) return true;
  // 自定义 abort reason
  if (
    error.name === ABORT_REASON_FINISHED ||
    error.name === ABORT_REASON_USER_CANCELLED ||
    error.name === ABORT_REASON_CLEANUP
  ) return true;
  return false;
}
