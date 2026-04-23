import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';

import { SubscribeActions, BroadcastActions } from '../PostMessageProvider';
import { CreateCustomToast } from '../components/CustomToast';
import { nanoid } from 'nanoid';
import { ERROR_MESSAGE } from './error';
import { useAuthStore } from '../store/auth';
import { useExtensionStore } from '../store/extension';
import { createDebouncedToast } from '../components/CustomToast/debounceToast';
import { generateTraceId } from '../utils/trace';
import { getErrorMessage } from '../utils';
const debouncedToast = createDebouncedToast();

const errorCache = new Map<string, number>();

function toastError(content: string) {
  const TOAST_LIFETIME = 5000;
  const now = Date.now();

  const coreMessage = content.replace(/，traceId:.*$/, '').trim();
  for (const [msg, expireTime] of errorCache.entries()) {
    if (now > expireTime) {
      errorCache.delete(msg);
    }
  }

  // 如果相同的核心错误消息还在 toast 生命周期内，直接跳过
  if (errorCache.has(coreMessage)) {
    console.log('[Toast] 检测到重复错误提示，已跳过:', coreMessage);
    return;
  }

  errorCache.set(coreMessage, now + TOAST_LIFETIME);
  return debouncedToast({
    title: content,
    status: 'error',
    duration: TOAST_LIFETIME,
    position: 'top',
    isClosable: true,
    isCopyable: true,
    enableHtml: true,
    render: CreateCustomToast,
  });
}

function parseJSONSafely(data: string | JSON) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  return data;
}

enum RequestStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
}

const DEFAULT_OPTIONS = {
  errorToast: true,
};

export async function proxyRequest(
  data: {
    requestUrl: string;
    requestData?: any;
    method?: string;
    requestHeaders?: any;
  },
  timeout = 10000,
  customErrorMsg?: boolean,
  abortSignal?: AbortSignal,
  options: typeof DEFAULT_OPTIONS = DEFAULT_OPTIONS
) {
  const traceId = generateTraceId();
  const {
    method = 'post',
    requestUrl,
    requestData,
    requestHeaders = {},
  } = data;

  const defaultHeaders = {
    'X-Access-Token': useAuthStore.getState().accessToken,
    'X-Auth-User': useAuthStore.getState().username,
    'codemaker-version': useExtensionStore.getState().codeMakerVersion,
    'department-code': encodeURI(
      useAuthStore.getState().authExtends.department_code,
    ),
    'code-generate-model-code':
      useExtensionStore.getState().generateModelCode,
    entrance: useExtensionStore.getState().entrance,
    ide: useExtensionStore.getState().IDE,
    'ntes-trace-id': traceId, // 虽然 VSCode 会覆盖掉，但是 JetBrains 是直接透传的所以需要带上
  };

  const mergedHeaders = { ...defaultHeaders, ...requestHeaders };
  const startTime = Date.now();

  const requestId = nanoid();
  const abortId = nanoid();
  
  // 从 URL 中获取 panelId
  const urlParams = new URLSearchParams(window.location.search);
  const panelId = urlParams.get('panelId') || undefined;
  
  window.parent.postMessage(
    {
      type: BroadcastActions.PROXY_REQUEST,
      data: {
        requestUrl,
        requestId,
        requestData,
        requestHeaders: mergedHeaders,
        method,
        abortId,
        traceId,
        panelId,
      },
    },
    '*',
  );

  const printRequestStatus = (status: RequestStatus, errMessage?: string) => {
    const baseInfo = `[WebView ProxyRequest] ${method.toUpperCase()} ${requestUrl}`;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    let message = '';
    switch (status) {
      case RequestStatus.SUCCESS:
        message = `${baseInfo} - Duration: ${duration}s, Status: Success`;
        break;
      case RequestStatus.ERROR:
        message = `${baseInfo} - Duration: ${duration}s, Status: Error, ErrorMessage: ${errMessage}`;
        break;
      case RequestStatus.TIMEOUT:
        message = `${baseInfo} - Status: Timeout of ${timeout}ms`;
        break;
      default:
        message = `${baseInfo} - Duration: ${duration}s, Status: Unknown`;
        break;
    }
    window.parent.postMessage(
      {
        type: 'PRINT_LOG',
        data: message,
      },
      '*',
    );
  };

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line prefer-const
    let timer: number | undefined;
    let isAborted = false;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', handlePostMessage);
      if (abortSignal) {
        abortSignal.removeEventListener('abort', handleAbort);
      }
    };
    function handlePostMessage(event: MessageEvent) {
      const message = event.data as any;
      // if (!message.type || message.type !== SubscribeActions.PROXY_REQUEST_RESPONSE) {
      //   cleanup();
      //   return;
      // }
      if (message.data?.requestId === requestId) {
        console.groupCollapsed(
          `[WebView ProxyRequest] ${method} /${requestUrl?.split('/')?.pop()}`,
        );
        console.log('Request URL:', requestUrl);
        console.log('Request Data:', requestData);
        console.log('Response Type:', message?.type);
        console.log('Response Data:', message?.data);
        console.log('Response Duration:', `${(Date.now() - startTime) / 1000}s`);
        console.groupEnd();
        switch (message.type) {
          case SubscribeActions.PROXY_REQUEST_RESPONSE: {
            if (isAborted) return;
            // if (!message.data?.response) {
            //   cleanup();
            //   return;
            // }
            const { status, data, body } = message.data.response;
            if (!String(status).startsWith('2')) {
              printRequestStatus(RequestStatus.ERROR);
              cleanup();
              reject(new Error(`Response status code is not OK: ${status}`));
              const errMsg = getErrorMessage(data);
              webToolsHub.withScope((scope) => {
                scope.setTag("from", "proxyRequest");
                scope.setContext("trace_id", traceId);
                webToolsLogger.captureException(`${status} ${errMsg} ${method.toUpperCase()} ${requestUrl}`)
              });
              if (!customErrorMsg) {
                if (status === 403) {
                  if (
                    data?.extra?.code === 30002 ||
                    data?.msg === 'token is empty' ||
                    data?.detail?.msg?.code === 30003
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
                  } else if (options.errorToast) {
                    if (errMsg) {
                      toastError(`错误信息：${errMsg}。请联系我们：7896636，traceId: ${traceId}`);
                    } else {
                      toastError(`未知错误。请联系我们：7896636，traceId: ${traceId}`);
                    }
                  }
                } else if (status === 401) {
                  if (data?.msg === 'token expired') {
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
                  } else if (options.errorToast) {
                    const errMsg = getErrorMessage(data);
                    if (errMsg) {
                      toastError(`错误信息：${errMsg}。请联系我们：7896636，traceId: ${traceId}`);
                    } else {
                      toastError(`未知错误。请联系我们：7896636，traceId: ${traceId}`);
                    }
                  }
                } else if (options.errorToast) {
                  const errMsg = getErrorMessage(data);
                  if (errMsg) {
                    toastError(`错误信息：${errMsg}。请联系我们：7896636，traceId: ${traceId}`);
                  } else {
                    toastError(`未知错误。请联系我们：7896636，traceId: ${traceId}`);
                  }
                }
              }
              console.log(message.data.response);
              return;
            }
            printRequestStatus(RequestStatus.SUCCESS);
            if (data) {
              resolve(data);
            } else if (body) {
              resolve(parseJSONSafely(body));
            } else {
              resolve(null);
            }
            cleanup();
            break;
          }
          case SubscribeActions.PROXY_REQUEST_ERROR: {
            if (isAborted) return;
            const proxyRequestErrMsg = getErrorMessage(message.data);
            reject(new Error(proxyRequestErrMsg));
            printRequestStatus(RequestStatus.ERROR, proxyRequestErrMsg);
            webToolsHub.withScope((scope) => {
              scope.setTag("from", "proxyRequest");
              scope.setContext("trace_id", traceId);
              webToolsLogger.captureException(`${proxyRequestErrMsg} ${method?.toUpperCase()} ${requestUrl}`);
            });
            if (!customErrorMsg && options.errorToast) {
              toastError(
                `错误信息：${proxyRequestErrMsg}。请联系我们：7896636，traceId: ${traceId}`,
              );
            }
            cleanup();
            break;
          }
        }
      }
    }

    function handleAbort() {
      isAborted = true;
      cleanup();
      reject(new Error('Request aborted'));
    }

    window.addEventListener('message', handlePostMessage);

    if (abortSignal) {
      if (abortSignal.aborted) {
        handleAbort();
        return;
      }
      abortSignal.addEventListener('abort', handleAbort);
    }

    timer = window.setTimeout(() => {
      if (!isAborted) {
        printRequestStatus(RequestStatus.TIMEOUT);
        reject(new Error('Request timeout'));
        toastError(`${ERROR_MESSAGE.NETWORK}`);
        console.groupCollapsed(
          `[WebView ProxyRequest] ${method} /${requestUrl?.split('/')?.pop()}`,
        );
        console.log('Request URL:', requestUrl);
        console.log('Request Data:', requestData);
        console.log(`Request Timeout of ${timeout}ms`);
        console.groupEnd();
        webToolsHub.withScope((scope) => {
          scope.setTag("from", "proxyRequest");
          scope.setContext("trace_id", traceId);
          webToolsLogger.captureException(`Request timeout ${method?.toUpperCase()} ${requestUrl}`);
        });
        window.removeEventListener('message', handlePostMessage);
      }
    }, timeout);
  });
}