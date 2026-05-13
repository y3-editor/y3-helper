import { ChatModel } from '../services/chatModel';

interface ChatModelInfo {
  hasTokenCache?: boolean;
}

/**
 * 判断当前 codebase chat 是否启用 prompt cache。
 *
 * 与 store/chat.ts 主对话路径的判断逻辑保持一致：
 * 1. 模型本身支持 token cache
 * 2. 该模型可用上下文 > 64K
 *
 * 抽离原因：让主对话与压缩调用走同款判断，确保 cache key 一致。
 */
export function inferCodebaseCacheEnable(
  model: ChatModel,
  chatModels: Partial<Record<ChatModel, ChatModelInfo | undefined>>,
  codebaseModelMaxTokens: Partial<Record<ChatModel, number>>,
): boolean {
  if (!chatModels[model]?.hasTokenCache) return false;
  return (codebaseModelMaxTokens[model] || 0) > 64 * 1000;
}