/**
 * 工具调用标题和显示相关逻辑
 */

import { useMemo } from 'react';
import { ChatMessage } from '../../services';
import { getToolCallQuery } from '../../utils/toolCall';
import { ToolCallTitleInfo } from './types';

export function useToolCallTitle(
  message: ChatMessage,
  hasEditFileTool: boolean,
  hasTerminalTool: boolean,
  hasMCPTool: boolean,
  hasToolCallError: boolean,
  hasMakePlanTool: boolean,
  hasAskUserQuestionTool: boolean,
  hasListFilesTool: boolean,
  hasReadFileTool: boolean,
  hasGlobSearchTool: boolean,
  hasClaudeEditTool: boolean,
): ToolCallTitleInfo {
  const toolCallTitle = useMemo(() => {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return '工具调用';
    }
    // 使用第一个工具调用来生成标题
    const firstTool = message.tool_calls[0];
    return getToolCallQuery(firstTool.function.name, firstTool.function.arguments || '');
  }, [message.tool_calls]) as string;

  const shouldShowHeader = useMemo(() => {
    return !hasEditFileTool &&
      !hasTerminalTool &&
      !hasMCPTool &&
      !hasToolCallError &&
      !hasMakePlanTool &&
      !hasAskUserQuestionTool &&
      !hasListFilesTool &&
      !hasGlobSearchTool &&
      !hasReadFileTool &&
      !hasClaudeEditTool
  }, [
    hasEditFileTool,
    hasTerminalTool,
    hasMCPTool,
    hasToolCallError,
    hasMakePlanTool,
    hasAskUserQuestionTool,
    hasListFilesTool,
    hasReadFileTool,
    hasGlobSearchTool,
    hasClaudeEditTool,
  ]);

  return {
    toolCallTitle,
    shouldShowHeader,
  };
}
