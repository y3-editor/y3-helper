import type { TourConfig, TourStep } from './types';
import { TourTriggerType } from './types';
import { useChatStore } from '../../../store/chat';
import { useExtensionStore, IDE } from '../../../store/extension';

/**
 * Chat 入口引导
 * 用户进入 Chat 页面时自动触发
 */
export const chatEntryTour: TourConfig = {
  id: 'chat-entry',
  name: 'Chat 入口引导',
  version: '1.0.0',
  // 引导所属页面，当用户切换到其他 Tab 时会暂停，回到 chat 时自动恢复
  activePageRoute: 'chat',
  trigger: {
    type: TourTriggerType.PageEnter,
    pageRoute: '/chat',
    delay: 400,
  },
  steps: [
    {
      target: '[data-tour="chat-type-selector"]',
      title: '迁移【仓库智聊、普通聊天】切换入口',
      content: '更换统一的 Agent 模式、Chat 模式切换入口',
      placement: 'top',
      disableBeacon: true,
      onStepComplete: () => {
        // 点击下一步后，如果当前不是 codebase 模式，则切换到 codebase
        const { chatType, setChatType } = useChatStore.getState();
        if (chatType !== 'codebase' && useExtensionStore.getState().IDE !== IDE.VisualStudio) {
          setChatType('codebase');
        }
      },
    } as TourStep,
    {
      target: '[data-tour="create-session"]',
      title: '支持发起并行会话',
      content: '不打断当前任务，创建新对话',
      placement: 'bottom',
      // 仅在 VSCode 下显示此步骤
      showWhen: () => useExtensionStore.getState().IDE === IDE.VisualStudioCode,
    } as TourStep,
    {
      target: '[data-tour="more-actions"]',
      title: '精简首屏常用 Chat 操作',
      content: '清空、删除、分享操作仍可在更多中找到',
      placement: 'left',
    },
  ],
};