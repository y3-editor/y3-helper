/**
 * 工具结果已卸载到工作区磁盘时，Tool 消息 content 的前缀。
 * 须与 codestream-vscode-extension `src/utils/persistToolResult.ts`
 * 中 `PERSISTED_TOOL_OUTPUT_MARKER` 保持字节级一致（影响 prompt cache 与 prune 跳过逻辑）。
 */
export const PERSISTED_TOOL_OUTPUT_MARKER = '<persisted-output>';

export function isPersistedToolOutputContent(content: unknown): boolean {
  return (
    typeof content === 'string' &&
    content.startsWith(PERSISTED_TOOL_OUTPUT_MARKER)
  );
}