/**
 * chunk 加载失败 — 纯 DOM 弹窗
 *
 * 不依赖 React / Chakra，即使 React 崩溃也能正常显示。
 * 颜色适配项目设计系统（#786FFF 主色、#FF9326 警告色）。
 */

import { formatErrorDetail } from './chunkErrorHandler';

const OVERLAY_ID = 'chunk-error-overlay';

// ── 主题检测 ──────────────────────────────────────────────

function isDarkMode(): boolean {
  const { body } = document;
  if (body?.classList.contains('chakra-ui-dark')) return true;
  if (body?.classList.contains('chakra-ui-light')) return false;

  const vsBg = getComputedStyle(document.documentElement)
    .getPropertyValue('--vscode-editor-background')
    .trim();
  if (vsBg) {
    const hex = vsBg.replace('#', '');
    const avg =
      (parseInt(hex.slice(0, 2), 16) +
        parseInt(hex.slice(2, 4), 16) +
        parseInt(hex.slice(4, 6), 16)) /
      3;
    return avg < 128;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getThemeTokens(dark: boolean) {
  return {
    overlay: 'rgba(0,0,0,0.5)',
    bg: dark ? '#181818' : '#FFFFFF',
    border: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    textPrimary: dark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)',
    textSecondary: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    textMuted: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    primary: '#786FFF',
    primaryHover: '#6960e6',
    warning: '#FF9326',
    warningBg: dark
      ? 'rgba(255,147,38,0.12)'
      : 'rgba(255,147,38,0.08)',
    detailBg: dark ? '#131313' : '#F2F2F2',
    detailBorder: dark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(0,0,0,0.06)',
    shadow: dark ? '0.4' : '0.12',
    scrollbar: dark ? '#666 #333' : '#ccc #f0f0f0',
  };
}

// ── HTML 模板 ─────────────────────────────────────────────

function escapeHtml(str: string): string {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function buildDialogHtml(
  t: ReturnType<typeof getThemeTokens>,
  detail: string,
): string {
  return `
<style>
  #${OVERLAY_ID} *{box-sizing:border-box;margin:0;padding:0}
  #chunk-error-reload-btn:hover{background:${t.primaryHover}!important}
  #chunk-error-detail-toggle:hover{color:${t.textPrimary}!important}
</style>
<div style="position:fixed;inset:0;background:${t.overlay};display:flex;align-items:center;justify-content:center;z-index:99999;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <div style="background:${t.bg};border:1px solid ${t.border};border-radius:8px;padding:24px;width:380px;max-width:calc(100vw - 32px);box-shadow:0 8px 32px rgba(0,0,0,${t.shadow})">

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:36px;height:36px;border-radius:8px;background:${t.warningBg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L18.66 17H1.34L10 2Z" stroke="${t.warning}" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M10 8V11.5" stroke="${t.warning}" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="14" r="0.75" fill="${t.warning}"/>
        </svg>
      </div>
      <div>
        <div style="font-size:15px;font-weight:600;color:${t.textPrimary};line-height:1.3">应用版本已更新</div>
        <div style="font-size:12px;color:${t.textMuted};margin-top:2px">Resource Load Failed</div>
      </div>
    </div>

    <div style="font-size:13px;color:${t.textSecondary};line-height:1.6;margin-bottom:16px">
      检测到新版本已发布，部分资源加载失败。请刷新页面以获取最新功能。
    </div>

    <button id="chunk-error-reload-btn" style="width:100%;background:${t.primary};color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;transition:background 0.15s">
      刷新页面
    </button>

    <div style="margin-top:12px;border-top:1px solid ${t.border};padding-top:12px">
      <div id="chunk-error-detail-toggle" style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:${t.textMuted};user-select:none;transition:color 0.15s">
        <svg id="chunk-error-chevron" width="12" height="12" viewBox="0 0 12 12" style="transition:transform 0.15s">
          <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        错误详情
      </div>
      <div id="chunk-error-detail-content" style="display:none;margin-top:8px;background:${t.detailBg};border:1px solid ${t.detailBorder};border-radius:6px;padding:10px 12px;max-height:160px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:${t.scrollbar}">
        <pre style="font-family:'SF Mono',Monaco,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;color:${t.textSecondary};white-space:pre-wrap;word-break:break-all;margin:0">${escapeHtml(detail)}</pre>
      </div>
    </div>

  </div>
</div>`;
}

// ── 事件绑定 ──────────────────────────────────────────────

function bindDialogEvents(): void {
  document
    .getElementById('chunk-error-reload-btn')
    ?.addEventListener('click', () => window.location.reload());

  const toggle = document.getElementById('chunk-error-detail-toggle');
  const content = document.getElementById('chunk-error-detail-content');
  const chevron = document.getElementById('chunk-error-chevron');
  if (toggle && content && chevron) {
    toggle.addEventListener('click', () => {
      const opening = content.style.display === 'none';
      content.style.display = opening ? 'block' : 'none';
      chevron.style.transform = opening ? 'rotate(90deg)' : '';
    });
  }
}

// ── 导出 ──────────────────────────────────────────────────

export function showChunkErrorDialog(error: unknown): void {
  if (document.getElementById(OVERLAY_ID)) return;

  const tokens = getThemeTokens(isDarkMode());
  const detail = formatErrorDetail(error);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = buildDialogHtml(tokens, detail);
  document.body.appendChild(overlay);

  bindDialogEvents();
}
