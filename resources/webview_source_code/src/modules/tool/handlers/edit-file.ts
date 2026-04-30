/**
 * EditFileHandler — 文件编辑结果格式化处理器
 *
 * 处理 `edit_file`、`replace_in_file`、`reapply` 工具的结果内容格式化：
 * - 失败时：返回 tool_result.content（原始错误信息）
 * - 成功时：使用 extra.finalResult 作为内容
 *   - 大文件（行数 > maxTruncatedLine = 1600）→ getDiffPatchOfContent 生成 diff
 *   - 普通文件 → 直接返回 finalResult
 *
 * metadata.isLargeFile 标记是否为大文件。
 *
 * 参考 CodeChat.tsx:1698-1732 原始处理逻辑
 */

import {
  maxTruncatedLine,
  getDiffPatchOfContent,
} from '../../../store/workspace/tools/read';
import type {
  RawToolCallResult,
  ProcessedToolResult,
  // ProcessContext,
  ToolResultHandler,
} from '../types';

export class EditFileHandler implements ToolResultHandler {
  readonly toolNames = ['edit_file', 'replace_in_file', 'reapply'];

  process(
    raw: RawToolCallResult,
    // _ctx: ProcessContext,
  ): ProcessedToolResult {
    const { tool_result, extra } = raw;
    const isError = tool_result.isError ?? false;

    // 失败时直接返回 tool_result.content
    if (isError) {
      return {
        content: tool_result.content,
        isError: true,
      };
    }

    // 成功时使用 extra.finalResult
    const beforeEdit: string = extra?.beforeEdit || '';
    let finalResult: string = extra?.finalResult || '';
    const lineCount = finalResult.split('\n').length;
    const isLargeFile = lineCount > maxTruncatedLine;

    if (isLargeFile) {
      finalResult = getDiffPatchOfContent(beforeEdit, finalResult);
    }

    return {
      content: finalResult,
      isError: false,
      metadata: {
        isLargeFile,
      },
    };
  }
}

export const editFileHandler = new EditFileHandler();