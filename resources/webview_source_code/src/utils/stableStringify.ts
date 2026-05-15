/**
 * 稳定化的 JSON 序列化：用于构造可比较的参数指纹。
 *
 * 规则：
 * - 对象按 key 字典序递归序列化；undefined 字段跳过（与字段缺失等价）
 * - 数组保持原顺序递归序列化（数组顺序本身带语义）
 * - null / 基本类型走 JSON.stringify 原生行为
 * - 递归深度超过 MAX_DEPTH 时返回占位符，避免异常对象导致栈溢出
 */

const MAX_DEPTH = 50;

export function stableStringify(value: unknown, depth = 0): string {
  if (depth > MAX_DEPTH) return '"[MaxDepth]"';
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v, depth + 1)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k], depth + 1))
      .join(',') +
    '}'
  );
}
