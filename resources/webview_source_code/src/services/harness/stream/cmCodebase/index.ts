import BaseStream from "../base";
import { createParser, EventSourceParseCallback, ParsedEvent } from "eventsource-parser";
import { ICmCodebaseStreamContext, ICmCodebaseStreamOption } from "./interface";
import { ChatMessage, ChatPromptBody } from "../../..";
import { ChatRole } from "../../../../types/chat";
import { getValidToolName } from "../../../../utils";
import { StreamTracker } from "../streamTracker";
import { UserEvent } from "../../../../types/report";
import { useChatStreamStore } from "../../../../store/chat";
import { ConversationRoundState } from "../../../../telemetry/otel";


const CODEBASE_CHAT_STREAM_CHUNK_TIMEOUT = 240 * 1000;
const CHAT_STREAM_CHUNK_TIMEOUT = 60000;
const MAX_CONTINUE_COUNT = 2;

const CONTINUOUS_CHAT_MESSAGE_ZH: ChatMessage = {
  id: '',
  role: ChatRole.User,
  content:
    '继续。不要回复重复的内容，请注意要精确到字符级别，从前一个回复的最后一个字符继续。如果上一个回复最后有未完成代码块，也一样从最后一个字符开始继续，不要用```再开始。。不要回复得太长，只需完成剩余内容并结束这次回答。',
};

const SEPERATE_TOOL_CALL_MESSAGE: ChatMessage = {
  id: '',
  role: ChatRole.User,
  content: 'If you are trying to make a tool call, separate it into more steps and use shorter arguments.',
};

export const EMPTY_CM_STREAM_CONTEXT = (): ICmCodebaseStreamContext => ({
  responseText: '',
  totalTokens: 0,
  completionTokens: 0,
  promptTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  toolCalls: [],
  claude37Response: {
    reasoning_content: '',
    thinking_signature: '',
    redacted_thinking: '',
  },
  responseId: '',
  autoModel: undefined,
});


export default class CmCodebaseSteam extends BaseStream<ICmCodebaseStreamOption> {
  public options: ICmCodebaseStreamOption;
  public streamContext: ICmCodebaseStreamContext = EMPTY_CM_STREAM_CONTEXT();

  private _shouldRetry = false;
  private continueCount = 0;
  private chunkTimeoutId: NodeJS.Timeout | null = null;
  private lastChunkTime = 0;
  private originalData: ChatPromptBody;
  private tracker = new StreamTracker();
  private round: ConversationRoundState | undefined = undefined
  private firstTokenReceived = false;

  public get getUrl() {
    const chatRequestUrl = this.options.chatRequestUrl || '/proxy/gpt/gpt/text_chat_stream';
    const event = this.options.event || 'CodeChat.codebase';
    return `${chatRequestUrl}/${event}`;
  }

  public get getMaxTimeout() {
    return 1000 * 60 * 2;
  }

  constructor(data: ChatPromptBody, options: ICmCodebaseStreamOption) {
    super(data, options);
    this.options = options;
    this.originalData = data;
    this.round = (useChatStreamStore.getState() as any).conversationRound;
  }

  public getRequestHeader() {
    const baseHeaders = super.getRequestHeader()
    const injectHeaders: Record<string, string> = {
      'X-Aigw-Meta': `first_tag=codebase`,
    }
    if (this.options?.ntesTraceId) {
      injectHeaders['ntes-trace-id'] = this.options.ntesTraceId
    }
    return {
      ...baseHeaders,
      ...injectHeaders,
    }
  }

  public setContextTokenByUsage(usage: any) {
    const {
      completion_tokens = 0,
      prompt_tokens = 0,
      total_tokens = 0,
      cache_creation_input_tokens = 0,
      cache_read_input_tokens = 0,
      prompt_tokens_details,
    } = usage;
    this.streamContext.totalTokens = total_tokens;
    this.streamContext.completionTokens = completion_tokens;
    if (this.requestParmas?.model?.includes('deepseek')) {
      const cacheReadInputTokens = prompt_tokens_details?.cached_tokens || 0;
      this.streamContext.promptTokens = Math.max(0, prompt_tokens - cacheReadInputTokens); // 未被命中的缓存
      this.streamContext.cacheCreationInputTokens = cache_creation_input_tokens;
      this.streamContext.cacheReadInputTokens = cacheReadInputTokens; // prompt_tokens_details 只有deepseek才有
    } else {
      this.streamContext.promptTokens = prompt_tokens;
      this.streamContext.cacheCreationInputTokens = cache_creation_input_tokens;
      this.streamContext.cacheReadInputTokens = cache_read_input_tokens;
    }
  }

  public handleApiError(parsedData: any) {
    try {
      const errorInfo = JSON.parse(parsedData.data)
      if (errorInfo?.error && errorInfo?.error?.message) {
        this.streamContext.responseText = errorInfo?.error?.message ?? '⚠️ 未知错误'
        return
      }
      throw new Error();
    } catch (_) {
      this.options?.onError?.(new Error(JSON.stringify(
        parsedData?.data
      )));
    }
  }

  public onParse(event: ParsedEvent) {
    if (event?.type !== 'event') return;
    const eData = event?.data;
    if (eData?.trim?.() === '[DONE]') {
      this.close()
      return
    }

    // 跳过空字符串或纯空白内容，避免 JSON.parse 抛出 "Expecting value" 错误
    if (!eData?.trim?.()) {
      return;
    }

    try {
      const parsedData = JSON.parse(eData);
      // 自定义错误信息处理
      if (parsedData?.error && typeof parsedData.error === 'string') {
        this.streamContext.responseText += parsedData.error;
        this.close();
        return
      }

      // 这基本属于 api 层面的报错，而且是在流式传输中。
      if (!parsedData?.choices && parsedData?.data) {
        this.handleApiError(parsedData);
        this.close();
        return
      }

      // Token usage
      if (parsedData.usage && typeof parsedData.usage === 'object') {
        this.setContextTokenByUsage(parsedData.usage);
      }

      if (!Array.isArray(parsedData.choices) || !parsedData.choices.length) return;

      const choice = parsedData.choices[0];

      if (choice.finish_reason === 'length') {
        this._shouldRetry = true;
      }

      if (!this.streamContext.responseId && parsedData.id) {
        this.streamContext.responseId = parsedData.id;
      }

      const delta = choice.delta;
      if (!delta) return;

      if (delta.content) {
        this.streamContext.responseText += delta.content;
      }

      if (delta.tool_calls) {
        for (const tool of delta.tool_calls) {
          if (!tool) continue;
          const index = tool.index || 0;
          if (!this.streamContext.toolCalls[index]) {
            this.streamContext.toolCalls[index] = {
              id: tool.id || '',
              function: {
                arguments: tool.function?.arguments || '',
                name: getValidToolName(tool.function?.name || ''),
              },
              type: tool.type || '',
            };
          } else {
            this.streamContext.toolCalls[index].id += tool.id || '';
            this.streamContext.toolCalls[index].function.arguments += tool.function?.arguments || '';
            this.streamContext.toolCalls[index].function.name += getValidToolName(tool.function?.name || '');
            this.streamContext.toolCalls[index].type += tool.type || '';
          }
          if (this.streamContext.toolCalls[index].type.includes('function')) {
            this.streamContext.toolCalls[index].type = 'function';
          }
        }
      }

      if (delta.reasoning_content) {
        this.streamContext.claude37Response.reasoning_content += delta.reasoning_content;
      }
      if (delta.thinking_signature) {
        if (this.requestParmas?.model?.includes('gemini')) {
          if (!this.streamContext.claude37Response.thinking_signature) {
            this.streamContext.claude37Response.thinking_signature = delta.thinking_signature;
          }
        } else {
          this.streamContext.claude37Response.thinking_signature += delta.thinking_signature;
        }
      }
      if (delta.redacted_thinking) {
        this.streamContext.claude37Response.redacted_thinking += delta.redacted_thinking;
      }

      this.emitMessage(false);
    } catch {
      // Ignore parse errors for individual SSE events
    }
  }

  private emitMessage(done: boolean) {
    // Skip emit if stream was manually aborted by user
    if (this.isUserAborted) {
      this.options?.onFinish?.(this.conversationContext)
      return;
    }

    const { responseText, toolCalls, completionTokens, promptTokens, cacheCreationInputTokens, cacheReadInputTokens, claude37Response, responseId, autoModel } = this.streamContext;
    this.options.onMessage(
      responseText,
      done,
      toolCalls.filter(tc => !!tc),
      completionTokens +
      promptTokens +
      cacheCreationInputTokens +
      cacheReadInputTokens,
      completionTokens,
      promptTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      claude37Response,
      responseId,
      autoModel,
    );
    if (done) {
      this.options?.onFinish?.(this.conversationContext)
    }
  }

  private setupChunkTimeout() {
    this.lastChunkTime = Date.now();
    this.clearChunkTimeout();
    this.chunkTimeoutId = setTimeout(() => {
      if (Date.now() - this.lastChunkTime >= CODEBASE_CHAT_STREAM_CHUNK_TIMEOUT) {
        this.streamContext.responseText += '\n\n回复超时，请重试';
        this.tracker.reportChunkTimeout({
          model: this.requestParmas?.model || '',
          ntesTraceId: this.options.ntesTraceId,
          chatType: 'codebase',
        });
        this.tracker.stopChatSpan({ error: 'chunk timeout' });
        this.options.setError?.(true);
        this.emitMessage(true);
        this.clearChunkTimeout();
        this.close();
      }
    }, CHAT_STREAM_CHUNK_TIMEOUT);
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

    // 将 BaseStream 中提取的 autoModel 写入 streamContext
    this.streamContext.autoModel = this.autoModel;

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
      // AbortError is expected when close() is called mid-stream
      if (!this.isUserAborted) {
        this.options?.onError?.(error as Error);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* empty */ }
      this.clearChunkTimeout();

      // Determine if we need to continue due to length-limited response
      const toolCalls = this.streamContext.toolCalls.filter(tc => !!tc);
      let toolcallParsable = true;
      let toolName = '';
      for (const toolCall of toolCalls) {
        if (toolCall?.function?.arguments) {
          try {
            JSON.parse(toolCall.function.arguments);
          } catch {
            toolcallParsable = false;
            toolName = toolCall.function.name;
          }
        }
      }

      if ((this._shouldRetry || !toolcallParsable) && this.continueCount < MAX_CONTINUE_COUNT) {
        this._shouldRetry = false;
        this.continueCount++;

        const preResponseMessage: ChatMessage = {
          role: ChatRole.Assistant,
          content: this.streamContext.responseText || '-',
        };

        let nextMessages: ChatMessage[];
        if (toolCalls.length) {
          this.tracker.reportToolcallStopByLength({
            model: this.requestParmas?.model,
            continueCount: this.continueCount,
            toolName,
          });
          nextMessages = [
            ...this.originalData.messages,
            preResponseMessage,
            SEPERATE_TOOL_CALL_MESSAGE,
          ];
        } else {
          nextMessages = [
            ...this.originalData.messages,
            preResponseMessage,
            CONTINUOUS_CHAT_MESSAGE_ZH,
          ];
        }

        this.emitMessage(false);
        this.tracker.stopChatSpan({
          messages: [preResponseMessage],
          usage: {
            prompt_tokens: this.streamContext.promptTokens,
            completion_tokens: this.streamContext.completionTokens,
            total_tokens: this.streamContext.totalTokens,
            cache_creation_input_tokens: this.streamContext.cacheCreationInputTokens,
            cache_read_input_tokens: this.streamContext.cacheReadInputTokens,
          },
          finish_reason: 'continue',
        });

        // Reset per-round state, preserve accumulated responseText and claude37Response
        this.streamContext.toolCalls = [];
        this.requestParmas = { ...this.requestParmas, messages: nextMessages };

        // Reset abort controller for the new connection
        this.reset();
        await this.connect();
      } else {
        const responseMessage: ChatMessage = {
          role: ChatRole.Assistant,
          content: this.streamContext.responseText || '',
          tool_calls: toolCalls.length ? toolCalls : undefined,
        };
        this.emitMessage(true);
        this.tracker.stopChatSpan({
          messages: [responseMessage],
          usage: {
            prompt_tokens: this.streamContext.promptTokens,
            completion_tokens: this.streamContext.completionTokens,
            total_tokens: this.streamContext.totalTokens,
            cache_creation_input_tokens: this.streamContext.cacheCreationInputTokens,
            cache_read_input_tokens: this.streamContext.cacheReadInputTokens,
          },
          finish_reason: 'stop',
        });
        this.close();
      }
    }
  }
}
