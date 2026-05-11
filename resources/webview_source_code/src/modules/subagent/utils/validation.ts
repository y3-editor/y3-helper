/**
 * 工具结果验证函数
 *
 * 验证历史消息中的工具结果是否过期。
 */

import { TOOL_TIMEOUT_MS } from '../constants';
import type { ChatMessage } from '../../../services';
import { ChatRole } from '../../../types/chat';

/**
 * 验证历史消息中的工具结果是否过期。
 *
 * 对 role === 'tool' 的消息检查时间戳：
 * - 超过 threshold 阈值 → 在 content 前注入 `[EXPIRED] ` 前缀
 * - 缺少时间戳 → 一律视为已过期
 *
 * 返回新数组（shallow copy），仅替换过期的消息对象，不修改原数组。
 */
export function validateToolResults(
  messages: ChatMessage[],
  threshold: number = TOOL_TIMEOUT_MS,
): ChatMessage[] {
  const now = Date.now();

  return messages.map((msg) => {
    if (msg.role !== ChatRole.Tool) {
      return msg;
    }

    // 检查消息上是否有时间戳字段
    const timestamp = (msg as any).timestamp as number | undefined;
    const content =
      typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content);

    if (!timestamp) {
      // 缺少时间戳，视为过期
      console.log(
        `[Subagent] Tool result expired for tool ${msg.tool_call_id || 'unknown'} (no timestamp)`,
      );
      return {
        ...msg,
        content: `[EXPIRED] ${content}`,
      };
    }

    const age = now - timestamp;
    if (age > threshold) {
      console.log(
        `[Subagent] Tool result expired for tool ${msg.tool_call_id || 'unknown'}, age: ${age}ms`,
      );
      return {
        ...msg,
        content: `[EXPIRED] ${content}`,
      };
    }

    return msg;
  });
}