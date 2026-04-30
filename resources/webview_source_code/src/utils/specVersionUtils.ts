/**
 * OpenSpec 版本工具 — Y3 stub
 * Y3Maker 不使用 OpenSpec 模式，版本检查直接返回默认值
 */
export function supportsOpenSpecVersionSelection(..._args: any[]): boolean {
  return false;
}

/**
 * Y3 stub: Subagent 版本检查 — Y3 始终支持
 */
export const supportsSubagent = (..._args: any[]): boolean => true;