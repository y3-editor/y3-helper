import type { TourConfig, TourStep } from './types';
import { TourTriggerType } from './types';
import { useExtensionStore, IDE } from '../../../store/extension';

/**
 * 检查是否为 VSCode 环境
 * 并行会话功能仅在 VSCode 中可用
 */
function isVSCodeIDE(): boolean {
  return useExtensionStore.getState().IDE === IDE.VisualStudioCode;
}

/**
 * 并行会话迁移引导
 * 告知用户新建并行会话按钮的迁移位置
 * 触发条件：进入 chat 页面时（仅 VSCode）
 */
export const parallelSessionTour: TourConfig = {
  id: 'parallel-session',
  name: '并行会话迁移引导',
  version: '1.0.0',
  activePageRoute: 'chat',
  trigger: {
    type: TourTriggerType.PageEnter,
    pageRoute: '/chat',
    delay: 500,
    // 仅在 VSCode 中触发（并行会话功能仅 VSCode 支持）
    condition: isVSCodeIDE,
  },
  steps: [
    {
      target: '[data-tour="create-parallel-session"]',
      title: '新建并行任务入口调整',
      content: '拆分新建会话与新建并行任务入口，可按需新建',
      placement: 'bottom',
      disableBeacon: true,
      // 仅在 VSCode 中显示
      showWhen: isVSCodeIDE,
    } as TourStep,
  ],
};