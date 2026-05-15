/**
 * Subagent LLM 调用封装
 */

import type { LLMCallResult, LLMCallUsage, SubagentSpanContext } from '../types';
import { withRetry } from '../utils/retry';
import { UserEvent } from '../../../types/report';
import { ChatPromptBody, ToolCall } from '../../../services';
import { requestCodebaseChatStream } from '../../../services/useChatStream';
import { generateTraceId } from '../../../utils/trace';
import { debugSuccess } from '../../../utils/debugLog';
import { ChatModel } from '../../../services/chatModel';
import { LLM_CALL_TIMEOUT_MS } from '../constants';

/**
 * 封装 LLM 流式调用，返回 Promise 化的结果。
 * - 内部通过 withRetry 对瞬态错误自动指数退避重试
 * - 每次调用有 3 分钟超时限制，避免 API 卡住
 * - Tracing 由 requestCodebaseChatStream 内部统一管理
 */
export function streamChat(
  promptData: ChatPromptBody,
  abortController: AbortController,
  subagentSpanContext?: SubagentSpanContext,
): Promise<LLMCallResult> {

  if (
    promptData.model.includes('gpt-5')
  ) {
    delete promptData.temperature;
  } else if ([ChatModel.Gemini3Pro].includes(promptData.model as ChatModel)) {
    if (promptData.messages?.length > 0 && promptData.messages[0].content != null) {
      promptData.messages[0].content += `\nNote:Don't repeat yourself`;
    }
    promptData.temperature = 1;
  } else if (
    [ChatModel.Glm47, ChatModel.Glm5].includes(promptData.model as ChatModel)
  ) {
    promptData.temperature = 2;
  } else if (promptData.model.includes('claude')) {
    promptData.temperature = 1;
  } else if (promptData.model.includes('deepseek')) {
    promptData.temperature = 1;
  }

  // LLM 调用超时 Promise
  const timeoutPromise = new Promise<LLMCallResult>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`LLM call timeout after ${LLM_CALL_TIMEOUT_MS}ms`));
    }, LLM_CALL_TIMEOUT_MS);

    // 如果 abort 信号触发，清除超时计时器
    if (abortController.signal.aborted) {
      clearTimeout(timeoutId);
    } else {
      abortController.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      }, { once: true });
    }
  });

  // 实际的 LLM 调用逻辑
  const llmCallPromise = withRetry(
    () =>
      new Promise<LLMCallResult>((resolve, reject) => {
        let resolved = false;

        // 用于存储 Gemini 模型的 thinking_signature
        let thinkingSignature = '';

        requestCodebaseChatStream(
          UserEvent.CODE_CHAT_SUBAGENT,
          promptData,
          '/proxy/gpt/gpt/codebase_chat_stream',
          {
            customAssociation: subagentSpanContext?.association,
            parentContext: subagentSpanContext?.taskContext,
            ntesTraceId: generateTraceId(),
            // subagent 错误通过 onError 处理，不通过 UI 展示
            setError: () => undefined,
            onMessage: (
              content: string,
              done: boolean,
              toolCalls: ToolCall[],
              totalTokens: number,
              promptTokens: number,
              cacheCreationInputTokens: number,
              cacheReadInputTokens: number,
              completionTokens: number,
              claude37Response?: {
                reasoning_content: string;
                thinking_signature: string;
                redacted_thinking: string;
              },
            ) => {
              // 捕获 Gemini 模型的 thinking_signature
              if (claude37Response?.thinking_signature) {
                thinkingSignature = claude37Response.thinking_signature;
              }

              if (done && !resolved) {
                debugSuccess(
                  'Sub Agent onMessage',
                  'Stream done. Final tool calls:',
                  {
                    toolCalls,
                    promptData,
                    totalTokens,
                    promptTokens,
                    cacheCreationInputTokens,
                    cacheReadInputTokens,
                    completionTokens,
                    thinkingSignature: thinkingSignature || undefined,
                  },
                );
                resolved = true;
                resolve({
                  text: content,
                  toolCalls: toolCalls || [],
                  usage: {
                    totalTokens: totalTokens || 0,
                    promptTokens: promptTokens || 0,
                    completionTokens: completionTokens || 0,
                    cacheCreationInputTokens: cacheCreationInputTokens || 0,
                    cacheReadInputTokens: cacheReadInputTokens || 0,
                  },
                  thinkingSignature: thinkingSignature || undefined,
                });
              }
            },
            onError: (error: Error) => {
              if (!resolved) {
                resolved = true;
                reject(error);
              }
            },
            onController: (controller: AbortController) => {
              if (abortController.signal.aborted) {
                controller.abort();
              } else {
                abortController.signal.addEventListener(
                  'abort',
                  () => controller.abort(),
                  { once: true },
                );
              }
            },
          },
        );
      }),
    { abortSignal: abortController.signal },
  );

  // 使用 Promise.race 实现超时机制
  return Promise.race([llmCallPromise, timeoutPromise]);
}

/** 创建空的 token 用量统计对象 */
export function createEmptyUsage(): LLMCallUsage {
  return {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
}

/** 合并 token 用量到 total */
export function mergeUsage(total: LLMCallUsage, delta: LLMCallUsage): void {
  total.totalTokens += delta.totalTokens;
  total.promptTokens += delta.promptTokens;
  total.completionTokens += delta.completionTokens;
  total.cacheCreationInputTokens += delta.cacheCreationInputTokens;
  total.cacheReadInputTokens += delta.cacheReadInputTokens;
}