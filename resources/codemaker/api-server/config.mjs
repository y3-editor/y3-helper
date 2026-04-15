/**
 * 配置模块 - 读取和验证环境变量
 * 
 * 使用通用命名，支持任意 OpenAI 兼容的 API 服务
 * 注意：服务器不保留任何默认值，所有配置由客户端提供
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __config_dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  // API Key（可选，客户端可提供）
  apiKey: process.env.AI_API_KEY || process.env.LINKAPI_API_KEY || '',
  
  // API 基础地址（可选，客户端必须提供）
  baseUrl: process.env.AI_API_BASE_URL || process.env.LINKAPI_BASE_URL || '',
  
  // API 协议类型：'chat-completions' (默认) 或 'responses'
  wireApi: process.env.AI_WIRE_API || 'chat-completions',

  // 服务端口（默认 3001）
  port: parseInt(process.env.PORT || '3001', 10),

  // 上传文件存储目录
  uploadsDir: join(process.env.CHAT_HISTORY_PATH || __config_dirname, 'uploads'),
};

// 确保上传目录存在
if (!existsSync(config.uploadsDir)) {
  mkdirSync(config.uploadsDir, { recursive: true });
}

/**
 * 验证配置
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateConfig() {
  const warnings = [];
  
  if (!config.apiKey) {
    warnings.push('💡 AI_API_KEY 未设置，需要客户端提供 API Key');
  }
  
  if (!config.baseUrl) {
    warnings.push('💡 AI_API_BASE_URL 未设置，需要客户端提供 API 地址');
  }
  
  return {
    valid: true,
    warnings,
  };
}

/**
 * 打印配置状态
 */
export function printConfigStatus() {
  console.log('\n📋 配置状态:');
  console.log(`   API Key: ${config.apiKey ? '✅ 已配置（服务器端）' : '⏳ 等待客户端提供'}`);
  console.log(`   Base URL: ${config.baseUrl ? config.baseUrl : '⏳ 等待客户端提供'}`);
  console.log(`   Wire API: ${config.wireApi}`);
  console.log(`   Port: ${config.port}`);
  
  const { warnings } = validateConfig();
  if (warnings.length > 0) {
    console.log('\n💡 提示:');
    warnings.forEach(w => console.log(`   ${w}`));
  }
  console.log('');
}