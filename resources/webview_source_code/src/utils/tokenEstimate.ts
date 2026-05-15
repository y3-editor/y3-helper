/**
 * Token 估算工具
 *
 * 算法说明：
 * - 检测中日韩字符（CJK）占比，按比例插值
 * - 中文内容约 2 char/token，英文约 4 char/token，混合按比例
 * - 换行符和特殊字符适当加权
 */

import { ChatMessage, ChatMessageContentText } from "../services";
import { ChatRole } from "../types/chat";

/** CJK 字符正则（中文、平假名、片假名） */
const CJK_REGEX = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/g;

/** 代码检测正则 */
const CODE_REGEX = /^```|function |class |const |let |var |import |export /;

/**
 * 估算文本的 token 数量。
 *
 * 规则：
 * - 纯英文：约 4 char/token
 * - 纯中日韩：约 2 char/token
 * - 混合内容：按 CJK 字符比例在 2~4 之间插值
 * - 代码（无 CJK）：约 3 char/token
 * - 换行符额外 +0.5 token/个
 * - 特殊字符额外 +0.1 token/个
 *
 * @param text 待估算的文本
 * @returns 估算的 token 数量
*/
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const totalChars = text.length;

  // 计算 CJK 字符数量和比例
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const cjkRatio = cjkCount / totalChars;

  // 按 CJK 比例插值确定每 token 对应字符数
  // CJK 比例 0 => 英文约 4 char/token；比例 1 => 中文约 2 char/token
  let charsPerToken: number;
  if (cjkRatio > 0) {
    // 混合内容：在 4（纯英文）和 2（纯中文）之间线性插值
    charsPerToken = 4 - cjkRatio * 2;
  } else if (CODE_REGEX.test(text)) {
    // 纯英文代码：稍微密集一点
    charsPerToken = 3.0;
  } else {
    // 普通英文
    charsPerToken = 4.0;
  }

  // 基础 token 估算
  let tokens = totalChars / charsPerToken;

  // 换行符额外加权（每个换行 +0.5 token）
  const newlineCount = (text.match(/\n/g) || []).length;
  tokens += newlineCount * 0.5;

  // 特殊字符额外加权（每个 +0.1 token）
  const specialCharCount = (text.match(/[{}[\]().,;:!?<>]/g) || []).length;
  tokens += specialCharCount * 0.1;

  return Math.ceil(tokens);
}


/**
 * 估算System Prompt的token数量
 */
export function estimateSystemPromptTokens(messages: ChatMessage[]): number {
  const systemMessage = messages?.[0] || { role: ChatRole.System, content: '' }
  if (systemMessage.role !== ChatRole.System) return 0;

  let content = '';
  if (typeof systemMessage.content === 'string') {
    content = systemMessage.content;
  } else if (Array.isArray(systemMessage.content)) {
    content = systemMessage.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as ChatMessageContentText).text)
      .join('\n');
  }
  return estimateTokens(content);
}