import { BroadcastActions } from '../PostMessageProvider';

export interface ChatReplyDoneData {
  /** 会话主题/标题 */
  topic?: string;
  success: boolean;
  /** 用户原始问题（截取前 20 字符用于通知展示） */
  userQuestion?: string;
  /** 面板 ID，用于插件端识别是哪个 webview */
  panelId?: string;
  /** 面板模式，用于插件端区分主会话/并行会话/CM2 */
  mode?: string;
  /** 是否为高优先级通知（如需要用户操作），高优先级通知会阻止后续的低优先级通知 */
  isHighPriority?: boolean;
}

// 全局通知状态管理
class NotificationManager {
  private hasHighPriorityNotified = false;
  private currentMessageId: string | null = null;

  /**
   * 设置高优先级通知已发送（需要用户操作时）
   */
  setHighPriorityNotified(messageId: string) {
    this.hasHighPriorityNotified = true;
    this.currentMessageId = messageId;
  }

  /**
   * 检查是否已发送高优先级通知
   */
  hasHighPriorityNotification(messageId?: string): boolean {
    return this.hasHighPriorityNotified && this.currentMessageId === messageId;
  }

  /**
   * 重置通知状态（新的对话回合开始时）
   */
  reset() {
    this.hasHighPriorityNotified = false;
    this.currentMessageId = null;
  }

  /**
   * 检查是否应该发送通知
   */
  shouldSendNotification(isHighPriority: boolean, messageId?: string): boolean {
    if (isHighPriority) {
      // 高优先级通知总是可以发送
      return true;
    }
    // 低优先级通知只有在没有高优先级通知时才能发送
    return !this.hasHighPriorityNotified && this.currentMessageId !== messageId;
  }
}

// 导出全局实例
export const notificationManager = new NotificationManager();

/**
 * 从用户消息内容中提取问题摘要
 * @param content 用户消息内容（可能是字符串或数组）
 * @param maxLength 最大长度，默认 20
 */
export function extractQuestionSummary(
  content: string | unknown[] | undefined,
  maxLength = 20,
): string {
  if (!content) return '';

  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    // 处理多模态消息，提取文本部分
    for (const item of content) {
      if (typeof item === 'string') {
        text = item;
        break;
      }
      if (
        item &&
        typeof item === 'object' &&
        'type' in item &&
        (item as { type: string }).type === 'text' &&
        'text' in item
      ) {
        text = (item as { text: string }).text;
        break;
      }
    }
  }

  // 移除多余空白，截取指定长度
  text = text.trim().replace(/\s+/g, ' ');
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  return text;
}

/**
 * 通知插件 Chat 请求开始
 * 插件端监听 CHAT_REQUEST_START 事件后可设置面板 loading 状态
 * @param panelId 面板 ID，用于插件端识别是哪个 webview 发起的请求
 */
export function notifyChatRequestStart(panelId: string) {
  window.parent.postMessage(
    {
      type: BroadcastActions.CHAT_REQUEST_START,
      data: { panelId },
    },
    '*',
  );
}

/**
 * 通知插件 Chat 回复已完成
 * 插件端监听 CHAT_REPLY_DONE 事件后可调用 vscode.window.showInformationMessage API 弹窗提示用户
 */
export function notifyChatReplyDone(data: ChatReplyDoneData) {
  window.parent.postMessage(
    {
      type: BroadcastActions.CHAT_REPLY_DONE,
      data,
    },
    '*',
  );
}