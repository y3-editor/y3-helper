import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';
import { useExtensionStore } from '../store/extension';
import { DocsetMeta } from './docsets';
import { SearchData } from '../store/searchResult';
import { ChatAttachStore, CodebaseChatMode, FileItem } from '../store/chat';
import { handleError } from './error';
import { createDebouncedToast } from '../components/CustomToast/debounceToast';
import { PluginAppRunner } from './plugin';
import { Prompt, PromptCategoryType } from './prompt';
import { PrePromptEvent } from '../utils/report';
import { ChatRole } from '../types/chat';
import { Tool } from '../store/workspace';

import type { CompressionMetadata } from '../types/contextCompression';

// message 状态
export enum ChatStatus {
  Pending = 'pending',
  Streaming = 'streaming',
  Fulfilled = 'fulfilled',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum ChatMessageAttachType {
  Docset = 'docset',
  CodeBase = 'codebase',
  File = 'file',
  Folder = 'folder',
  NetworkModel = 'networkModel',
  KnowledgeAugmentation = 'knowledgeAugmentation',
  MultiAttachment = 'multiAttachment',
  ImageUrl = 'imageUrl',
}
export interface CodeBaseSearchResult extends Omit<SearchData, 'code'> {
  id: string;
}
export interface CodeBaseMeta {
  collection: string;
  searchResult: CodeBaseSearchResult[];
  type: ChatMessageAttachType;
}

export interface NetworkModelAttach {
  type: ChatMessageAttachType;
  model: string;
}
export interface KnowledgeAugmentationModelAttach {
  type: ChatMessageAttachType;
}

export interface MultipleAttach {
  type: ChatMessageAttachType;
  attachs: ChatAttachStore['attachs'];
}

export interface DocsetMetaWithType extends DocsetMeta {
  type: ChatMessageAttachType;
}

export interface AttachFile
  extends Pick<FileItem, 'fileName' | 'content' | 'path'> {
  type: ChatMessageAttachType;
}
export enum ChatMessageContent {
  Text = 'text',
  ImageUrl = 'image_url',
}
interface ChatMessageContentType {
  type: ChatMessageContent;
}

export interface ChatMessageContentText extends ChatMessageContentType {
  type: ChatMessageContent.Text;
  text: string;
  cache_control?: {
    type: "ephemeral";
  };
}
export interface ChatMessageContentImageUrl extends ChatMessageContentType {
  type: ChatMessageContent.ImageUrl;
  image_url: {
    url: string;
  };
}

export interface WebSearch {
  no: number;
  content?: string;
  title: string;
  url: string;
  web_icon?: string;
}

export interface DouBaoWebSearch {
  url: string;
  title: string;
  summary: string;
  site_name: string;
  publish_time: string;
  cover_image: {
    url: string;
  };
}

export interface BMSearch {
  /** 标记是否需要替换引用链接 */
  bmMark: boolean;
  contexts: BMSearchContext[];
  /** 思考过程内容 */
  reasoningContent?: string;
}
export interface GeminiWebSearch {
  web: {
    title: string;
    uri: string;
  };
}

export interface BMSearchContext {
  attributes: {
    filename: string;
    url: string;
  };
}

export type ChatMessageContentUnion =
  | ChatMessageContentText
  | ChatMessageContentImageUrl;

export interface ToolCall {
  id: string;
  function: {
    arguments: string | null;
    name: string;
  };
  type: string;
}

export interface ToolResult {
  path: string;
  content: string;
  isError?: boolean;
  isLpc?: boolean;
  extra?: {
    terminalStatus?: string;
    terminalLog?: string;
    hasShellIntegration?: boolean;
    isLargeFile?: boolean; // 判定是否为大文件
  }
}

export type ToolResultExtraWithSource = NonNullable<ToolResult['extra']> & {
  source?: string;
};

export type ToolResultWithSource = Omit<ToolResult, 'extra'> & {
  extra?: ToolResultExtraWithSource;
};

export interface ToolCallResultPayload {
  tool_name?: string;
  tool_id?: string;
  tool_result?: ToolResultWithSource;
  extra?: Record<string, any>;
}
interface SystemPrompt extends Prompt {
  codeBlock?: string;
}
export enum ChatFeedbackType {
  UpVote = 'up_vote',
  DownVote = 'down_vote',
}

export type ToolResultItem = NonNullable<ChatMessage['tool_result']>[string];
export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string | ChatMessageContentUnion[];
  tool_calls?: ToolCall[];
  name?: string;
  streaming?: boolean;
  processing?: boolean;
  attachs?:
  | DocsetMetaWithType[]
  | CodeBaseMeta[]
  | AttachFile[]
  | NetworkModelAttach[]
  | MultipleAttach[]
  | KnowledgeAugmentationModelAttach[];
  pluginApp?: PluginAppRunner;
  mcpPrompt?: {
    serverName: string;
    promptName: string;
    title?: string;
  };
  skillPrompt?: {
    skillName: string;
    title?: string;
    source?: string;
  };
  // TODO: 内置的 Prompt 配置, 先临时和 attachs 一样挂在这里
  systemPrompt?: SystemPrompt;
  loading?: boolean;
  // TODO: Commit Msg 特殊展示的字段，后续不需要即可删除
  commitMsgPayload?: {
    short: boolean;
  };
  webSearch?: GeminiWebSearch[];
  bmSearch?: BMSearchContext[];
  bmSearchSourcesIndex?: number[];
  // 废弃属性，统一使用 reasoning_content 代替
  reasoningContent?: string;
  codeContent?: string;
  bmMark?: boolean;
  response?: {
    [propName: string]: boolean;
  };
  // TODO: 后面需要优化下，可以直接从 Tool 消息中后获取
  tool_result?: {
    [propName: string]: ToolResult
  };
  tool_call_id?: string;
  total_tokens?: number;
  // 用于避免 Claude 出错，添加的隐藏消息
  hidden?: boolean;
  // 表示当前 QA 对所用tokens
  group_tokens?: number;
  completion_tokens?: number;
  // 用于判断是否需要自动确认路径
  autoCompleteAdress?: boolean;
  // 原始prompt
  _originalRequestData?: {
    content?: string;
    originPrompt?: string;
    attachs?: any;
    options?: {
      event?: PrePromptEvent | string;
      ntesTraceId?: string;
    };
    appliedPaths?: string[] // 已应用文件修改的路径
  };
  shortcutPrompt?: { // 快捷指令
    content: string
    title: string
    _id: string
    type: PromptCategoryType
  }
  // 反馈，用于前端记录用户有没有点赞/踩，up_vote/down_vote
  feedback?: ChatFeedbackType;
  // claude 3.7 thinking 模式 需要带上的字段
  reasoning_content?: string;
  thinking_signature?: string;
  redacted_thinking?: string;
  finalResult?: string;
  checkPointFiles?: {
    [propName: string]: {
      content: string;
      filePath: string;
      isCreateFile?: boolean;
    };
  };
  revertedFiles?: {
    [propName: string]: {
      content: string;
      filePath: string;
    };
  };
  cache_control?: {
    type: "ephemeral";
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  truncateStart?: boolean;
  reuseStart?: boolean;

  // 压缩相关字段
  isCompressed?: boolean;
  isCompressionSummary?: boolean;
  compressionMetadata?: CompressionMetadata;
  isOutdatedTokens?: boolean
  isAutoCompressingMessage?: boolean
  /** updateConsumedTokens 调用后的会话累计 token 快照，用于计算每轮增量 */
  consumedTokensTotal?: number;

  rules?: {
    name: string;
    filePath: string;
  }[];

  specPrompt?: string;
  /** 消息创建时间戳（ms）：user 消息为发送时间，assistant 消息为回复完成时间 */
  createdAt?: number;
}

// interface WebSearchType {
//   type: string;
// }

export interface ChatPromptBody {
  // chat 主体
  messages: ChatMessage[];
  // 选择的 ai 模型
  model: string;
  // 最大 token 数
  max_tokens?: number;
  // 阈值
  temperature?: number;
  backend?: string;
  top_p?: number;
  n?: number;
  stop?: [];
  presence_penalty?: number;
  frequencyPenalty?: number;
  logitBias?: unknown;
  timeout?: number;
  app_id?: string;
  app_key?: string;
  stream?: boolean;
  tool_choice?: string;
  tools?: Tool[];
  prompt_construct?: {
    mode?: string;
    params: Record<string, unknown>;
  };
  // google gemini2.0 模型携带参数
  extra_body?: Record<string, unknown>;

  vertexai?: {
    thinking_config?: {
      "thinking_budget"?: number
    }
  }

  codebase_chat_mode?: CodebaseChatMode;
  base_url?: string;
}

export const codemakerChatRequest = axios.create({
  baseURL: '/proxy/gpt/hangyan',
  timeout: 40000,
  headers: {},
});

codemakerChatRequest.interceptors.request.use(setDefaultHeaders);
codemakerChatRequest.interceptors.response.use(undefined, handleError);

export const codemakerApiRequest = axios.create({
  baseURL: '/proxy/api',
  timeout: 40000,
  headers: {},
});

codemakerApiRequest.interceptors.request.use(setDefaultHeaders);
codemakerApiRequest.interceptors.response.use(undefined, handleError);

export const devcloudOfficeRequest = axios.create({
  baseURL: '/proxy/devcloud_office',
  timeout: 40000,
  headers: {},
});

devcloudOfficeRequest.interceptors.request.use(setDefaultHeaders);
devcloudOfficeRequest.interceptors.response.use(undefined, handleError);


export const originalCodeMakerApi = axios.create({
  baseURL: '/proxy/cm',
  timeout: 40000,
  headers: {},
});

originalCodeMakerApi.interceptors.request.use(setDefaultHeaders);
originalCodeMakerApi.interceptors.response.use(undefined, handleError);



function applyDefaultHeaders(
  request: InternalAxiosRequestConfig<unknown>,
) {
  request.headers['X-Access-Token'] = useAuthStore.getState().accessToken;
  request.headers['X-Auth-User'] = useAuthStore.getState().username;
  request.headers['codemaker-version'] =
    useExtensionStore.getState().codeMakerVersion || '(empty)';
  request.headers['ide'] = useExtensionStore.getState().IDE || '(empty)';
  try {
    request.headers['department-code'] = encodeURI(
      useAuthStore.getState().authExtends.department_code,
    );
  } catch (error) {
    console.error(error);
  }
  request.headers['code-generate-model-code'] =
    useExtensionStore.getState().generateModelCode;
  request.headers['entrance'] = useExtensionStore.getState().entrance;
  return request;
}

const debouncedToast = createDebouncedToast();

export function setDefaultHeaders(
  request: InternalAxiosRequestConfig<unknown>,
) {
  const { accessToken, username } = useAuthStore.getState();
  if (!accessToken) {
    debouncedToast({
      title: '请求失败，未能获取到登录状态',
      status: 'error',
      duration: 3000,
    });
    console.error('setDefaultHeaders 未能获取到登录状态: 缺少 accessToken');
    return Promise.reject(
      new axios.Cancel('请求失败，未能获取到登录状态'),
    );
  }
  if (!username) {
    console.warn('setDefaultHeaders 未能获取到登录状态: 缺少 username');
  }
  return applyDefaultHeaders(request);
}

export function setDefaultHeadersWithoutAuth(
  request: InternalAxiosRequestConfig<unknown>,
) {
  return applyDefaultHeaders(request);
}
