import { IStreamOption } from "../base/interface";
import { ToolCall } from "../../..";


export interface ICmCodebaseStreamOption extends Omit<IStreamOption, 'onMessage'> {
  event?: string;
  chatRequestUrl?: string;
  ntesTraceId?: string;
  setError?: (type: boolean) => void;
  onMessage: (
    message: string,
    done: boolean,
    toolCalls: ToolCall[],
    totalTokens: number,
    completionTokens: number,
    promptTokens: number,
    cacheCreationInputTokens: number,
    cacheReadInputTokens: number,
    claude37Response: {
      reasoning_content: string;
      thinking_signature: string;
      redacted_thinking: string;
    },
    responseId: string,
    autoModel?: string,
  ) => void;
}

export interface ICmCodebaseStreamContext {
  responseText: string;
  totalTokens: number;
  completionTokens: number;
  promptTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  toolCalls: ToolCall[];
  claude37Response: {
    reasoning_content: string;
    thinking_signature: string;
    redacted_thinking: string;
  };
  responseId: string;
  autoModel?: string;
}
