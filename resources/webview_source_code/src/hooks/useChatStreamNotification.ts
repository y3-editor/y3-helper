import * as React from 'react';
import { useChatStore, useChatStreamStore } from '../store/chat';
import {
  notifyChatReplyDone,
  notifyChatRequestStart,
  extractQuestionSummary,
  notificationManager,
} from '../utils/chatNotification';

/**
 * 监听聊天流状态变化，并通知插件端
 * - 当流式请求开始时，通知 CHAT_REQUEST_START
 * - 当流式请求结束时，通知 CHAT_REPLY_DONE
 *
 * @param panelId 面板 ID，用于插件端识别来源
 */
export function useChatStreamNotification(panelId?: string) {
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const isApplying = useChatStreamStore((state) => state.isApplying);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const currentSession = useChatStore((state) => state.currentSession());

  const prevStreamState = React.useRef(isStreaming);

  React.useEffect(() => {
    // 检测开始回答：从非流式变为流式
    if (!prevStreamState.current && isStreaming && panelId) {
      // 新的对话回合开始，重置通知状态
      notificationManager.reset();
      notifyChatRequestStart(panelId);
    }

    // 检测回答结束：从流式变为非流式，且所有处理状态都已完成
    if (
      prevStreamState.current &&
      !isStreaming &&
      !isProcessing &&
      !isMCPProcessing &&
      !isApplying &&
      !isTerminalProcessing
    ) {
      // 回答结束，发送通知到插件
      if (currentSession) {
        const messages = currentSession.data?.messages || [];
        // 查找最近一条用户消息
        const userMessages = messages.filter((m) => m.role === 'user');
        const lastUserMsg = userMessages[userMessages.length - 1];
        const userQuestion = extractQuestionSummary(lastUserMsg?.content);

        // 获取最后一条 Assistant 消息的 ID，用于检查是否有高优先级通知
        const assistantMessages = messages.filter((m) => m.role === 'assistant');
        const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
        const messageId = lastAssistantMsg?.id;

        // 检查是否应该发送低优先级的"回答完成"通知
        if (notificationManager.shouldSendNotification(false, messageId)) {
          // 判断回答是否成功
          const { isError } = useChatStore.getState();

          notifyChatReplyDone({
            topic: currentSession.topic,
            success: !isError,
            userQuestion,
            panelId: panelId || undefined,
            isHighPriority: false,
          });
        }
      }
    }

    prevStreamState.current = isStreaming;
  }, [
    isStreaming,
    isProcessing,
    isMCPProcessing,
    isApplying,
    isTerminalProcessing,
    currentSession,
    panelId,
  ]);
}
