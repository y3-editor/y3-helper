import axios from 'axios';
import { ChatMessage, setDefaultHeaders } from '.';
import { AttachType } from '../store/attaches';
import { useDocsetStore } from '../store/docset';
import { handleError } from './error';
import { OFFICE_BM_API_URL } from '../routes/CodeCoverage/const';

// 对接 BrainMaker 接口和业务
export const codemakerDocsetsRequest = axios.create({
  baseURL: '/proxy/bm',
  timeout: 40000,
});

// 对接 BrainMaker 接口和业务
export const officeDocsetsRequest = axios.create({
  baseURL: `${OFFICE_BM_API_URL}/proxy/bm/api/v1`,
  timeout: 40000,
});

codemakerDocsetsRequest.interceptors.request.use(setDefaultHeaders);
codemakerDocsetsRequest.interceptors.response.use(undefined, handleError);

officeDocsetsRequest.interceptors.request.use(setDefaultHeaders);
// TODO: 需要静默，暂时不做错误处理，后续需要支持配置不弹错误消息
// officeDocsetsRequest.interceptors.response.use(undefined, handleError);

export interface ChatBMPromptBody {
  input: string;
  chat_model?: string;
  chat_params?: {
    temperature: number;
  };
  topk?: number;
  stream_response?: boolean;
  use_dataset_config?: boolean;
  folder_names?: string[];
  messages?: ChatMessage[];
  shorten_bm_image_url?: boolean;
}

export interface MultipleChatBMPromptBody {
  stream_response: boolean;
  query: string;
  mode: string;
  inputs: {
    docset_list: string;
    input: string;
    message: string;
  };
}
export interface KnowledgeAugmentationBMPromptBody {
  stream_response: boolean;
  query: string;
  mode: string;
  inputs: {
    docset_list?: string;
    input?: string;
    message: string;
  };
}

export enum DocsetType {
  _BrainMaker = '_brainmaker',
  Project = 'project',
  User = 'user',
}

export const DocsetTypeNameMap = {
  [DocsetType._BrainMaker]: '系统',
  [DocsetType.Project]: '项目',
  [DocsetType.User]: '我的',
};

export interface DocsetFile {
  _id: string;
  name: string;
}

export interface DocsetChatConfig {
  chat_mode: {
    // silent 为 false 表示使用总结模式，会返回检索内容+prompt 通过 gpt chat 回复内容。
    // silent 为 true 表示普通模式，仅返回检索内容。
    silent: boolean;
    simplify_input: false;
    chat_model: string;
    params: {
      temperature: number;
    };
    // 是否为流式
    stream_response: boolean;
    external_knowledge: boolean;
    is_link: boolean;
    use_messages: boolean;
    is_diversion: boolean;
  };
  search_mode: {
    smart: boolean;
    topk: number;
  };
  prompt_id: string;
  simplify_prompt_id: string;
}

export interface Docset {
  _id: string;
  code: string;
  name: string;
  is_public: boolean;
  is_project_public: boolean;
  creator: string;
  project: string;
  type: DocsetType;
  files?: DocsetFile[];
  attachType: AttachType;
  chat_config: DocsetChatConfig;
  predetermined_questions: string[];
  tags: string[];
  folder_names: string[];
  folders?: DocsetFolder[];
  children?: DocsetOptions[];
  parent?: DocsetItem[];
  env?: string;
}

export interface BaseDocsetItem {
  _id: string;
  label: string;
  name: string;
  tags: string[];
  parent?: DocsetItem[];
  docsetType: DocsetType;
}

export enum DocsetType {
  Docset = 'docset',
  Folder = 'folder',
  Label = 'label',
}
export interface DocsetOptions extends Docset, BaseDocsetItem {
  children?: DocsetOptions[];
  parent?: DocsetItem[];
  docsetType: DocsetType;
}

export interface DocsetFile extends BaseDocsetItem {
  children: DocsetOptions[];
  docsetType: DocsetType;
}

export type DocsetItem = DocsetOptions | DocsetFile;

export interface Docsets {
  attachType: AttachType;
  docsets: Docset[];
}

export type DocsetMeta = Pick<Docset, '_id' | 'name' | 'project' | 'code'>;

export interface DocsetRequestParams {
  exclude_files: boolean;
}

const CODEMAKER_DOCSET_TAG = 'codemaker';
export async function getDocsets(params?: Partial<DocsetRequestParams>) {
  const { data } = await codemakerDocsetsRequest.get<{
    items: Docset[];
    total: number;
  }>(`/docsets`, {
    params: {
      _all: true,
      exclude_files: true,
      tags: CODEMAKER_DOCSET_TAG,
      ...params,
    },
    headers: {
      'X-Auth-Project': '_demo',
    },
  });
  const itemsWithEnv = data.items.map((item) => ({
    ...item,
    env: 'idc' as const,
  }));

  return itemsWithEnv;
}

export async function getOfficeDocsets(params?: Partial<DocsetRequestParams>) {
  const { data } = await officeDocsetsRequest.get<{
    items: Docset[];
    total: number;
  }>(`/docsets`, {
    params: {
      _all: true,
      exclude_files: true,
      tags: CODEMAKER_DOCSET_TAG,
      ...params,
    },
    headers: {
      'X-Auth-Project': '_demo',
    },
    timeout: 3000,
  });
  const itemsWithEnv = data.items.map((item) => ({
    ...item,
    env: 'office' as const,
  }));

  return itemsWithEnv;
}

export async function getDocsetRawFile(
  code: string,
  project: string,
  fileId: string,
) {
  const { data } = await codemakerDocsetsRequest.get<string>(
    `/docsets/@${code}/files/${fileId}/raw_file`,
    {
      headers: {
        'X-Auth-Project': project,
      },
    },
  );
  return data;
}

export interface DocsetSearchSegmentContext {
  text: string;
  meta: {
    digest_id: string;
    token: number;
    anchor: string;
    filename: string;
  };
  score: number;
  id: number;
}

// 根据用户输入内容，查询某个文档集中的资料片段
export async function getDocsetSearchSegment(code: string, userInput: string) {
  const docset = useDocsetStore.getState().docsets.get(code);
  if (!docset) {
    return;
  }
  const { chat_mode, search_mode } = docset.chat_config;
  const payload = {
    input: userInput,
    chat_model: chat_mode.chat_model,
    chat_params: {
      temperature: chat_mode.params.temperature,
    },
    topk: search_mode.topk,
    silent: true,
    use_dataset_config: false,
    simplify_input: chat_mode.simplify_input,
    smart: search_mode.smart,
    stream_response: false,
    external_knowledge: chat_mode.external_knowledge,
    is_link: chat_mode.is_link,
    is_diversion: chat_mode.is_diversion,
    source: 'ack',
    shorten_bm_image_url: false,
  };
  const { data } = await codemakerDocsetsRequest.post<{
    contexts: DocsetSearchSegmentContext[];
  }>(`/docsets/@${code}:chat`, payload, {
    headers: {
      'X-Auth-Project': docset.project,
    },
  });
  return data.contexts;
}

// 反馈类型, 正向反馈:1, 负向反馈:0
// BM文档：https://github.com/user/codemaker
export enum FeedbackType {
  down,
  up,
}

/**
 *
 * @param docsetId
 * @param feedback
 * @returns
 */
export async function sendBMDocsetFeedback(
  docsetCode: string,
  searchRecordId: string,
  feedback: FeedbackType,
  username: string,
) {
  codemakerDocsetsRequest.post(
    `/docsets/@${docsetCode}/search_records/${searchRecordId}/feedbacks`,
    {
      dataset: 'docset',
      search_record_id: searchRecordId,
      params: {
        silent: true,
      },
      type: feedback,
      username: username,
    },
    {
      headers: {
        'X-Auth-Project': 'codemaker',
      },
    },
  );
}

interface DocsetFolder {
  name: string;
  description: string;
  is_public: boolean;
  is_project_public: boolean;
  groups: string[];
  users: string[];
  is_inherit_docset_auth: boolean;
  _id: string;
  docset_id: string;
  creator: string;
  create_time: number;
  update_time: number;
  is_default: boolean;
  order_num: number;
}
export async function getDocsetFoldersReq(id: string, project: string) {
  const { data } = await codemakerDocsetsRequest.get<{
    items: DocsetFolder[];
    total: number;
  }>(`/docsets/${id}/folders`, {
    headers: {
      'X-Auth-Project': project,
    },
  });
  return data;
}
