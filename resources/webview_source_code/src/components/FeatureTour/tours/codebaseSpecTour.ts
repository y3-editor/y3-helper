import type { TourConfig } from './types';
import { TourTriggerType } from './types';

/** 事件名称常量 */
export const CODEBASE_SESSION_CREATED_EVENT = 'tour:codebase-session-created';

/**
 * Codebase Spec 模式引导
 * 用户新建 codebase 会话时触发
 */
export const codebaseSpecTour: TourConfig = {
  id: 'codebase-spec',
  name: 'Codebase Spec 模式引导',
  version: '1.0.0',
  trigger: {
    type: TourTriggerType.Event,
    eventName: CODEBASE_SESSION_CREATED_EVENT,
    delay: 400,
  },
  steps: [
    {
      target: '[data-tour="spec-mode-card"]',
      title: '仓库智聊新增Spec Coding模式',
      content:
        '支持OpenSpec、SpecKit两种框架。先规划后实现，按工程标准逐步构建结构化编程。 ',
      placement: 'bottom',
      disableBeacon: true,
    },
  ],
};