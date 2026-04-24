import { encoding_for_model } from 'tiktoken';
import type { Tiktoken } from 'tiktoken';
import { ChatRole } from '../types/chat';

import type { ChatMessage } from '../services';
import { ChatModel } from '../services/chatModel';
import { getAIGWModel } from '../store/chat-config';

// 编码器单例，避免重复创建和释放
let encoderInstance: Tiktoken | null = null;
const scheduleWork = typeof requestIdleCallback !== 'undefined'
  ? requestIdleCallback
  : (callback: IdleRequestCallback) => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 16 } as IdleDeadline), 0);


function getEncoder(): Tiktoken {
  if (!encoderInstance) {
    encoderInstance = encoding_for_model("gpt-4o-mini");
  }
  return encoderInstance;
}

type MessageTokenCacheEntry = {
  tokens: number;
  fingerprint: string;
};

const TOKEN_RELEVANT_FIELDS = ['role', 'content', 'name', 'tool_calls', 'tool_call_id'] as const;

const encoderCacheByModel = new Map<string, Tiktoken>();
function getEncoderByModel(model: string): Tiktoken {
  let enc = encoderCacheByModel.get(model);
  if (!enc) {
    try {
      enc = (encoding_for_model as any)(model);
    } catch {
      enc = getEncoder();
    }
    encoderCacheByModel.set(model, enc!);
  }
  return enc!;
}

function normalizeModelForToolCounting(model?: string): 'gpt-4o' | 'gpt-4' | 'gpt-3.5' {
  const m = (model || '').toLowerCase();
  if (m.includes('4o') || m.includes('gpt5')) return 'gpt-4o';
  if (m.includes('3.5')) return 'gpt-3.5';
  if (m.includes('gpt-4') || m.includes('gpt4')) return 'gpt-4';
  return 'gpt-4o';
}

export type ToolDef = {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: {
      type?: string;
      properties?: Record<string, any>;
      required?: string[];
    };
  };
};

function countToolDefinitionTokens(tools: ToolDef[] | undefined, model?: string): number {
  if (!tools || !tools.length) return 0;
  const norm = normalizeModelForToolCounting(model);
  const enc = getEncoderByModel(model || 'gpt-4o-mini');
  let func_init = 0, prop_init = 0, prop_key = 0, enum_init = 0, enum_item = 0, func_end = 0;
  if (norm === 'gpt-4o') {
    func_init = 7; prop_init = 3; prop_key = 3; enum_init = -3; enum_item = 3; func_end = 12;
  } else if (norm === 'gpt-4' || norm === 'gpt-3.5') {
    func_init = 10; prop_init = 3; prop_key = 3; enum_init = -3; enum_item = 3; func_end = 12;
  }
  let func_token_count = 0;
  for (const t of tools) {
    if (!t || !t.function) continue;
    func_token_count += func_init;
    const f = t.function;
    const f_name = f.name || '';
    let f_desc = f.description || '';
    if (f_desc.endsWith('.')) f_desc = f_desc.slice(0, -1);
    const header = `${f_name}:${f_desc}`;
    func_token_count += enc.encode(header).length;
    const props = f.parameters?.properties || {};
    const keys = Object.keys(props);
    if (keys.length > 0) {
      func_token_count += prop_init;
      for (const key of keys) {
        func_token_count += prop_key;
        const def = props[key] || {};
        const p_name = key;
        const p_type = def.type || '';
        let p_desc = def.description || '';
        if (def && Array.isArray(def.enum)) {
          func_token_count += enum_init;
          for (const item of def.enum) {
            func_token_count += enum_item;
            func_token_count += enc.encode(String(item)).length;
          }
        }
        if (p_desc.endsWith('.')) p_desc = p_desc.slice(0, -1);
        const line = `${p_name}:${p_type}:${p_desc}`;
        func_token_count += enc.encode(line).length;
      }
    }
  }
  func_token_count += func_end;
  return func_token_count;
}

// 单条消息内容 token 缓存（使用 WeakMap 避免内存泄漏）
// 注意：这里缓存的是单条消息的内容 token，不包括消息结构开销
// 同时记录指纹，确保当消息内容更新时缓存能正确失效
const messageSingleTokenCache = new WeakMap<ChatMessage, MessageTokenCacheEntry>();

// 在应用退出时释放
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (encoderInstance) {
      encoderInstance.free();
      encoderInstance = null;
    }
  });
}

/**
 * 将消息字段值转换为字符串用于 token 计算
 */
function valueToString(key: string, value: any): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (key === 'content') {
      return value
        .map(item => ('text' in item ? item.text : ''))
        .filter(text => text)
        .join('\n');
    } else {
      return JSON.stringify(value);
    }
  }

  if (typeof value === 'object' && value !== null) {
    // 其他对象：序列化为 JSON
    return JSON.stringify(value);
  }

  // number, boolean 等：转为字符串
  return String(value);
}

/**
 * 计算单条消息的内容 token 数量（不包括消息结构开销）
 * 此函数会使用缓存，相同的消息对象只会计算一次
 */
function calculateSingleMessageContentTokens(message: ChatMessage): number {
  const tokensPerName = 1;
  const fieldStrings: { key: typeof TOKEN_RELEVANT_FIELDS[number]; value: string }[] = [];

  for (const key of TOKEN_RELEVANT_FIELDS) {
    const value = message[key];
    if (value === undefined || value === null || value === '') continue;

    const stringValue = valueToString(key, value);
    if (!stringValue) continue;

    fieldStrings.push({ key, value: stringValue });
  }

  const fingerprint = JSON.stringify(fieldStrings.map(({ key, value }) => [key, value]));
  const cached = messageSingleTokenCache.get(message);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.tokens;
  }

  const enc = getEncoder();
  let numTokens = 0;

  for (const { key, value } of fieldStrings) {
    try {
      numTokens += enc.encode(value).length;
    } catch (error) {
      console.error('Error encoding token:', error);
    }

    if (key === 'name') {
      numTokens += tokensPerName;
    }
  }

  messageSingleTokenCache.set(message, { tokens: numTokens, fingerprint });

  return numTokens;
}

/**
 * 计算消息数组的 token 数量（使用 tiktoken）
 * 使用 requestIdleCallback 避免阻塞 UI
 * 参考 OpenAI 官方计算方式
 * https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 */
async function calculateMessageTokens(messages: ChatMessage[]): Promise<number> {
  // 每条消息的固定结构开销
  const tokensPerMessage = 3;
  let numTokens = 0;
  let currentIndex = 0;

  return new Promise<number>((resolve) => {
    const processMessages = (deadline: IdleDeadline) => {
      // 在空闲时间内尽可能多地处理消息
      while (deadline.timeRemaining() > 0 && currentIndex < messages.length) {
        numTokens += tokensPerMessage + calculateSingleMessageContentTokens(messages[currentIndex]);
        currentIndex++;
      }

      // 如果还有消息未处理，继续调度
      if (currentIndex < messages.length) {
        scheduleWork(processMessages);
      } else {
        // 所有消息处理完毕，加上最后的固定开销
        numTokens += 3;
        resolve(numTokens);
      }
    };

    scheduleWork(processMessages);
  });
}

/**
 * Calculate latest token usage from message array
 */
export function calculateLatestTokenUsage(messages: ChatMessage[]): number {
  let totalTokensUsed = 0;
  let foundUsage = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === ChatRole.Assistant && msg.usage) {
      totalTokensUsed =
        msg.usage.prompt_tokens +
        msg.usage.completion_tokens +
        (msg.usage.cache_creation_input_tokens || 0) +
        (msg.usage.cache_read_input_tokens || 0);
      foundUsage = true;
      break;
    }
  }

  return foundUsage ? totalTokensUsed : 0;
}

/**
 * Get model context limit, reusing existing codebaseModelMaxTokens logic
*/
export function getModelContextLimit(
  model: ChatModel,
  codebaseModelMaxTokens: Record<ChatModel, number>
): number {
  let currentModelMaxTokens = codebaseModelMaxTokens[model];

  if (!currentModelMaxTokens) {
    currentModelMaxTokens = Math.min(currentModelMaxTokens, 48 * 1000);
  }

  return currentModelMaxTokens
}

/**
 * Estimate token count using tiktoken
 */
export async function estimateTokensByContentLength(messages: ChatMessage[]): Promise<number> {
  const length = await calculateMessageTokens(messages);
  return length
}

export async function estimateTokensIncludingTools(
  messages: ChatMessage[],
  tools?: ToolDef[] | undefined,
  model?: ChatModel | string,
): Promise<number> {
  const base = await calculateMessageTokens(messages);
  const toolDefs = countToolDefinitionTokens(tools, typeof model === 'string' ? model : (model as string | undefined));
  return base + toolDefs;
}

export async function analyzeTokenUsageWithTools(
  messages: ChatMessage[],
  tools: ToolDef[] | undefined,
  model: ChatModel,
  codebaseModelMaxTokens: Record<ChatModel, number>
): Promise<{
  currentUsage: number;
  maxLimit: number;
  estimatedUsage: number;
  hasExactUsage: boolean;
}> {
  const exactUsage = calculateLatestTokenUsage(messages);
  const estimatedUsage = 4063 + await estimateTokensIncludingTools(messages, tools, getAIGWModel(model));
  const maxLimit = getModelContextLimit(model, codebaseModelMaxTokens);


  console.debug(`[Token Analysis] Model: ${model}, Exact Usage: ${exactUsage}, Estimated Usage: ${estimatedUsage}, Max Limit: ${maxLimit}`);
  return {
    currentUsage: exactUsage || estimatedUsage,
    maxLimit,
    estimatedUsage,
    hasExactUsage: exactUsage > 0,
  };
}

/**
 * 计算最后一次QA（问答）的token用量
 */
export async function calculateLastQATokenUsage(messages: ChatMessage[]): Promise<number> {
  if (!messages || messages.length === 0) {
    return 0;
  }

  // 1. 找到最后一个 Assistant 消息的索引
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === ChatRole.Assistant) {
      lastAssistantIndex = i;
      break;
    }
  }

  // 如果没有找到 Assistant 消息，或最后一个 Assistant 没有 usage，使用 tiktoken
  if (lastAssistantIndex === -1 || !messages[lastAssistantIndex].usage) {
    console.debug('[calculateLastQATokenUsage] No assistant with usage found, using tiktoken for all messages');
    return await calculateMessageTokens(messages);
  }

  const lastAssistant = messages[lastAssistantIndex];

  // 2. 找到上一个 Assistant 消息
  let previousAssistantIndex = -1;
  for (let i = lastAssistantIndex - 1; i >= 0; i--) {
    if (messages[i].role === ChatRole.Assistant) {
      previousAssistantIndex = i;
      break;
    }
  }

  // 3. 计算当前 Assistant 的 total tokens
  const currentTotalTokens =
    (lastAssistant.usage!.prompt_tokens || 0) +
    (lastAssistant.usage!.completion_tokens || 0) +
    (lastAssistant.usage!.cache_creation_input_tokens || 0) +
    (lastAssistant.usage!.cache_read_input_tokens || 0);

  // 4. 如果没有找到上一个 Assistant，直接返回当前的 total tokens
  if (previousAssistantIndex === -1) {
    console.debug(`[calculateLastQATokenUsage] First QA, using current usage: ${currentTotalTokens} tokens`);
    return currentTotalTokens;
  }

  const previousAssistant = messages[previousAssistantIndex];

  // 5. 如果上一个 Assistant 没有 usage，使用 tiktoken 计算
  if (!previousAssistant.usage) {
    console.debug('[calculateLastQATokenUsage] Previous assistant has no usage, using tiktoken');
    const qaMessages = messages.slice(previousAssistantIndex + 1, lastAssistantIndex + 1);
    return await calculateMessageTokens(qaMessages);
  }

  // 6. 计算上一个 Assistant 的 total tokens
  const previousTotalTokens =
    (previousAssistant.usage.prompt_tokens || 0) +
    (previousAssistant.usage.completion_tokens || 0) +
    (previousAssistant.usage.cache_creation_input_tokens || 0) +
    (previousAssistant.usage.cache_read_input_tokens || 0);

  // 7. 检测异常：如果当前 token 比上一个还小，说明可能发生了异步压缩
  if (currentTotalTokens < previousTotalTokens) {
    console.warn(
      `[calculateLastQATokenUsage] Token count decreased: ${previousTotalTokens} → ${currentTotalTokens}. ` +
      `This may indicate asynchronous compression. Falling back to tiktoken calculation.`
    );
    const qaMessages = messages.slice(previousAssistantIndex + 1, lastAssistantIndex + 1);
    const tiktokenTokens = await calculateMessageTokens(qaMessages);
    console.debug(`[calculateLastQATokenUsage] Tiktoken calculation (compression detected): ${tiktokenTokens} tokens`);
    return tiktokenTokens;
  }

  // 8. 正常情况：返回差值
  const incrementalTokens = currentTotalTokens - previousTotalTokens;
  console.debug(
    `[calculateLastQATokenUsage] Using usage-based calculation: ${currentTotalTokens} - ${previousTotalTokens} = ${incrementalTokens} tokens`
  );
  return incrementalTokens;
}

/**
 * Trim old messages that exceed token limit
 * 使用 requestIdleCallback 避免阻塞 UI
 * @param messages - Message array to trim (format: [old -> new])
 * @param maxTokens - Maximum token limit
 * @returns Filtered message array with old messages removed
 */
export async function trimMessagesByTokenLimit(
  messages: ChatMessage[],
  maxTokens: number
): Promise<ChatMessage[]> {
  if (messages.length === 0) {
    return messages;
  }

  const tokensPerMessage = 3; // 每条消息的固定开销
  const finalOverhead = 3; // 最后的固定 +3

  return new Promise<ChatMessage[]>((resolve) => {
    let currentIndex = messages.length - 1;
    let accumulatedTokens = finalOverhead;
    let foundCutoffIndex = -1;

    const processMessages = (deadline: IdleDeadline) => {
      // 在空闲时间内尽可能多地处理消息
      while (deadline.timeRemaining() > 0 && currentIndex >= 0) {
        const msgContentTokens = calculateSingleMessageContentTokens(messages[currentIndex]);
        const msgTotalTokens = tokensPerMessage + msgContentTokens;

        // 检查加入这条消息后是否会超限
        if (accumulatedTokens + msgTotalTokens > maxTokens) {
          // 如果第一条消息就超限
          if (currentIndex === messages.length - 1) {
            console.warn('[trimMessagesByTokenLimit] Single message exceeds token limit');
            resolve([]);
            return;
          }
          // 找到截断点
          foundCutoffIndex = currentIndex + 1;
          resolve(messages.slice(foundCutoffIndex));
          return;
        }

        accumulatedTokens += msgTotalTokens;
        currentIndex--;
      }

      // 如果还有消息未处理，继续调度
      if (currentIndex >= 0) {
        scheduleWork(processMessages);
      } else {
        // 所有消息都不超限
        resolve(messages);
      }
    };

    scheduleWork(processMessages);
  });
}
