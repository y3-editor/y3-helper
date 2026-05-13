import BaseStream from "./../base";
import { createParser, EventSourceParseCallback, ParsedEvent } from "eventsource-parser";
import { getErrorMessage } from "../../../../utils";
import { IAIGWResponsesRequest, IAzureOpenAIStream, IAzureOpenAIStreamContext } from "./interface";
import { ChatPromptBody } from "../../..";
import { ICmCodebaseStreamOption } from "../cmCodebase/interface";
import { StreamTracker } from "../streamTracker";
import { ChatRole } from "../../../../types/chat";
import { ConversationRoundState } from "../../../../telemetry/otel";
import { useChatStreamStore } from "../../../../store/chat";
import { UserEvent } from "../../../../types/report";


export default class AzureOpenAIStream extends BaseStream<ICmCodebaseStreamOption> implements IAzureOpenAIStream {
  public requestParmas: IAIGWResponsesRequest = { model: '', input: '' }
  public conversationContext: IAzureOpenAIStreamContext = {
    content: '',
    tool_calls: [],
    totalTokens: 0,
    completionTokens: 0,
    promptTokens: 0,
    cacheReadInputTokens: 0,
    responseId: '',
  } // 记录回流的上下文

  private chunkTimeoutId: NodeJS.Timeout | null = null;
  private lastChunkTime = 0;
  private originalData: ChatPromptBody;
  private tracker = new StreamTracker();
  private round: ConversationRoundState | undefined = undefined
  private firstTokenReceived = false

  public get getUrl() {
    return `/proxy/cm/openai/v1/responses`
  }

  public get getMaxTimeout() {
    return 1000 * 60 * 2
  }

  constructor(data: ChatPromptBody, options: ICmCodebaseStreamOption) {
    super(AzureOpenAIStream.convertRequestParams(data), options)
    this.originalData = data
    this.round = (useChatStreamStore.getState() as any).conversationRound;
  }

  /**
   * 将 ChatPromptBody 转换为 Responses API 请求参数
   *
   * 主要差异：
   * - system 消息 → 顶层 instructions 字段
   * - user content "text" → "input_text"
   * - assistant content "text" → "output_text"
   * - assistant tool_calls → content[]{type:"function_call"}
   * - tool result → content[]{type:"function_call_output"}
   */
  public static convertRequestParams(data: ChatPromptBody): IAIGWResponsesRequest {
    let instructions: string | undefined;
    const input: Record<string, any>[] = [];

    for (const msg of data.messages) {
      // system 消息提取为顶层 instructions，不放入 input
      if (msg.role === 'system') {
        instructions = typeof msg.content === 'string' ? msg.content : undefined;
        continue;
      }

      // assistant 携带 tool_calls → 展开为顶层 function_call 条目（不带 role）
      if (msg.role === 'assistant' && msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
        continue;
      }

      // tool result → 顶层 function_call_output 条目（不带 role）
      if (msg.role === 'tool') {
        input.push({
          type: 'function_call_output',
          call_id: msg.tool_call_id,
          output: typeof msg.content === 'string' ? msg.content : '',
        });
        continue;
      }

      // user / assistant 普通文本消息
      // Chat Completions 用 "text"，Responses API 用 "input_text" / "output_text"
      const contentType = msg.role === 'user' ? 'input_text' : 'output_text';
      const content = typeof msg.content === 'string'
        ? [{ type: contentType, text: msg.content }]
        : (msg.content as any[]).map(c =>
          c.type === 'text' || c.type === 'input_text' || c.type === 'output_text'
            ? { type: contentType, text: c.text }
            : c.type === 'image_url'
              ? { type: 'input_image', image_url: typeof c.image_url === 'object' ? c.image_url.url : c.image_url }
              : c
        );

      input.push({ role: msg.role, content });
    }

    return {
      model: data.model,
      input,
      instructions,
      stream: data.stream ?? true,
      temperature: data.temperature || 1,
      top_p: data.top_p,
      max_output_tokens: data.max_tokens,
      tools: data.tools?.map(t => t.type === 'function' && (t as any).function
        ? { type: 'function', ...(t as any).function }
        : t
      ) as Record<string, any>[] | undefined,
      tool_choice: data.tool_choice,
      ...(data.extra_body ?? {}),
    };
  }

  public reset() {
    super.reset()
    this.conversationContext = {
      content: '',
      tool_calls: [],
      totalTokens: 0,
      completionTokens: 0,
      promptTokens: 0,
      cacheReadInputTokens: 0,
      responseId: '',
    }
  }

  /**
   * @name 解析流 (OpenAI Responses API SSE 格式)
   * 支持 text delta 和 function call
   */
  public onParse(event: ParsedEvent) {
    if (event.type !== 'event') return;

    const eData = event.data;

    try {
      const parsedData = JSON.parse(eData);
      const eventType: string = parsedData?.type ?? '';

      switch (eventType) {
        // ── 文本 delta ──────────────────────────────────────────────────────
        case 'response.output_text.delta': {
          this.conversationContext.content += parsedData.delta ?? '';
          this.emitMessage(false)
          break;
        }

        // ── 新输出项（可能是 function_call）────────────────────────────────
        case 'response.output_item.added': {
          const item = parsedData.item;
          if (item?.type === 'function_call') {
            // 用 item.id 作为临时 id，便于 delta 事件通过 item_id 查找
            this.conversationContext.tool_calls.push({
              id: item.id ?? '',
              type: 'function',
              function: {
                name: item.name ?? '',
                arguments: item.arguments ?? '',
              },
            });
          }
          break;
        }

        // ── function call 参数 delta ────────────────────────────────────────
        case 'response.function_call_arguments.delta': {
          const itemId: string = parsedData.item_id ?? '';
          const delta: string = parsedData.delta ?? '';
          const toolCall = this.conversationContext.tool_calls.find(tc => tc.id === itemId);
          if (toolCall) {
            toolCall.function.arguments = (toolCall.function.arguments ?? '') + delta;
          }
          break;
        }

        // ── function call 参数完成 ──────────────────────────────────────────
        case 'response.function_call_arguments.done': {
          const itemId: string = parsedData.item_id ?? '';
          const finalArgs: string = parsedData.arguments ?? '';
          const toolCall = this.conversationContext.tool_calls.find(tc => tc.id === itemId);
          if (toolCall) {
            toolCall.function.arguments = finalArgs;
          }
          break;
        }

        // ── 输出项完成：将临时 item.id 替换为真正的 call_id ─────────────────
        case 'response.output_item.done': {
          const item = parsedData.item;
          if (item?.type === 'function_call') {
            const toolCall = this.conversationContext.tool_calls.find(tc => tc.id === item.id);
            if (toolCall && item.call_id) {
              toolCall.id = item.call_id;
            }
          }
          break;
        }

        // ── 响应完成（实际终止事件为 response.completed）──────────────────
        case 'response.completed':
        case 'response.done': {
          const resp = parsedData.response;
          const usage = resp?.usage;
          if (usage) {
            this.conversationContext.totalTokens = usage.total_tokens ?? 0;
            this.conversationContext.completionTokens = usage.output_tokens ?? 0;
            this.conversationContext.promptTokens = (usage.input_tokens ?? 0)
            // TODO: gpt有缓存的，后续需要优化计算token的策略
            // this.conversationContext.promptTokens = (usage.input_tokens ?? 0) - (usage.input_tokens_details?.cached_tokens ?? 0);
            // this.conversationContext.cacheReadInputTokens = usage.input_tokens_details?.cached_tokens ?? 0;
          }
          if (resp?.id) {
            this.conversationContext.responseId = resp.id;
          }
          this.emitMessage(true);
          this.close()
          break;
        }
        case 'response.failed': {
          if (parsedData?.response?.status_details?.error?.message) {
            this.conversationContext.content += parsedData?.response?.status_details?.error?.message ?? '';
          } else {
            this.conversationContext.content += eData
          }
          this.emitMessage(true);
          this.close();
          break
        }

        // ── 错误 ────────────────────────────────────────────────────────────
        case 'error': {
          const msg: string =
            parsedData.message
            ?? parsedData.error?.message
            ?? '请求出现错误';
          this.options?.onError?.(new Error(msg));
          this.close();
          break;
        }

        default:
          break;
      }
    } catch (error) {
      // Ignore parse errors for individual SSE events
      console.error('JSON parsing error:', getErrorMessage(error));
      // throw new Error(eData)
    }
  }

  private emitMessage(done: boolean) {
    requestAnimationFrame(() => {
      this.options?.onMessage(
        this.conversationContext.content,
        done,
        this.conversationContext.tool_calls,
        this.conversationContext.totalTokens,
        this.conversationContext.completionTokens,
        this.conversationContext.promptTokens,
        0,
        this.conversationContext.cacheReadInputTokens,
        {
          reasoning_content: '',
          thinking_signature: '',
          redacted_thinking: '',
        },
        this.conversationContext.responseId,
      );
      if (done) {
        this.options?.onFinish?.(this.conversationContext)
      }
    })
  }

  private setupChunkTimeout() {
    this.lastChunkTime = Date.now();
    this.clearChunkTimeout();
    this.chunkTimeoutId = setTimeout(() => {
      if (Date.now() - this.lastChunkTime >= this.getMaxTimeout) {
        this.conversationContext.content += '\n\n回复超时，请重试';
        this.tracker.reportChunkTimeout({
          model: this.requestParmas?.model || '',
          ntesTraceId: this.options.ntesTraceId,
          chatType: 'azureOpenAI',
        });
        this.tracker.stopChatSpan({ error: 'chunk timeout' });
        this.options.setError?.(true);
        this.emitMessage(true);
        this.clearChunkTimeout();
        this.close();
      }
    }, 60000);
  }

  private clearChunkTimeout() {
    if (this.chunkTimeoutId) {
      clearTimeout(this.chunkTimeoutId);
      this.chunkTimeoutId = null;
    }
  }

  public async onStream(res: Response) {
    if (!res.body) {
      return;
    }
    clearTimeout(this.pingpongTimer);
    this.setupChunkTimeout();
    this.tracker.startChatSpan({
      name: 'requestChatStream.run',
      event: UserEvent.CODE_CHAT_CODEBASE,
      url: this.getUrl,
      data: this.originalData,
      ntesTraceId: this.options.ntesTraceId,
      parentSpan: (useChatStreamStore.getState() as any).submitSpan?.span,
      round: this.round,
    });

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    const parser = createParser(((event: ParsedEvent) => this.onParse(event)) as EventSourceParseCallback);

    try {
      while (this._needContinue) {
        const { done, value } = await reader.read();
        if (!this.firstTokenReceived && value?.length) {
          this.firstTokenReceived = true;
          this.tracker.setChatSpanAttribute('gen_ai.server.time_to_first_token_ms', Math.round(performance.now() - this.requestStartTime));
        }
        if (value?.length) {
          this.lastChunkTime = Date.now();
        }
        if (done) {
          this._needContinue = false;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.options?.onError?.(error as Error);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* empty */ }
      this.clearChunkTimeout();
      this.tracker.stopChatSpan({
        messages: [{ role: ChatRole.Assistant, content: this.conversationContext.content, tool_calls: this.conversationContext.tool_calls }],
        usage: {
          prompt_tokens: this.conversationContext.promptTokens,
          completion_tokens: this.conversationContext.completionTokens,
          total_tokens: this.conversationContext.totalTokens,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: this.conversationContext.cacheReadInputTokens,
        },
        finish_reason: 'stop',
      });
    }
  }

}