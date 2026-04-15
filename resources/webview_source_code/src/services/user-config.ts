import { codemakerApiRequest } from '.';

export interface CodeManageConfig {
  // 用户配置的 model mapper id
  mapper_id: string;
  user: string;
  // 用户实际系统所使用的 model mapper id
  using_mapper_id: string;
  _id: string;
  // 用户订阅的 Plugin App, 其中 value 为 plugin app id
  subscribe_app_tools?: string[];
}

export interface UserConfig {
  code: string;
  dep: string;
  mapper_id: string;
  mapper_type: string;
  subscribe_app_tools: string[];
  user: string;
  using_mapper_id: string;
  _id: string;
}

export async function getUserConfig() {
  const { data } = await codemakerApiRequest.get<UserConfig>('/user_config');
  return data;
}

// 更新用户订阅的 Plugin App 列表
export async function subscribePluginApp(toolIds: string[]) {
  const data = {
    subscribe_app_tools: toolIds,
  };
  const { data: latestUserConfig } = await codemakerApiRequest.post<UserConfig>(
    '/user_config:subscribe_app_tool',
    data,
  );
  return latestUserConfig;
}
