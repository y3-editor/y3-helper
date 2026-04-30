import { ToolCall } from "../services";
import { ChatSession } from "../store/chat";

export const onMessageToolCallResponse = (
  session: ChatSession,
  content: string,
  done: boolean,
  toolCalls: ToolCall[],
  totalTokens: number,
  completionTokens: number) => {

  // 过滤多余的 ask_user_question 和 use_mcp_tool 工具调用，只保留第一个
  const filteredToolCalls = filterDuplicateSpecialTools(toolCalls);

  console.debug('onMessageToolCallResponse', {
    content,
    done,
    toolCalls: filteredToolCalls,  // 使用过滤后的 toolCalls
    originalToolCalls: toolCalls,  // 记录原始 toolCalls 用于调试
    totalTokens,
    completionTokens
  });

  if (filteredToolCalls.find(toolCall => toolCall.function.name === 'make_plan') && session.data) {
    session.data.planModeState = 'draft';
  }

  // 返回过滤后的 toolCalls，确保调用方使用过滤后的结果
  return filteredToolCalls;
}

/**
 * 过滤多余的特殊工具调用，只保留第一个
 * 目前支持：ask_user_question 和 use_mcp_tool
 */
function filterDuplicateSpecialTools(toolCalls: ToolCall[]): ToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return toolCalls;
  }

  let hasFoundAskUserQuestion = false;
  let hasFoundUseMcpTool = false;

  return toolCalls.filter((toolCall) => {
    if (toolCall.function.name === 'ask_user_question') {
      if (hasFoundAskUserQuestion) {
        // 如果已经有一个 ask_user_question，跳过这个
        console.log(`[Filter] Skipping duplicate ask_user_question with id: ${toolCall.id}`);
        return false;
      } else {
        // 第一个 ask_user_question，保留它
        hasFoundAskUserQuestion = true;
        console.log(`[Filter] Keeping first ask_user_question with id: ${toolCall.id}`);
        return true;
      }
    }

    if (toolCall.function.name === 'use_mcp_tool') {
      if (hasFoundUseMcpTool) {
        // 如果已经有一个 use_mcp_tool，跳过这个
        console.log(`[Filter] Skipping duplicate use_mcp_tool with id: ${toolCall.id}`);
        return false;
      } else {
        // 第一个 use_mcp_tool，保留它
        hasFoundUseMcpTool = true;
        console.log(`[Filter] Keeping first use_mcp_tool with id: ${toolCall.id}`);
        return true;
      }
    }

    // 保留其他类型的工具调用
    return true;
  });
}