/**
 * AI Provider - 处理与 AI API 服务的通信
 * 
 * 支持任意 OpenAI 兼容的 API 服务（如 LinkAPI、OpenAI、Azure 等）
 * API Key 和 Base URL 必须由客户端提供，服务器不保留默认值
 */

import { config } from './config.mjs';

// 请求超时时间（60秒）
const REQUEST_TIMEOUT = 60000;

// ⚠️ TLS 证书验证说明：
// Windows 环境下，某些网络（代理/防火墙）会导致 SSL 证书吊销检查失败
// (CRYPT_E_NO_REVOCATION_CHECK / UNABLE_TO_VERIFY_LEAF_SIGNATURE)
// 
// NODE_TLS_REJECT_UNAUTHORIZED=0 由 apiServer.ts 在 fork 子进程时注入，
// 仅影响此 API Server 子进程，不影响 VSCode 主进程或其他扩展。
// 
// 安全性：此子进程仅用于转发用户配置的 API 请求，不处理敏感的本地操作。
// 用户配置的 API 地址是用户自己信任的服务商。
// 
// 后续优化方向：可改为自定义 https.Agent 仅对特定请求跳过验证。

/**
 * 从请求体中提取 API Key
 * 优先级：客户端 > 服务器环境变量
 * 
 * @param {Object} requestBody - 请求体
 * @returns {string|null} API Key
 */
function extractApiKey(requestBody) {
  // 1. 客户端直接提供的 api_key
  if (requestBody.api_key) {
    return requestBody.api_key;
  }
  
  // 2. 客户端提供的 app_key（VS Code 配置 CodeChatApiKey）
  if (requestBody.app_key) {
    return requestBody.app_key;
  }
  
  // 3. 服务器环境变量（备用）
  if (config.apiKey) {
    return config.apiKey;
  }
  
  return null;
}

/**
 * 从请求体中提取 API Base URL
 * 优先级：客户端 > 服务器环境变量
 * 
 * @param {Object} requestBody - 请求体
 * @returns {string|null} API Base URL
 */
function extractBaseUrl(requestBody) {
  // 1. 客户端直接提供的 base_url
  if (requestBody.base_url) {
    return requestBody.base_url.replace(/\/$/, ''); // 移除末尾斜杠
  }
  
  // 2. 客户端提供的 api_base_url
  if (requestBody.api_base_url) {
    return requestBody.api_base_url.replace(/\/$/, '');
  }
  
  // 3. 服务器配置（可能为空）
  if (config.baseUrl) {
    return config.baseUrl;
  }
  
  return null;
}

/**
 * 智能构建 chat/completions 的完整 URL
 * 兼容不同 API 服务商的 Base URL 格式：
 * 
 * - https://api.linkapi.ai              → https://api.linkapi.ai/v1/chat/completions
 * - https://api.openai.com/v1           → https://api.openai.com/v1/chat/completions
 * - https://right.codes/codex/v1        → https://right.codes/codex/v1/chat/completions
 * - https://xxx/v1/chat/completions     → https://xxx/v1/chat/completions (不变)
 * - https://xxx/chat/completions        → https://xxx/chat/completions (不变)
 * 
 * @param {string} baseUrl - 用户配置的 API Base URL（已去除末尾斜杠）
 * @returns {string} 完整的 chat completions URL
 */
function buildChatCompletionsUrl(baseUrl) {
  // 如果已经包含 /chat/completions，直接使用
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }
  
  // 如果已经以 /v1、/v2、/v3 等版本号结尾（如 OpenAI、讯飞、智谱等），拼接 /chat/completions
  if (/\/v\d+$/.test(baseUrl)) {
    return `${baseUrl}/chat/completions`;
  }
  
  // 其他情况（如 LinkAPI 只给了域名），拼接完整路径 /v1/chat/completions
  return `${baseUrl}/v1/chat/completions`;
}

/**
 * 智能构建 Responses API 的完整 URL
 * 兼容不同 API 服务商的 Base URL 格式：
 * 
 * - https://right.codes/codex/v1        → https://right.codes/codex/v1/responses
 * - https://api.openai.com/v1           → https://api.openai.com/v1/responses
 * - https://api.example.com             → https://api.example.com/v1/responses
 * - https://xxx/v1/responses            → https://xxx/v1/responses (不变)
 * 
 * @param {string} baseUrl - 用户配置的 API Base URL（已去除末尾斜杠）
 * @returns {string} 完整的 responses URL
 */
function buildResponsesUrl(baseUrl) {
  // 如果已经包含 /responses，直接使用
  if (baseUrl.endsWith('/responses')) {
    return baseUrl;
  }
  
  // 直接在 baseUrl 后拼接 /responses
  // 不同服务商路径结构不同：
  // - https://right.codes/codex/v1  → /v1/responses
  // - https://capi.quan2go.com/openai → /openai/responses
  // - https://api.openai.com/v1     → /v1/responses
  // 统一策略：baseUrl 已经包含了服务商的完整前缀，直接追加 /responses
  return `${baseUrl}/responses`;
}

/**
 * 将前端发来的 Chat Completions 格式请求体转换为 Responses API 格式
 * 
 * Chat Completions: { messages: [{role, content}], model, stream, ... }
 * Responses API:    { input: [{role, content}], model, stream, ... }
 * 
 * @param {Object} requestBody - 原始请求体
 * @returns {Object} Responses API 格式的请求体
 */
function buildResponsesRequestBody(requestBody) {
  // 移除客户端特有字段和 Chat Completions 特有参数
  const { 
    app_id, app_key, api_key, base_url, api_base_url, 
    backend, session_id, // 非标字段，讯飞/智谱等服务商会校验报 400
    codebase_chat_mode, messages,
    // Chat Completions 特有参数
    temperature, top_p, frequency_penalty, presence_penalty,
    max_tokens, n, stop, logprobs, top_logprobs, 
    response_format, seed, 
    tools: chatTools, tool_choice: chatToolChoice,
    stream, // 我们自己控制 stream
    ...restBody 
  } = requestBody;
  
  // 清洗 messages → input：转换为 Responses API 格式
  // Chat Completions: { role: "user", content: "hi" } 或 { role: "user", content: [{type: "text", text: "hi"}] }
  // Responses API:    { role: "user", content: "hi" } (字符串) 或 { role: "user", content: [{type: "input_text", text: "hi"}] }
  // 
  // 关键差异：
  // 1. content 为数组时，type: "text" → type: "input_text"
  // 2. 前端自定义字段（如 reuseStart）需要过滤
  // 3. assistant 消息的 content 数组 type: "text" → type: "output_text"
  const input = [];
  for (const msg of (messages || [])) {
    // role: "tool" → Responses API 的 function_call_output 格式
    if (msg.role === 'tool') {
      const callId = msg.tool_call_id?.startsWith('fc_') ? msg.tool_call_id : 'fc_' + (msg.tool_call_id || Date.now());
      input.push({
        type: 'function_call_output',
        call_id: callId,
        output: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
      continue;
    }

    // role: "assistant" 且有 tool_calls → 转换为 function_call 输出项
    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // 先输出文本内容（如果有）
      if (msg.content) {
        input.push({ role: 'assistant', content: msg.content });
      }
      // 再输出每个 function_call
      for (const tc of msg.tool_calls) {
        // Responses API 要求 id 以 'fc_' 开头
        const callId = tc.id?.startsWith('fc_') ? tc.id : 'fc_' + (tc.id || Date.now());
        input.push({
          type: 'function_call',
          id: callId,
          call_id: callId,
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '{}',
        });
      }
      continue;
    }

    let content = msg.content;
    
    // 如果 content 是数组（多模态格式），转换 type 字段
    if (Array.isArray(content)) {
      content = content.map(part => {
        if (part.type === 'text') {
          // user/system → input_text, assistant → output_text
          const newType = msg.role === 'assistant' ? 'output_text' : 'input_text';
          return { type: newType, text: part.text };
        }
        if (part.type === 'image_url') {
          return { type: 'input_image', image_url: part.image_url };
        }
        return part;
      });
    }
    
    input.push({ role: msg.role, content });
  }

  const body = {
    ...restBody,
    input,
    stream: true,
  };

  // max_tokens → max_output_tokens（Responses API 的字段名）
  if (max_tokens) {
    body.max_output_tokens = max_tokens;
  }

  // tools 转换: Chat Completions 格式 → Responses API 格式
  // Chat Completions: [{ type: "function", function: { name, description, parameters } }]
  // Responses API:    [{ type: "function", name, description, parameters }]
  if (chatTools && chatTools.length > 0) {
    body.tools = chatTools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: tool.function.parameters || {},
        };
      }
      return tool; // 非 function 类型保持原样
    });
    console.log(`[AI Provider] [Responses API] 转换了 ${body.tools.length} 个 tools`);
  }

  return body;
}

/**
 * 创建一个 Responses API SSE 流解析器
 * 
 * 关键：event: 和 data: 可能分布在不同的网络 chunk 中，
 * 因此需要维护跨 chunk 的解析状态。
 * 
 * @returns {{ parse: (chunk: string) => Array<{event: string, data: string}> }}
 */
function createResponsesSSEParser() {
  let currentEvent = '';
  let buffer = '';  // 处理不完整行的缓冲区
  
  return {
    /**
     * 解析一个 chunk，返回本次解析出的完整事件数组
     * @param {string} chunk - 原始 SSE 文本块
     * @returns {Array<{event: string, data: string}>}
     */
    parse(chunk) {
      const events = [];
      buffer += chunk;
      
      // 按换行符分割，保留最后一个可能不完整的行在 buffer 中
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';  // 最后一段可能不完整，留到下次
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7).trim();
        } else if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          events.push({ event: currentEvent || 'message', data });
          // 注意：不重置 currentEvent，因为有些实现可能不发 event 行
        } else if (trimmed === '') {
          // 空行表示事件结束，重置状态准备下一个事件
          currentEvent = '';
        }
      }
      
      return events;
    }
  };
}

/**
 * 将 Responses API 的事件转换为 Chat Completions SSE 格式
 * 
 * 输入:  event: response.output_text.delta, data: {"delta":"Hello"}
 * 输出:  data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}
 * 
 * @param {string} eventType - 事件类型
 * @param {Object} eventData - 解析后的事件数据
 * @returns {string|null} Chat Completions 格式的 SSE 数据行，null 表示忽略
 */
function convertToCompletionsSSE(eventType, eventData) {
  switch (eventType) {
    case 'response.output_text.delta': {
      // 文本增量 → choices.delta.content
      const delta = eventData.delta || '';
      const converted = {
        id: eventData.response_id || 'resp-' + Date.now(),
        choices: [{
          delta: { content: delta, tool_calls: null },
          finish_reason: null,
          index: 0,
        }],
      };
      return `data: ${JSON.stringify(converted)}\n\n`;
    }
    
    case 'response.completed': {
      // 响应完成 → 判断是否有 function_call 输出
      const output = eventData.response?.output || [];
      const hasFunctionCall = output.some(item => item.type === 'function_call');
      const finishReason = hasFunctionCall ? 'tool_calls' : 'stop';
      
      const finalData = {
        id: eventData.response?.id || 'resp-' + Date.now(),
        choices: [{
          delta: { content: '', tool_calls: null },
          finish_reason: finishReason,
          index: 0,
        }],
      };
      return `data: ${JSON.stringify(finalData)}\n\ndata: [DONE]\n\n`;
    }
    
    case 'error': {
      // 错误事件
      const errorMsg = eventData.message || eventData.error || 'Unknown error';
      return null; // 返回 null，让调用方用 sendErrorSSE 处理
    }
    
    case 'response.output_item.added': {
      // 新增输出项 —— 如果是 function_call，发送 tool_calls 开始信息
      if (eventData.item?.type === 'function_call') {
        const converted = {
          id: eventData.response_id || 'resp-' + Date.now(),
          choices: [{
            delta: {
              content: null,
              tool_calls: [{
                index: eventData.output_index || 0,
                id: eventData.item.call_id || 'call-' + Date.now(),
                type: 'function',
                function: {
                  name: eventData.item.name || '',
                  arguments: '',
                },
              }],
            },
            finish_reason: null,
            index: 0,
          }],
        };
        return `data: ${JSON.stringify(converted)}\n\n`;
      }
      return null;
    }

    case 'response.function_call_arguments.delta': {
      // function call 参数增量
      const converted = {
        id: eventData.response_id || 'resp-' + Date.now(),
        choices: [{
          delta: {
            content: null,
            tool_calls: [{
              index: eventData.output_index || 0,
              function: {
                arguments: eventData.delta || '',
              },
            }],
          },
          finish_reason: null,
          index: 0,
        }],
      };
      return `data: ${JSON.stringify(converted)}\n\n`;
    }

    case 'response.function_call_arguments.done': {
      // function call 参数完成 → finish_reason: tool_calls
      // 注意：不在这里发 finish_reason，等 response.completed 统一处理
      return null;
    }

    // 忽略的事件类型（不影响聊天显示）
    case 'response.created':
    case 'response.in_progress':
    case 'response.output_item.done':
    case 'response.content_part.added':
    case 'response.content_part.done':
    case 'response.output_text.done':
      return null; // 静默忽略
    
    default:
      // 未知事件类型，记录日志但不中断
      console.log(`[AI Provider] 忽略未知 Responses API 事件: ${eventType}`);
      return null;
  }
}

/**
 * 使用 Responses API 协议发送流式请求并转发给客户端
 * 
 * @param {Object} requestBody - 完整的请求体
 * @param {import('http').ServerResponse} res - HTTP 响应对象
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API Base URL
 */
async function streamResponsesApi(requestBody, res, apiKey, baseUrl) {
  const url = buildResponsesUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 构建 Responses API 请求体
  const apiRequestBody = buildResponsesRequestBody(requestBody);
  
  // 设置模型
  if (requestBody.model) {
    apiRequestBody.model = requestBody.model;
  }

  console.log(`[AI Provider] [Responses API] 请求 ${url} 使用模型 ${apiRequestBody.model}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiRequestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 处理 HTTP 错误（复用现有 handleHttpError）
    if (!response.ok) {
      const errorText = await response.text();
      handleHttpError(res, response.status, errorText, baseUrl);
      return;
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 流式读取 Responses API 响应，解析并转换为 Chat Completions 格式
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const sseParser = createResponsesSSEParser();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const events = sseParser.parse(chunk);
        
        for (const { event, data } of events) {
          try {
            const parsed = JSON.parse(data);
            
            // 检查是否为错误事件
            if (event === 'error') {
              const errorMsg = parsed.message || parsed.error || 'API 返回了错误';
              sendErrorSSE(res, `❌ **API 错误**\n\n${errorMsg}`);
              return;
            }
            
            // 转换为 Chat Completions SSE 格式
            const converted = convertToCompletionsSSE(event, parsed);
            if (converted) {
              res.write(converted);
            }
          } catch (parseErr) {
            // JSON 解析失败，可能是不完整的块，记录并继续
            // 对于 data: 不是 JSON 的情况（如纯文本），直接忽略
          }
        }
      }
    } catch (streamError) {
      console.error('[AI Provider] [Responses API] 流式读取错误:', streamError);
      sendErrorSSE(res, '流式传输中断');
    }

    res.end();

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      sendErrorSSE(res, '⏱️ **请求超时**\n\n请求 60 秒未响应，请稍后重试。');
    } else {
      console.error('[AI Provider] [Responses API] 请求错误:', error);
      let errorDetail = error.message;
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
          error.message?.includes('certificate') ||
          error.message?.includes('SSL') ||
          error.message?.includes('TLS')) {
        errorDetail = `SSL/TLS 证书错误: ${error.message}\n\n💡 这可能是网络环境（代理/防火墙）导致的证书问题。`;
      } else if (error.code === 'ECONNREFUSED') {
        errorDetail = `连接被拒绝: ${url}\n\n请检查 API 地址是否正确。`;
      } else if (error.code === 'ENOTFOUND') {
        errorDetail = `域名解析失败: ${baseUrl}\n\n请检查 API 地址和网络连接。`;
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        errorDetail = `网络连接异常 (${error.code})\n\n请检查网络连接或代理设置。`;
      }
      sendErrorSSE(res, `❌ **请求失败**\n\n${errorDetail}`);
    }
  }
}

/**
 * 发送流式聊天请求到 AI API，并将响应转发给客户端
 * 根据 config.wireApi 自动选择 Chat Completions 或 Responses API 协议
 * 
 * @param {Object} requestBody - 完整的请求体（包含 messages, model, tools 等）
 * @param {import('http').ServerResponse} res - HTTP 响应对象
 */
/**
 * 发送非流式聊天请求到 AI API，返回完整的 JSON 响应
 * 用于标题生成等不需要流式输出的场景
 * 
 * @param {Object} requestBody - 完整的请求体（包含 messages, model 等）
 * @param {import('http').ServerResponse} res - HTTP 响应对象
 */
export async function chatCompletion(requestBody, res) {
  const apiKey = extractApiKey(requestBody);
  const baseUrl = extractBaseUrl(requestBody);

  if (!apiKey || !baseUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing API Key or Base URL' }));
    return;
  }

  const url = buildChatCompletionsUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 构建请求体（移除客户端特有的字段）
  const {
    app_id, app_key, api_key, base_url, api_base_url,
    backend, session_id, codebase_chat_mode,
    prompt_construct, extra_body,
    ...restBody
  } = requestBody;

  const apiRequestBody = {
    ...restBody,
    stream: false,
  };

  if (requestBody.model) {
    apiRequestBody.model = requestBody.model;
  }

  console.log(`[AI Provider] [非流式] 请求 ${baseUrl} 使用模型 ${apiRequestBody.model}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiRequestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Provider] [非流式] HTTP 错误 [${response.status}]:`, errorText);
      res.writeHead(response.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errorText }));
      return;
    }

    const data = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[AI Provider] [非流式] 请求错误:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
}

export async function streamChatCompletion(requestBody, res) {
  // 从请求体中提取配置
  const apiKey = extractApiKey(requestBody);
  const baseUrl = extractBaseUrl(requestBody);
  
  // 检查必需的配置
  if (!apiKey) {
    sendErrorSSE(res, 
      '⚠️ **未配置 API Key**\n\n' +
      '请在 VS Code 设置中配置：\n' +
      '1. 按 `Ctrl + ,` 打开设置\n' +
      '2. 搜索 `CodeMaker.CodeChatApiKey`\n' +
      '3. 填入你的 API Key'
    );
    return;
  }

  if (!baseUrl) {
    sendErrorSSE(res, 
      '⚠️ **未配置 API 地址**\n\n' +
      '请在 VS Code 设置中配置：\n' +
      '1. 按 `Ctrl + ,` 打开设置\n' +
      '2. 搜索 `CodeMaker.CodeChatApiBaseUrl`\n' +
      '3. 填入 API 地址（如 `https://api.openai.com`）'
    );
    return;
  }

  // 根据 wireApi 配置选择协议
  if (config.wireApi === 'responses') {
    console.log('[AI Provider] 使用 Responses API 协议');
    return streamResponsesApi(requestBody, res, apiKey, baseUrl);
  }

  // 默认：Chat Completions API
  console.log('[AI Provider] 使用 Chat Completions API 协议');
  const url = buildChatCompletionsUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  // 构建发送给 AI API 的请求体（移除客户端特有的字段）
  const { 
    app_id, 
    app_key, 
    api_key,
    base_url, 
    api_base_url,
    backend,      // 非标字段，讯飞/智谱等服务商会校验报 400
    session_id,   // 非标字段，讯飞/智谱等服务商会校验报 400
    codebase_chat_mode, 
    prompt_construct,  // CodeMaker 内部字段，非 OpenAI 标准
    extra_body,        // CodeMaker 内部字段，非 OpenAI 标准
    ...restBody 
  } = requestBody;
  
  // 构建请求体
  const apiRequestBody = {
    ...restBody,
    stream: true,
  };

  // 确保 temperature 为浮点数且在有效范围内 [0.0, 2.0)
  if (apiRequestBody.temperature !== undefined) {
    apiRequestBody.temperature = parseFloat(Number(apiRequestBody.temperature).toFixed(2));
    if (isNaN(apiRequestBody.temperature) || apiRequestBody.temperature < 0 || apiRequestBody.temperature >= 2.0) {
      apiRequestBody.temperature = 0.7;
    }
  }
  
  // 如果有指定模型，使用指定的模型
  if (requestBody.model) {
    apiRequestBody.model = requestBody.model;
  }

  console.log(`[AI Provider] 请求 ${baseUrl} 使用模型 ${apiRequestBody.model}`);
  console.log(`[AI Provider] 请求体:`, JSON.stringify(apiRequestBody, null, 2).slice(0, 500));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiRequestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 处理 HTTP 错误
    if (!response.ok) {
      const errorText = await response.text();
      handleHttpError(res, response.status, errorText, baseUrl);
      return;
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 流式转发响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    } catch (streamError) {
      console.error('流式读取错误:', streamError);
      sendErrorSSE(res, '流式传输中断');
    }

    res.end();

  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      sendErrorSSE(res, '⏱️ **请求超时**\n\n请求 60 秒未响应，请稍后重试。');
    } else {
      console.error('AI API 请求错误:', error);
      // 提供更详细的网络错误信息
      let errorDetail = error.message;
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
          error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
          error.message?.includes('certificate') ||
          error.message?.includes('SSL') ||
          error.message?.includes('TLS')) {
        errorDetail = `SSL/TLS 证书错误: ${error.message}\n\n💡 这可能是网络环境（代理/防火墙）导致的证书问题。`;
      } else if (error.code === 'ECONNREFUSED') {
        errorDetail = `连接被拒绝: ${url}\n\n请检查 API 地址是否正确。`;
      } else if (error.code === 'ENOTFOUND') {
        errorDetail = `域名解析失败: ${baseUrl}\n\n请检查 API 地址和网络连接。`;
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        errorDetail = `网络连接异常 (${error.code})\n\n请检查网络连接或代理设置。`;
      }
      sendErrorSSE(res, `❌ **请求失败**\n\n${errorDetail}`);
    }
  }
}

/**
 * 处理 HTTP 错误响应
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {string} errorText
 * @param {string} baseUrl
 */
function handleHttpError(res, status, errorText, baseUrl) {
  let message;
  
  switch (status) {
    case 401:
      message = '❌ **API 认证失败**\n\n请检查 API Key 是否正确。';
      break;
    case 403:
      message = '❌ **API 访问被拒绝**\n\n请检查 API Key 权限或账户状态。';
      break;
    case 429:
      message = '⏳ **请求频率超限**\n\n请稍后重试。';
      break;
    case 500:
      message = `🔧 **API 服务内部错误 (500)**\n\n服务器: ${baseUrl}\n错误详情: ${errorText?.slice(0, 200) || '无'}\n请稍后重试。`;
      break;
    case 502:
      message = `🔧 **API 网关错误 (502)**\n\n服务器: ${baseUrl}\n后端服务可能正在重启，请稍后重试。`;
      break;
    case 503:
      message = `🔧 **API 服务暂时不可用 (503)**\n\n服务器: ${baseUrl}\n服务可能正在维护中，请稍后重试。`;
      break;
    case 504:
      message = `🔧 **API 网关超时 (504)**\n\n服务器: ${baseUrl}\n请求处理超时，请稍后重试。`;
      break;
    default:
      // 尝试解析错误详情
      let detail = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error?.message) {
          detail = parsed.error.message;
        }
      } catch {}
      message = `❌ **API 请求失败 (${status})**\n\n${detail}`;
  }
  
  console.error(`AI API HTTP 错误 [${status}] (${baseUrl}):`, errorText);
  sendErrorSSE(res, message);
}

/**
 * 以 SSE 格式发送错误消息
 * @param {import('http').ServerResponse} res
 * @param {string} message
 */
function sendErrorSSE(res, message) {
  // 如果响应头还没发送，先设置
  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  }

  const id = 'error-' + Date.now();
  
  // 发送错误内容
  const data = JSON.stringify({
    id,
    choices: [{
      delta: { content: message, tool_calls: null },
      finish_reason: null,
      index: 0,
    }],
  });
  res.write(`data: ${data}\n\n`);

  // 发送结束标记
  const finalData = JSON.stringify({
    id,
    choices: [{
      delta: { content: '', tool_calls: null },
      finish_reason: 'stop',
      index: 0,
    }],
  });
  res.write(`data: ${finalData}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}
