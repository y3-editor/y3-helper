import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';
import userReporter from '../../../utils/report';
import { UserEvent } from '../../../types/report';
import * as otel from '../../../telemetry/otel';
import { ChatMessage, ChatPromptBody } from '../..';
import { Span } from '../../../telemetry/otel';
import { ConversationRoundState } from '../../../telemetry/otel';

export interface IChunkTimeoutParams {
  model: string;
  ntesTraceId?: string;
  chatType?: string;
  mark?: number;
}

export interface IToolcallStopByLengthParams {
  model?: string;
  continueCount: number;
  toolName: string;
}

export interface IStartChatSpanOptions {
  name: string;
  event: string;
  url: string;
  data: ChatPromptBody;
  ntesTraceId?: string;
  round?: ConversationRoundState;
  parentSpan?: Span;
}

export interface IStopChatSpanOptions {
  messages?: ChatMessage[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  finish_reason?: 'stop' | 'continue';
  error?: string;
}

export class StreamTracker {
  private span: Span | null = null;

  startChatSpan(opts: IStartChatSpanOptions): void {
    this.span = otel.startChatSpan(opts.name, {
      event: opts.event,
      url: opts.url,
      data: opts.data,
      ntesTraceId: opts.ntesTraceId,
      round: opts.round,
      parentSpan: opts.parentSpan,
    });
  }

  setChatSpanAttribute(key: string, value: string | number | boolean): void {
    if (!this.span) return;
    this.span.setAttribute(key, value);
  }

  stopChatSpan(opts?: IStopChatSpanOptions): void {
    if (!this.span) return;
    otel.stopChatSpan(this.span, opts);
    this.span = null;
  }

  reportChunkTimeout(params: IChunkTimeoutParams): void {
    const { model, ntesTraceId, chatType, mark = 3 } = params;
    userReporter.report({
      event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
      extends: {
        model,
        ntesTraceId,
        chatType,
      },
    });
    webToolsHub.withScope((scope) => {
      scope.setExtras({
        event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
        model,
        ntesTraceId,
        chatType,
        mark,
      });
      webToolsLogger.captureException(new Error(UserEvent.CODE_CHAT_CHUNK_TIMEOUT));
    });
  }

  reportToolcallStopByLength(params: IToolcallStopByLengthParams): void {
    userReporter.report({
      event: UserEvent.TOOLCALL_STOP_BY_LENGTH,
      extends: {
        model: params.model,
        continueCount: params.continueCount,
        toolName: params.toolName,
      },
    });
  }
}