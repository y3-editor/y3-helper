import { isNumber } from 'lodash';
import { ChatMessage } from '../services';
import { ChatRole } from '../types/chat';

const MAX_FILE_READ_LENGTH = 150000;
const DS_MAX_FILE_READ_LENGTH = 100000;

export function getMaxFileReadLength(model: string): number {
  if (model.includes('deepseek')) {
    return DS_MAX_FILE_READ_LENGTH;
  } else {
    return MAX_FILE_READ_LENGTH;
  }
}

export interface ChatSession {
  _id?: string;
  data?: {
    messages: ChatMessage[];
  };
}

export function createNewSession(
  message: ChatMessage,
  currentSession: ChatSession | null,
  chatType: string,
  current?: boolean
): ChatMessage[] {
  if (!currentSession || !message.id) return [];

  const currentIndex = currentSession?.data?.messages.findIndex(
    (item) => item.id === message.id,
  );

  let newMessage: ChatMessage[] = [];
  if (isNumber(currentIndex) && currentIndex !== -1) {
    if (current) {
      // 截取到当前消息的上一条
      newMessage = currentSession?.data?.messages.slice(0, currentIndex) || [];
    } else if (chatType === 'codebase') {
      // 仓库智聊：找到下一次用户输入之前的所有消息
      const messages = currentSession?.data?.messages || [];
      let endIndex = currentIndex + 1; // 从当前消息的下一条开始查找

      // 向后查找，直到找到下一个用户消息或到达消息末尾
      for (let i = endIndex; i < messages.length; i++) {
        if (messages[i].role === ChatRole.User) {
          endIndex = i;
          break;
        }
        endIndex = i + 1;
      }

      newMessage = messages.slice(0, endIndex);
    } else {
      // 普通聊天：保持原有逻辑，截取到当前消息+对应的回答
      newMessage = currentSession?.data?.messages.slice(0, currentIndex + 2) || [];
    }
  }

  return newMessage;
}