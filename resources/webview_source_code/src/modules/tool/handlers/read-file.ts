/**
 * ReadFileHandler — 文件读取结果处理器
 *
 * 处理 `read_file` 工具的结果，按以下优先级分支：
 * 1. .c/.h 安全限制（仅 source === 'codechat' 且未解除限制）
 * 2. 文档解析回调（extra.parseDocStatus === NotParsed 且 ctx.onParseDoc 存在）
 * 3. 图片解析回调（isImageFileWithPath 且 ctx.onParseImage 存在）
 * 4. 大文件截断提示（行数 > exceedsMaxLines + 10 = 1610）
 * 5. 普通截断（truncateContent）
 *
 * 参考 CodeChat.tsx:1645-1697 原始处理逻辑
 */

import { truncateContent, isImageFileByPath } from '../../../utils';
import {
  maxTruncatedLine,
  getFilePrompt,
} from '../../../store/workspace/tools/read';
import { EParsedDocsStatus } from '../../../utils/chatAttachParseHandler';
import type {
  RawToolCallResult,
  ProcessedToolResult,
  ProcessContext,
  ToolResultHandler,
} from '../types';

/** 大文件阈值：允许 10 行误差 */
const LARGE_FILE_THRESHOLD = maxTruncatedLine + 10; // 1610

export class ReadFileHandler implements ToolResultHandler {
  readonly toolNames = ['read_file'];

  process(
    raw: RawToolCallResult,
    ctx: ProcessContext,
  ): ProcessedToolResult | null {
    const { tool_result, extra } = raw;
    const content = tool_result.content;
    const isError = tool_result.isError ?? false;
    const path: string = (tool_result as any).path ?? extra?.path ?? '';

    // ① .c/.h 安全限制（仅 codechat，且未解除限制）
    if (ctx.source === 'codechat') {
      const fileExt = path ? path.split('.').pop() : '';
      if (
        (fileExt === 'c' || fileExt === 'h') &&
        !ctx.cUnrestrict &&
        !ctx.isPrivateModel
      ) {
        return {
          content: '(出于安全考虑，当前文件不允许读取)',
          path,
          isError,
        };
      }
    }

    // ② 文档解析回调（extra.parseDocStatus 为未解析状态且回调存在）
    if (
      extra?.parseDocStatus === EParsedDocsStatus.NotParsed &&
      ctx.onParseDoc
    ) {
      ctx.onParseDoc(raw);
      return null;
    }

    // ③ 图片解析回调（isImageFileByPath 且回调存在）
    if (isImageFileByPath(path) && ctx.onParseImage) {
      ctx.onParseImage(raw);
      return null;
    }

    // ④ 大文件截断提示（行数 > 1610）
    const lines = content.split('\n');
    if (lines.length > LARGE_FILE_THRESHOLD) {
      return {
        content: getFilePrompt(path, content),
        path,
        isError: false,
      };
    }

    // ⑤ 普通截断
    return {
      content: truncateContent(content),
      path,
      isError,
    };
  }
}

export const readFileHandler = new ReadFileHandler();