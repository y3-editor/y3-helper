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
    consumedTokens: {
      input: number;
      output: number;
      inputCost: number;
      outputCost: number;
      systemTokens: number;
      systemToolTokens: number;
      promptTokens: number;
      completionTokens: number;
      comporessPromptTokens: number;
      comporessCompletionTokens: number;
      readCacheTokens: number;
      skillTokens: number
      ruleTokens: number
      mcpTokens: number
    };
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

  return cleanupCompressionFlags(newMessage);
}

/**
 * 清理截断后消息列表中失效的压缩标记。
 * 找到最后一条摘要，该摘要之前的消息保持压缩状态（仍被该摘要覆盖），
 * 该摘要及其之后的消息清除压缩标记（原本覆盖它们的后续摘要已被截断）。
 */
function cleanupCompressionFlags(messages: ChatMessage[]): ChatMessage[] {
  if (!messages.length) return messages;

  let lastSummaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isCompressionSummary) {
      lastSummaryIndex = i;
      break;
    }
  }

  if (lastSummaryIndex === -1) return messages;

  return messages.map((msg, index) => {
    if (index < lastSummaryIndex) return msg;
    const cleaned = { ...msg };
    delete cleaned.isCompressed;
    return cleaned;
  });
}


/**
 * 创建消耗的tokens
 */
export function createConsumedTokens(): NonNullable<ChatSession['data']>['consumedTokens'] {
  return {
    input: 0,
    output: 0,
    inputCost: 0,
    outputCost: 0,
    systemTokens: 0,
    systemToolTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    comporessPromptTokens: 0,
    comporessCompletionTokens: 0,
    readCacheTokens: 0,
    skillTokens: 0,
    ruleTokens: 0,
    mcpTokens: 0,
  };
}
