import axios from 'axios';
// import { handleError } from './error';
import { setDefaultHeaders } from '.';
import { proxyRequest } from './common';
import { useAuthStore } from '../store/auth';
// import { handleError } from './error';
// export const codemakerSearchRequest = axios.create({
//   baseURL: '/proxy/search_config',
//   timeout: 40000,
//   headers: {},
// });

// codemakerSearchRequest.interceptors.request.use(setDefaultHeaders);
// codemakerSearchRequest.interceptors.response.use(undefined, handleError);

export interface CodeSearchConfigOption {
  code: string;
  desc: string;
  branches: string[];
  is_public: boolean;
  name?: string;
  urls?: string[]
  codemaker_public?: boolean;
}
const codeSearchRequest = axios.create();
codeSearchRequest.interceptors.request.use(setDefaultHeaders);
export async function getCodeSearchDataSets() {
  const { data } = await codeSearchRequest.get<{
    items: CodeSearchConfigOption[];
    totlal: number;
  }>(
    'http://localhost:3001',
  );
  return data.items;
}

// interface CodeSearchConfig {
//   text: string;
//   collection: string;
//   topk: number;
//   branch?: string;
// }
export interface SearchResult {
  // page_content: string;
  metadata: {
    module_name: string;
    name: string;
    type: string;
    code: string;
    annotation: string;
    branch?: string;
    language?: string;
    class_code?: string;
    class_name?: string;
  };
  score: number;
}

// export async function getCodeSearchData(params: CodeSearchConfig) {
//   const { data } = await codeSearchRequest.post<{
//     items: SearchResult[];
//   }>(
//     `http://localhost:3001`,
//     params,
//   );
//   return data.items || [];
// }

export async function getCodeSearchData(
  data: {
    text: string;
    collection: string;
    topk: number;
  },
  timeout = 10000,
): Promise<SearchResult[]> {
  window.parent.postMessage(
    {
      type: 'REQUEST_CODE_SEARCH',
      data,
    },
    '*',
  );
  return new Promise((resolve) => {
    // eslint-disable-next-line prefer-const
    let timer: number | undefined;
    // 定义处理消息的函数
    function handlePostMessage(event: MessageEvent) {
      const message = event.data as any;
      console.log('响应的message:', message);
      // 当收到特定类型的消息时，解决这个promise并移除这个事件监听器
      switch (message.type) {
        case 'receiveSearchData':
          resolve(message.data.items);
          clearTimeout(timer);
          window.removeEventListener('message', handlePostMessage);
          break;

        case 'receiveSearchDataError':
          resolve([]);
          clearTimeout(timer);
          window.removeEventListener('message', handlePostMessage);
          break;
        case 'actionInfo':
          if (message.data.content === '未搜索到相关代码') {
            resolve([]);
            clearTimeout(timer);
            window.removeEventListener('message', handlePostMessage);
          }
          break;
      }
    }

    // 添加事件监听器
    window.addEventListener('message', handlePostMessage);

    // 设置超时，如果在一定时间内没有收到消息，就拒绝这个promise
    timer = window.setTimeout(() => {
      resolve([]);
      window.removeEventListener('message', handlePostMessage);
    }, timeout);
  });
}
export interface SearchResultNew {
  module_name: string;
  func_name?: string;
  name: string;
  type: string;
  code: string;
  annotation: string;
  branch?: string;
  language?: string;
  class_code?: string;
  class_name?: string;
}

export const CODE_SEARCH_URL_NEW =
  'http://localhost:3001';
export async function getCodeSearchDataNew(
  query: string,
  codeTable: string,
  controller?: AbortController,
) {
  let searchResult: SearchResultNew[] = []
  try {
    const data = await proxyRequest(
      {
        requestUrl: CODE_SEARCH_URL_NEW,
        requestData: {
          query,
          inputs: {
            'X-ACCESS-TOKEN': useAuthStore.getState().accessToken,
            'X-AUTH-USER': encodeURIComponent(useAuthStore.getState().username || ''),
            code_table: codeTable,
          },
          stream_response: false,
          mode: 'advanced-chat',
        },
      },
      40000,
      true,
      controller?.signal,
    );
    const { answer } = data as { answer: string };
    try {
      const searchData = JSON.parse(answer);
      if (searchData.items) {
        searchResult = searchData.items || [];
      } else if (Array.isArray(searchData)) {
        searchResult = searchData;
      } else {
        searchResult = []
      }
    } catch (error) {
      searchResult = []
      console.error('codeSearchDataError', error);
    }
  } catch (error) {
    console.log('error', error);
    searchResult = [];
  }
  return searchResult;
}

export async function getCodeSearchDataByApi(
  params: {
    text: string;
    collection: string;
    topk: number;
  },
  controller?: AbortController,
) {
  try {
    const data = await proxyRequest(
      {
        requestUrl:
          'http://localhost:3001',
        requestData: params,
        method: 'post',
      },
      120 * 1000,
      true,
      controller?.signal,
    );
    return ((data as { items: SearchResult[] })?.items || []).map(
      (i) => i.metadata,
    )
  } catch (error) {
    console.log('error', error);
  }
}
