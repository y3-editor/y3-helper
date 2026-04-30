/**
 * RetrieveHandler — 检索结果处理器
 *
 * 处理 `retrieve_code` 和 `retrieve_knowledge` 工具的结果：
 * - 内容为空 → 返回 '未查询到相关信息'
 * - retrieve_code 非空 → 解析 JSON，根据 ctx.allowPublicModelAccess 为每条结果标记 isLpc，
 *   然后重新序列化返回
 * - retrieve_knowledge 非空 → 委托给 DefaultHandler 处理（截断逻辑）
 *
 * 参考 CodeChat.tsx:1768-1797 原始处理逻辑
 */

import { truncateContent } from '../../../utils';
import type {
  RawToolCallResult,
  ProcessedToolResult,
  ProcessContext,
  ToolResultHandler,
} from '../types';

export class RetrieveHandler implements ToolResultHandler {
  readonly toolNames = ['retrieve_code', 'retrieve_knowledge'];

  process(
    raw: RawToolCallResult,
    ctx: ProcessContext,
  ): ProcessedToolResult {
    const { tool_name, tool_result } = raw;
    const content = tool_result.content;
    const isError = tool_result.isError ?? false;

    // 内容为空 → 统一返回提示文本
    if (!content) {
      return {
        content: '未查询到相关信息',
        isError: false,
      };
    }

    // retrieve_code：解析 JSON 并标记 isLpc
    if (tool_name === 'retrieve_code') {
      let searchResult: any[] = [];
      try {
        searchResult = JSON.parse(content);
      } catch (e) {
        console.warn('[RetrieveHandler] 无法解析 retrieve_code 内容：', content);
        // JSON 解析失败，保持原内容
        return {
          content: truncateContent(content),
          isError,
        };
      }

      const isLpc = ctx.allowPublicModelAccess === false;
      searchResult.forEach((item: any) => {
        item.isLpc = isLpc;
        if (item.to_func) {
          item.to_func.forEach((func: any) => {
            func.isLpc = isLpc;
          });
        }
      });

      return {
        content: JSON.stringify(searchResult),
        isError,
      };
    }

    // retrieve_knowledge 非空 → 走 DefaultHandler 截断逻辑
    return {
      content: truncateContent(content),
      isError,
    };
  }
}

export const retrieveHandler = new RetrieveHandler();