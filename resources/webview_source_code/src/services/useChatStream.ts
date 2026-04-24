import {
  createParser,
  ParsedEvent,
  ReconnectInterval,
} from 'eventsource-parser';
import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';
import {
  ChatMessage,
  ChatPromptBody,
  // ChatRole,
  ToolCall,
  GeminiWebSearch,
} from '.';
import { useAuthStore } from '../store/auth';
import { useExtensionStore } from '../store/extension';
import userReporter, { PrePromptEvent } from '../utils/report';
import {
  ChatBMPromptBody,
  Docset,
  KnowledgeAugmentationBMPromptBody,
  MultipleChatBMPromptBody,
} from './docsets';
import { PluginAppRunnerParams } from './plugin';
import { REQUEST_TIMEOUT_NAME } from '../store/chat';
import { OFFICE_BM_API_URL } from '../routes/CodeCoverage/const';
import { BMSearch } from '../services';
import { uniqueId } from 'lodash';
import { UserEvent } from '../types/report';
import { getValidToolName } from '../utils';
import { ChatModel } from './chatModel';

/**
 * @name 执行函数时，忽略异常
 * @param func
 */
export const execFuncWithoutException = (func: () => void) => {
  try {
    func?.();
  } catch (e) {
    /* empty */
  }
};

export enum StreamError {
  BaiChuan2TokenLimit = 'Prompt is greator than max_tokens.',
  GPTTokenLimit = "This model's maximum context length is",
  Timeout = 'request timeout error',
  AuthTokenIsExpired = 'token is expired',
  // Api key 配置错误接口的返回值
  ApiKeyIsError = 'invalid Authorization or AppId',
  GPT4TokenLimit = 'please try again later due to token limit',
  NeedAppKey = 'gpt-4 need app_id/app_key',
  GPT4MaxLimit = 'exceed quota limit, try later or contact admin.',
  TokenLimitErrorFromAIGW = 'please try again later due to token limit (TPM)',
  RateLimitErrorFromAIGW = 'please try again later due to rate limit (RPM)',
  ReturnDataError = `Failed to execute 'decode' on 'TextDecoder': The provided value is not of type '(ArrayBuffer or ArrayBufferView)'`,
  NetworkError = 'network error',
  FailedToFetch = 'Failed to fetch',
  PeerClosedConnection = 'peer closed connection without sending complete message body',
  AzureaiRateLimitChunk = 'azureai_error_chunk code:rate_limit_exceeded',
}

export enum ChatRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool',
}

enum FinishReason {
  Stop = 'stop',
  Continue = 'length',
}

// time out 2min for knowledge base chat
const TIMEOUT_MS = 1000 * 60;

const BM_STREAM_TIMEOUT = 120000;

const CODEBASE_CHAT_STREAM_CHUNK_TIMEOUT = 240 * 1000;
const CHAT_STREAM_CHUNK_TIMEOUT = 60000;
const DEEPSEEK_STREAM_CHUNK_TIMEOUT = 60000;
const O3_CHUNK_TIMEOUT = 60000;

const MAX_CONTINUE_COUNT = 2;

// 断点续传
let needContinue = false;

interface BMLatestMessageContext {
  meta: {
    url: string;
    filename: string;
    anchor: string;
  };
}
interface BMLatestMessage {
  _bm_extra: {
    references: number[];
    contexts: BMLatestMessageContext[];
  };
}

/**
 * 最后一次返回的消息，格式不确定
 * 正常返回，格式是：
 * {
 *    "choices": [],
 *    ""
 * }
 * 非正常返回，格式可能是：
 * {
 *    "data": "xxxxx error"
 * }
 *
 */

let latestMessage: Record<string, unknown> | BMLatestMessage | undefined;

const CONTINUOUS_CHAT_MESSAGE: ChatMessage = {
  id: '',
  role: ChatRole.User,
  content:
    'Continue. Do not repeat what has been said, just pick up from the last character of the previous response. Do not go too far, just finish the response and make it to an end.',
};

const CONTINUOUS_CHAT_MESSAGE_ZH: ChatMessage = {
  id: '',
  role: ChatRole.User,
  content:
    '继续。不要回复重复的内容，请注意要精确到字符级别，从前一个回复的最后一个字符继续。如果上一个回复最后有未完成代码块，也一样从最后一个字符开始继续，不要用```再开始。。不要回复得太长，只需完成剩余内容并结束这次回答。',
};

const SEPERATE_TOOL_CALL_MESSAGE: ChatMessage = {
  id: '',
  role: ChatRole.User,
  content:
    'If you are trying to make a tool call, separate it into more steps and use shorter arguments.',
};

const securelyCloseStream = (controller: ReadableStreamDefaultController) => {
  execFuncWithoutException(() => {
    if (controller.desiredSize !== null) {
      controller.close();
    }
  })
}

const securelyEnqueueValue = (controller: ReadableStreamDefaultController, value: string | Uint8Array<ArrayBuffer>) => {
  execFuncWithoutException(() => {
    if (controller.desiredSize !== null) {
      controller.enqueue(value);
    }
  })
}

async function createStream(req: Request, parseCallback?: (data: any) => void) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    if (result.msg === StreamError.GPT4MaxLimit) {
      throw new Error(StreamError.GPT4MaxLimit);
    }
    // 兼容 BrainMaker 的错误情况
    if (result.code) {
      throw new Error(result.detail.error || result.msg);
    }
    // TODO: 先hardcode 处理这个错误，后续跟后端对接一下这个错误的返回
    const msg = result.detail[0].msg;
    if (msg === StreamError.NeedAppKey) {
      throw new Error(StreamError.NeedAppKey);
    } else if (msg === StreamError.GPT4TokenLimit) {
      throw new Error(StreamError.GPT4TokenLimit);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;

          // https://platform.openai.com/docs/api-reference/chat/create#chat/create-stream
          if (data === '[DONE]') {
            // 如果 BM 有参考链接，则把参考链接拼接到最后
            securelyCloseStream(controller);
            return;
          }
          try {
            // 如果 data 不是 json字符串 ，则是有问题的
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }
            // 这基本属于 api 层面的报错，而且是在流式传输中。
            if (!json.choices && json.data) {
              if ((latestMessage as Record<string, unknown>)?.data) {
                throw new Error(
                  JSON.stringify(
                    (latestMessage as Record<string, unknown>)?.data,
                  ),
                );
              }
              return;
            }
            const choices = json.choices;
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }
            // 如果返回的 finish_reason 为 'length'，表示返回内容超过 max_token
            // 需要继续请求并且返回后续内容
            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            const text = delta.content ?? '';

            // 处理 reasoning 相关字段
            const reasoningContent = delta.reasoning_content ?? '';
            const thinkingSignature = delta.thinking_signature ?? '';
            const redactedThinking = delta.redacted_thinking ?? '';

            // 处理一些后端的错误
            if (
              [StreamError.Timeout, StreamError.BaiChuan2TokenLimit].includes(
                text,
              )
            ) {
              throw new Error(text);
            }

            // 如果有 reasoning 相关字段，返回 JSON 格式
            if (reasoningContent || thinkingSignature || redactedThinking) {
              const queue = encoder.encode(
                JSON.stringify({
                  content: text,
                  reasoningContent,
                  thinkingSignature,
                  redactedThinking,
                }),
              );
              securelyEnqueueValue(controller, queue);
            } else {
              // 否则返回普通文本
              const queue = encoder.encode(text);
              securelyEnqueueValue(controller, queue);
            }
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

async function createDeepseekReasonerStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    if (result.msg === StreamError.GPT4MaxLimit) {
      throw new Error(StreamError.GPT4MaxLimit);
    }

    if (result.code) {
      throw new Error(result.detail.error || result.msg);
    }

    const msg = result.detail[0].msg;
    if (msg === StreamError.NeedAppKey) {
      throw new Error(StreamError.NeedAppKey);
    } else if (msg === StreamError.GPT4TokenLimit) {
      throw new Error(StreamError.GPT4TokenLimit);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            securelyCloseStream(controller);
            return;
          }
          try {
            // 如果 data 不是 json字符串 ，则是有问题的
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }
            // 这基本属于 api 层面的报错，而且是在流式传输中。
            if (!json.choices && json.data) {
              if ((latestMessage as Record<string, unknown>)?.data) {
                throw new Error(
                  JSON.stringify(
                    (latestMessage as Record<string, unknown>)?.data,
                  ),
                );
              }
              return;
            }
            const usage = json.usage;
            if (usage) {
              const completion_tokens = usage.completion_tokens;
              const prompt_tokens = usage.prompt_tokens;
              const total_tokens = usage.total_tokens;
              const queue = encoder.encode(
                JSON.stringify({
                  completion_tokens,
                  prompt_tokens,
                  total_tokens,
                }),
              );
              securelyEnqueueValue(controller, queue);
            }
            const choices = json.choices;
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }
            // 如果返回的 finish_reason 为 'length'，表示返回内容超过 max_token
            // 需要继续请求并且返回后续内容
            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            const text = delta.content ?? '';
            const reasoningText = delta.reasoning_content ?? '';

            // 处理一些后端的错误
            if ([StreamError.Timeout].includes(text as StreamError)) {
              throw new Error(text);
            }

            const queue = encoder.encode(
              JSON.stringify({
                text: text,
                reasoningText: reasoningText,
              }),
            );
            securelyEnqueueValue(controller, queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

async function createClaude37ReasonerStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    if (result.msg === StreamError.GPT4MaxLimit) {
      throw new Error(StreamError.GPT4MaxLimit);
    }

    if (result.code) {
      throw new Error(result.detail.error || result.msg);
    }

    const msg = result.detail[0].msg;
    if (msg === StreamError.NeedAppKey) {
      throw new Error(StreamError.NeedAppKey);
    } else if (msg === StreamError.GPT4TokenLimit) {
      throw new Error(StreamError.GPT4TokenLimit);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;

          if (data === '[DONE]') {
            securelyCloseStream(controller);
            return;
          }
          try {
            // 如果 data 不是 json字符串 ，则是有问题的
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }
            // 这基本属于 api 层面的报错，而且是在流式传输中。
            if (!json.choices && json.data) {
              if ((latestMessage as Record<string, unknown>)?.data) {
                throw new Error(
                  JSON.stringify(
                    (latestMessage as Record<string, unknown>)?.data,
                  ),
                );
              }
              return;
            }
            const choices = json.choices;
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }
            // 如果返回的 finish_reason 为 'length'，表示返回内容超过 max_token
            // 需要继续请求并且返回后续内容
            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            const text = delta.content ?? '';
            const reasoningContent = delta.reasoning_content ?? '';
            const thinkingSignature = delta.thinking_signature ?? '';
            const redactedThinking = delta.redacted_thinking ?? '';

            // 处理一些后端的错误
            if ([StreamError.Timeout].includes(text as StreamError)) {
              throw new Error(text);
            }

            const queue = encoder.encode(
              JSON.stringify({
                text: text,
                reasoningContent: reasoningContent,
                thinkingSignature: thinkingSignature,
                redactedThinking: redactedThinking,
              }),
            );
            securelyEnqueueValue(controller, queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

// BM 有一些特殊字段返回，没必要和普通的 Chat 流式处理写在一起
async function createBMStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);

  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    if (result.msg === StreamError.GPT4MaxLimit) {
      throw new Error(StreamError.GPT4MaxLimit);
    }
    // 兼容 BrainMaker 的错误情况
    if (result.code) {
      throw new Error(result.detail.error || result.msg);
    }
    // TODO: 先hardcode 处理这个错误，后续跟后端对接一下这个错误的返回
    const msg = result.detail[0].msg;
    if (msg === StreamError.NeedAppKey) {
      throw new Error(StreamError.NeedAppKey);
    } else if (msg === StreamError.GPT4TokenLimit) {
      throw new Error(StreamError.GPT4TokenLimit);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  let bmSearch = {};
  let bmMark = false;
  let reasoningContent = ''; // 用于拼接思考过程
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;

          // https://platform.openai.com/docs/api-reference/chat/create#chat/create-stream
          if (data === '[DONE]') {
            const queue = encoder.encode(
              JSON.stringify({
                text: '',
                bmSearch: bmSearch,
                bmMark: bmMark,
                reasoningContent: reasoningContent, // 返回完整的思考过程
              }),
            );
            securelyEnqueueValue(controller, queue);
            securelyCloseStream(controller);
            return;
          }
          try {
            // 如果 data 不是 json字符串 ，则是有问题的
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }
            // 这基本属于 api 层面的报错，而且是在流式传输中。
            if (!json.choices && json.data) {
              if ((latestMessage as Record<string, unknown>)?.data) {
                throw new Error(
                  JSON.stringify(
                    (latestMessage as Record<string, unknown>)?.data,
                  ),
                );
              }
              return;
            }
            const choices = json.choices;
            // BM 需要特殊处理引用链接的标记
            if (json?._bm_corner_mark) {
              bmMark = true;
            }
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }
            // 如果返回的 finish_reason 为 'length'，表示返回内容超过 max_token
            // 需要继续请求并且返回后续内容
            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            const text = delta.content ?? '';

            // 处理 reasoning_content 字段，拼接思考过程
            if (json.reasoning_content) {
              reasoningContent += json.reasoning_content;
            }

            if (json?._bm_extra) {
              bmSearch = json._bm_extra;
            }
            // 处理一些后端的错误
            if ([StreamError.Timeout].includes(text)) {
              throw new Error(text);
            }

            const queue = encoder.encode(
              JSON.stringify({
                text: text,
                bmSearch: bmSearch,
                bmMark: bmMark,
                reasoningContent: reasoningContent, // 实时返回当前拼接的思考过程
              }),
            );
            securelyEnqueueValue(controller, queue);
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

// MiniMax 模型的流式返回
// async function createNetworkStream(
//   req: Request,
//   parseCallback?: (data: any) => void,
// ) {
//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   const res = await fetch(req);
//   if (!res.ok) {
//     const result = await res.json();
//     if (
//       result.extra &&
//       result.extra.code === 30002 &&
//       (result.extra.msg as string)
//         .toLocaleLowerCase()
//         .includes(StreamError.AuthTokenIsExpired)
//     ) {
//       throw new Error(StreamError.AuthTokenIsExpired);
//     }
//     throw new Error(res.statusText);
//   }

//   needContinue = false;
//   latestMessage = undefined;
//   let webSearch = '';
//   const stream = new ReadableStream({
//     async start(controller) {
//       function onParse(event: ParsedEvent | ReconnectInterval) {
//         if (event.type === 'event') {
//           const data = event.data;
//           if (data === '[DONE]') {
//             controller.close();
//             return;
//           }
//           try {
//             let json;
//             try {
//               json = JSON.parse(data);
//               console.log('json', json);
//               latestMessage = json;
//               if (parseCallback) {
//                 parseCallback(json);
//               }
//             } catch {
//               throw new Error(data);
//             }

//             if (!json.choices && json.data) {
//               throw new Error(json.data);
//             }
//             const choices = json.choices;
//             if (!choices.length) {
//               return;
//             }

//             if (choices[0].finish_reason === FinishReason.Continue) {
//               needContinue = true;
//             }
//             // 取出 webSearch 的内容
//             if (
//               choices[0].finish_reason === FinishReason.Stop &&
//               choices[0].delta?.role === ChatRole.Tool
//             ) {
//               webSearch = choices[0].delta.content;
//             }

//             let text = '';
//             // 模型回答的内容
//             if (
//               choices[0].delta?.role === ChatRole.Assistant &&
//               choices[0]?.delta?.content !== null
//             ) {
//               text = choices[0].delta.content;
//             }

//             if (
//               choices[0].finish_reason === FinishReason.Stop &&
//               choices[0].delta?.role === ChatRole.Assistant
//             ) {
//               // 模型回答结束，取出最后一次回答的内容并且结束
//               text = choices[0].delta.content;
//               const queue = encoder.encode(
//                 JSON.stringify({
//                   text: text,
//                   webSearch: webSearch,
//                 }),
//               );
//               controller.enqueue(queue);
//               controller.close();
//               return;
//             }
//             const queue = encoder.encode(
//               JSON.stringify({
//                 text: text,
//                 webSearch: webSearch,
//               }),
//             );
//             controller.enqueue(queue);
//           } catch (e) {
//             controller.error(e);
//           }
//         }
//       }

//       const parser = createParser(onParse);
//       if (!res.body) {
//         return;
//       }
//       for await (const chunk of streamAsyncIterator(res.body)) {
//         parser.feed(decoder.decode(chunk));
//       }
//     },
//   });
//   return stream;
// }

// DouBao 模型的流式返回
// async function createDouBaoNetworkStream(
//   req: Request,
//   parseCallback?: (data: any) => void,
// ) {
//   const encoder = new TextEncoder();
//   const decoder = new TextDecoder();

//   const res = await fetch(req);
//   if (!res.ok) {
//     const result = await res.json();
//     if (
//       result.extra &&
//       result.extra.code === 30002 &&
//       (result.extra.msg as string)
//         .toLocaleLowerCase()
//         .includes(StreamError.AuthTokenIsExpired)
//     ) {
//       throw new Error(StreamError.AuthTokenIsExpired);
//     }
//     throw new Error(res.statusText);
//   }

//   needContinue = false;
//   latestMessage = undefined;
//   let webSearch = {};
//   const stream = new ReadableStream({
//     async start(controller) {
//       function onParse(event: ParsedEvent | ReconnectInterval) {
//         if (event.type === 'event') {
//           const data = event.data;
//           if (data === '[DONE]') {
//             controller.close();
//             return;
//           }
//           try {
//             let json;
//             try {
//               json = JSON.parse(data);
//               latestMessage = json;
//               if (parseCallback) {
//                 parseCallback(json);
//               }
//             } catch {
//               throw new Error(data);
//             }
//             if (!json.choices && json.data) {
//               throw new Error(json.data);
//             }
//             const choices = json.choices;
//             if (json.references) {
//               webSearch = json.references;
//             }
//             if (!choices.length) {
//               return;
//             }

//             if (choices[0].finish_reason === FinishReason.Continue) {
//               needContinue = true;
//             }
//             let text = '';
//             // 模型回答的内容
//             if (
//               choices[0].delta?.role === ChatRole.Assistant &&
//               choices[0]?.delta?.content !== null
//             ) {
//               text = choices[0].delta.content;
//             }

//             if (
//               choices[0].finish_reason === FinishReason.Stop &&
//               choices[0].delta?.role === ChatRole.Assistant
//             ) {
//               text = choices[0].delta.content;
//               // 结束时再把 webSearch 一起返回
//               const queue = encoder.encode(
//                 JSON.stringify({
//                   text: text,
//                   webSearch: webSearch,
//                 }),
//               );
//               controller.enqueue(queue);
//               controller.close();
//               return;
//             }
//             const queue = encoder.encode(
//               JSON.stringify({
//                 text: text,
//               }),
//             );
//             controller.enqueue(queue);
//           } catch (e) {
//             controller.error(e);
//           }
//         }
//       }

//       const parser = createParser(onParse);
//       if (!res.body) {
//         return;
//       }
//       for await (const chunk of streamAsyncIterator(res.body)) {
//         parser.feed(decoder.decode(chunk));
//       }
//     },
//   });
//   return stream;
// }

async function createGoogleGeminiNetworkStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  let webSearch = {};
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;
          if (data === '[DONE]') {
            securelyCloseStream(controller);
            return;
          }
          try {
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }
            if (!json.choices && json.data) {
              throw new Error(json.data);
            }
            const choices = json.choices;
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }

            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            let text = '';
            // 模型回答的内容
            if (delta.content != null) {
              text = delta.content;
            }

            if (json?.grounding_metadata) {
              webSearch = json.grounding_metadata?.grounding_chunks || [];
            }

            if (choices[0].finish_reason === FinishReason.Stop) {
              const queue = encoder.encode(
                JSON.stringify({
                  text: text,
                  webSearch: webSearch,
                }),
              );
              securelyEnqueueValue(controller, queue);
            } else {
              const queue = encoder.encode(
                JSON.stringify({
                  text: text,
                }),
              );
              securelyEnqueueValue(controller, queue);
            }
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}
async function createFunctionCallStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    throw new Error(res.statusText);
  }

  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === 'event') {
          const data = event.data;
          if (data === '[DONE]') {
            securelyCloseStream(controller);
            return;
          }
          try {
            let json;
            try {
              json = JSON.parse(data);
              latestMessage = json;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch {
              throw new Error(data);
            }

            if (!json.choices && json.data) {
              throw new Error(json.data);
            }
            const usage = json.usage;
            if (usage) {
              const completion_tokens = usage.completion_tokens;
              const prompt_tokens = usage.prompt_tokens;
              const total_tokens = usage.total_tokens;
              const cache_creation_input_tokens = usage.cache_creation_input_tokens;
              const cache_read_input_tokens = usage.cache_read_input_tokens;
              const queue = encoder.encode(
                JSON.stringify({
                  completion_tokens,
                  prompt_tokens,
                  total_tokens,
                  cache_creation_input_tokens,
                  cache_read_input_tokens
                }),
              );
              securelyEnqueueValue(controller, queue);
            }
            const choices = json.choices;
            if (!Array.isArray(choices) || !choices?.length) {
              return
            }

            if (choices[0].finish_reason === FinishReason.Continue) {
              needContinue = true;
            }

            const delta = choices[0]?.delta;
            if (!delta) return;

            // 模型回答的内容
            if (
              delta.tool_calls != null ||
              delta.content != null
            ) {
              const response_id = json.id || '';
              const content = delta.content;
              const tool_calls = delta.tool_calls;
              const reasoningContent = delta.reasoning_content ?? '';
              const thinkingSignature = delta.thinking_signature ?? '';
              const redactedThinking = delta.redacted_thinking ?? '';
              const queue = encoder.encode(
                JSON.stringify({
                  response_id,
                  content,
                  tool_calls,
                  reasoningContent,
                  thinkingSignature,
                  redactedThinking
                }),
              );
              securelyEnqueueValue(controller, queue);
            }
            if (
              choices[0].finish_reason === FinishReason.Stop &&
              delta.role === ChatRole.Assistant
            ) {
              securelyCloseStream(controller);
              return;
            }
          } catch (e) {
            controller.error(e);
          }
        }
      }

      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(res.body)) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

async function createDifyStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    throw new Error(res.statusText);
  }
  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: any) {
        if (event.type === 'event') {
          const eData = event.data;
          if (eData === '[DONE]') {
            securelyCloseStream(controller);
            return;
          }
          if (!eData.startsWith('{') || !eData.endsWith('}')) {
            return;
          }
          try {
            let json;
            let text;
            try {
              json = JSON.parse(eData) || {};
              latestMessage = json;
              text = json?.answer;
              if (parseCallback) {
                parseCallback(json);
              }
            } catch (error) {
              throw new Error(eData);
            }

            if (text) {
              const queue = encoder.encode(text);
              securelyEnqueueValue(controller, queue);
            }
            if (json.event === 'error') {
              const queue = encoder.encode(
                'AI 应用发生异常',
              );
              securelyEnqueueValue(controller, queue);
              securelyCloseStream(controller);
              return;
            }
            if (json.event === 'message_end') {
              securelyCloseStream(controller);
              return;
            }
          } catch (e) {
            controller.error(e);
          }
        }
      }
      const parser = createParser(onParse);
      if (!res.body) {
        return;
      }
      for await (const chunk of streamAsyncIterator(
        res.body as ReadableStream,
      )) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}
async function createDifyWorkFlowStream(
  req: Request,
  parseCallback?: (data: any) => void,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const res = await fetch(req);
  if (!res.ok) {
    const result = await res.json();
    if (
      result.extra &&
      result.extra.code === 30002 &&
      (result.extra.msg as string)
        .toLocaleLowerCase()
        .includes(StreamError.AuthTokenIsExpired)
    ) {
      throw new Error(StreamError.AuthTokenIsExpired);
    }
    throw new Error(res.statusText);
  }
  needContinue = false;
  latestMessage = undefined;
  const stream = new ReadableStream({
    async start(controller) {
      function onParse(event: any) {
        if (event.type !== 'event') return;

        const eData = event.data;
        if (!eData || !eData.startsWith('{') || !eData.endsWith('}')) return;

        let parsedData;
        try {
          parsedData = JSON.parse(eData);
        } catch (error) {
          console.error('JSON parsing error:', error);
          return;
        }
        const { event: eventType, data } = parsedData;
        switch (eventType) {
          case 'workflow_finished':
            parseCallback?.(data);
            securelyCloseStream(controller);
            break;
          case 'error': {
            const errorQueue = encoder.encode(
              'AI 应用发生异常',
            );
            securelyEnqueueValue(controller, errorQueue);
            securelyCloseStream(controller);
            break;
          }
          case 'text_chunk': {
            try {
              latestMessage = data || {};
              const { text }: any = latestMessage;
              if (parseCallback) {
                parseCallback(latestMessage);
              }
              if (text) {
                const queue = encoder.encode(text);
                securelyEnqueueValue(controller, queue);
              }
            } catch (e) {
              controller.error(e);
            }
            break;
          }
        }
      }
      const parser = createParser(onParse);
      if (!res.body) return;

      for await (const chunk of streamAsyncIterator(
        res.body as ReadableStream,
      )) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });
  return stream;
}

export function setRequestHeaders(): HeadersInit {
  const accessToken = useAuthStore.getState().accessToken;
  const username = useAuthStore.getState().username;
  const codeMakerVersion = useExtensionStore.getState().codeMakerVersion;
  const ide = useExtensionStore.getState().IDE;
  let departmentCode = '';
  try {
    departmentCode = encodeURI(
      useAuthStore.getState().authExtends.department_code,
    );
  } catch (error) {
    console.error(error);
  }
  const codeGenerateModelCode = useExtensionStore.getState().generateModelCode;
  const entrance = useExtensionStore.getState().entrance;
  return {
    'Content-Type': 'application/json',
    'X-Access-Token': accessToken as string,
    'X-Auth-User': encodeURIComponent(username || '') as string,
    'y3maker-version': codeMakerVersion as string,
    ide: ide as string,
    'department-code': departmentCode as string,
    'code-generate-model-code': codeGenerateModelCode as string,
    entrance: entrance as string,
  };
}

// 请求默认 CodeMaker chat stream (gpt)
export async function requestChatStream(
  // 事件名，Y3不使用，保留参数位置兼容上游调用签名
  _event:
    | PrePromptEvent
    | string
    | undefined = UserEvent.CODE_CHAT_PROMPT_CUSTOM,
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/gpt/text_chat_stream',
  options?: {
    onMessage: (
      message: string,
      done: boolean,
      reasoningResponse: {
        reasoning_content: string;
        thinking_signature: string;
        redacted_thinking: string;
      },
      jsonData?: any
    ) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    ntesTraceId?: string;
    setError: (type: boolean) => void;
  },
) {
  let model_time_out = CHAT_STREAM_CHUNK_TIMEOUT;
  if (data.model === 'o3-mini-2025-01-31') {
    model_time_out = O3_CHUNK_TIMEOUT;
  }
  const abortController = new AbortController();
  options?.onController?.(abortController);
  // 还在 stream 中的内容，因为 max token 问题导致内容会被中断，需要继续 prompt 并且将回答拼接起来。
  let responseText = '';
  let jsonData: any;
  const reasoningResponse = {
    reasoning_content: '',
    thinking_signature: '',
    redacted_thinking: '',
  };
  const finish = () => {
    options?.onMessage(responseText, true, reasoningResponse, jsonData);
    abortController.abort();
  };
  async function run(promptData: ChatPromptBody) {
    const url = chatRequestUrl;
    let chunkTimeoutId: NodeJS.Timeout | null = null;
    try {
      const requestHeaders: any = setRequestHeaders() || {};
      if (options?.ntesTraceId) {
        requestHeaders['ntes-trace-id'] = options?.ntesTraceId;
      }
      const req = new Request(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const parseCallback = (chunkData: any) => {
        jsonData = chunkData
      };
      const res = new Response(await createStream(req, parseCallback));
      if (res.ok) {
        clearTimeout(reqTimeoutId);

        // chunk 回复超时检测
        let lastMessageReceivedTime = new Date().getTime();
        if (chunkTimeoutId) {
          clearInterval(chunkTimeoutId);
        }
        chunkTimeoutId = setInterval(() => {
          if (
            new Date().getTime() - lastMessageReceivedTime >=
            model_time_out
          ) {
            responseText += '\n\n回复超时，请重试';
            options?.setError(true);
            userReporter.report({
              event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
              extends: {
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                mark: 0
              });
              webToolsLogger.captureException(UserEvent.CODE_CHAT_CHUNK_TIMEOUT);
            });
            finish();
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
          }
        }, model_time_out);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line
        while (true) {
          // handle time out, will stop if no response in 30 secs
          const content = await reader?.read();
          lastMessageReceivedTime = new Date().getTime();
          const done = !content || content.done;
          if (done && needContinue) {
            const preResposneMessage: ChatMessage = {
              role: ChatRole.Assistant,
              content: responseText || '-',
            };

            const nextData = {
              ...promptData,
              messages: [
                ...data.messages,
                preResposneMessage,
                CONTINUOUS_CHAT_MESSAGE,
              ],
            };
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
            needContinue = false;
            options?.onMessage(responseText, false, reasoningResponse);
            await run(nextData);
            break;
          }
          if (!content || done) {
            clearInterval(chunkTimeoutId);
            finish();
            break;
          }
          const textChunk = decoder.decode(content?.value, { stream: true });
          try {
            // 尝试解析为 JSON，如果失败则作为普通文本处理
            const parsedChunk = JSON.parse(textChunk);
            if (parsedChunk.content !== undefined) {
              // 这是包含 reasoning 字段的 JSON 响应
              const { content: chunkContent, reasoningContent, thinkingSignature, redactedThinking } = parsedChunk;
              responseText += chunkContent || '';
              if (reasoningContent) {
                reasoningResponse.reasoning_content += reasoningContent;
              }
              if (thinkingSignature) {
                reasoningResponse.thinking_signature += thinkingSignature;
              }
              if (redactedThinking) {
                reasoningResponse.redacted_thinking += redactedThinking;
              }
              options?.onMessage(responseText, false, reasoningResponse);
            } else {
              // 这是普通的 JSON 响应，直接作为文本处理
              responseText += textChunk;
              options?.onMessage(responseText, false, reasoningResponse);
            }
          } catch (e) {
            // 解析 JSON 失败，作为普通文本处理
            responseText += textChunk;
            options?.onMessage(responseText, false, reasoningResponse);
          }
        }
      } else {
        console.error('Stream Error', res.body);
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      console.error('Error', error);
      if (chunkTimeoutId) {
        clearInterval(chunkTimeoutId);
      }
      options?.onError(error as Error);
    }
  }

  await run(data);
}

export async function requestDeepseekReasonerChatStream(
  // 事件名，Y3不使用，保留参数位置兼容上游调用签名
  _event:
    | PrePromptEvent
    | string
    | undefined = UserEvent.CODE_CHAT_PROMPT_CUSTOM,
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/gpt/text_chat_stream',
  options?: {
    onMessage: (message: string, done: boolean, reasoningText: string, jsonData?: any) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    ntesTraceId?: string;
    setError: (type: boolean) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  // 还在 stream 中的内容，因为 max token 问题导致内容会被中断，需要继续 prompt 并且将回答拼接起来。
  let responseText = '';
  let responseReasoningText = '';
  let jsonData: any;
  const onParse = (chunkData: any) => {
    jsonData = chunkData
  }
  const finish = () => {
    options?.onMessage(responseText, true, responseReasoningText, jsonData);
    abortController.abort();
  };
  async function run(promptData: ChatPromptBody) {
    const url = chatRequestUrl;
    let chunkTimeoutId: NodeJS.Timeout | null = null;
    try {
      const requestHeaders: any = setRequestHeaders() || {};
      if (options?.ntesTraceId) {
        requestHeaders['ntes-trace-id'] = options?.ntesTraceId;
      }
      const req = new Request(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const res = new Response(await createDeepseekReasonerStream(req, onParse));
      if (res.ok) {
        clearTimeout(reqTimeoutId);

        // chunk 回复超时检测
        let lastMessageReceivedTime = new Date().getTime();
        if (chunkTimeoutId) {
          clearInterval(chunkTimeoutId);
        }
        chunkTimeoutId = setInterval(() => {
          if (
            new Date().getTime() - lastMessageReceivedTime >=
            CHAT_STREAM_CHUNK_TIMEOUT
          ) {
            responseText += '\n\n回复超时，请重试';
            options?.setError(true);
            userReporter.report({
              event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
              extends: {
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                mark: 1
              });
              webToolsLogger.captureException(UserEvent.CODE_CHAT_CHUNK_TIMEOUT);
            });
            finish();
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
          }
        }, DEEPSEEK_STREAM_CHUNK_TIMEOUT);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line
        while (true) {
          // handle time out, will stop if no response in 30 secs
          const content = await reader?.read();
          lastMessageReceivedTime = new Date().getTime();
          const done = !content || content.done;
          if (done && needContinue) {
            const preResposneMessage: ChatMessage = {
              role: ChatRole.Assistant,
              content: responseText || '-',
              reasoningContent: responseReasoningText,
            };

            const nextData = {
              ...promptData,
              messages: [
                ...data.messages,
                preResposneMessage,
                CONTINUOUS_CHAT_MESSAGE,
              ],
            };
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
            needContinue = false;
            options?.onMessage(responseText, false, responseReasoningText);
            await run(nextData);
            break;
          }
          if (!content || done) {
            clearInterval(chunkTimeoutId);
            finish();
            break;
          }
          const chunk = decoder.decode(content?.value, { stream: true });

          try {
            const parsedChunk = JSON.parse(chunk);
            const { text, reasoningText } = parsedChunk;
            if (text) {
              responseText += text;
            }
            if (reasoningText) {
              responseReasoningText += reasoningText;
            }
            options?.onMessage(responseText, false, responseReasoningText);
          } catch (error) {
            console.error('Stream Error', res.body);
            options?.onError(new Error('Stream Error'));
          }
        }
      } else {
        console.error('Stream Error', res.body);
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      console.error('Error', error);
      if (chunkTimeoutId) {
        clearInterval(chunkTimeoutId);
      }
      options?.onError(error as Error);
    }
  }

  await run(data);
}

export async function requestClaude37ChatStream(
  // 事件名，Y3不使用，保留参数位置兼容上游调用签名
  _event:
    | PrePromptEvent
    | string
    | undefined = UserEvent.CODE_CHAT_PROMPT_CUSTOM,
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/gpt/text_chat_stream',
  options?: {
    onMessage: (
      message: string,
      done: boolean,
      claude37Response: {
        reasoning_content: string;
        thinking_signature: string;
        redacted_thinking: string;
      },
      jsonData?: any
    ) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    ntesTraceId?: string;
    setError: (type: boolean) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  // 还在 stream 中的内容，因为 max token 问题导致内容会被中断，需要继续 prompt 并且将回答拼接起来。
  let responseText = '';
  const claude37Response = {
    reasoning_content: '',
    thinking_signature: '',
    redacted_thinking: '',
  };
  let jsonData: any;
  const finish = () => {
    options?.onMessage(responseText, true, claude37Response, jsonData);
    abortController.abort();
  };
  const onParse = (chunkData: any) => {
    jsonData = chunkData
  }
  async function run(promptData: ChatPromptBody) {
    const url = chatRequestUrl;
    let chunkTimeoutId: NodeJS.Timeout | null = null;
    try {
      const requestHeaders: any = setRequestHeaders() || {};
      if (options?.ntesTraceId) {
        requestHeaders['ntes-trace-id'] = options?.ntesTraceId;
      }
      const req = new Request(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const res = new Response(await createClaude37ReasonerStream(req, onParse));
      if (res.ok) {
        clearTimeout(reqTimeoutId);

        // chunk 回复超时检测
        let lastMessageReceivedTime = new Date().getTime();
        if (chunkTimeoutId) {
          clearInterval(chunkTimeoutId);
        }
        chunkTimeoutId = setInterval(() => {
          if (
            new Date().getTime() - lastMessageReceivedTime >=
            CHAT_STREAM_CHUNK_TIMEOUT
          ) {
            responseText += '\n\n回复超时，请重试';
            options?.setError(true);
            userReporter.report({
              event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
              extends: {
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                mark: 2
              });
              webToolsLogger.captureException(UserEvent.CODE_CHAT_CHUNK_TIMEOUT);
            });
            finish();
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
          }
        }, DEEPSEEK_STREAM_CHUNK_TIMEOUT);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line
        while (true) {
          // handle time out, will stop if no response in 30 secs
          const content = await reader?.read();
          lastMessageReceivedTime = new Date().getTime();
          const done = !content || content.done;
          if (done && needContinue) {
            const preResposneMessage: ChatMessage = {
              role: ChatRole.Assistant,
              content: responseText || '-',
              reasoning_content: claude37Response.reasoning_content,
              thinking_signature: claude37Response.thinking_signature,
              redacted_thinking: claude37Response.redacted_thinking,
            };

            const nextData = {
              ...promptData,
              messages: [
                ...data.messages,
                preResposneMessage,
                CONTINUOUS_CHAT_MESSAGE,
              ],
            };
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
            needContinue = false;
            options?.onMessage(responseText, false, claude37Response);
            await run(nextData);
            break;
          }
          if (!content || done) {
            clearInterval(chunkTimeoutId);
            finish();
            break;
          }
          const chunk = decoder.decode(content?.value, { stream: true });

          try {
            const parsedChunk = JSON.parse(chunk);
            const {
              text,
              reasoningContent,
              thinkingSignature,
              redactedThinking,
            } = parsedChunk;
            if (text) {
              responseText += text;
            }
            if (reasoningContent) {
              claude37Response.reasoning_content += reasoningContent;
            }
            if (thinkingSignature) {
              claude37Response.thinking_signature += thinkingSignature;
            }
            if (redactedThinking) {
              claude37Response.redacted_thinking += redactedThinking;
            }
            options?.onMessage(responseText, false, claude37Response);
          } catch (error) {
            console.error('Stream Error', res.body);
            options?.onError(new Error('Stream Error'));
          }
        }
      } else {
        console.error('Stream Error', res.body);
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      console.error('Error', error);
      if (chunkTimeoutId) {
        clearInterval(chunkTimeoutId);
      }
      options?.onError(error as Error);
    }
  }

  await run(data);
}

// 请求 BrainMark chat stream
export async function requestBMChatStream(
  content: string,
  docset: Docset,
  sendMessages: ChatMessage[],
  options?: {
    onMessage: (message: string, done: boolean, bmSearch: BMSearch) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    onFinish?: (extra: any) => void;
  },
) {
  let chatRequestUrl = '/proxy/bm/docsets';
  if (docset.env === 'office') {
    chatRequestUrl = `${OFFICE_BM_API_URL}/proxy/bm/api/v1/docsets`;
  }

  const abortController = new AbortController();
  options?.onController?.(abortController);

  let responseText = '';
  // 用于获取额外的数据
  let extraData: any = {};
  const bmSearchData: BMSearch = {
    contexts: [],
    bmMark: false,
    reasoningContent: '',
  };

  const finish = () => {
    options?.onMessage(responseText, true, bmSearchData);
    if (options?.onFinish) {
      options?.onFinish(extraData);
    }
    abortController.abort();
  };

  const data: ChatBMPromptBody = {
    input: content,
    stream_response: true,
    use_dataset_config: true,
    folder_names: docset.folder_names,
    shorten_bm_image_url: false,
  };

  if (sendMessages.length) {
    data.messages = sendMessages;
  }

  const url = chatRequestUrl + `/@${docset.code}:chat`;
  try {
    const req = new Request(url, {
      method: 'POST',
      headers: {
        ...setRequestHeaders(),
        'X-Auth-Project': docset.project,
      },
      body: JSON.stringify(data),
      signal: abortController.signal,
    });

    const reqTimeoutId = setTimeout(
      () =>
        abortController.abort({
          name: REQUEST_TIMEOUT_NAME,
          message: StreamError.Timeout,
        }),
      BM_STREAM_TIMEOUT,
    );
    const res = new Response(
      await createBMStream(req, (jsonData) => {
        if (jsonData) {
          extraData = {
            ...extraData,
            ...jsonData,
          };
        }
      }),
    );

    if (res.ok) {
      clearTimeout(reqTimeoutId);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      // eslint-disable-next-line
      while (true) {
        // handle time out, will stop if no response in 30 secs
        const content = await reader?.read();
        const chunk = decoder.decode(content?.value, { stream: true });
        if (!content || content.done) {
          finish();
          break;
        }
        try {
          const parsedChunk = JSON.parse(chunk);
          const { text, bmSearch, bmMark, reasoningContent } = parsedChunk;
          responseText += text;

          // 更新 bmSearch 相关数据
          if (bmSearch?.contexts) {
            bmSearchData.contexts = bmSearch.contexts;
          }
          if (bmMark !== undefined) {
            bmSearchData.bmMark = bmMark;
          }
          // 独立更新 reasoningContent
          if (reasoningContent !== undefined) {
            bmSearchData.reasoningContent = reasoningContent;
          }
          options?.onMessage(responseText, false, bmSearchData);
        } catch (error) {
          options?.onError(new Error('Error parsing chunk'));
          break;
        }
      }
    } else {
      console.error('Stream Error', res.body);
      options?.onError(new Error('Stream Error'));
    }
  } catch (error) {
    console.error('Error', error);
    options?.onError(error as Error);
  }
}

export async function requestMultipleBMChatStream(
  content: string,
  docsets: Docset[],
  sendMessages: ChatMessage[],
  options?: {
    onMessage: (message: string, done: boolean, jsonData?: any) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    onFinish?: (extra: any) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  let docsetList = '';
  let chatRequestUrl = '';
  const hasOfficeDocset = docsets.some((docset) => docset.env === 'office');
  if (hasOfficeDocset) {
    chatRequestUrl = `${OFFICE_BM_API_URL}/proxy/bm/api/v1/apps/00000000-0000-0000-0000-000000000005/chat`;
    docsetList = JSON.stringify(
      docsets.map((docset) => ({
        docset_code: docset.code,
        project: docset.project,
        env: docset.env,
      })),
    );
  } else {
    chatRequestUrl = `/proxy/bm/apps/00000000-0000-0000-0000-000000000006/chat`;
    docsetList = JSON.stringify(
      docsets.map((docset) => ({
        docset_code: docset.code,
        project: docset.project,
      })),
    );
  }
  let responseText = '';
  // 用于获取额外的数据
  let extraData: any = {};

  const finish = () => {
    options?.onMessage(responseText, true, extraData);
    if (options?.onFinish) {
      options?.onFinish(extraData);
    }
    abortController.abort();
  };

  const requestData: MultipleChatBMPromptBody = {
    query: content,
    stream_response: true,
    mode: 'advanced-chat',
    inputs: {
      docset_list: docsetList,
      input: content,
      message: JSON.stringify(sendMessages),
    },
  };

  try {
    const req = new Request(chatRequestUrl, {
      method: 'POST',
      headers: {
        ...setRequestHeaders(),
      },
      body: JSON.stringify(requestData),
      signal: abortController.signal,
    });

    const reqTimeoutId = setTimeout(
      () =>
        abortController.abort({
          name: REQUEST_TIMEOUT_NAME,
          message: StreamError.Timeout,
        }),
      TIMEOUT_MS,
    );
    const res = new Response(
      await createDifyStream(req, (jsonData) => {
        if (jsonData) {
          extraData = {
            ...extraData,
            ...jsonData,
          };
        }
      }),
    );

    if (res.ok) {
      clearTimeout(reqTimeoutId);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      // eslint-disable-next-line
      while (true) {
        // handle time out, will stop if no response in 30 secs
        const content = await reader?.read();
        const text = decoder.decode(content?.value);
        responseText += text;
        const done = !content || content.done;
        options?.onMessage(responseText, false);
        if (done) {
          finish();
          break;
        }
      }
    } else {
      console.error('Stream Error', res.body);
      options?.onError(new Error('Stream Error'));
    }
  } catch (error) {
    console.error('Error', error);
    options?.onError(error as Error);
  }
}

export async function requestBMKnowledgeAugmentationStream(
  content: string,
  sendMessages: ChatMessage[],
  reqData: {
    model?: string;
    repo?: string;
  },
  options?: {
    onMessage: (message: string, done: boolean, jsonData?: any) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    onFinish?: (extra: any) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);

  let responseText = '';
  // 用于获取额外的数据
  let extraData: any = {};

  const finish = () => {
    options?.onMessage(responseText, true, extraData);
    if (options?.onFinish) {
      options?.onFinish(extraData);
    }
    abortController.abort();
  };

  const requestData: KnowledgeAugmentationBMPromptBody = {
    query: content,
    stream_response: true,
    mode: 'workflow',
    inputs: {
      input: content,
      message: JSON.stringify(sendMessages),
      ...reqData,
    },
  };

  const url = `${OFFICE_BM_API_URL}/proxy/bm/api/v1/apps/00000000-0000-0000-0000-000000000007/chat`;

  try {
    const req = new Request(url, {
      method: 'POST',
      headers: {
        ...setRequestHeaders(),
      },
      body: JSON.stringify(requestData),
      signal: abortController.signal,
    });

    const reqTimeoutId = setTimeout(
      () =>
        abortController.abort({
          name: REQUEST_TIMEOUT_NAME,
          message: StreamError.Timeout,
        }),
      TIMEOUT_MS,
    );
    const res = new Response(
      await createDifyWorkFlowStream(req, (jsonData) => {
        if (jsonData) {
          extraData = {
            ...extraData,
            ...jsonData,
          };
        }
      }),
    );
    if (res.ok) {
      clearTimeout(reqTimeoutId);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      // eslint-disable-next-line
      while (true) {
        // handle time out, will stop if no response in 30 secs
        const content = await reader?.read();
        const text = decoder.decode(content?.value);
        responseText += text;
        const done = !content || content.done;
        options?.onMessage(responseText, false);
        if (done) {
          finish();
          break;
        }
      }
    } else {
      console.log('res.Error');

      console.error('Stream Error', res.body);
      options?.onError(new Error('Stream Error'));
    }
  } catch (error) {
    console.error('Error', error);
    options?.onError(error as Error);
  }
}

export async function requestPluginStream(
  data: PluginAppRunnerParams,
  options?: {
    onMessage: (message: string, done: boolean, jsonData?: any) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
  },
) {
  const url = '/proxy/gpt/app_tool/funcs';
  const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

  const abortController = new AbortController();
  options?.onController?.(abortController);

  let responseText = '';
  let jsonData: any
  const parseCallback = (chunkData: any) => {
    jsonData = chunkData;
  };

  const finish = () => {
    options?.onMessage(responseText, true, jsonData);
    abortController.abort();
  };
  async function run(promptData: PluginAppRunnerParams) {
    try {
      const req = new Request(url, {
        method: 'POST',
        headers: setRequestHeaders(),
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        REQUEST_TIMEOUT_MS,
      );
      const res = new Response(await createStream(req, parseCallback));
      if (res.ok) {
        clearTimeout(reqTimeoutId);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line
        while (true) {
          // handle time out, will stop if no response in 30 secs
          const content = await reader?.read();
          const text = decoder.decode(content?.value);
          responseText += text;
          const done = !content || content.done;
          if (done) {
            options?.onMessage(responseText, true);
            break;
          }
          options?.onMessage(responseText, false);
          if (done) {
            finish();
            break;
          }
        }
      } else {
        console.error('Stream Error', res.body);
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      console.error('Error', error);
      options?.onError(error as Error);
    }
  }

  await run(data);
}

export async function requestNetworkChatStream(
  _event:
    | PrePromptEvent
    | string
    | undefined = UserEvent.CODE_CHAT_PROMPT_CUSTOM,
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/gpt/text_chat_stream',
  options?: {
    onMessage: (
      message: string,
      done: boolean,
      webSearch: GeminiWebSearch[],
      jsonData?: any,
    ) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  let responseText = '';
  let webSearchContent: GeminiWebSearch[] = []; // 用于存储 webSearch 内容
  let jsonData: any;

  const finish = () => {
    options?.onMessage(responseText, true, webSearchContent, jsonData);
    abortController.abort();
  };

  const parseCallback = (chunkData: any) => {
    jsonData = chunkData;
  };

  async function run(promptData: ChatPromptBody) {
    const url = chatRequestUrl;
    try {
      const req = new Request(url, {
        method: 'POST',
        headers: setRequestHeaders(),
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const res = new Response(await createGoogleGeminiNetworkStream(req, parseCallback));
      if (res.ok) {
        clearTimeout(reqTimeoutId);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line
        while (true) {
          const content = await reader?.read();
          if (!content || content.done) {
            if (needContinue) {
              const preResponseMessage: ChatMessage = {
                role: ChatRole.Assistant,
                content: responseText,
              };

              const nextData = {
                ...promptData,
                messages: [
                  ...data.messages,
                  preResponseMessage,
                  CONTINUOUS_CHAT_MESSAGE,
                ],
              };
              needContinue = false;
              options?.onMessage(responseText, false, webSearchContent);
              await run(nextData);
              break;
            }
            finish();
            break;
          }

          const textChunk = decoder.decode(content.value, { stream: true });
          try {
            const parsedChunk = JSON.parse(textChunk);
            const { text, webSearch } = parsedChunk;
            responseText += text;
            if (webSearch) {
              webSearchContent = webSearch;
            }

            options?.onMessage(responseText, false, webSearchContent);
          } catch (e) {
            options?.onError(new Error('Error parsing chunk'));
            break;
          }
        }
      } else {
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      options?.onError(error as Error);
    }
  }

  await run(data);
}

export async function requestCodebaseChatStream(
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/u5_chat/codebase_chat_stream',
  options?: {
    isDeepSeek?: boolean;
    onMessage: (
      message: string,
      done: boolean,
      toolCalls: ToolCall[],
      totalTokens: number,
      promptTokens: number,
      cache_creation_input_tokens: number,
      cache_read_input_tokens: number,
      completionTokens: number,
      claude37Response: {
        reasoning_content: string;
        thinking_signature: string;
        redacted_thinking: string;
      },
      responseId: string
    ) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    ntesTraceId?: string;
    setError: (type: boolean) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  let responseText = '';
  // let totalTokens = 0;
  let completionTokens = 0;
  let promptTokens = 0;
  let cacheCreationInputTokens = 0;
  let cacheReadInputTokens = 0;
  let toolCalls: ToolCall[] = [];
  let continueCount = 0;
  const claude37Response = {
    reasoning_content: '',
    thinking_signature: '',
    redacted_thinking: '',
  };
  let responseId = '';

  const finish = () => {
    // 兼容下标从 1 开始的情况
    // if (toolCalls.length && !toolCalls[0]) {
    //   toolCalls.shift();
    // }
    options?.onMessage(
      responseText,
      true,
      toolCalls.filter(toolCall => !!toolCall),
      completionTokens + promptTokens + cacheCreationInputTokens + cacheReadInputTokens,
      completionTokens,
      promptTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
      claude37Response,
      responseId
    );
    abortController.abort();
  };

  async function run(promptData: ChatPromptBody) {
    toolCalls = [];
    const url = chatRequestUrl;
    let chunkTimeoutId: NodeJS.Timeout | null = null;
    try {
      const requestHeaders: any = setRequestHeaders() || {};
      if (options?.ntesTraceId) {
        requestHeaders['ntes-trace-id'] = options?.ntesTraceId;
      }
      const req = new Request(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const res = new Response(await createFunctionCallStream(req));
      if (res.ok) {
        clearTimeout(reqTimeoutId);

        // chunk 回复超时检测
        let lastMessageReceivedTime = new Date().getTime();
        if (chunkTimeoutId) {
          clearInterval(chunkTimeoutId);
        }
        chunkTimeoutId = setInterval(() => {
          if (
            new Date().getTime() - lastMessageReceivedTime >=
            CODEBASE_CHAT_STREAM_CHUNK_TIMEOUT
          ) {
            responseText += '\n\n回复超时，请重试';
            userReporter.report({
              event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
              extends: {
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                chatType: 'codebase',
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                chatType: 'codebase',
                mark: 3
              });
              webToolsLogger.captureException(UserEvent.CODE_CHAT_CHUNK_TIMEOUT);
            });
            options?.setError(true);
            finish();
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
          }
        }, CHAT_STREAM_CHUNK_TIMEOUT);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line
        while (true) {
          const chunk = await reader?.read();
          lastMessageReceivedTime = new Date().getTime();
          if (!chunk || chunk.done) {
            // let toolcallParsable = true;
            // if (toolCalls.length) {
            //   try {
            //     JSON.parse(toolCalls[0].function.arguments || '');
            //   } catch (err) {
            //     console.error('Error parsing tool call arguments after streaming:', err);
            //     toolcallParsable = false;
            //   }
            // }
            if (needContinue && continueCount < MAX_CONTINUE_COUNT) {
              userReporter.report({
                event: UserEvent.TOOLCALL_STOP_BY_LENGTH,
                extends: {
                  model: data.model,
                  max_tokens: data.max_tokens
                }
              })
              if (chunkTimeoutId) {
                clearInterval(chunkTimeoutId);
              }
              needContinue = false;
              continueCount++;
              if (toolCalls && toolCalls.length) {
                const preResponseMessage: ChatMessage = {
                  role: ChatRole.Assistant,
                  content: responseText || '-',
                };
                const nextData = {
                  ...promptData,
                  messages: [
                    ...data.messages,
                    preResponseMessage,
                    SEPERATE_TOOL_CALL_MESSAGE,
                  ],
                };
                options?.onMessage(
                  responseText,
                  false,
                  toolCalls.filter(toolCall => !!toolCall),
                  completionTokens + promptTokens + cacheCreationInputTokens + cacheReadInputTokens,
                  completionTokens,
                  promptTokens,
                  cacheCreationInputTokens,
                  cacheReadInputTokens,
                  claude37Response,
                  responseId
                );
                await run(nextData);
                break;
              } else {
                const preResponseMessage: ChatMessage = {
                  role: ChatRole.Assistant,
                  content: responseText || '-',
                };
                const nextData = {
                  ...promptData,
                  messages: [
                    ...data.messages,
                    preResponseMessage,
                    CONTINUOUS_CHAT_MESSAGE_ZH,
                  ],
                };
                options?.onMessage(
                  responseText,
                  false,
                  toolCalls.filter(toolCall => !!toolCall),
                  completionTokens + promptTokens + cacheCreationInputTokens + cacheReadInputTokens,
                  completionTokens,
                  promptTokens,
                  cacheCreationInputTokens,
                  cacheReadInputTokens,
                  claude37Response,
                  responseId
                );
                await run(nextData);
                break;
              }
            }
            clearTimeout(chunkTimeoutId);
            finish();
            break;
          }

          const textChunk = decoder.decode(chunk.value, { stream: true });
          try {
            const parsedChunk = JSON.parse(textChunk);
            const {
              content, tool_calls, total_tokens, completion_tokens,
              reasoningContent, thinkingSignature, redactedThinking,
              prompt_tokens, cache_creation_input_tokens, cache_read_input_tokens,
              response_id
            } = parsedChunk;
            responseText += content || '';
            if (!responseId) {
              responseId = response_id;
            }
            if (tool_calls) {
              for (const tool of tool_calls) {
                if (!tool) continue
                const index = tool.index || 0;
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: tool.id || '',
                    function: {
                      arguments: tool.function?.arguments || '',
                      name: getValidToolName(tool.function?.name || ''),
                    },
                    type: tool.type || '',
                  };
                } else {
                  toolCalls[index].id += tool.id || '';
                  toolCalls[index].function.arguments +=
                    tool.function?.arguments || '';
                  toolCalls[index].function.name += getValidToolName(tool.function?.name || '');
                  toolCalls[index].type += tool.type || '';
                }
                if (toolCalls[index].type.includes('function')) {
                  toolCalls[index].type = 'function';
                }
              }
            }
            if (reasoningContent) {
              claude37Response.reasoning_content += reasoningContent;
            }
            if (thinkingSignature) {
              // Gemini的签名中，content和function都有对应签名，需要一一列举，否则会出现签名不一致的情况
              if ([ChatModel.Gemini25].includes(data?.model as ChatModel)) {
                if (!claude37Response.thinking_signature) {
                  claude37Response.thinking_signature = thinkingSignature;
                }
              } else {
                claude37Response.thinking_signature += thinkingSignature;
              }
            }
            if (redactedThinking) {
              claude37Response.redacted_thinking += redactedThinking;
            }
            if (total_tokens) {
              // totalTokens = total_tokens;
              completionTokens = completion_tokens;
              promptTokens = prompt_tokens;
              cacheCreationInputTokens = cache_creation_input_tokens;
              cacheReadInputTokens = cache_read_input_tokens;
            }

            options?.onMessage(
              responseText,
              false,
              toolCalls.filter(toolCall => !!toolCall),
              completionTokens + promptTokens + cacheCreationInputTokens + cacheReadInputTokens,
              completionTokens,
              promptTokens,
              cacheCreationInputTokens,
              cacheReadInputTokens,
              claude37Response,
              responseId
            );
          } catch (e) {
            options?.onError(new Error('Error parsing chunk'));
            break;
          }
        }
      } else {
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      if (chunkTimeoutId) {
        clearInterval(chunkTimeoutId);
      }
      options?.onError(error as Error);
    }
  }

  await run(data);
}

export async function requestDSCodebaseChatStream(
  data: ChatPromptBody,
  chatRequestUrl = '/proxy/gpt/gpt/text_chat_stream',
  options?: {
    onMessage: (
      message: string,
      done: boolean,
      toolCalls: ToolCall[],
      reasoningText: string,
      totalTokens: number,
      completionTokens: number,
      streamingToolCall: ParsedToolCall | undefined
    ) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    ntesTraceId?: string;
    setError: (type: boolean) => void;
  },
) {
  const abortController = new AbortController();
  options?.onController?.(abortController);
  let responseText = '';
  let totalTokens = 0;
  let completionTokens = 0;
  let toolCalls: ToolCall[] = [];
  let responseReasoningText = '';
  let textContent = '';

  const finish = () => {
    // 兼容下标从 1 开始的情况
    if (toolCalls.length && !toolCalls[0]) {
      toolCalls.shift();
    }
    console.log(responseText);
    options?.onMessage(
      textContent,
      true,
      toolCalls,
      responseReasoningText,
      totalTokens,
      completionTokens,
      undefined
    );
    abortController.abort();
  };

  async function run(promptData: ChatPromptBody) {
    const url = chatRequestUrl;
    let chunkTimeoutId: NodeJS.Timeout | null = null;
    try {
      const requestHeaders: any = setRequestHeaders() || {};
      if (options?.ntesTraceId) {
        requestHeaders['ntes-trace-id'] = options?.ntesTraceId;
      }
      const req = new Request(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(promptData),
        signal: abortController.signal,
      });
      const reqTimeoutId = setTimeout(
        () =>
          abortController.abort({
            name: REQUEST_TIMEOUT_NAME,
            message: StreamError.Timeout,
          }),
        TIMEOUT_MS,
      );
      const res = new Response(await createDeepseekReasonerStream(req));
      if (res.ok) {
        clearTimeout(reqTimeoutId);

        // chunk 回复超时检测
        let lastMessageReceivedTime = new Date().getTime();
        if (chunkTimeoutId) {
          clearInterval(chunkTimeoutId);
        }
        chunkTimeoutId = setInterval(() => {
          if (
            new Date().getTime() - lastMessageReceivedTime >=
            CHAT_STREAM_CHUNK_TIMEOUT
          ) {
            responseText += '\n\n回复超时，请重试';
            userReporter.report({
              event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
              extends: {
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.CODE_CHAT_CHUNK_TIMEOUT,
                model: promptData.model || '',
                ntesTraceId: options?.ntesTraceId,
                mark: 4
              });
              webToolsLogger.captureException(UserEvent.CODE_CHAT_CHUNK_TIMEOUT);
            });
            options?.setError(true);
            finish();
            if (chunkTimeoutId) {
              clearInterval(chunkTimeoutId);
            }
          }
        }, CHAT_STREAM_CHUNK_TIMEOUT);
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line
        while (true) {
          const chunk = await reader?.read();
          lastMessageReceivedTime = new Date().getTime();
          if (!chunk || chunk.done) {
            clearTimeout(chunkTimeoutId);
            finish();
            break;
          }

          const textChunk = decoder.decode(chunk.value, { stream: true });
          try {
            const parsedChunk = JSON.parse(textChunk);
            const { text, reasoningText, total_tokens, completion_tokens } = parsedChunk;
            responseText += text || '';
            let toolCall = undefined
            if (responseText) {
              const {
                parsedToolCalls,
                parsedContent,
                streamingToolCall
              } = parseAssistantMessage(responseText);
              if (parsedToolCalls) {
                toolCalls = parsedToolCalls || [];
              }
              if (streamingToolCall) {
                toolCall = streamingToolCall;
              }
              textContent = parsedContent;
            }
            if (reasoningText) {
              responseReasoningText += reasoningText;
            }
            if (total_tokens) {
              totalTokens = total_tokens;
              completionTokens = completion_tokens;
            }

            options?.onMessage(
              textContent,
              false,
              toolCalls,
              responseReasoningText,
              totalTokens,
              completionTokens,
              toolCall
            );
          } catch (e) {
            options?.onError(new Error('Error parsing chunk'));
            break;
          }
        }
      } else {
        options?.onError(new Error('Stream Error'));
      }
    } catch (error) {
      if (chunkTimeoutId) {
        clearInterval(chunkTimeoutId);
      }
      options?.onError(error as Error);
    }
  }

  await run(data);
}

async function* streamAsyncIterator(stream: ReadableStream) {
  // Get a lock on the stream
  const reader = stream.getReader();

  try {
    while (true) {
      // Read from the stream
      const { done, value } = await reader.read();
      // Exit if we're done
      if (done) return;
      // Else yield the chunk
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

// To store message streaming controller
export const ControllerPool = {
  controllers: new Map<string, AbortController>(),

  addController(
    sessionId: string,
    messageIndex: number,
    controller: AbortController,
  ) {
    const key = this.key(sessionId, messageIndex);
    this.controllers.set(key, controller);
    return key;
  },

  stop(sessionId: string, messageIndex: number) {
    const key = this.key(sessionId, messageIndex);
    const controller = this.controllers.get(key);
    controller?.abort();
  },

  remove(sessionId: string, messageIndex: number) {
    const key = this.key(sessionId, messageIndex);
    this.controllers.delete(key);
  },

  key(sessionId: string, messageIndex: number) {
    return `${sessionId}-${messageIndex}`;
  },
};

// To store wait for feedback Q&A
export const FeedbackPool = {
  feedbacks: new Set<string>(),

  add(id: string) {
    this.feedbacks.add(id);
  },

  remove(id: string) {
    this.feedbacks.delete(id);
  },

  getter() {
    return this.feedbacks;
  },

  clear() {
    this.feedbacks = new Set();
  },
};

export const toolCallNames = [
  'list_files_top_level',
  'list_files_recursive',
  'view_source_code_definitions_top_level',
  'read_file',
  'retrieve_code',
  'retrieve_knowledge',
  'use_mcp_tool',
  'access_mcp_resource',
  'edit_file',
  'replace_in_file',
  'excute_command',
  'generate_codewiki_structure',
]

const toolParamNames = [
  'path',
  'search_query',
  'diff',
  'target_file',
  'code_edit',
  'is_create_file',
  'server_name',
  'tool_name',
  'arguments',
  'uri',
  'command',
  'docset_id'
]

export interface ParsedToolCall {
  name: string;
  params: {
    [propName: string]: string
  }
}

export function parseAssistantMessage(assistantMessage: string) {
  const toolCalls: ToolCall[] = [];
  let currentTextContent = '';
  let currentToolCall: ParsedToolCall | undefined = undefined;
  const currentToolCallStartIndex = 0;
  let currentParamName: string | undefined = undefined;
  let currentParamValueStartIndex = 0;
  let accumulator = "";
  let streamingToolCall: ParsedToolCall | undefined = undefined;

  for (let i = 0; i < assistantMessage.length; i++) {
    const char = assistantMessage[i]
    accumulator += char

    if (currentToolCall && currentParamName) {
      const currentParamValue = accumulator.slice(currentParamValueStartIndex)
      const paramClosingTag = `</${currentParamName}>`
      if (currentParamValue.endsWith(paramClosingTag)) {
        currentToolCall.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim();
        if (streamingToolCall && ['replace_in_file', 'edit_file'].includes(streamingToolCall.name)) {
          streamingToolCall.params[currentParamName] = currentParamValue.slice(0, -paramClosingTag.length).trim();
        }
        currentParamName = undefined
        continue
      } else if (streamingToolCall && ['replace_in_file', 'edit_file'].includes(streamingToolCall.name)) {
        streamingToolCall.params[currentParamName] = currentParamValue.trim();
      } else {
        continue
      }
    }

    if (currentToolCall) {
      const currentToolValue = accumulator.slice(currentToolCallStartIndex)
      const toolCallClosingTag = `</${currentToolCall.name}>`
      if (currentToolValue.endsWith(toolCallClosingTag)) {
        toolCalls.push({
          type: 'function',
          id: uniqueId(),
          function: {
            arguments: JSON.stringify(currentToolCall.params),
            name: currentToolCall.name
          }
        })
        currentToolCall = undefined
        streamingToolCall = undefined
        continue
      } else {
        const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
        for (const paramOpeningTag of possibleParamOpeningTags) {
          if (accumulator.endsWith(paramOpeningTag)) {
            currentParamName = paramOpeningTag.slice(1, -1);
            currentParamValueStartIndex = accumulator.length;
            break
          }
        }
        continue
      }
    }
    let didStartToolCall = false
    const possibleToolCallOpeningTags = toolCallNames.map((name) => `<${name}>`)
    for (const toolCallOpeningTag of possibleToolCallOpeningTags) {
      if (accumulator.endsWith(toolCallOpeningTag)) {
        currentToolCall = {
          name: toolCallOpeningTag.slice(1, -1),
          params: {}
        }
        streamingToolCall = {
          name: toolCallOpeningTag.slice(1, -1),
          params: {}
        }
        currentTextContent = currentTextContent.slice(0, -(toolCallOpeningTag.length - 1))
        didStartToolCall = true
        break
      }
    }

    if (!didStartToolCall) {
      currentTextContent += char;
    }
  }

  return {
    parsedToolCalls: toolCalls,
    streamingToolCall: streamingToolCall,
    parsedContent: currentTextContent,
    toolCallBreak: toolCalls.length && currentToolCall
  }
}
