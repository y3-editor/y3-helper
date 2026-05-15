import type { ToolCall } from '../services';
import { stableStringify } from './stableStringify';

/**
 * 从一轮 tool_calls 计算唯一的「轮 key」。
 *
 * 规则：
 * 1. 对每个 tool_call，取 function.name + ':' + stableStringify(parsedArguments)。
 *    arguments 为 JSON 字符串，尝试 parse 失败则退回原字符串。
 * 2. 将所有子 key 按字典序排序后用 '|' 连接 —— 保证一轮内 tool_call 顺序不影响结果。
 *
 * 说明：
 * - 空数组（没有 tool_call 的一轮）返回空串，调用方通常在 toolCalls.length > 0 时才调用。
 * - 跳过 name 缺失的脏数据，避免把 "undefined" 混进 key。
 */
export function computeRoundKey(toolCalls: ToolCall[]): string {
  if (!toolCalls || toolCalls.length === 0) return '';
  const subKeys: string[] = [];
  for (const tc of toolCalls) {
    const name = tc?.function?.name;
    if (!name) continue;
    const rawArgs = tc.function.arguments;
    let parsed: unknown = rawArgs;
    if (typeof rawArgs === 'string') {
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        parsed = rawArgs;
      }
    }
    subKeys.push(name + ':' + stableStringify(parsed));
  }
  subKeys.sort();
  return subKeys.join('|');
}
