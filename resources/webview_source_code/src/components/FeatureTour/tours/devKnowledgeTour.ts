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
  version: '1.0.0',
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
      title: '研发知识集配置迁移',
      content: '研发知识集配置调整到工具里，开启后可选择生效知识集合。',
      placement: 'top',
      disableBeacon: true,
    },
  ],
};
