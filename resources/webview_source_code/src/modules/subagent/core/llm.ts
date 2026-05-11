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

/**
 * 封装 LLM 流式调用，返回 Promise 化的结果。
 * - 内部通过 withRetry 对瞬态错误自动指数退避重试
 * - Tracing 由 requestCodebaseChatStream 内部统一管理
 */
export function streamChat(
  promptData: ChatPromptBody,
  abortController: AbortController,
  subagentSpanContext?: SubagentSpanContext,
): Promise<LLMCallResult> {

   if (
     [ChatModel.GPT5, ChatModel.GPT51, ChatModel.GPT51Codex].includes(
       promptData.model as ChatModel,
     )
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
   }

  return withRetry(
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