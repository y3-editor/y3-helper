/**
 * 压缩调用 agent —— 对照 Claude Code 的 runForkedAgent + createCompactCanUseTool。
 *
 * 我们没有真正的 agent loop,但用"递归追加 deny 后的 tool result"模拟同一行为:
 * - 复用主对话同款 payload(system + tools + model + tool_choice + messages prefix),
 *   在 messages 末尾追加 summary prompt 作为 last user,命中主对话已建立的 prompt cache 前缀
 * - 若模型不听话回了 tool_calls 而没文本,则伪造 (assistant{tool_calls}, tool{denied}) 对
 *   追加到 messages 再请求一次 —— 相当于 Claude Code 里 canUseTool 返回 behavior:'deny'
 * - 终止条件:拿到非空文本 / 无 tool_calls / 达到 MAX_DENY_TURNS
 *
 * 传输层:每次 callOnce 都 new AgentEntry(),绕开 getCodemakerAgentEntry 的单例 gate,
 * 与主对话共用同一个 AgentEntry.execute 代码路径 → 未来主对话传输层任何变动(换 stream、
 * 加 supplyChannel、接 cache 新模型)压缩自动同步,无需二次维护。
 */

import { ChatRole } from '../types/chat';
import { UserEvent } from '../types/report';
import type { ChatMessage, ChatPromptBody, ToolCall } from './index';
import type { GPTResponse } from './chat';
import { AgentEntry } from './harness/swarm/agentEntry';
import type { IChatModelConfig } from './chatModel';

const MAX_DENY_TURNS = 3;
const DENY_REASON =
  'Tool calls are denied during context compaction. Output ONLY the summary text wrapped in <analysis> and <summary> tags as instructed.';

export interface CompactionAgentOptions {
  /** 最大 deny-重试轮数(含首次),默认 3 */
  maxDenyTurns?: number;
}

/**
 * 单次请求 → 聚合成 { text, toolCalls, usage }。
 * 每次 new AgentEntry(),独立实例不与主对话抢单例。
 */
async function callOnce(
  chatModelConfig: IChatModelConfig,
  payload: ChatPromptBody,
): Promise<{
  text: string;
  toolCalls: ToolCall[];
  usage: GPTResponse['usage'];
}> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const agent = new AgentEntry();
    agent.execute(chatModelConfig, payload, {
      event: UserEvent.CODE_CHAT_COMPRESS,
      chatRequestUrl: '/proxy/gpt/gpt/codebase_chat_stream',
      setError: () => undefined,
      onError: (err) => {
        if (resolved) return;
        resolved = true;
        reject(err);
      },
      onMessage: (
        content: string,
        done: boolean,
        toolCalls: ToolCall[],
        _totalTokens: number,
        completionTokens: number,
        promptTokens: number,
        cacheCreationInputTokens: number,
        cacheReadInputTokens: number,
      ) => {
        if (!done || resolved) return;
        resolved = true;
        resolve({
          text: content || '',
          toolCalls: toolCalls || [],
          usage: {
            prompt_tokens: promptTokens || 0,
            completion_tokens: completionTokens || 0,
            total_tokens:
              (promptTokens || 0) +
              (completionTokens || 0) +
              (cacheCreationInputTokens || 0) +
              (cacheReadInputTokens || 0),
            cache_creation_input_tokens: cacheCreationInputTokens || 0,
            cache_read_input_tokens: cacheReadInputTokens || 0,
            prompt_tokens_details: {
              cached_tokens: cacheReadInputTokens || 0,
            },
            completion_tokens_details: {
              reasoning_tokens: 0,
              text_tokens: completionTokens || 0,
            },
          } as GPTResponse['usage'],
        });
      },
    });
  });
}

function assembleGptResponse(
  text: string,
  usage: GPTResponse['usage'],
): GPTResponse {
  return {
    choices: [
      {
        message: {
          role: ChatRole.Assistant,
          content: text,
        },
      },
    ],
    usage,
  };
}

/**
 * 运行压缩 agent,返回 GPTResponse 形态以便 compressionService 的 extractSummaryText 直接消费。
 *
 * @param chatModelConfig 当前模型配置(来自 useChatConfig.getState().chatModels[model],
 *                        和主对话 execute 入参同源,决定 AgentEntry 内部走哪条 stream)
 * @param basePayload     完整的主对话同款 payload(已含 summary prompt 作为 last user)
 * @param options         可选参数
 */
export async function runCompactionAgent(
  chatModelConfig: IChatModelConfig,
  basePayload: ChatPromptBody,
  options?: CompactionAgentOptions,
): Promise<GPTResponse> {
  const maxTurns = options?.maxDenyTurns ?? MAX_DENY_TURNS;
  let messages = basePayload.messages;
  let lastUsage: GPTResponse['usage'] | undefined;

  for (let turn = 1; turn <= maxTurns; turn++) {
    const { text, toolCalls, usage } = await callOnce(chatModelConfig, {
      ...basePayload,
      messages,
    });
    lastUsage = usage;

    if (text.trim()) {
      return assembleGptResponse(text, usage);
    }
    if (!toolCalls.length) {
      // 既没文本也没 tool_calls,再重试也没意义,交给调用方走 fallback
      return assembleGptResponse('', usage);
    }

    // 模型不听话,要调工具 —— 伪造 (assistant{tool_calls}, tool{denied}) 对追加到 messages 再来一轮
    console.warn(
      `[CompactionAgent] turn ${turn}: model returned ${toolCalls.length} tool_calls, denying and retrying`,
    );
    messages = [
      ...messages,
      {
        role: ChatRole.Assistant,
        content: '',
        tool_calls: toolCalls,
      } as ChatMessage,
      ...toolCalls.map(
        (tc) =>
          ({
            role: ChatRole.Tool,
            tool_call_id: tc.id,
            content: DENY_REASON,
          } as ChatMessage),
      ),
    ];
  }

  console.warn(
    `[CompactionAgent] exhausted ${maxTurns} deny turns, no text returned`,
  );
  return assembleGptResponse('', lastUsage!);
}