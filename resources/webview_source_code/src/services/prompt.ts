import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { setDefaultHeaders } from '.';
import { VariableType } from '../store/mask';
import { FileMeta } from '../components/WorkspaceFileSelect/WorkspaceFileSelect';
import { ChatModel } from './chatModel';

export const codemakerPromptRequest = axios.create({
  baseURL: '/proxy/prompt/api/v1',
  timeout: 40000,
});

codemakerPromptRequest.interceptors.request.use(setDefaultHeaders);

export async function initUser() {
  return await codemakerPromptRequest.post('/categories:init_user');
}

const CODEMAKER_CLASSIFY = 'Y3Maker';

export enum PromptCategoryType {
  // 该 type 不存在于接口中，当 is_global 为 true 时，表示该通用类
  _CodeMaker = '_codemaker',
  Project = 'project',
  User = 'user',
  Plugin = 'plugin',
  MCP = 'mcp',
  CodeWiki = 'codewiki',
  Skill = 'skills',
}

export const promptCategoryNameMap = {
  [PromptCategoryType._CodeMaker]: '通用快捷指令',
  [PromptCategoryType.Project]: '项目快捷指令',
  [PromptCategoryType.User]: '我的自定义指令',
  [PromptCategoryType.Plugin]: '我订阅的插件指令',
  [PromptCategoryType.MCP]: 'MCP',
  [PromptCategoryType.CodeWiki]: 'CodeWiki',
  [PromptCategoryType.Skill]: 'Skills',
};

export const maskTypeNameMap = {
  [PromptCategoryType._CodeMaker]: '系统聊天模式',
  [PromptCategoryType.Project]: '团队聊天模式',
  [PromptCategoryType.User]: '我的聊天模式',
  [PromptCategoryType.Plugin]: '',
  [PromptCategoryType.MCP]: 'MCP',
  [PromptCategoryType.CodeWiki]: '',
  [PromptCategoryType.Skill]: 'Skills',
};

export interface PromptCategory {
  classify: typeof CODEMAKER_CLASSIFY;
  code: string;
  _id: string;
  // true 为通用分类
  is_global: boolean;
  project: string;
  type: PromptCategoryType;
  description: string;
  name: string;
}

export interface Prompt {
  category_id?: string;
  description?: string;
  name: string;
  prompt: string;
  _id: string;
  type?: PromptCategoryType;
  labels?: string[];
  // 由于 prompt 平台并没有此类字段，只有 extra parameters 存任何自定义信息
  extra_parameters?: Partial<{
    model: ChatModel;
    presence_penalty: number;
    temperature: number;
    max_tokens: number;
    [VariableType.Knowledge]: {
      code: string;
      description: string;
    };
    [VariableType.File]: {
      paths: FileMeta[];
      description: string;
    };
    [VariableType.Codebase]: {
      code: string;
      description: string;
    };
  }>;
  metadata?: {
    creator: string;
  };
  app_shortcut?: PromptAppShortcut;
}
export interface PromptAppShortcut {
  name: string;
  tip: string;
}

export async function getPromptCategories(params?: Partial<PromptCategory>) {
  return params ? [] : [];
}

/**
 * 获取某个 category 下所有 prompt
 * 如果使用 category code 获取，则 id 中需要带上 `@` 前缀
 * @param id prompt category id
 * @returns
 */
export async function getPrompts(id: string, extra?: Record<string, unknown>) {
  const { data } = await codemakerPromptRequest.get<{
    items: Prompt[];
    total: number;
  }>(`/categories/${id}/prompts`, {
    params: {
      // TODO: 暂时请求前 200 条 prompt
      _num: 200,
      ...extra,
    },
  });
  return data.items;
}

export async function getUserCategoryId() {
  const username = useAuthStore.getState().username;
  const code = `root.${username}.codemaker`;
  const { data } = await codemakerPromptRequest.get<{ _id: string }>(
    `/categories/@${code}`,
  );
  return data._id;
}

export async function getUserPrompts() {
  return [];
}

export async function getSystemPrompts() {
  return [];
}

export async function getProjectPrompts() {
  const params: Partial<PromptCategory> = {
    is_global: false,
    type: PromptCategoryType.Project,
  };
  const data = await getPromptCategories(params);
  const promises = data.map(async ({ _id }) => getPrompts(_id));
  const prompts = await Promise.all(promises);
  return prompts.flat();
}

export const MASK_LABEL = 'mask';
export async function getMaskPrompts() {
  const username = useAuthStore.getState().username;
  const code = `@root.${username}.codemaker`;
  return await getPrompts(code, {
    labels: MASK_LABEL,
  });
}
export async function getProjectMaskPrompts() {
  const params: Partial<PromptCategory> = {
    is_global: false,
    type: PromptCategoryType.Project,
  };
  const data = await getPromptCategories(params);
  const promises = data.map(async ({ _id }) =>
    getPrompts(_id, {
      labels: MASK_LABEL,
    }),
  );
  const prompts = await Promise.all(promises);
  return prompts.flat();
}

export async function createPrompt(
  category_id: string,
  name: string,
  prompt: string,
  extra?: Record<string, unknown>,
) {
  const data = { name, prompt, ...extra };
  return await codemakerPromptRequest.post(
    `/categories/${category_id}/prompts`,
    data,
  );
}

export async function removePrompt(category_id: string, prompt_id: string) {
  return await codemakerPromptRequest.delete(
    `/categories/${category_id}/prompts/${prompt_id}`,
  );
}

export async function updatePrompt(
  category_id: string,
  prompt_id: string,
  name: string,
  prompt: string,
  extra?: Record<string, unknown>,
) {
  const data = { name, prompt, ...extra };
  const { data: result } = await codemakerPromptRequest.put<Prompt>(
    `/categories/${category_id}/prompts/${prompt_id}`,
    data,
  );
  return result;
}
