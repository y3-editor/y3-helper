/**
 * DefaultHandler — 通用截断兜底处理器
 *
 * 处理所有未专门注册的工具，如：
 * list_files_top_level、list_files_recursive、view_source_code_definitions_top_level、
 * grep_search、make_plan、write_todo 等
 *
 * 逻辑：
 * - isError: true → 原样返回，不截断
 * - 内容超过 100000 字符 → 截断并追加提示
 *
 * 参考 src/utils/index.ts:truncateContent
 */

import { truncateContent } from '../../../utils';
import type {
  RawToolCallResult,
  ProcessedToolResult,
  ProcessContext,
  ToolResultHandler,
} from '../types';

export class DefaultHandler implements ToolResultHandler {
  /**
   * DefaultHandler 作为兜底不注册具体 toolNames，
   * 通过 processor.setDefaultHandler() 设置
   */
  readonly toolNames: string[] = [];

  process(
    raw: RawToolCallResult,
    _ctx: ProcessContext,
  ): ProcessedToolResult {
    const { content, isError } = raw.tool_result;

    // 错误结果不截断，原样返回
    if (isError) {
      return { content, isError: true };
    }

    // 正常结果截断到 100000 字符
    return {
      content: truncateContent(content),
      isError: false,
    };
  }
}

export const defaultHandler = new DefaultHandler();