// tiktoken 异步加载模块
// 避免 WASM 阻塞主线程导致白屏
import type { Tiktoken, TiktokenModel } from 'tiktoken';
import { ChatRole } from '../types/chat';
import type { ChatMessage } from '../services';
import { ChatModel } from '../services/chatModel';
import { scheduleWork } from './scheduler';
import type { SchedulerDeadline } from './scheduler';
import { onChunkLoadError } from './chunkErrorHandler';

// 异步加载 tiktoken 模块
let tiktokenModule: typeof import('tiktoken') | null = null;
let tiktokenLoadPromise: Promise<typeof import('tiktoken')> | null = null;

/**
 * 异步加载 tiktoken 模块
 * 使用懒加载方式避免阻塞主线程
 */
async function loadTiktoken(): Promise<typeof import('tiktoken')> {
  if (tiktokenModule) {
    return tiktokenModule;
  }

  if (!tiktokenLoadPromise) {
    tiktokenLoadPromise = import('tiktoken').then((module) => {
      tiktokenModule = module;
      console.debug('[tiktoken] WASM module loaded successfully');
      return module;
    }).catch((error) => {
      console.error('[tiktoken] Failed to load WASM module:', error);
      tiktokenLoadPromise = null;
      onChunkLoadError(error);
      throw error;
    });
  }

  return tiktokenLoadPromise;
}

// 预加载 tiktoken（在空闲时触发）
if (typeof window !== 'undefined') {
  const preloadTiktoken = () => {
    scheduleWork(() => {
      loadTiktoken().catch(() => {
        // 预加载失败不影响后续使用，会在实际使用时重试
      });
    });
  };

  // 等待页面加载完成后再预加载
  if (document.readyState === 'complete') {
    preloadTiktoken();
  } else {
    window.addEventListener('load', preloadTiktoken, { once: true });
  }
}

// 编码器单例，避免重复创建和释放
let encoderInstance: Tiktoken | null = null;
let encoderPromise: Promise<Tiktoken> | null = null;

/**
 * 异步获取编码器实例
 */
async function getEncoderAsync(): Promise<Tiktoken> {
  if (encoderInstance) {
    return encoderInstance;
  }

  if (!encoderPromise) {
    encoderPromise = loadTiktoken().then((tiktoken) => {
      encoderInstance = tiktoken.encoding_for_model('gpt-4o-mini');
      return encoderInstance;
    }).catch((error) => {
      encoderPromise = null;
      throw error;
    });
  }

  return encoderPromise;
}

type MessageTokenCacheEntry = {
  tokens: number;
  fingerprint: string;
};

const TOKEN_RELEVANT_FIELDS = ['role', 'content', 'name', 'tool_calls', 'tool_call_id'] as const;

const encoderCacheByModel = new Map<string, Tiktoken>();

async function getEncoderByModelAsync(model: string): Promise<Tiktoken> {
  const cached = encoderCacheByModel.get(model);
  if (cached) {
    return cached;
  }

  const tiktoken = await loadTiktoken();
  let enc: Tiktoken;
  try {
    enc = tiktoken.encoding_for_model(model as TiktokenModel);
  } catch {
    enc = await getEncoderAsync();
  }
  encoderCacheByModel.set(model, enc);
  return enc;
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

export async function countToolDefinitionTokensAsync(tools: ToolDef[] | undefined, model?: string): Promise<number> {
  if (!tools || !tools.length) return 0;
  const norm = normalizeModelForToolCounting(model);
  const enc = await getEncoderByModelAsync(model || 'gpt-4o-mini');
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
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

type FieldEntry = { key: typeof TOKEN_RELEVANT_FIELDS[number]; value: string };

/**
 * 提取消息中与 token 计算相关的字段，并生成用于缓存失效的指纹
 */
function extractFieldsAndFingerprint(message: ChatMessage): { fields: FieldEntry[]; fingerprint: string } {
  const fields: FieldEntry[] = [];

  for (const key of TOKEN_RELEVANT_FIELDS) {
    const value = message[key];
    if (value === undefined || value === null || value === '') continue;

    const stringValue = valueToString(key, value);
    if (!stringValue) continue;

    fields.push({ key, value: stringValue });
  }

  const fingerprint = JSON.stringify(fields.map(({ key, value }) => [key, value]));
  return { fields, fingerprint };
}

/**
 * 使用编码器计算字段 token 数量（纯同步，核心编码逻辑）
 * 会自动读写 messageSingleTokenCache
 */
function encodeMessageTokens(enc: Tiktoken, message: ChatMessage): number {
  const { fields, fingerprint } = extractFieldsAndFingerprint(message);

  const cached = messageSingleTokenCache.get(message);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.tokens;
  }

  let numTokens = 0;
  for (const { key, value } of fields) {
    try {
      numTokens += enc.encode(value).length;
    } catch (error) {
      console.error('Error encoding token:', error);
    }
    if (key === 'name') {
      numTokens += 1; // tokensPerName
    }
  }

  messageSingleTokenCache.set(message, { tokens: numTokens, fingerprint });
  return numTokens;
}

/**
 * 计算单条消息的内容 token 数量（不包括消息结构开销）
 * 异步版本：等待 tiktoken 加载完成
 */
export async function calculateSingleMessageContentTokensAsync(message: ChatMessage): Promise<number> {
  const enc = await getEncoderAsync();
  return encodeMessageTokens(enc, message);
}

/**
 * 获取编码器实例（同步版本）
 * 仅在 encoder 已通过 getEncoderAsync() 初始化后使用
 */
function getEncoderSync(): Tiktoken {
  if (!encoderInstance) {
    throw new Error(
      '[getEncoderSync] Encoder not initialized. Ensure getEncoderAsync() has been awaited before calling sync methods.'
    );
  }
  return encoderInstance;
}

/**
 * 计算单条消息的内容 token 数量（同步版本）
 * 调用前必须确保 encoder 已初始化（通过 await getEncoderAsync()）
 * 用于时间片调度器的同步循环中，避免 await 破坏时间片逻辑
 */
function calculateSingleMessageContentTokensSync(message: ChatMessage): number {
  return encodeMessageTokens(getEncoderSync(), message);
}

/**
 * 计算消息数组的 token 数量（使用 tiktoken）
 * 使用 MessageChannel 协作式调度，每 5ms 让步一次，避免阻塞 UI
 * 参考 OpenAI 官方计算方式
 * https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
 */
export async function calculateMessageTokens(messages: ChatMessage[]): Promise<number> {
  // 确保 encoder 已初始化（同步循环依赖 encoderInstance）
  await getEncoderAsync();

  const tokensPerMessage = 3;
  let numTokens = 0;
  let currentIndex = 0;

  return new Promise<number>((resolve) => {
    const processMessages = (deadline: SchedulerDeadline) => {
      while (deadline.timeRemaining() > 0 && currentIndex < messages.length) {
        numTokens += tokensPerMessage
          + calculateSingleMessageContentTokensSync(messages[currentIndex]);
        currentIndex++;
      }

      if (currentIndex < messages.length) {
        scheduleWork(processMessages);
      } else {
        numTokens += 3;
        resolve(numTokens);
      }
    };

    scheduleWork(processMessages);
  });
}

/**
 * 从 usage 对象汇总 token 总数
 */
export function sumUsageTokens(usage: NonNullable<ChatMessage['usage']>): number {
  return (
    (usage.prompt_tokens || 0) +
    (usage.completion_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0)
  );
}

/**
 * Calculate latest token usage from message array
 */
export function calculateLatestTokenUsage(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === ChatRole.Assistant && msg.usage) {
      return sumUsageTokens(msg.usage);
    }
  }
  return 0;
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
  return calculateMessageTokens(messages);
}

export async function estimateTokensIncludingTools(
  messages: ChatMessage[],
  tools?: ToolDef[] | undefined,
  model?: ChatModel | string,
): Promise<number> {
  const base = await calculateMessageTokens(messages);
  const toolDefs = await countToolDefinitionTokensAsync(tools, typeof model === 'string' ? model : (model as string | undefined));
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
  const estimatedUsage = 4063 + await estimateTokensIncludingTools(messages, tools, model);
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
  const currentTotalTokens = sumUsageTokens(lastAssistant.usage!);

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
  const previousTotalTokens = sumUsageTokens(previousAssistant.usage);

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
 * 使用 MessageChannel 协作式调度，每 5ms 让步一次，避免阻塞 UI
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

  // 确保 encoder 已初始化（同步循环依赖 encoderInstance）
  await getEncoderAsync();

  const tokensPerMessage = 3;
  const finalOverhead = 3;

  let currentIndex = messages.length - 1;
  let accumulatedTokens = finalOverhead;

  return new Promise<ChatMessage[]>((resolve) => {
    const processMessages = (deadline: SchedulerDeadline) => {
      while (deadline.timeRemaining() > 0 && currentIndex >= 0) {
        const msgContentTokens =
          calculateSingleMessageContentTokensSync(messages[currentIndex]);
        const msgTotalTokens = tokensPerMessage + msgContentTokens;

        if (accumulatedTokens + msgTotalTokens > maxTokens) {
          if (currentIndex === messages.length - 1) {
            console.warn('[trimMessagesByTokenLimit] Single message exceeds token limit');
            resolve([]);
            return;
          }
          resolve(messages.slice(currentIndex + 1));
          return;
        }

        accumulatedTokens += msgTotalTokens;
        currentIndex--;
      }

      if (currentIndex >= 0) {
        scheduleWork(processMessages);
      } else {
        resolve(messages);
      }
    };

    scheduleWork(processMessages);
  });
}