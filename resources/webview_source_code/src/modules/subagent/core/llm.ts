/**
 * LLM 调用封装
 *
 * 封装 LLM 调用，支持自动重试。
 */

import type { LLMCallResult, LLMCallUsage } from '../types';
import { withRetry } from '../utils/retry';
import { ChatPromptBody, ToolCall } from '../../../services';
import { requestCodebaseChatStream } from '../../../services/useChatStream';

// ============================================================
// LLM 调用封装
// ============================================================

/**
 * 封装 LLM 流式调用，返回 Promise 化的结果。
 * 内部通过 withRetry 对瞬态错误自动指数退避重试。
 */
export function callSubagentLLM(
  promptData: ChatPromptBody,
  abortController: AbortController,
): Promise<LLMCallResult> {
  return withRetry(
    () =>
      new Promise<LLMCallResult>((resolve, reject) => {
        let resolved = false;
        const chatRequestUrl = '/proxy/gpt/gpt/codebase_chat_stream';

        requestCodebaseChatStream(
          promptData,
          chatRequestUrl,
          {
            // 参数顺序参考 requestCodebaseChatStream 的 finish() 调用:
            // message, done, toolCalls, totalTokens, completionTokens, promptTokens,
            // cacheCreationInputTokens, cacheReadInputTokens, claude37Response, responseId
            onMessage: (
              content: string,
              done: boolean,
              toolCalls: ToolCall[],
              totalTokens: number,
              completionTokens: number,
              promptTokens: number,
              cacheCreationInputTokens: number,
              cacheReadInputTokens: number,
            ) => {
              if (done && !resolved) {
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
              // 当外部 abort 时，也 abort 这个 stream controller
              const onAbort = () => {
                controller.abort();
              };
              if (abortController.signal.aborted) {
                controller.abort();
              } else {
                abortController.signal.addEventListener('abort', onAbort, {
                  once: true,
                });
              }
            },
            setError: () => {
              // 子代理的错误不通过 UI 展示，通过 onError 处理
            },
          },
        );
      }),
    { abortSignal: abortController.signal },
  );
}

/**
 * 创建空的 token 用量统计对象。
 */
export function createEmptyUsage(): LLMCallUsage {
  return {
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
}

/**
 * 累加 token 用量。
 */
export function addUsage(total: LLMCallUsage, delta: LLMCallUsage): void {
  total.totalTokens += delta.totalTokens;
  total.promptTokens += delta.promptTokens;
  total.completionTokens += delta.completionTokens;
  total.cacheCreationInputTokens += delta.cacheCreationInputTokens;
  total.cacheReadInputTokens += delta.cacheReadInputTokens;
}