/**
 * Tool Result Handlers
 *
 * 各种工具的特定处理逻辑
 */

import { isDocsetFile } from '../../utils/chatAttachParseHandler';
import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';
import type {
  ToolResultInput,
  ToolResultOutput,
  ToolResultProcessContext
} from './types';
import {
  requiresImageProcessing,
  requiresDocProcessing,
  requiresSecurityRestriction,
  applySecurityRestriction,
  processReadFileLargeContent,
  processEditFileResult,
  processRetrieveEmptyResult,
  processMCPToolResult,
  applyGeneralTruncation,
  processImageBufferSync,
} from './utils';
import { getReportEventByToolName } from '../../utils/toolCall';

/** read_file 工具处理器 */
export async function handleReadFile(
  input: ToolResultInput,
  context: ToolResultProcessContext
): Promise<ToolResultOutput> {
  const { tool_result } = input;
  const path = tool_result.path || '';

  // 1. 安全限制检查
  if (requiresSecurityRestriction(
    input.tool_name,
    tool_result.path, // 直接传递原始 path，函数内部会处理 undefined
    context.source,
    context.cUnrestrict,
    context.isPrivateModel
  )) {
    return applySecurityRestriction(input);
  }

  // 2. 异步处理检查
  if (requiresDocProcessing(input)) {
    return {
      content: '',
      path,
      isError: false,
      requiresAsyncProcessing: true,
      asyncType: 'document',
    };
  }

  if (requiresImageProcessing(input)) {
    // 对于 subagent，使用同步处理避免时序问题
    if (context.source === 'subagent') {
      return await processImageBufferSync(input);
    } else {
      // 主 agent 保持异步处理
      return {
        content: '',
        path,
        isError: false,
        requiresAsyncProcessing: true,
        asyncType: 'image',
      };
    }
  }

  // 3. 正常文件内容处理
  const content = tool_result.content as string;

  if (isDocsetFile(path)) {
    return {
      content,
      path,
      isError: tool_result.isError,
      extra: input.extra,
    };
  }

  return processReadFileLargeContent(content, path);
}

/** 编辑工具处理器 */
export function handleEditFile(
  input: ToolResultInput,
  context: ToolResultProcessContext
): ToolResultOutput {
  const result = processEditFileResult(input);

  // 用户事件上报
  if (!input.tool_result.isError) {
    userReporter.report({
      event: getReportEventByToolName({ toolName: input.tool_name, status: 1 }),
      extends: {
        filePath: input.tool_result.path,
        finalResult: input.extra?.finalResult || '',
        beforeEdit: input.extra?.beforeEdit,
        editSnippet: input.extra?.editSnippet,
        replaceSnippet: input.extra?.replaceSnippet,
        taskId: input.extra?.taskId,
        tool_id: input.tool_id,
        tool_name: input.tool_name,
        enablePlanMode: context.session?.data?.enablePlanMode || false,
        source: context.source,
      },
    });
  } else {
    userReporter.report({
      event: getReportEventByToolName({ toolName: input.tool_name, status: 2 }),
      extends: {
        filePath: input.tool_result.path,
        beforeEdit: input.extra?.beforeEdit,
        editSnippet: input.extra?.editSnippet,
        replaceSnippet: input.extra?.replaceSnippet,
        taskId: input.extra?.taskId,
        tool_id: input.tool_id,
        tool_name: input.tool_name,
        enablePlanMode: context.session?.data?.enablePlanMode || false,
        source: context.source,
      },
    });
  }

  return result;
}

/** retrieve 工具处理器 */
export function handleRetrieveTool(
  input: ToolResultInput,
  context: ToolResultProcessContext
): ToolResultOutput {
  if (!input.tool_result.content) {
    return processRetrieveEmptyResult(input);
  }

  // retrieve_code 需要处理 LPC 权限
  if (input.tool_name === 'retrieve_code') {
    let searchResult: any[] = [];
    try {
      const parsed = JSON.parse(input.tool_result.content as string);
      if (!Array.isArray(parsed)) {
        throw new Error('retrieve_code result is not an array');
      }
      searchResult = parsed;
    } catch (e) {
      console.log('无法解析原内容：', input.tool_result.content);
      return {
        content: input.tool_result.content as string,
        path: input.tool_result.path,
        isError: input.tool_result.isError,
        extra: input.extra,
      };
    }

    const isLpc = context.allowPublicModelAccess === false;
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
      path: input.tool_result.path,
      isError: input.tool_result.isError,
      extra: input.extra,
    };
  }

  return {
    content: input.tool_result.content as string,
    path: input.tool_result.path,
    isError: input.tool_result.isError,
    extra: input.extra,
  };
}

/** MCP 工具处理器 */
export function handleMCPTool(
  input: ToolResultInput,
  // context: ToolResultProcessContext
): ToolResultOutput {
  return processMCPToolResult(input);
}

/** 通用工具处理器 */
export function handleGenericTool(
  input: ToolResultInput,
  context: ToolResultProcessContext
): ToolResultOutput {
  // 工具调用错误上报
  if (input.tool_result.isError) {
    userReporter.report({
      event: UserEvent.CHAT_TOOL_CALL_ERROR,
      extends: {
        tool_name: input.tool_name,
        tool_id: input.tool_id,
        session_id: context.session._id,
        error_message: input.tool_result.content as string,
        source: context.source,
      },
    });
  }

  return applyGeneralTruncation(input);
}