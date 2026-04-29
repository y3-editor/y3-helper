/**
 * chunk 加载失败 — 错误检测 & 全局处理
 *
 * 场景：Docker 部署新版本后旧 chunk 被删除，用户浏览器 dynamic import 404。
 *
 * 捕获层：
 *  - vite:preloadError — Vite __vitePreload 包装的 import 失败
 *  - unhandledrejection — 未被 catch 的 import() 失败
 *  - onChunkLoadError() — 业务代码已 catch 但仍需处理的场景
 */

import { showChunkErrorDialog } from './chunkErrorDialog';

// 跨浏览器错误消息匹配
const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome
  'Importing a module script failed',            // Safari
  'error loading dynamically imported module',   // Firefox
  'Failed to load module script',                // Safari variant
  'Unable to preload CSS',                       // Vite CSS preload
  'ChunkLoadError',                              // Webpack compat
  'Loading chunk',                               // Webpack legacy
  'Loading CSS chunk',                           // Webpack legacy CSS
] as const;

let handled = false;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return !!message && CHUNK_ERROR_PATTERNS.some((p) => message.includes(p));
}

/**
 * 格式化错误诊断信息（供弹窗 / ErrorBoundary 共用）
 */
export function formatErrorDetail(error: unknown): string {
  const lines = [
    `Time: ${new Date().toISOString()}`,
    `URL: ${window.location.href}`,
    `UserAgent: ${navigator.userAgent}`,
    '',
  ];
  if (error instanceof Error) {
    lines.push(`Error: ${error.name}: ${error.message}`);
    if (error.stack) {
      lines.push('', 'Stack Trace:', error.stack);
    }
  } else {
    lines.push(`Error: ${String(error)}`);
  }
  return lines.join('\n');
}

function handleChunkError(error: unknown): void {
  if (handled) return;
  handled = true;
  console.error('[ChunkError]', error);
  showChunkErrorDialog(error);
}

/**
 * 供业务代码在 catch 块中主动调用。
 * 仅当 error 匹配 chunk 加载失败模式时触发弹窗。
 *
 * @example
 * import('tiktoken').catch(onChunkLoadError);
 */
export function onChunkLoadError(error: unknown): void {
  if (isChunkLoadError(error)) {
    handleChunkError(error);
  }
}

/**
 * 安装全局 chunk 错误处理器（必须在 ReactDOM.createRoot 之前调用）
 */
export function installChunkErrorHandler(): void {
  window.addEventListener('vite:preloadError', (event: Event) => {
    (event as Event & { preventDefault(): void }).preventDefault();
    handleChunkError(
      (event as Event & { payload?: Error }).payload || event,
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const { reason } = event;
    if (reason instanceof Error && isChunkLoadError(reason)) {
      event.preventDefault();
      handleChunkError(reason);
    }
  });
}
