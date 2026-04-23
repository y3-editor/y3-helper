import type { TourConfig } from './types';
import { TourTriggerType } from './types';
import { useChatStore } from '../../../store/chat';

/**
 * 研发知识集引导
 * 告知用户研发知识集功能已迁移到工具里面
 * 触发条件：进入 chat 页面且 chatType 为 codebase 时
 */
export const devKnowledgeTour: TourConfig = {
  id: 'dev-knowledge',
  name: '研发知识集引导',
  version: '1.2.0',
  activePageRoute: 'chat',
  trigger: {
    type: TourTriggerType.PageEnter,
    pageRoute: '/chat',
    delay: 500,
    condition: () => {
      const { chatType } = useChatStore.getState();
      return chatType === 'codebase';
    },
  },
  steps: [
    {
      target: '[data-tour="chat-functional-toolbar"]',
      title: '仓库智聊迁移【Auto】入口	',
      content:
        'Auto模式开启整体迁入工具列表，可对更多工具【启用(Auto)】配置，减少人工介入',
      placement: 'top',
      disableBeacon: true,
    },
  ],
};