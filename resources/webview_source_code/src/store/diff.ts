import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { setRequestHeaders } from '../services/useChatStream';
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';
import { proxyRequest } from '../services/common';
import { TEAM_REVIEW_API_URL } from '../routes/CodeReview/const';
import { ABORT_REASON_FINISHED, createAbortReason, REQUEST_TIMEOUT_NAME } from '../utils/abort';

export type ChatStreamState = {
  isStreaming: boolean;
  message: string;
  isError: boolean;
  reviewRequestId: string;
};

type ChatStreamActions = {
  onUserSubmit: (paylod: { reviewRequestId: string }) => void;
  onReset: () => void;
};

const TIMEOUT_MS = 120000;

// 请求 BrainMark chat stream
async function requestBMChatStream(
  payload: { reviewRequestId: string },
  options?: {
    onMessage: (message: string, done: boolean) => void;
    onError: (error: Error) => void;
    onController?: (controller: AbortController) => void;
    onFinish?: () => void;
  },
) {
  const chatRequestUrl = `${TEAM_REVIEW_API_URL}/review_requests/${payload.reviewRequestId}/explain`;

  const abortController = new AbortController();
  options?.onController?.(abortController);

  let responseText = '';

  const finish = () => {
    options?.onMessage(responseText, true);
    if (options?.onFinish) {
      options?.onFinish();
    }
    abortController.abort(createAbortReason(ABORT_REASON_FINISHED, __ABORT_LOC__));
  };

  try {
    const req = new Request(chatRequestUrl, {
      method: 'GET',
      headers: {
        ...setRequestHeaders(),
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
    });

    const reqTimeoutId = setTimeout(() => abortController.abort(createAbortReason(REQUEST_TIMEOUT_NAME, __ABORT_LOC__)), TIMEOUT_MS);
    const res = new Response(await createStream(req));

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

async function* streamAsyncIterator(stream: ReadableStream) {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function createStream(req: Request) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const res = await fetch(req);

  if (!res.ok) {
    const result = await res.json();
    // 兼容 BrainMaker 的错误情况
    if (result.code) {
      throw new Error(result.detail?.error || result.msg);
    }
    throw new Error(res.statusText);
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;
          // https://platform.openai.com/docs/api-reference/chat/create#chat/create-stream
          try {
            let json;
            try {
              json = JSON.parse(data);
            } catch {
              throw new Error(data);
            }
            if (json.event === 'message_end') {
              controller.close();
              return;
            }
            if (json.event !== 'message') return;
            const text = json.answer;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };
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

export const useDiffStreamStore = create(
  immer<ChatStreamState & ChatStreamActions>((set, get) => ({
    isStreaming: false,
    message: '',
    searchRecordId: '',
    docCode: '',
    isError: false,
    reviewRequestId: '',

    /** @private */
    onReset: () => {
      set((state) => {
        state.isStreaming = false;
        state.message = '';
        state.isError = false;
        state.reviewRequestId = '';
      });
    },

    /** @private */
    onUserSubmit: async ({ reviewRequestId }) => {
      // 先判断是否"处于流传输中"或者是"处于搜索中"
      if (get().isStreaming) {
        return;
      }
      set((state) => {
        state.isStreaming = true;
        state.message = '';
        state.isError = false;
        state.reviewRequestId = reviewRequestId;
      });

      requestBMChatStream(
        { reviewRequestId: reviewRequestId },
        {
          onMessage(content, done) {
            if (done) {
              set((state) => {
                state.isStreaming = false;
                state.message = content;
              });
              proxyRequest({
                method: 'put',
                requestUrl: `${TEAM_REVIEW_API_URL}/review_requests/${reviewRequestId}/ai_explain`,
                requestData: {
                  aiExplain: content,
                },
              });
            } else {
              if (get().reviewRequestId !== reviewRequestId) return;
              set((state) => {
                state.message = content;
              });
            }
          },
          onError(error) {
            set((state) => {
              state.isStreaming = false;
              state.message = `出错了，${error.message}，稍后重试或联系 CodeMaker 团队。`;
              state.isError = true;
            });
          },
        },
      );
    },
  })),
);
