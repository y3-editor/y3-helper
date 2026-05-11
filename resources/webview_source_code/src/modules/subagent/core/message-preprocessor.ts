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
import {
  truncateMessagesIfNeeded,
  truncatedMessageWithSlideWindow,
} from '../../../utils/truncateMessages';
// import { useWorkspaceStore } from '../../../store/workspace';
// import { CACHE_TIER_BREAK } from '../../../store/workspace/constructRemixPrompt';
import addCacheMarksToMessages, {
  addCacheMarksToTools,
  checkReusable,
} from '../../../utils/addCacheMarksToMessages';
import type { Tool } from '../../../store/workspace';
import type { Agent } from '../types';
import type { SessionCompressionState } from '../../../types/contextCompression';
import { debugLog, debugWarn } from '../../../utils/debugLog';

const MODULE = 'Subagent/MessagePreprocessor';

export interface MessagePreprocessOptions {
  messages: ChatMessage[];
  agent: Agent;
  model: ChatModel;
  tools: Tool[];
  cacheEnable: boolean;
  taskId: string;
  compressionState: SessionCompressionState;
}

export interface PreprocessedMessageResult {
  messages: ChatMessage[];
  tools: Tool[];
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
  const { messages, model, taskId, compressionState } = options;
  let { cacheEnable } = options;

  const originalMessageCount = messages.length;
  const processedMessages = [...messages];

  debugLog(MODULE, 'Preprocessing Start', {
    taskId,
    initialCacheEnable: cacheEnable,
    compressionEnabled: compressionState.enabled,
    messageCount: originalMessageCount,
    model,
  });

  // 1. 过滤未压缩的消息（参考主agent逻辑）
  const unCompressedMessages = processedMessages.filter(
    (msg, index, self) =>
      !msg.isCompressed ||
      (msg.role === ChatRole.Assistant &&
        self?.[index + 1]?.role === ChatRole.Tool &&
        !self?.[index + 1]?.isCompressed),
  );

  // 2. 消息截断策略：与主 agent 保持一致
  let truncationResult;
  const codebaseModelMaxTokens =
    useChatConfig.getState().codebaseModelMaxTokens;

  // 优先使用 pruneToolOutputs 来减少token使用
  const prunedMessages = await pruneToolOutputs(unCompressedMessages);

  if (cacheEnable && prunedMessages.length !== unCompressedMessages.length) {
    debugLog(MODULE, 'Tool Output Pruning Applied', {
      taskId,
      before: unCompressedMessages.length,
      after: prunedMessages.length,
      pruned: unCompressedMessages.length - prunedMessages.length,
    });
  }

  // ✅ 关键修复：与主 agent 保持一致的逻辑
  const compressionEnabled = compressionState.enabled;

  if (compressionEnabled) {
    // 压缩启用时：只用 pruneToolOutputs，不调用 truncateMessagesIfNeeded
    // 这样不会设置 truncateStart 标记，避免截断第一条 user message
    truncationResult = {
      sendMessages: prunedMessages,
      containUserMessage: true,
      newTruncateStart: -1,
      previousTokens: 0,
      fallbackToSlideWindow: false,
    };

    debugLog(MODULE, 'Compression Enabled - Skip Truncation', {
      taskId,
      messageCount: prunedMessages.length,
      note: 'Using pruneToolOutputs only, no truncateMessagesIfNeeded',
    });
  } else if (cacheEnable) {
    // 压缩未启用但 cache 启用时：才调用 truncateMessagesIfNeeded
    truncationResult = truncateMessagesIfNeeded({
      messages: prunedMessages,
      model,
      codebaseModelMaxTokens,
    });

    debugLog(MODULE, 'Truncation Result', {
      taskId,
      fallbackToSlideWindow: truncationResult.fallbackToSlideWindow,
      newTruncateStart: truncationResult.newTruncateStart,
      messageCount: truncationResult.sendMessages.length,
      previousTokens: truncationResult.previousTokens,
    });

    if (truncationResult.fallbackToSlideWindow) {
      debugWarn(MODULE, '⚠️ Cache Disabled by Slide Window Fallback', {
        taskId,
        reason: 'truncateMessagesIfNeeded returned fallbackToSlideWindow=true',
        messageCount: prunedMessages.length,
        maxTokens: codebaseModelMaxTokens[model],
      });
      cacheEnable = false;
    }
  } else {
    // 都未启用：使用滑动窗口
    truncationResult = truncatedMessageWithSlideWindow({
      messages: prunedMessages,
      model,
      codebaseModelMaxTokens,
    });

    debugLog(MODULE, 'Slide Window Fallback', {
      taskId,
      messageCount: truncationResult.sendMessages.length,
    });
  }

  const { sendMessages } = truncationResult;

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

  // 4. 序列化消息（处理文件内容等）
  let filteredMessages = await serializeCodebaseMessages(
    model,
    sendMessages,
  );

  // 4.5 Gemini 模型的 thinking_signature 特殊处理
  // 与主 agent 保持一致的逻辑 (src/store/chat.ts:6002-6007)
  if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
    filteredMessages = filteredMessages.map((message) => {
      // 对于 Gemini 模型,如果 assistant message 没有 thinking_signature,
      // 则删除所有 thinking 相关字段
      if (message.role === ChatRole.Assistant && !message.thinking_signature) {
        const { redacted_thinking, thinking_signature, reasoning_content, ...rest } = message;
        return rest as ChatMessage;
      }
      return message;
    });
  }

  // 5. 工具ID修复
  filteredMessages = repairToolIdOfMessages(filteredMessages, model);

  // 6. 返回未添加缓存标记的消息（与主agent保持一致）
  // 缓存标记将在 buildSubagentChatPromptBody 中添加，避免影响压缩逻辑
  const filteredTools = options.tools;

  const metadata = {
    originalMessageCount,
    finalMessageCount: filteredMessages.length,
    hasCompression: prunedMessages.length !== unCompressedMessages.length,
    hasTruncation: truncationResult.newTruncateStart !== -1,
    // systemPromptLength: codebaseChatSystemPrompt.length,
  };

  debugLog(MODULE, 'Preprocessing Complete', {
    taskId,
    finalCacheEnable: cacheEnable,
    cacheDisabledReason: !cacheEnable && options.cacheEnable ? 'fallbackToSlideWindow' : undefined,
    ...metadata,
    note: 'Cache marks will be added in buildSubagentChatPromptBody',
  });

  return {
    messages: filteredMessages,
    tools: filteredTools,
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
  options: {
    stream?: boolean;
    tool_choice?: string;
    temperature?: number;
    max_tokens?: number;
    taskId?: string;
  } = {},
): ChatPromptBody {
  const {
    stream = true,
    tool_choice = 'auto',
    temperature = 1,
    max_tokens,
    taskId = 'unknown',
  } = options;

  // 计算默认max_tokens
  let defaultMaxTokens = 10240;
  if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
    defaultMaxTokens = 32000;
  }

  // 在构建最终请求体时添加缓存标记（与主agent的时机保持一致）
  let finalMessages = preprocessResult.messages;
  let finalTools = preprocessResult.tools;

  if (preprocessResult.cacheEnable) {
    finalMessages = addCacheMarksToMessages(preprocessResult.messages);
    finalTools = addCacheMarksToTools(preprocessResult.tools) || preprocessResult.tools;

    debugLog(MODULE, 'Cache Marks Applied', {
      taskId,
      messageCount: finalMessages.length,
      toolCount: finalTools.length,
    });

    // 验证缓存前缀匹配性（开发调试用）
    checkReusable({
      messages: finalMessages,
      tools: finalTools,
    });
  }

  const promptData: ChatPromptBody = {
    messages: finalMessages,
    model,
    tools: finalTools,
    stream,
    tool_choice: model.startsWith('claude') ? undefined : tool_choice,
    temperature,
    max_tokens: Math.max(max_tokens || 0, defaultMaxTokens),
  };

  return promptData;
}