/**
 * 聊天路由 - 处理所有聊天相关的 API 端点
 */

import { streamChatCompletion, chatCompletion } from '../ai-provider.mjs';
import { config } from '../config.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

/**
 * 从请求体中提取消息和模型参数
 * @param {Object} body - 请求体
 * @returns {{ messages: Array, model: string }}
 */
function extractParams(body) {
  const messages = body?.messages || [];
  const model = body?.model || '';
  return { messages, model };
}

/**
 * 处理流式聊天请求
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Object} body - 解析后的请求体
 */
async function handleStreamChat(req, res, body) {
  // 打印调试信息
  console.log('[Chat] 收到请求，参数 keys:', Object.keys(body));
  console.log('[Chat] api_key:', body.api_key ? '✅ 有' : '❌ 无');
  console.log('[Chat] app_key value:', body.app_key || '❌ 无');
  console.log('[Chat] base_url:', body.base_url || '❌ 无');
  if (body.tools) {
    console.log('[Chat] tools 数量:', body.tools.length);
  }
  
  // 直接透传完整的请求体给 AI Provider
  await streamChatCompletion(body, res);
}

/**
 * 处理非流式聊天请求（用于会话标题生成等场景）
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Object} body - 解析后的请求体
 */
async function handleNonStreamChat(req, res, body) {
  console.log('[Chat] [非流式] 收到请求，参数 keys:', Object.keys(body));
  await chatCompletion(body, res);
}

/**
 * 注册聊天路由
 * @param {Map} routes - 路由映射
 */
export function registerChatRoutes(routes) {
  // =============================================
  // 主要聊天端点（流式）
  // POST /proxy/gpt/gpt/text_chat_stream/:event
  // =============================================
  routes.set('POST:/proxy/gpt/gpt/text_chat_stream', handleStreamChat);

  // =============================================
  // 主要聊天端点（非流式）
  // POST /proxy/gpt/gpt/text_chat/:event
  // 用于会话标题生成等不需要流式输出的场景
  // =============================================
  routes.set('POST:/proxy/gpt/gpt/text_chat', handleNonStreamChat);

  // =============================================
  // Codebase 聊天端点
  // POST /proxy/gpt/u5_chat/codebase_chat_stream
  // =============================================
  routes.set('POST:/proxy/gpt/u5_chat/codebase_chat_stream', handleStreamChat);

  // =============================================
  // Agent 聊天端点
  // POST /proxy/gpt/u5_chat/codebase_agent_stream
  // =============================================
  routes.set('POST:/proxy/gpt/u5_chat/codebase_agent_stream', handleStreamChat);

  // =============================================
  // Codebase agent（非流式）
  // POST /proxy/gpt/u5_chat/codebase_agent_chat
  // =============================================
  routes.set('POST:/proxy/gpt/u5_chat/codebase_agent_chat', handleNonStreamChat);

  // =============================================
  // Hangyan 前缀端点（与上面相同逻辑）
  // =============================================
  routes.set('POST:/proxy/gpt/hangyan/gpt/text_chat_stream', handleStreamChat);
  routes.set('POST:/proxy/gpt/hangyan/gpt/text_chat', handleNonStreamChat);
  routes.set('POST:/proxy/gpt/hangyan/u5_chat/codebase_chat_stream', handleStreamChat);
  routes.set('POST:/proxy/gpt/hangyan/u5_chat/codebase_agent_stream', handleStreamChat);
  routes.set('POST:/proxy/gpt/hangyan/u5_chat/codebase_agent_chat', handleNonStreamChat);

  // =============================================
  // 辅助端点 - 返回简单 Mock 响应
  // =============================================
  
  // Token 计算
  routes.set('POST:/proxy/gpt/gpt/calculate_tokens', (req, res, body) => {
    const text = body?.text || body?.content || '';
    sendJson(res, { code: 0, data: { token_count: Math.ceil(text.length / 4) } });
  });
  routes.set('POST:/proxy/gpt/hangyan/gpt/calculate_tokens', (req, res, body) => {
    const text = body?.text || body?.content || '';
    sendJson(res, { code: 0, data: { token_count: Math.ceil(text.length / 4) } });
  });

  // 配额检查
  routes.set('GET:/proxy/gpt/gpt/check_limit', (req, res) => {
    sendJson(res, { code: 0, data: { remaining: 9999, limit: 10000, used: 1 } });
  });
  routes.set('GET:/proxy/gpt/hangyan/gpt/check_limit', (req, res) => {
    sendJson(res, { code: 0, data: { remaining: 9999, limit: 10000, used: 1 } });
  });

  // 图片上传 - 解析 multipart/form-data，保存文件，返回可访问的 URL
  routes.set('POST:/proxy/gpt/u5_chat/upload_img', handleUploadImg);
  routes.set('POST:/proxy/gpt/hangyan/u5_chat/upload_img', handleUploadImg);

  // 反馈
  routes.set('POST:/proxy/gpt/u5_chat/chat_feedback', (req, res) => {
    sendJson(res, { code: 0, message: 'Feedback received' });
  });
  routes.set('POST:/proxy/gpt/hangyan/u5_chat/chat_feedback', (req, res) => {
    sendJson(res, { code: 0, message: 'Feedback received' });
  });
}

/**
 * 处理图片上传 (multipart/form-data)
 * 从 raw request 中解析文件数据，保存到 uploads 目录，返回可访问的 URL
 * 
 * 返回格式: { url: string, message: string }
 * 注意：不包装在 { code, data } 中，因为前端 axios 直接使用 response.data
 */
async function handleUploadImg(req, res) {
  try {
    const rawBody = await readRawBody(req);
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);

    if (!boundaryMatch) {
      sendJson(res, { url: '', message: 'Missing boundary in content-type' });
      return;
    }

    const boundary = boundaryMatch[1];
    const file = parseMultipartFile(rawBody, boundary);

    if (!file) {
      sendJson(res, { url: '', message: 'No file found in upload' });
      return;
    }

    // 生成唯一文件名
    const uniqueId = randomBytes(8).toString('hex');
    const ext = getExtFromMime(file.contentType) || getExtFromFilename(file.filename) || 'png';
    const savedFilename = `${uniqueId}.${ext}`;
    const savePath = join(config.uploadsDir, savedFilename);

    // 保存文件
    writeFileSync(savePath, file.data);

    // 返回可通过 API Server 访问的 URL（前端会用 proxyImage 转换）
    const url = `http://localhost:${config.port}/uploads/${savedFilename}`;
    console.log(`[Upload] 图片已保存: ${savedFilename} (${file.data.length} bytes)`);

    // 注意：前端 uploadImg() 中 const { data } = await axios.post(...)
    // axios 的 response.data 就是这个 JSON 对象本身，前端用 result.url 取值
    sendJson(res, { url, message: 'ok' });
  } catch (err) {
    console.error('[Upload] 上传失败:', err);
    sendJson(res, { url: '', message: err.message || 'Upload failed' });
  }
}

/**
 * 读取 raw request body 为 Buffer
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer>}
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * 从 multipart/form-data body 中解析出第一个文件
 * @param {Buffer} body
 * @param {string} boundary
 * @returns {{ filename: string, contentType: string, data: Buffer } | null}
 */
function parseMultipartFile(body, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const crlfCrlf = Buffer.from('\r\n\r\n');

  // 找到第一个 boundary 之后的内容
  let start = body.indexOf(boundaryBuf);
  if (start === -1) return null;
  start += boundaryBuf.length;

  // 找到 headers 和 body 的分隔（\r\n\r\n）
  const headerEnd = body.indexOf(crlfCrlf, start);
  if (headerEnd === -1) return null;

  const headerSection = body.slice(start, headerEnd).toString('utf-8');

  // 解析 Content-Disposition 获取 filename
  const filenameMatch = headerSection.match(/filename="?([^";\r\n]+)"?/);
  const filename = filenameMatch ? filenameMatch[1] : 'upload';

  // 解析 Content-Type
  const ctMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
  const contentType = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

  // 文件数据开始位置
  const dataStart = headerEnd + crlfCrlf.length;

  // 找到下一个 boundary（结束位置）
  const nextBoundary = body.indexOf(boundaryBuf, dataStart);
  // 减去 \r\n（boundary 前的换行符）
  const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : body.length;

  const data = body.slice(dataStart, dataEnd);

  return { filename, contentType, data };
}

/**
 * 根据 MIME 类型获取文件扩展名
 */
function getExtFromMime(mime) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mime] || '';
}

/**
 * 从文件名获取扩展名
 */
function getExtFromFilename(filename) {
  const match = filename.match(/\.(\w+)$/);
  return match ? match[1] : '';
}

/**
 * 发送 JSON 响应
 * @param {import('http').ServerResponse} res
 * @param {Object} data
 */
function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
