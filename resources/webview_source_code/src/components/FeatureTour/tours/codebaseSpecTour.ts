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
      title: 'Spec Coding 模式',
      content:
        '选择 Spec 模式，支持 OpenSpec 和 SpecKit 两种框架，遵循结构化流程进行编程开发。',
      placement: 'bottom',
      disableBeacon: true,
    },
  ],
};
