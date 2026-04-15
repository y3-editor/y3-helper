import axios, { AxiosRequestConfig } from 'axios';
import { setDefaultHeaders } from '../services';

const request = axios.create({
  timeout: 1 * 60 * 1000,
});

let defaultHeaders = {};

// // 请求拦截器
request.interceptors.request.use(setDefaultHeaders);

// // 响应拦截器
// request.interceptors.response.use(
//   (response) => {
//     if (response.status >= 200 && response.status < 300) {
//       return Promise.resolve(response);
//     } else {
//       return Promise.reject(response);
//     }
//   },
//   (error) => Promise.reject(error.response)
// );

export const $request = function (
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  dataOrParams?: any,
  config?: AxiosRequestConfig,
) {
  return new Promise<any>((resolve, reject) => {
    let req;

    // 统一设置 headers
    const reqConfig = config
      ? {
          ...config,
        }
      : {};
    // TODO: 统一 header 设置

    if (method === 'get') {
      req = request[method](url, {
        ...reqConfig,
        params: dataOrParams,
      });
    } else if (method === 'delete') {
      req = request[method](url, { ...reqConfig, ...dataOrParams });
    } else if (method === 'post' || method === 'put' || method === 'patch') {
      req = request[method](url, dataOrParams, reqConfig);
    }
    req
      ?.then((res) => {
        if (res) {
          resolve(res.data || {});
        }
      })
      .catch((err) => {
        // TODO: 错误处理
        reject(err);
      });
  });
};

export const getDefaultHeaders = function () {
  return {
    ...defaultHeaders,
  };
};

export const updateDefaultHeaders = function (headers: any) {
  defaultHeaders = {
    ...defaultHeaders,
    ...headers,
  };
};

export const resetDefaultHeaders = function () {
  defaultHeaders = {};
};

export const $get = $request.bind(this, 'get');
export const $post = $request.bind(this, 'post');
export const $put = $request.bind(this, 'put');
export const $delete = $request.bind(this, 'delete');
export const CancelToken = axios.CancelToken;
