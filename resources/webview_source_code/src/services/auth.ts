import axios from 'axios';
import { setDefaultHeaders } from '.';
import { handleError } from './error';
import { ModelMaxTokenType } from '../store/chat-config';

export const codemakerAuthRequest = axios.create({
  timeout: 40000,
  headers: {},
});

codemakerAuthRequest.interceptors.request.use(setDefaultHeaders);
codemakerAuthRequest.interceptors.response.use(undefined, handleError);

export interface ValidateProps {
  user: string;
  gateway: string;
  gateway_name: string;
  department: string;
  department_code: string;
  code_generate_model: string;
  code_generate_model_code: string;
  code_search: string;
  code_review: string;
  code_lint: string;
  code_review_proxy: string;
  code_lint_proxy: string;
  c_unrestrict: boolean;
  chat_max_token: ModelMaxTokenType;
  codebase_chat_max_token: ModelMaxTokenType;
  recent_edit_enable: boolean;
  track_enable: boolean;
  pkg_namespace: string;
  new_apply_enable: boolean;
  codebase_compress?: boolean;
  user_info: {
    nickname: string;
    display_name: string;
  };
}

export async function validate() {
  const { data } =
    await codemakerAuthRequest.post<ValidateProps>('/proxy/validate');
  return data;
}
