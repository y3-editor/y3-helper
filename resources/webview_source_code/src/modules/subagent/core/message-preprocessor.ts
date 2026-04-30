/**
 * Subagent 消息预处理模块
 *
 * 提供与主agent一致的消息预处理逻辑，包括：
 * - 消息过滤和截断
 * - 消息序列化和工具ID修复
 * - 系统提示词处理和缓存标记
 */

import {
  ChatMessage,
  ChatPromptBody,
  // ChatMessageContent,
} from '../../../services';
import { ChatRole } from '../../../services/useChatStream';
import { ChatModel } from '../../../services/chatModel';
import { useChatConfig } from '../../../store/chat-config';
import {
  serializeCodebaseMessages,
  repairToolIdOfMessages,
} from '../../../utils/validateBeforeChat';
import { pruneToolOutputs } from '../../../services/compressionService';
import { truncateMessagesIfNeeded } from '../../../utils/truncateMessages';
// import { useWorkspaceStore } from '../../../store/workspace';
// import { CACHE_TIER_BREAK } from '../../../store/workspace/constructRemixPrompt';
import addCacheMarksToMessages from '../../../utils/addCacheMarksToMessages';
import type { Tool } from '../../../store/workspace';
import type { Agent } from '../types';

export interface MessagePreprocessOptions {
  messages: ChatMessage[];
  agent: Agent;
  model: ChatModel;
  tools: Tool[];
  cacheEnable: boolean;
  taskId: string;
}

export interface PreprocessedMessageResult {
  messages: ChatMessage[];
  cacheEnable: boolean;
  metadata: {
    originalMessageCount: number;
    finalMessageCount: number;
    hasCompression: boolean;
    hasTruncation: boolean;
    // systemPromptLength: number;
  };
}

/**
 * 预处理subagent的消息，使其与主agent保持一致的处理逻辑
 */
export async function preprocessSubagentMessages(
  options: MessagePreprocessOptions,
): Promise<PreprocessedMessageResult> {
  const { messages, agent, model, taskId } = options;
  let { cacheEnable } = options;

  const originalMessageCount = messages.length;
  const processedMessages = [...messages];

  console.log(`[Subagent] ${taskId} Starting message preprocessing:`, {
    originalCount: originalMessageCount,
    model,
    cacheEnable,
    agentName: agent.name,
  });

  // 1. 过滤未压缩的消息（参考主agent逻辑）
  const unCompressedMessages = processedMessages.filter(
    (msg, index, self) =>
      !msg.isCompressed ||
      (msg.role === ChatRole.Assistant &&
        self?.[index + 1]?.role === ChatRole.Tool &&
        !self?.[index + 1]?.isCompressed),
  );

  console.log(
    `[Subagent] ${taskId} After compression filtering: ${unCompressedMessages.length} messages`,
  );

  // 2. 消息截断策略（简化版本，主要使用pruneToolOutputs）
  let truncationResult;
  const codebaseModelMaxTokens =
    useChatConfig.getState().codebaseModelMaxTokens;

  // 优先使用 pruneToolOutputs 来减少token使用
  const prunedMessages = await pruneToolOutputs(unCompressedMessages);

  if (cacheEnable && prunedMessages.length !== unCompressedMessages.length) {
    console.log(
      `[Subagent] ${taskId} Applied tool output pruning: ${unCompressedMessages.length} -> ${prunedMessages.length} messages`,
    );
  }

  // 如果启用缓存，尝试智能截断
  if (cacheEnable) {
    truncationResult = truncateMessagesIfNeeded({
      messages: prunedMessages,
      model,
      codebaseModelMaxTokens,
    });

    if (truncationResult.fallbackToSlideWindow) {
      console.log(
        `[Subagent] ${taskId} Falling back to slide window, disabling cache`,
      );
      cacheEnable = false;
    }
  } else {
    // 不启用缓存时，直接使用pruned消息
    truncationResult = {
      sendMessages: prunedMessages,
      containUserMessage: true,
      newTruncateStart: -1,
      previousTokens: 0,
      fallbackToSlideWindow: false,
    };
  }

  const { sendMessages } = truncationResult;

  console.log(
    `[Subagent] ${taskId} After truncation: ${sendMessages.length} messages`,
  );

  // 3. 系统提示词处理（使用简化的规则集）
  // const effectiveRules: Rule[] = []; // subagent可以传入空规则集，或者从agent配置中提取

  // const workspaceStore = useWorkspaceStore.getState();
  // const codebaseChatSystemPrompt = workspaceStore.getCodebaseChatSystemPrompt({
  //   effectiveRules,
  // });

  // // 替换或增强原有的系统提示词
  // const systemMessageIndex = sendMessages.findIndex(
  //   (m) => m.role === ChatRole.System,
  // );
  // const systemMessage: ChatMessage = {
  //   role: ChatRole.System,
  //   content: cacheEnable
  //     ? codebaseChatSystemPrompt
  //         .split(CACHE_TIER_BREAK)
  //         .map((text) => ({ type: ChatMessageContent.Text, text }))
  //     : codebaseChatSystemPrompt.split(CACHE_TIER_BREAK).join('\n'),
  // };

  // if (systemMessageIndex >= 0) {
  //   // 替换现有的系统提示词
  //   sendMessages[systemMessageIndex] = systemMessage;
  // } else {
  //   // 添加系统提示词到顶部
  //   sendMessages.unshift(systemMessage);
  // }

  // console.log(
  //   `[Subagent] ${taskId} System prompt ${systemMessageIndex >= 0 ? 'replaced' : 'added'}: ${codebaseChatSystemPrompt.length} chars`,
  // );

  // 4. 消息序列化（关键步骤）
  let filteredMessages = await serializeCodebaseMessages(
    model,
    sendMessages,
    undefined, // subagent不需要session参数
  );

  console.log(
    `[Subagent] ${taskId} After serialization: ${filteredMessages.length} messages`,
  );

  // 5. 工具ID修复
  filteredMessages = repairToolIdOfMessages(filteredMessages, model);

  console.log(
    `[Subagent] ${taskId} After tool ID repair: ${filteredMessages.length} messages`,
  );

  // 6. 添加缓存标记（如果启用）
  if (cacheEnable) {
    filteredMessages = addCacheMarksToMessages(filteredMessages);
    console.log(`[Subagent] ${taskId} Applied cache marks`);
  }

  const metadata = {
    originalMessageCount,
    finalMessageCount: filteredMessages.length,
    hasCompression: prunedMessages.length !== unCompressedMessages.length,
    hasTruncation: truncationResult.newTruncateStart !== -1,
    // systemPromptLength: codebaseChatSystemPrompt.length,
  };

  console.log(`[Subagent] ${taskId} Preprocessing complete:`, metadata);

  return {
    messages: filteredMessages,
    cacheEnable,
    metadata,
  };
}

/**
 * 构建Subagent的ChatPromptBody，使用预处理后的消息
 */
export function buildSubagentChatPromptBody(
  preprocessResult: PreprocessedMessageResult,
  model: ChatModel,
  tools: Tool[],
  options: {
    stream?: boolean;
    tool_choice?: string;
    temperature?: number;
    max_tokens?: number;
  } = {},
): ChatPromptBody {
  const {
    stream = true,
    tool_choice = 'auto',
    temperature = 1,
    max_tokens,
  } = options;

  // 计算默认max_tokens
  let defaultMaxTokens = 10240;
  if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
    defaultMaxTokens = 32000;
  }

  const promptData: ChatPromptBody = {
    messages: preprocessResult.messages,
    model,
    tools,
    stream,
    tool_choice: model.startsWith('claude') ? undefined : tool_choice,
    temperature,
    max_tokens: Math.max(max_tokens || 0, defaultMaxTokens),
  };

  return promptData;
}