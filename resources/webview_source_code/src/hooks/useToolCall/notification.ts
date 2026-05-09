/**
 * 工具调用通知管理逻辑
 */

import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../services';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { useChatApplyStore } from '../../store/chatApply';
import { usePanelContextOptional } from '../../context/PanelContext';
import {
  notifyChatReplyDone,
  notificationManager,
} from '../../utils/chatNotification';
import { NotificationState } from './types';

export function useToolCallNotification(
  message: ChatMessage,
  isLatest: boolean,
  isShare: boolean,
  toolResponseDisabled: boolean,
  hasAskUserQuestionTool: boolean,
  hasTerminalTool: boolean,
  hasEditFileTool: boolean,
  hasMCPTool: boolean,
  hasMakePlanTool: boolean,
  hasTodoTool: boolean,
  hasTaskTool: boolean,
  repoNotMatch: boolean,
  mcpServerDisplayName?: string,
  hasAutoExecuteEnabled?: boolean,
): NotificationState {
  const currentSession = useChatStore((state) => state.currentSession());
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const isApplying = useChatStreamStore((state) => state.isApplying);
  const isTerminalProcessing = useChatStreamStore((state) => state.isTerminalProcessing);
  const chatApplyInfo = useChatApplyStore((state) => state.chatApplyInfo);
  const panelContext = usePanelContextOptional();
  const hasNotifiedRef = useRef<boolean>(false);

  // 检查新版应用是否有正在处理中的项
  const hasApplyingItem = Object.values(chatApplyInfo).some(item => item.applying);

  // 当需要用户操作时发起通知
  useEffect(() => {
    // 只有最新消息且需要用户操作时才发送通知（如果开启了自动执行则不需要用户操作）
    const needsUserAction =
      !toolResponseDisabled &&
      !isProcessing &&
      !isMCPProcessing &&
      !isApplying &&
      !isTerminalProcessing &&
      !hasApplyingItem && // 新版应用处理中不发送通知
      !isShare &&
      !hasAskUserQuestionTool &&
      !hasTaskTool && // Task 工具（subagent）不需要通知
      !repoNotMatch &&
      !hasAutoExecuteEnabled; // 如果有自动执行开关开启，则不需要用户操作

    if (isLatest && needsUserAction && !hasNotifiedRef.current) {
      // 立即标记已通知，防止重复通知
      hasNotifiedRef.current = true;

      // 标记高优先级通知已发送
      notificationManager.setHighPriorityNotified(message.id || '');

      // 根据不同工具类型生成不同的通知消息
      let notificationMessage = '';
      if (hasTerminalTool) {
        notificationMessage = '需要确认命令执行';
      } else if (hasEditFileTool) {
        notificationMessage = '需要确认代码修改';
      } else if (hasMCPTool) {
        notificationMessage = `需要确认 ${mcpServerDisplayName || 'MCP'} 调用`;
      } else if (hasMakePlanTool) {
        notificationMessage = '需要确认执行计划';
      } else if (hasTodoTool) {
        notificationMessage = '需要确认任务操作';
      } else {
        notificationMessage = '需要用户确认操作';
      }

      notifyChatReplyDone({
        topic: currentSession?.topic,
        success: true,
        userQuestion: notificationMessage,
        panelId: panelContext?.panelId,
        mode: panelContext?.mode,
        isHighPriority: true, // 标记为高优先级通知
      });
    }

    // 当不再需要用户操作时，重置通知状态
    if (!needsUserAction && hasNotifiedRef.current) {
      hasNotifiedRef.current = false;
    }
  }, [
    isLatest,
    toolResponseDisabled,
    isProcessing,
    isMCPProcessing,
    isApplying,
    isTerminalProcessing,
    hasApplyingItem,
    isShare,
    hasAskUserQuestionTool,
    hasTaskTool,
    repoNotMatch,
    hasTerminalTool,
    hasEditFileTool,
    hasMCPTool,
    hasMakePlanTool,
    hasTodoTool,
    currentSession?.topic,
    panelContext?.panelId,
    panelContext?.mode,
    mcpServerDisplayName,
    message.id,
    hasAutoExecuteEnabled,
  ]);

  return {
    hasNotifiedRef,
  };
}
