import axios from 'axios';
import { ChatMessage, setDefaultHeaders, ChatPromptBody } from '.';
import { ChatSession, ChatType } from '../store/chat';
import { handleError } from './error';
import { ChatMask } from '../store/config';
import { CodeBaseFeedbackDetail } from '../routes/CodeChat/CodeBaseFeedback';
import { TokenUsage } from '../types/chat';
import { ChatModel } from './chatModel';
import { getAIGWModel } from '../store/chat-config';

export const codemakerChatHistoryRequest = axios.create({
  baseURL: '/proxy/gpt/u5_chat',
  timeout: 40000,
});

export const codemakderChatGptRequest = axios.create({
  baseURL: '/proxy/gpt/gpt/',
  timeout: 180000,
});

codemakerChatHistoryRequest.interceptors.request.use(setDefaultHeaders);
codemakerChatHistoryRequest.interceptors.response.use(undefined, handleError);
codemakderChatGptRequest.interceptors.request.use(setDefaultHeaders);
codemakderChatGptRequest.interceptors.response.use(undefined, handleError);

export type ChatHistoryGetterParams = Partial<{
  _page: number;
  _num: number;
  _sort_by: string;
  _exclude: string;
  'metadata.creator': string;
  topic_content?: string;
}>;

export async function getHistories(
  params: ChatHistoryGetterParams,
  signal?: AbortSignal,
) {
  const { data } = await codemakerChatHistoryRequest.get<{
    items: ChatSession[];
    total: number;
  }>('/chat_histories', {
    params,
    signal,
  });
  return data;
}

export async function preloadSessionData(id: string) {
  const { data } = await axios.get<ChatSession>(
    '/proxy/gpt/u5_chat/chat_histories/' + id,
  );
  return data;
}

export async function getSessionData(id: string) {
  const { data } = await codemakerChatHistoryRequest.get<ChatSession>(
    '/chat_histories/' + id,
  );
  return data;
}

interface ChatHistoryData {
  messages: ChatMessage[];
  mask?: ChatMask;
  model?: string;
}

interface ChatHistoryPostBody {
  topic: string;
  chat_type: ChatType;
  data: ChatHistoryData;
}

export async function createSession(postData: ChatHistoryPostBody) {
  const { data } = await codemakerChatHistoryRequest.post<ChatSession>(
    '/chat_histories',
    postData,
  );
  return data;
}

export async function removeSession(id: string) {
  return await codemakerChatHistoryRequest.delete(`/chat_histories/${id}`);
}

export async function updateSession(
  data: Pick<ChatSession, '_id' | 'topic' | 'data'>,
) {
  return await codemakerChatHistoryRequest.put(
    `/chat_histories/${data._id}`,
    data,
  );
}
export async function updateSessionTopic(
  id: string, topic: string,
) {
  return await codemakerChatHistoryRequest.put(
    `/chat_histories/${id}`,
    { topic: topic },
  );
}

export async function countTokens(
  text: string,
  model: ChatModel,
  signal?: AbortSignal,
) {
  if (!text) return 0
  let sendModel = getAIGWModel(model);
  switch (model) {
    case ChatModel.DEEPSEEK:
    case ChatModel.DeepseekReasoner0120:
    case ChatModel.DeepseekReasonerDistilled0206:
    case ChatModel.Gemini25:
    case ChatModel.Gemini3Pro:
      sendModel = ChatModel.Gpt4;
      break;
    case ChatModel.Gpt41:
    case ChatModel.GPT5:
    case ChatModel.GPT51:
    case ChatModel.GPT51Codex:
      sendModel = ChatModel.GPT4o;
      break
  }
  const params: Record<string, string> = {
    model: sendModel,
    text,
  };

  const result = await codemakderChatGptRequest.post<{ num_tokens: number }>(
    '/calculate_tokens',
    params,
    {
      signal,
    },
  );
  return result?.data?.num_tokens || 0;
}

/**
 *
 * @returns 返回 true 就是 gpt4 达到了免费上限
 */
export async function checkGPT4QuotaAvailability() {
  const params = {
    model: ChatModel.Gpt4,
    backend: 'azure',
  };
  const { data } = await codemakderChatGptRequest.get<{
    azure: {
      [ChatModel.Gpt4]: boolean;
    };
  }>('/check_limit', {
    params,
  });
  return data?.azure[ChatModel.Gpt4];
}

interface GPTResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
  usage?: TokenUsage
}
export async function fetchGptResponse(event: string, params: ChatPromptBody) {
  const { data } = await codemakderChatGptRequest.post<GPTResponse>(
    `/text_chat/${event}`,
    params,
  );
  return data;
}

export async function fetchCompressResponse(params: ChatPromptBody) {
  const { data } = await codemakerChatHistoryRequest.post<GPTResponse>(
    `/codebase_agent_chat`,
    params,
  );
  return data;
}

export async function uploadImg(params: FormData) {
  const { data } = await codemakerChatHistoryRequest.post<{
    url: string;
    message: string;
  }>('/upload_img', params);
  return data;
}

export async function uploadMessageFeedback(params: CodeBaseFeedbackDetail) {
  if (params?.imgUrls?.length) {
    params.feedback += `\n\n用户反馈图\n ${params.imgUrls.map((url) => `![image](${url})`).join('\n')}`;
  }
  codemakerChatHistoryRequest.post('/chat_feedback', params);
}
