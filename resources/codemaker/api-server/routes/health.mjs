/**
 * 健康检查路由
 */

import { config, validateConfig } from '../config.mjs';

/**
 * 注册健康检查路由
 * @param {Map} routes - 路由映射
 */
export function registerHealthRoutes(routes) {
  // 健康检查端点
  routes.set('GET:/health', (req, res) => {
    const { valid } = validateConfig();
    
    const status = {
      status: valid ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      config: {
        apiKeyConfigured: !!config.apiKey,
        baseUrl: config.baseUrl,
      },
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  });

  // 根路径不再注册路由，由静态文件服务返回 index.html
}
