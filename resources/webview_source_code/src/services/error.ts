import { isAxiosError } from 'axios';
import { BroadcastActions } from '../PostMessageProvider';
import { CreateCustomToast } from '../components/CustomToast';
import userReporter, { ReportErrorType } from '../utils/report';
import { createDebouncedToast } from '../components/CustomToast/debounceToast';
import { getErrorMessage } from '../utils';
import { UserEvent } from '../types/report';
import EventBus, { EBusEvent } from '../utils/eventbus';

// 超时或网络问题
const NETWORK_ERROR = ['ECONNABORTED', 'ETIMEDOUT'];

// 不用提示的错误，例如取消请求
const IGNORE_ERROR = ['ERR_CANCELED'];

export const ERROR_MESSAGE = {
  NETWORK: '请求超时，请检查网络连接',
  WHITE_LIST:
    '当前网络环境无法使用插件服务，请尝试关掉代理软件',
  LOGIN: '登录信息失效，请重新登录，5秒后将跳转登录页',
  FORBIDDEN: '可尝试重启编辑器',
  COMMON: '请求异常，请重试',
};

const debouncedToast = createDebouncedToast();

export function toastError(content: string) {
  return debouncedToast({
    title: content,
    status: 'error',
    duration: 5000,
    position: 'top',
    isClosable: true,
    render: CreateCustomToast,
  });
}

export function handleError(error: any, ) {
  const _config = error.config;
  const message = `${_config?.method} ${_config?.url} ${error.code}, ${error.message}`;
  userReporter.report({
    event: UserEvent.WEB_ERROR,
    extends: {
      error_type: ReportErrorType.Request,
      error_message: message,
      error_stack: error.stack,
    },
  });
  const displayErrorMessage = getErrorMessage(error);
  if (isAxiosError(error)) {
    if (NETWORK_ERROR.includes(error.code!)) {
      toastError(ERROR_MESSAGE.NETWORK);
    } else if (error.response?.status === 403) {
      if (
        typeof error.response.data === 'string' &&
        error.response.statusText === 'Forbidden'
      ) {
        toastError(ERROR_MESSAGE.WHITE_LIST);
      } else if (
        error?.response?.data?.extra?.code === 30002 ||
        error?.response?.data?.msg === 'token is empty' ||
        error?.response?.data?.detail?.msg?.code === 30003
      ) {
        window.parent.postMessage(
          {
            type: BroadcastActions.GET_INIT_DATA,
            data: {
              isExpired: true,
            },
          },
          '*',
        );
        debouncedToast({
          title: '登陆信息更新，请重试',
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      } else {
        toastError(`错误信息：${displayErrorMessage}, ${ERROR_MESSAGE.FORBIDDEN}`);
      }
    } else if (error.response?.status === 401) {
      if (error.response?.data?.msg === 'token expired') {
        window.parent.postMessage(
          {
            type: BroadcastActions.GET_INIT_DATA,
            data: {
              isExpired: true,
            },
          },
          '*',
        );
        debouncedToast({
          title: '登陆信息更新，请重试',
          status: 'info',
          duration: 3000,
          isClosable: true,
          position: 'top',
        });
      } else {
        toastError(`错误信息：${displayErrorMessage}, ${ERROR_MESSAGE.FORBIDDEN}`);
      }
    } else if (error.response?.status === 413 && error.config?.method === 'put' && error.config?.baseURL === '/proxy/gpt/chat') {
      /** 自定义消息错误 */
      EventBus.instance.dispatch(EBusEvent.Exceed_Session_Length)
      return
    } else if (IGNORE_ERROR.includes(error.code!)) {
      return;
    } else {
      toastError(`错误信息：${displayErrorMessage}, ${ERROR_MESSAGE.COMMON}`);
    }
  }
  return Promise.reject(error);
}
