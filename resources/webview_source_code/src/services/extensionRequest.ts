interface ExtensionRequestConfig {
  baseUrl: string;
  path: string;
  method: 'get' | 'post' | 'put' | 'delete';
  listenType?: string;
  requestData?: any;
}

interface BatchExtensionRequestConfig {
  listenType: string;
  data: ExtensionRequestConfig[];
}

// 需要请求office环境的接口时
const extensionRequest = (
  config: ExtensionRequestConfig | BatchExtensionRequestConfig,
) => {
  window.parent.postMessage({ type: 'EXTENSION_REQUEST', data: config }, '*');
};

export default extensionRequest;
