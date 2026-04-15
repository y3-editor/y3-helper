import { findLastIndex } from "lodash";
import { ChatMessage } from "../services";
import { ChatRole } from "../services/useChatStream";
import { ChatModel } from "../services/chatModel";

export function truncateMessagesIfNeeded(options: {
  messages: ChatMessage[];
  model: ChatModel;
  codebaseModelMaxTokens: Record<ChatModel, number>;
}): {
  sendMessages: ChatMessage[];
  containUserMessage: boolean;
  newTruncateStart: number;
  previousTokens: number;
  fallbackToSlideWindow?: boolean;
} {
  const { messages, model, codebaseModelMaxTokens } = options;

  if (messages.length === 0) {
    return {
      sendMessages: [],
      containUserMessage: false,
      newTruncateStart: -1,
      previousTokens: 0
    };
  }

  console.debug(`[Debug] 开始检查消息截断，当前消息数 ${messages.length} 条，模型 ${model}`);
  const indexedMessages = messages.map((msg, index) => ({ msg, index }));
  let sendEntries = indexedMessages.filter(entry => !entry.msg.isCompressionSummary);
  const pinnedEntries = indexedMessages.filter(entry => entry.msg.isCompressionSummary || entry.msg.role === ChatRole.System);

  console.debug(`[Debug] 过滤后的发送消息数 ${sendEntries.length} 条，固定消息数 ${pinnedEntries.length} 条`);
  if (sendEntries.length === 0) {
    const finalMessages = [...messages];
    return {
      sendMessages: finalMessages,
      containUserMessage: finalMessages.some(msg => msg.role === ChatRole.User),
      newTruncateStart: -1,
      previousTokens: 0
    };
  }

  // 获取当前模型的最大 token 限制
  let currentModelMaxTokens = codebaseModelMaxTokens[model];
  if (model === ChatModel.Claude37SonnetThinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude37Sonnet];
  }
  if (model === ChatModel.Claude4Sonnet20250514Thinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude4Sonnet20250514];
  }
  if (model === ChatModel.Claude45Sonnet20250929Thinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude45Sonnet20250929];
  }

  // 1. 从倒数第一条 assistant 消息中获取 usage 字段，计算 tokens 总使用量
  let totalTokensUsed = 0;
  let foundUsage = false;
  for (let i = sendEntries.length - 1; i >= 0; i--) {
    const msg = sendEntries[i].msg;
    if (msg.role === ChatRole.Assistant && msg.usage) {
      totalTokensUsed = msg.usage.prompt_tokens + msg.usage.completion_tokens + msg.usage.cache_creation_input_tokens + msg.usage.cache_read_input_tokens;
      foundUsage = true;
      break;
    }
  }

  // 2. 如果没有找到 usage 信息，走旧版逻辑
  if (!foundUsage || !totalTokensUsed) {
    return {
      ...truncatedMessageWithSlideWindow(options),
      fallbackToSlideWindow: true
    };
  }

  console.debug(`[Debug] 找到上一次截断的位置，如果有，先还原截断`);
  // 3. 找到上一次截断的位置，如果有，先还原截断
  const lastTruncatedStart = findLastIndex(sendEntries, entry => !!entry.msg.truncateStart);
  if (lastTruncatedStart !== -1) {
    sendEntries = sendEntries.slice(lastTruncatedStart);
  }

  // 4. 如果未超过阈值，正常返回
  if (totalTokensUsed <= currentModelMaxTokens) {
    const mergedMap = new Map<number, ChatMessage>();
    sendEntries.forEach(entry => {
      mergedMap.set(entry.index, entry.msg);
    });
    pinnedEntries.forEach(entry => {
      mergedMap.set(entry.index, entry.msg);
    });

    const finalMessages = Array.from(mergedMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, msg]) => msg);

    const newTruncateStart = lastTruncatedStart !== -1 ? (sendEntries[0]?.index ?? -1) : -1;

    return {
      sendMessages: finalMessages,
      containUserMessage: finalMessages.some(msg => msg.role === ChatRole.User),
      newTruncateStart,
      previousTokens: totalTokensUsed
    };
  }

  console.log(`[Debug] prompt Token 使用量 ${totalTokensUsed} 超过阈值 ${currentModelMaxTokens}，开始截断`);

  const safeStartRoles = new Set([ChatRole.Assistant, ChatRole.User]);

  const overflowRatio = totalTokensUsed / currentModelMaxTokens;
  const baseDropFraction = Math.min(0.5, Math.max(0.2, overflowRatio - 0.85));
  const maxDroppable = Math.max(0, sendEntries.length);

  let dropCount = Math.floor(sendEntries.length * baseDropFraction);
  if (!Number.isFinite(dropCount) || dropCount <= 0) {
    dropCount = Math.min(Math.max(Math.floor(sendEntries.length / 2), 1), maxDroppable);
  } else {
    dropCount = Math.min(Math.max(dropCount, 1), maxDroppable);
  }

  let truncateIndex = dropCount;

  console.debug(`[Debug] 计算截断索引，初始值 ${truncateIndex}`);
  while (truncateIndex < sendEntries.length && !safeStartRoles.has(sendEntries[truncateIndex].msg.role)) {
    truncateIndex++;
  }

  if (truncateIndex >= sendEntries.length) {
    truncateIndex = dropCount - 1;
    while (truncateIndex >= 0 && !safeStartRoles.has(sendEntries[truncateIndex].msg.role)) {
      truncateIndex--;
    }
    if (truncateIndex < 0) {
      truncateIndex = 0;
    }
  }

  const truncatedEntries = sendEntries.slice(truncateIndex);
  if (!truncatedEntries.length) {
    truncatedEntries.push(sendEntries[sendEntries.length - 1]);
  }

  const newTruncateStart = truncatedEntries[0]?.index ?? -1;

  const mergedMap = new Map<number, ChatMessage>();
  truncatedEntries.forEach(entry => {
    mergedMap.set(entry.index, entry.msg);
  });
  pinnedEntries.forEach(entry => {
    mergedMap.set(entry.index, entry.msg);
  });

  const finalMessages = Array.from(mergedMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, msg]) => msg);
  const containUserMessage = finalMessages.some(msg => msg.role === ChatRole.User);

  console.debug(`[Debug] 返回截断后的消息，包含用户消息: ${containUserMessage}, 新截断起始索引: ${newTruncateStart}, 之前的Token数: ${totalTokensUsed}`);
  return {
    sendMessages: finalMessages,
    containUserMessage,
    newTruncateStart,
    previousTokens: totalTokensUsed
  };
}

export function truncatedMessageWithSlideWindow(options: {
  messages: ChatMessage[];
  model: ChatModel;
  codebaseModelMaxTokens: Record<ChatModel, number>;
}): {
  sendMessages: ChatMessage[];
  containUserMessage: boolean;
  newTruncateStart: number;
  previousTokens: number;
  fallbackToSlideWindow: boolean;
} {
  const {
    messages,
    model,
    codebaseModelMaxTokens
  } = options;
  let sendMessages = [...messages];
  // 找出需要截断的 index
  let currentModelMaxTokens = codebaseModelMaxTokens[model];
  if (model === ChatModel.Claude37SonnetThinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude37Sonnet];
  }
  if (model === ChatModel.Claude4Sonnet20250514Thinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude4Sonnet20250514];
  }
  if (model === ChatModel.Claude45Sonnet20250929Thinking) {
    currentModelMaxTokens = codebaseModelMaxTokens[ChatModel.Claude45Sonnet20250929];
  }
  // 非 gemini 模型，maxtokens 需要减小到 48k 最多
  if (!model.includes('gemini')) {
    currentModelMaxTokens = Math.min(currentModelMaxTokens, 48 * 1000);
  } else {
    currentModelMaxTokens = Math.min(currentModelMaxTokens, 160 * 1000);
  }
  let previousTokens = 0;
  let previousContentLength = 0;
  let truncateIndex = sendMessages.length - 1;
  // 用于判断 Claude37Sonnet 是否需要降级到非 thinking
  let containUserMessage = false;
  // let containMakePlan = false;
  // 只靠 tokens 来计算可能有遗漏，再加上字符串长度来判断
  while (truncateIndex >= 0) {
    const msg = sendMessages[truncateIndex];
    // TODO: 需要个统一把message里content转成字符串的方法
    let msgContent = '';
    if (typeof msg.content === 'string') {
      msgContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      msgContent = msg.content.map((i: any) => typeof i.text === 'string' ? i.text : '').join('');
    }
    if (msg.role === ChatRole.User) {
      containUserMessage = true;
    }
    previousContentLength += msgContent.length;
    if (msg.role === ChatRole.Assistant) {
      // 如果已经超出限制了，就停下来
      if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
        if (previousContentLength > 1000 * 1000 || previousTokens > currentModelMaxTokens) {
          break;
        }
      } else {
        if (previousContentLength > 500 * 1000 || previousTokens > currentModelMaxTokens) {
          break;
        }
      }
    }
    if (msg.role !== ChatRole.Assistant) {
      truncateIndex--;
      continue;
    }
    if (msg.group_tokens && msg.group_tokens > 0) {
      if (previousTokens + msg.group_tokens > currentModelMaxTokens) {
        // 如果加上QA对超出tokens限制了，则只加上Assistant消息（确保不会有tool错误）
        previousTokens += msg.completion_tokens || 0;
        break;
      } else {
        previousTokens += msg.group_tokens;
      }
    }
    truncateIndex--;
  }
  sendMessages = sendMessages.slice(Math.max(truncateIndex, 0));
  const newTruncateStart = truncateIndex >= 0 ? truncateIndex : -1;
  return {
    sendMessages,
    containUserMessage,
    newTruncateStart,
    previousTokens,
    fallbackToSlideWindow: true
  };
}
