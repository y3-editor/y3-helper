/**
 * CodeMaker API Server - 服务入口
 * 
 * 生产级后端服务，接入 LinkAPI 实现真实 AI 对话
 */

import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config, printConfigStatus } from './config.mjs';
import { registerChatRoutes } from './routes/chat.mjs';
import { registerHealthRoutes } from './routes/health.mjs';
import { registerHistoryRoutes, getOrCreateSession, updateSession } from './routes/history.mjs';
import { registerApplyRoutes } from './routes/apply.mjs';

// 静态文件 MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// WebView 静态文件根目录（与 api-server 同级的 webview 目录）
const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBVIEW_ROOT = process.env.WEBVIEW_STATIC_ROOT || join(__dirname, '..', 'webview');

// 路由映射表
const routes = new Map();

// 注册所有路由
registerHealthRoutes(routes);
registerChatRoutes(routes);
registerHistoryRoutes(routes);
registerApplyRoutes(routes);

/**
 * 解析请求体
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Object>}
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

/**
 * 添加 CORS 头
 * @param {import('http').ServerResponse} res
 */
function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * 请求日志
 * @param {string} method
 * @param {string} url
 * @param {number} statusCode
 */
function logRequest(method, url, statusCode) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${method} ${url} - ${statusCode}`);
}

/**
 * 匹配路由 - 支持动态路径参数
 * @param {string} method
 * @param {string} pathname
 * @returns {{ handler: Function|null, params: Object }}
 */
function matchRoute(method, pathname) {
  // 精确匹配
  const exactKey = `${method}:${pathname}`;
  if (routes.has(exactKey)) {
    return { handler: routes.get(exactKey), params: {} };
  }

  // 处理 :id 等动态参数 - 尝试去掉最后一个路径段
  const pathParts = pathname.split('/');
  if (pathParts.length > 1) {
    const lastPart = pathParts.pop();
    const parentKey = `${method}:${pathParts.join('/')}/:id`;
    if (routes.has(parentKey)) {
      return { handler: routes.get(parentKey), params: { id: lastPart } };
    }
    // 也尝试不带 :id 的父路径（用于 text_chat_stream/:event）
    const parentKey2 = `${method}:${pathParts.join('/')}`;
    if (routes.has(parentKey2)) {
      return { handler: routes.get(parentKey2), params: { event: lastPart } };
    }
  }

  return { handler: null, params: {} };
}

/**
 * 请求处理器
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const pathname = url.pathname;

  // 添加 CORS 头
  addCorsHeaders(res);

  // 处理预检请求
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    logRequest(method, pathname, 204);
    return;
  }

  // 查找路由
  const { handler, params } = matchRoute(method, pathname);

  if (handler) {
    try {
      // multipart/form-data 请求（如 upload_img）不通过 parseBody，由 handler 自行处理 raw request
      const contentType = req.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');
      let body = {};
      if (!isMultipart && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        body = await parseBody(req);
      }
      req.params = params; // 附加路由参数
      await handler(req, res, body);
      logRequest(method, pathname, res.statusCode || 200);
    } catch (error) {
      console.error('请求处理错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
      logRequest(method, pathname, 500);
    }
  } else if (method === 'GET') {
    // 静态文件服务：尝试从 webview 目录提供文件
    serveStaticFile(pathname, res);
    logRequest(method, pathname, res.statusCode || 200);
  } else {
    // 非 GET 的未知路由：返回兼容响应
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 0, message: 'ok', data: null }));
    logRequest(method, pathname, 200);
  }
}

/**
 * 静态文件服务
 * @param {string} pathname 
 * @param {import('http').ServerResponse} res 
 */
function serveStaticFile(pathname, res) {
  // 上传文件服务：/uploads/* 或 /proxy/img/uploads/* 从上传目录提供
  // 前端 proxyImage() 会将 http://localhost:3001 替换为 /proxy/img，所以需要同时支持两种路径
  const uploadsPrefix = pathname.startsWith('/proxy/img/uploads/') 
    ? '/proxy/img/uploads/' 
    : pathname.startsWith('/uploads/') 
      ? '/uploads/' 
      : null;
  if (uploadsPrefix) {
    const uploadPath = join(config.uploadsDir, pathname.replace(uploadsPrefix, ''));
    if (existsSync(uploadPath)) {
      try {
        const content = readFileSync(uploadPath);
        const ext = extname(uploadPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
    return;
  }

  // 默认返回 index.html（SPA 支持）
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = join(WEBVIEW_ROOT, filePath);

  if (existsSync(fullPath)) {
    try {
      const content = readFileSync(fullPath);
      const ext = extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  } else {
    // SPA fallback: 返回 index.html
    const indexPath = join(WEBVIEW_ROOT, 'index.html');
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, message: 'ok', data: null }));
    }
  }
}

// 创建服务器
const server = http.createServer(handleRequest);

// 启动服务器
server.listen(config.port, () => {
  console.log('\n🚀 CodeMaker API Server');
  console.log('========================');
  printConfigStatus();
  console.log(`✅ 服务已启动: http://localhost:${config.port}`);
  console.log(`📋 健康检查: http://localhost:${config.port}/health`);
  console.log('\n按 Ctrl+C 停止服务\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});
