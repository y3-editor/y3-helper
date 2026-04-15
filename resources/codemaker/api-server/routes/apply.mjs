/**
 * Apply 路由 - 处理代码编辑合并 (edit_file 的智能合并 API)
 * 
 * 源码版的 edit_file 会把「原文件内容」+「code_edit 片段」发到这个端点，
 * 由 AI 模型做智能合并（理解 // ... existing code ... 等省略标记）
 */

import { streamChatCompletion } from '../ai-provider.mjs';

/**
 * 处理 apply/edit 请求
 * 
 * 请求体:
 * {
 *   messages: [{role, content}],  // 包含 system prompt + user prompt（原文件+code_edit）
 *   model: 'fast_apply_7b',       // 源码版用的模型名
 *   temperature: 0,
 *   original_content: string,     // 原文件内容
 *   code_edit: string,            // AI 生成的代码片段
 *   task_id: string,
 *   stream: true,
 *   filePath: string,
 *   isFallback: boolean
 * }
 * 
 * 我们直接把 messages 转发给配置的 AI API，让它做合并
 */
async function handleApplyEdit(req, res, body) {
  console.log('[Apply] 收到 apply/edit 请求');
  console.log('[Apply] model:', body.model);
  console.log('[Apply] original_content 长度:', body.original_content?.length || 0);
  console.log('[Apply] code_edit 长度:', body.code_edit?.length || 0);
  console.log('[Apply] filePath:', body.filePath || '');

  // 源码版发来的 messages 已经包含了合并提示词
  // 直接转发给 AI Provider 即可
  await streamChatCompletion(body, res);
}

/**
 * 处理 apply/accept_code_generate 请求（确认应用）
 * 源码版用这个端点来上报「用户接受了编辑」
 * 我们的集成版不需要上报，直接返回成功
 */
async function handleAcceptCodeGenerate(req, res, body) {
  console.log('[Apply] 收到 accept_code_generate 请求');
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ code: 0, message: 'ok', data: null }));
}

/**
 * 注册 apply 路由
 * @param {Map} routes - 路由映射
 */
export function registerApplyRoutes(routes) {
  // POST /api/v1/apply/edit - 智能合并编辑
  routes.set('POST:/api/v1/apply/edit', handleApplyEdit);

  // POST /api/v1/apply/accept_code_generate - 确认应用（上报）
  routes.set('POST:/api/v1/apply/accept_code_generate', handleAcceptCodeGenerate);
}
