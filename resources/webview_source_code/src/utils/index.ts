import { OFFICE_BM_API_URL } from '../routes/CodeCoverage/const';
import { ChatMessage } from '../services';
import { REQUEST_TIMEOUT_NAME, useChatStore } from '../store/chat';
import { StreamError } from '../services/useChatStream';
import { Docset } from '../services/docsets';
import { cloneDeep } from 'lodash';
import { ChatRole } from '../types/chat';


export const LANGUAGE_TO_GRAPH_TYPE: Record<string, 'mermaid' | 'plantuml' | 'graphviz'> = {
  mermaid: 'mermaid',
  plantuml: 'plantuml',
  dot: 'graphviz',
  graphviz: 'graphviz',
};

function pad(str: string | number): string {
  return +str >= 10 ? (str as string) : '0' + str;
}

/**
 * 时间格式函数
 *
 * @export
 * @param {any} [date=new Date()]
 * @param {string} [format='YYYY-MM-DD']
 * @returns
 */

export function DateFormat(d: Date | string | number, fmt?: string): string {
  let date = d || new Date();
  const format: string = fmt || 'YYYY-MM-DD';
  if (!date) {
    return '';
  }
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();

  return format
    .replace('YYYY', '' + year)
    .replace('MM', pad(month))
    .replace('DD', pad(day))
    .replace('HH', pad(hour))
    .replace('mm', pad(min))
    .replace('ss', pad(sec));
}

export function toastErrorMessage(error: Error) {
  return `错误：${error.message}`;
}

export function addString(
  textarea: HTMLTextAreaElement,
  str: string | ((prefix: string, postfix: string) => string),
) {
  const value = textarea.value;
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const prefix = value.slice(0, selectionStart);
  const postfix = value.slice(selectionEnd);
  const added = typeof str === 'function' ? str(prefix, postfix) : str;
  const nextValue = `${prefix}${added}${postfix}`;

  // https://github.com/facebook/react/issues/955
  // 为了保持光标暂时先用 setTimeout 解决。如果有问题的话可以参考：
  // https://github.com/facebook/react/issues/955#issuecomment-411558217
  // 将 selectionStart 作为一个状态，在 useLayoutEffect 中设置
  setTimeout(() => {
    textarea.selectionStart = selectionStart + added.length;
    textarea.selectionEnd = selectionStart + added.length;
  });
  return nextValue;
}

export function getErrorMessage(err: any) {
  // TODO: 根据错误类型提取错误信息，以及做定制化提示
  return (
    err?.status?.reson ||
    err?.response?.data?.msg ||
    err?.data?.msg ||
    err?.msg ||
    err?.message ||
    err?.detail ||
    ''
  );
}

/**
 * Detects Macintosh
 */
export function isMacOS(): boolean {
  if (typeof window !== 'undefined') {
    const userAgent = window.navigator.userAgent.toLocaleLowerCase();
    const macintosh = /iphone|ipad|ipod|macintosh/.test(userAgent);
    return !!macintosh;
  }
  return false;
}

export function isWin(): boolean {
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  return (
    platform.indexOf('win') > -1 ||
    userAgent.indexOf('windows') > -1 ||
    userAgent.indexOf('win32') > -1 ||
    userAgent.indexOf('win64') > -1
  );
}

export function alphabeticalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true });
}

// 计算代码的行数和字符数
export function countGodeGenerate(code: string): {
  generate_lines: number;
  generate_chars: number;
} {
  if (!code) {
    return { generate_lines: 0, generate_chars: 0 };
  }
  const lines = code.split('\n').length;
  const chars = code.length;
  return { generate_lines: lines, generate_chars: chars };
}

export async function getBase64FromUrl(url: string): Promise<string> {
  try {
    // 使用代理去获取图片
    const newUrl = url.replace(
      'http://localhost:3001',
      '/proxy/img',
    );
    // 提取文件扩展名
    const fileExtensionMatch = newUrl.match(/\.(jpeg|png|gif|webp|jfif|jpg)$/i);
    const fileExtension = fileExtensionMatch
      ? fileExtensionMatch[1].toLowerCase()
      : '';
    // 获取图片响应
    const response = await fetch(newUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // 获取响应中的 Blob 数据
    const blob = await response.blob();

    // 获取响应的 Content-Type 头部信息，测试发现 Content-Type 无论什么图片都返回了 image/png ，前端先特殊处理
    // let contentType = response.headers.get('Content-Type');
    let contentType = 'image/png';
    switch (fileExtension) {
      case 'jpeg':
      case 'jpg':
      case 'png':
      case 'jfif':
      case 'webp':
        contentType = 'image/jpeg';
        // contentType = 'image/png';
        break;
      case 'gif':
        contentType = 'image/gif';
        break;
      // case 'webp':
      //   contentType = 'image/webp';
      //   break;
      default:
        throw new Error('Unable to determine content type');
    }

    const reader = new FileReader();

    const readerPromise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const base64WithMime = `data:${contentType};base64,${base64Data.split(',')[1]
          }`;
        resolve(base64WithMime);
      };
      reader.onerror = () =>
        reject(new Error('Error reading Blob as Data URL'));
    });

    reader.readAsDataURL(blob);
    const base64Data = await readerPromise;

    return base64Data;
  } catch (error) {
    console.error('Failed to get Base64 from URL:', error);
    throw error;
  }
}

export function proxyImage(url: string) {
  // TODO: BM 图片需要特殊处理，目前没有更好的方案，先这样处理
  // 后续需要优化
  if (url.includes('brainmaker')) {
    if (url.includes('brainmaker-office')) {
      return url.replace(
        `http://localhost:3001`,
        `${OFFICE_BM_API_URL}/proxy/bm/api/v1`,
      );
    }
    return url.replace(
      `http://localhost:3001`,
      '/proxy/bm',
    );
  }
  return url.replace('http://localhost:3001', '/proxy/img');
}

// const superscriptNumbers: readonly string[] = [
//   '',
//   '¹',
//   '²',
//   '³',
//   '⁴',
//   '⁵',
//   '⁶',
//   '⁷',
//   '⁸',
//   '⁹',
// ];

// 字符 List: ①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿
const superscriptNumbers: readonly string[] = [
  '',
  '①',
  '②',
  '③',
  '④',
  '⑤',
  '⑥',
  '⑦',
  '⑧',
  '⑨',
  '⑩',
  '⑪',
  '⑫',
  '⑬',
  '⑭',
  '⑮',
  '⑯',
  '⑰',
  '⑱',
  '⑲',
  '⑳',
];

export function extractAndReplaceSources(input: string): {
  sourcesIndex: number[];
  replaceString: string;
} {
  const regex = /【(\d+)†source】/g;
  const sourcesIndex: number[] = [];

  // 使用 replace 方法进行替换，并在回调函数中提取数字
  const replaceString = input.replace(regex, (_, numberStr) => {
    const number = parseInt(numberStr, 10);
    sourcesIndex.push(number);
    if (number >= 1 && number <= 9) {
      return ` ${superscriptNumbers[number]}`;
    } else {
      return '';
    }
  });

  return { sourcesIndex: [...new Set(sourcesIndex)], replaceString };
}

export function bmExtractAndReplaceSources(input: string): {
  sourcesIndex: number[];
  replaceString: string;
} {
  const regex = /\[\^(\d+)\^\]/g;
  const sourcesIndex: number[] = [];

  const replaceString = input.replace(regex, (_, numberStr) => {
    const number = parseInt(numberStr, 10);
    sourcesIndex.push(number);
    if (number >= 1 && number <= 20) {
      return superscriptNumbers[number];
    } else {
      return ``;
    }
  });

  return { sourcesIndex: [...new Set(sourcesIndex)], replaceString };
}

// 从消息数组中获取指定 ID 的对话范围
export function getMessageRangeById(
  messages: ChatMessage[],
  targetId: string,
): ChatMessage[] {
  const targetIndex = messages.findIndex((msg) => msg.id === targetId);
  if (targetIndex === -1) return [];

  // 向前查找对话起点
  let startIndex = targetIndex;
  while (startIndex > 0 && messages[startIndex].role !== ChatRole.User) {
    startIndex--;
  }

  // 从起点开始收集消息,直到下一个 user 消息或数组结束
  const conversation = [];
  for (let i = startIndex; i < messages.length; i++) {
    if (i > startIndex && messages[i].role === ChatRole.User) break;
    conversation.push(messages[i]);
  }

  return conversation;
}

export function convertExtToLanguage(ext: string): string {
  if (!ext) {
    return '';
  }
  const extToLang: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    yaml: 'yaml',
    xml: 'xml',
    swift: 'swift',
    kt: 'kotlin',
    rs: 'rust',
  };

  return extToLang[ext.toLowerCase()] || ext.toLowerCase();
}

type GraphType = 'mermaid' | 'plantuml' | 'graphviz';

interface ExportGraphOptions {
  type: GraphType;
  chart: string;
}

export const exportGraphAsPng = async ({ type, chart }: ExportGraphOptions) => {
  try {
    // 处理不同类型的图表内容
    const processedChart = type === 'mermaid'
      ? `%%{init: {"theme": "dark", "themeVariables": {"background": "#000000", "primaryColor": "#303030", "secondaryColor": "#202020"}}}%%${chart}`
      : chart;

    // 映射图表类型到API端点
    const endpointMap: Record<GraphType, string> = {
      mermaid: 'mermaid',
      plantuml: 'plantuml',
      graphviz: 'graphviz'
    };

    const endpoint = endpointMap[type];
    if (!endpoint) {
      throw new Error(`Unsupported graph type: ${type}`);
    }

    const response = await fetch(`http://localhost:3001`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: processedChart
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const blob = await response.blob();

    // 使用Canvas处理图片
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 创建Canvas元素
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Failed to get canvas context');
          }

          // 设置Canvas尺寸与图片相同
          canvas.width = img.width;
          canvas.height = img.height;

          // 先填充黑色背景
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // 然后绘制图片
          ctx.drawImage(img, 0, 0);

          // 转换为base64字符串
          const base64Data = canvas.toDataURL('image/png').split(',')[1];
          const timestamp = DateFormat(Date.now(), 'YYYYMMDDHHmmss');

          // 根据不同类型生成对应的文件名
          const typeLabels: Record<GraphType, string> = {
            mermaid: 'mermaid',
            plantuml: 'plantuml',
            graphviz: 'graphviz'
          };

          const filename = `${typeLabels[type]}-diagram-${timestamp}.png`;

          window.parent.postMessage(
            {
              type: 'EXPORT_FILE',
              data: { filename, content: base64Data },
            },
            '*'
          );
          resolve({ success: true });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // 从blob创建图片URL
      img.src = URL.createObjectURL(blob);
    });
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

interface StreamErrorType {
  name?: string;
  message: string;
  type?: string;
}

// 处理需要特殊匹配的错误
export const specialErrorPatterns = [
  {
    condition: (msg: string) => msg.startsWith(StreamError.GPTTokenLimit),
    message: '当前对话超出最大token数限制，请尝试新建对话'
  },
  {
    condition: (msg: string) => (
      msg.includes("Error code: 429") && (msg.includes(StreamError.TokenLimitErrorFromAIGW)
        || msg.includes(StreamError.RateLimitErrorFromAIGW)
        || msg.includes(StreamError.PeerClosedConnection)
      )
      || (
        msg.includes(StreamError.AzureaiRateLimitChunk)
      )
    ),
    message: '⚠️ 当前请求触发模型限流，请稍后再试'
  },
  {
    condition: (msg: string) => msg.includes("Error code: 400") && msg.includes('invalid_request_error'),
    message: '❌ 消息体异常'
  },
  {
    condition: (msg: string) => msg.includes("Error code: 500") && msg.includes('TypeError'),
    message: '🔧 消息解析异常'
  },
  {
    condition: (msg: string) => msg.includes("Error code: 400") && msg.includes('RequestValidationError'),
    message: '📝 内容超出长度限制，请精简后重试'
  },
  {
    condition: (msg: string) => msg.includes("Error code: 400") && msg.includes('InvalidRequestErrorFromAIGW'),
    message: '⚠️ 消息格式异常'
  },
  {
    condition: (msg: string) => (
      [
        'Error code: 402',
        'SupplierResponseFailedErrorFromAIGW',
        'PaymentRequiredErrorFromAIGW',
      ].some(i => msg.includes(i))
      && msg.includes('credit limit reached')
    ),
    message: '💰 模型积分不足，系统充值中，请稍等'
  },
  {
    condition: (msg: string) => /Error code: [54]\d{2}/.test(msg),
    message: '❌ 系统报错'
  },
  {
    condition: (msg: string) => msg.includes("anthropic_error_chunk type:overloaded_error message:Overloaded"),
    message: '💰 模型资源不足，请稍后重试或切换其他模型使用'
  },
  {
    condition: (msg: string) => (
      [
        'Model not found',
        'model is not supported',
        'anthropic_error_chunk type:serviceUnavailableException',
        'peer closed connection without sending complete message body',
      ].some(i => msg.includes(i))
    ),
    message: '🤨 本次模型没有回复，可点击重新回复'
  },
  {
    condition: (msg: string) => msg.includes(`Unexpected token`) && msg.includes(`is not valid JSON`),
    message: '🤔 无法正常解析模型数据，请点击重新回复'
  },
  {
    condition: (msg: string) => (
      msg.includes("'type': 'SupplierResponseFailedErrorFromAIGW'") &&
      (
        msg?.toLowerCase?.()?.includes?.('prompt is too long')
        || msg?.toLowerCase?.()?.includes?.('input is too long')
        || msg?.toLowerCase?.()?.includes?.(`maximum context length`)
      )
    ),
    message: '🤨 检测到上下文过长，可在聊天窗口中输入 /compress 指令后再重新回复',
    errorType: 'ContextTooLong' as StreamErrorCallbackType,
  },
  {
    condition: (msg: string) => (
      msg.includes("API 请求失败") &&
      (msg.includes('Range of input length should be'))
    ),
    message: '🤨 检测到上下文过长，可在聊天窗口中输入 /compress 指令后再重新回复',
    errorType: 'ContextTooLong' as StreamErrorCallbackType,
  },
  {
    condition: (msg: string) => (
      msg.includes("'type': 'SupplierResponseFailedErrorFromAIGW'")
    ) && (
        msg.includes('Invalid `signature` in `thinking` block')
        || (msg.includes('Base64 decoding failedfor') && msg.includes('thought_signature'))
      ),
    message: '🤨 检测到上下文思维签名异常，请切换非Thinking模型后再重新回复',
    errorType: 'InvalidSignature' as StreamErrorCallbackType,
  },
];


export type StreamErrorCallbackType = 'ContextTooLong' | 'InvalidSignature' | 'Unknown';

export const handleStreamError = (
  error: StreamErrorType,
  onErrorType?: (errorType: StreamErrorCallbackType) => void
): string => {
  const chatStoreState = useChatStore.getState();

  // 定义错误消息映射
  const errorMessages: Record<string, string> = {
    // 基础错误映射
    [REQUEST_TIMEOUT_NAME]: '消息请求超时',
    [StreamError.BaiChuan2TokenLimit]: '当前对话超出最大token数限制，请尝试新建对话',
    [StreamError.ApiKeyIsError]: 'ApiKey 配置错误，请检查 ApiKey',
    [StreamError.GPT4TokenLimit]: '当前对话超出次数限制，请稍后重试',
    [StreamError.NeedAppKey]: '使用 GPT 4 需要配置 AppKey',
    [StreamError.GPT4MaxLimit]: '当月GPT-4使用次数已达限额 \n\n 如需长期稳定的 GPT-4 服务，请点击查看[接入指引](https://github.com/user/codemaker)申请',
    [StreamError.ReturnDataError]: '⚠️ 返回数据错误，请重试',
    [StreamError.NetworkError]: '📶 网络连接已断开，请检查网络后重试',
    [StreamError.FailedToFetch]: '📶 网络连接已断开，请检查网络后重试',
  };


  chatStoreState.setError(true);
  // 1. 检查基础错误映射
  if (error.name && errorMessages[error.name]) {
    return `\n\n ${errorMessages[error.name]}`;
  }

  if (error.message && errorMessages[error.message]) {
    return `\n\n ${errorMessages[error.message]}`;
  }

  // 2. 检查特殊错误模式
  for (const pattern of specialErrorPatterns) {
    if (pattern.condition(error.message)) {
      if (pattern.errorType) {
        onErrorType?.(pattern.errorType);
      }
      return `\n\n ${pattern.message}`;
    }
  }

  return `\n\n 出错了，【${error.message}】，稍后重试`;
}
export const filterDocsetsFn = (docsets: Docset[]): Partial<Docset>[] => {
  // 深拷贝输入数据
  // const deepCopiedDocsets = structuredClone(docsets);
  const deepCopiedDocsets = cloneDeep(docsets);
  return deepCopiedDocsets.map(({ _id, name, code, project, env }: Docset) => ({
    _id,
    name,
    code,
    project,
    env
  }));
};


/**
 * @name 转换成可渲染的markdown字符
 */
export const convertStringToMarkdown = (data: string): string => {
  if (!data.includes('```markdown')) return data
  const lines = data.split('\n')
  const newLines: string[] = []
  const markdownRecored: Record<number, number> = {}
  // 收集```, charlist一定是偶数
  const charList: [number, string][] = []
  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || ''
      // 只收集结束符号
      if (line.startsWith("```")) {
        charList.push([i, line])
      }
    }
    let matchIndex = 0
    while (charList.length > matchIndex) {
      const [, data] = charList[matchIndex]
      const [, nextData = ''] = charList[matchIndex + 1] || [-1, '']
      if (!data.startsWith("```markdown") && nextData === '```') {
        charList.splice(matchIndex, 2)
      } else {
        matchIndex++
      }
    }

    let curMdIndex = -1
    charList.forEach(([index, data]) => {
      if (data.startsWith("```markdown")) {
        curMdIndex = index
      } else {
        markdownRecored[curMdIndex] = index
      }
    })
  } catch (e) {
    console.warn('兼容markdown失败')
    return data
  }

  let endMdLine = -1 // 当前markdown的行
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i + 1 > endMdLine) endMdLine = -1
    if (endMdLine > -1) {
      newLines.push(`__CM__${line}`)
    } else {
      newLines.push(line)
    }
    // 首次遇到匹配markdown块时，不做处理
    if (markdownRecored[i]) {
      endMdLine = markdownRecored[i]
    }
  }
  return newLines.join('\n')
}

/**
 * @name 兼容不同平台按键值判断
 * @param codes 按键唯一值 部分webview环境没有keyboard.code
 * @param keys 按键原值
 */
export const checkValueOfPressedKeyboard = (
  event: KeyboardEvent | React.KeyboardEvent,
  codes: string[],
  keys: string[] = []
) => {
  if (codes.includes(event.code)) {
    return true
  } else if (keys.includes(event.key)) {
    return true
  } else if (codes.includes(event.key)) {
    return true
  }
  return false
}

/**
 * @name 检查命令是否安全
 * @param dangerousCommands 危险命令列表
 * @param command 要检查的命令
 */
export function isCommandSafe(dangerousCommands: string[], command: string): boolean {
  const lowerCommand = command?.toLowerCase?.();
  return !dangerousCommands.some(dangerousCmd => {
    const regex = new RegExp(`\\b${dangerousCmd?.toLowerCase?.()}\\b`, 'ig');
    return regex.test(lowerCommand);
  });
}

/**
 * @name 截断渲染字符串
 */
export function truncateContent(content: string, maxLen = 100000) {
  if (typeof content !== 'string') return ''
  return content.length > maxLen
    ? `${content.slice(0, maxLen)}\n\n(Truncated due to content size limit)`
    : content
}
/**
 * @name 通过验证标志获取正确内容
 */
export function getContentByValidateFlag(flag: boolean, content: string) {
  if (flag) {
    return content
  }
  return ''
}

/**
 * @name 获取字符串文本
 */
export function getStringContent(content: any) {
  let result = content
  if (typeof content === 'string') {
    return result
  }
  try {
    if (typeof content === 'object') {
      result = JSON.stringify(content)
    } else {
      result = new String(content)
    }
  } catch (e) { /* empty */ }
  return result
}

/**
 * @name 兼容工具名称
 */
export function getValidToolName(name: string) {
  if (name.includes('default_api:')) {
    return name.replace('default_api:', '')
  }
  return name
}
