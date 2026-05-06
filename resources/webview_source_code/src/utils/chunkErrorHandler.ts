/**
 * chunk 加载失败 — 错误检测 & 全局处理
 *
 * 场景：Docker 部署新版本后旧 chunk 被删除，用户浏览器 dynamic import 404。
 *
 * 捕获层：
 *  - vite:preloadError — Vite __vitePreload 包装的 import 失败
 *  - unhandledrejection — 未被 catch 的 import() 失败
 *  - onChunkLoadError() — 业务代码已 catch 但仍需处理的场景
 *
 * 注意：vite:preloadError 不调用 preventDefault()，让错误继续传播到
 * React.lazy → ErrorBoundary，由 ErrorBoundary 统一决定渲染策略。
 * 这里只负责弹 toast 提示用户。
 */

import { createStandaloneToast } from '@chakra-ui/react';

const { toast } = createStandaloneToast();
const CHUNK_TOAST_ID = 'chunk-error-toast';

/** 去重时间窗（ms），同一窗口内多源触发只弹一次 toast */
const DEDUP_WINDOW_MS = 1000;
let lastToastTime = 0;

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
 * 格式化错误诊断信息（供 ErrorBoundary 共用）
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

/**
 * 弹出 chunk 错误 toast（幂等）。
 * 通过 toast.isActive + 时间窗双重去重，避免多源竞态下重复弹出。
 * 全局处理器 & ErrorBoundary 共用此函数，保证单实例 toast manager。
 */
export function showChunkToast(): void {
  const now = Date.now();
  if (now - lastToastTime < DEDUP_WINDOW_MS) return;
  if (toast.isActive(CHUNK_TOAST_ID)) return;

  lastToastTime = now;
  toast({
    id: CHUNK_TOAST_ID,
    title: '应用已更新',
    description: '检测到新版本已发布，请刷新页面以获取最新功能。',
    status: 'warning',
    duration: 5000,
    isClosable: true,
    position: 'top',
  });
}

/**
 * chunk 错误统一处理入口：日志 + toast。
 */
function handleChunkError(error: unknown): void {
  console.error('[ChunkError]', error);
  showChunkToast();
}

/**
 * 供业务代码在 catch 块中主动调用。
 * 仅当 error 匹配 chunk 加载失败模式时触发 toast。
 *
 * @example
 * import('tiktoken').catch(onChunkLoadError);
 */
export function onChunkLoadError(error: unknown): void {
  if (isChunkLoadError(error)) {
    handleChunkError(error);
  }
}

let installed = false;

/**
 * 安装全局 chunk 错误处理器（必须在 ReactDOM.createRoot 之前调用，仅安装一次）
 *
 * - vite:preloadError：只弹 toast，不 preventDefault()，让错误继续传播到 React ErrorBoundary
 * - unhandledrejection：对于未被 React 捕获的 chunk error（如非 lazy 的 import），弹 toast 并阻止控制台报错
 */
export function installChunkErrorHandler(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('vite:preloadError', (event: Event) => {
    const error = (event as Event & { payload?: Error }).payload || event;
    handleChunkError(error);
    // 不调用 preventDefault()，让错误继续传播到 React.lazy → ErrorBoundary
  });

  window.addEventListener('unhandledrejection', (event) => {
    const { reason } = event;
    if (isChunkLoadError(reason)) {
      event.preventDefault();
      handleChunkError(reason);
    }
  });
}
