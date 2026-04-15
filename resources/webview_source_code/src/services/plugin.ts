import axios from 'axios';
import { ChatMessage, setDefaultHeaders } from '.';
import { EditorFileState } from '../store/editor';
import { handleError } from './error';

export const codemakerPluginRequest = axios.create({
  baseURL: '/proxy/gpt/app_tool_config',
  timeout: 40000,
});

codemakerPluginRequest.interceptors.request.use(setDefaultHeaders);
codemakerPluginRequest.interceptors.response.use(undefined, handleError);

export enum PluginActionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESS = 'SUCCESS',
  ABORTED = 'ABORTED',
  FAILED = 'FAILED',
  NOT_FOUND = 'NOT_FOUND',
}

export enum PluginAction {
  Create = 'create',
  Insert = 'insert',
  Chat = 'chat',
}

export type PluginRecieveData = {
  task_id: string;
  status: PluginActionStatus;
  message: string;
};
export interface PluginAppShortcutParams {
  id: string;
  title: string;
  type: string;
  default_value?: string;
  enum?: string[];
  description: string;
  dependencies?: PluginAppShortcutParamDep[];
}
interface PluginAppShortcutParamDep {
  field: string;
  mapping: Record<string, { enum: string[] }>;
}
export interface PluginAppShortcut {
  _id: string;
  name: string;
  action: PluginAction;
  description: string;
  tip: string;
  attachs?: unknown;
  loading_msg?: string;
  success_msg?: string;
  auto_trigger?: boolean;
  params: PluginAppShortcutParams[];
}

export interface PluginApp {
  _id: string;
  app_description: string;
  app_id: string;
  app_name: string;
  app_settings: unknown;
  app_version: string;
  // 应用提供者
  app_provider: string;
  // 应用快捷键
  app_shortcuts: PluginAppShortcut[];
  app_doc: string;
  url: string;
  name?: string;
}

export type PluginAppRunner = Omit<PluginApp, 'app_shortcuts'> & {
  app_shortcut: PluginAppShortcut;
};

export async function getPlugins(): Promise<any> {
  return [];
}

export interface PluginAppRunnerParams extends Partial<EditorFileState> {
  _id?: string;
  app_id: string;
  action: {
    name: PluginAction;
    params?: Record<string, unknown>;
  };
  app_settings: unknown;
  description: string;
  reference: {
    docsets?: []; // 知识库片段
    codebase?: []; // 代码库片段
    files?: Array<{
      path: string;
      content: string;
      file_name: string;
    }>; // 本地文件
    code_snippets?: [];
  };
  extends?: unknown;
  usage?: unknown;
  task_id?: string;
  shortcut: {
    action: PluginAction;
    name: string;
  };
  url: string;
  messages?: ChatMessage[];
}
