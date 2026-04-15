import axios, { isAxiosError } from 'axios';
import { createStandaloneToast } from '@chakra-ui/react';
import { setDefaultHeaders } from '.';
import { handleError } from './error';
import { CreateCustomToast } from '../components/CustomToast';

// TODO: 后续这部分内容迁移到 user-config.ts 中，无须额外一个 proxy
function toastError(content: string) {
  return toast({
    title: content,
    status: 'error',
    duration: 5000,
    position: 'top',
    isClosable: true,
    render: CreateCustomToast,
  });
}

function switchModelError(error: any) {
  if (isAxiosError(error)) {
    if (error.response?.status === 404) {
      // 404 是因为 office 环境的数据库找不到对应的模型，如果发现这个问题需要找后端同学确认
      toastError(`该模型不存在`);
      return Promise.reject(error);
    }
    return handleError(error);
  }
}

export const codemakerCodeManagerRequest = axios.create({
  baseURL: '/proxy/code_manager',
  timeout: 40000,
});
const { toast } = createStandaloneToast();

codemakerCodeManagerRequest.interceptors.request.use(setDefaultHeaders);
codemakerCodeManagerRequest.interceptors.response.use(
  undefined,
  switchModelError,
);

export interface CodeMakerModel {
  _id?: string;
  mapper_type?: string;
  mapper_admin?: string[];
  dep?: null | string;
  users?: string[];
  name: string;
  code: string;
  gateway: string;
  gateway_name: string;
  code_search_enable: boolean;
  code_search: string;
  code_review: string;
  code_lint: string;
  code_review_proxy: string;
  code_lint_proxy: string;
  /** true 为定制模型   */
  is_customized: boolean;
}
export async function getModelList() {
  const { data } = await codemakerCodeManagerRequest.get<{
    items: CodeMakerModel[];
    total: number;
  }>(`/user_config/mappers`);
  return data?.items || [];
}
export interface UpdateUserModelParams {
  mapper_id: string;
  mapper_type: string;
  dep: string;
  code: string;
}
export async function updateUserConfig(params: UpdateUserModelParams) {
  return await codemakerCodeManagerRequest.post('/user_config', params);
}

const codemakerOfficeRequest = axios.create();
codemakerOfficeRequest.interceptors.request.use(setDefaultHeaders);

codemakerOfficeRequest.interceptors.response.use(undefined, switchModelError);

export async function updateGateway(
  gateway: string,
  params?: UpdateUserModelParams,
) {
  const { data } = await codemakerOfficeRequest.post(
    `${gateway}/api/v1/user_config`,
    params,
  );
  return data;
}
