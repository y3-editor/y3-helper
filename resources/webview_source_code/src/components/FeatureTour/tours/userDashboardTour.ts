import type { TourConfig, TourStep } from './types';
import { TourTriggerType } from './types';
import { useExtensionStore, IDE } from '../../../store/extension';

/**
 * 检查当前 IDE 是否支持个人使用情况引导
 * 支持 VSCode 和 JetBrains
 */
function isSupportedIDE(): boolean {
  const currentIDE = useExtensionStore.getState().IDE;
  return currentIDE === IDE.VisualStudioCode || currentIDE === IDE.JetBrains;
}

/**
 * 个人使用情况按钮引导
 * 登录完成后首次进入页面时自动触发
 * 该按钮位于 IDE 原生标题栏，使用虚拟锚点定位
 */
export const userDashboardTour: TourConfig = {
  id: 'user-dashboard',
  name: '个人使用情况引导',
  version: '1.0.0',
  trigger: {
    type: TourTriggerType.PageEnter,
    pageRoute: '/chat',
    delay: 800, // 延迟等待页面完全加载
    // 在 VSCode 和 JetBrains 中显示此引导
    condition: isSupportedIDE,
  },
  steps: [
    {
      target: '[data-tour="user-dashboard-anchor"]',
      title: '用量展示',
      content:
        '关注CodeMaker个人用量，合理使用工具',
      placement: 'bottom',
      disableBeacon: true,
      // 在支持的 IDE 中显示
      showWhen: isSupportedIDE,
    } as TourStep,
  ],
};