/**
 * 工具分类和环境检查逻辑
 */

import { useMemo } from 'react';
import { ChatMessage, ToolCall } from '../../services';
import {
  createMainAgentContext,
  createSubagentContext,
  AutoExecutePermissions
} from '../../types/executionContext';
import { useChatStore } from '../../store/chat';
import { useChatConfig } from '../../store/chat-config';
import { useWorkspaceStore } from '../../store/workspace';
import { useChatTerminalStore } from '../../store/chatTerminal';
import { useExtensionStore, IDE } from '../../store/extension';
import { useChatTerminal } from '../../routes/CodeChat/ChatMessagesList/TermialPanel';
import { ToolClassificationResult, ToolTypeChecks, EnvironmentChecks } from './types';

export function useToolClassification(message: ChatMessage): ToolClassificationResult {
  const currentSessionId = useChatStore(state => state.currentSessionId);
  const currentSession = useChatStore(state => state.currentSession());
  const autoApprove = useChatConfig(state => state.autoApprove);
  const autoApply = useChatConfig(state => state.autoApply);
  const autoExecute = useChatConfig(state => state.autoExecute);
  const autoTodo = useChatConfig(state => state.autoTodo);

  // 环境相关状态
  const workspaceInfo = useWorkspaceStore(state => state.workspaceInfo);
  const ide = useExtensionStore(state => state.IDE);
  const enableTerminal = useChatTerminalStore(state => state.enableTerminal);

  // 终端工具检查
  const { hasTerminalTool, hasDangerousCommand } = useChatTerminal(message);

  return useMemo(() => {
    const toolGroups = new Map<string, ToolCall[]>();

    // 分组工具调用
    message.tool_calls?.forEach(tool => {
      const toolType = getToolType(tool.function.name);
      if (!toolGroups.has(toolType)) {
        toolGroups.set(toolType, []);
      }
      toolGroups.get(toolType)!.push(tool);
    });

    // 判断工具类型特征（提前定义，供下面使用）
    const hasTaskTools = message.tool_calls?.some(tc => tc.function.name === 'task') || false;
    const hasMultipleTools = (message.tool_calls?.length || 0) > 1;
    const hasMixedTools = hasMultipleTools &&
      new Set(message.tool_calls?.map(tool => tool.function.name)).size > 1;
    const hasMultipleSubagents = hasMultipleTools &&
      (message.tool_calls?.every(tool => tool.function.name === 'task') ?? false);

    // 详细的工具类型判断
    const toolTypeChecks: ToolTypeChecks = {
      hasEditFileTool: message.tool_calls?.some((tool) =>
        ['edit_file', 'reapply', 'replace_in_file'].includes(tool.function.name)
      ) || false,

      hasListFilesTool: message.tool_calls?.some((tool) =>
        ['list_files_top_level', 'list_files_recursive', 'view_source_code_definitions_top_level'].includes(tool.function.name)
      ) || false,

      hasReadFileTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'read_file'
      ) || false,

      hasMCPTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'use_mcp_tool' || tool.function.name === 'access_mcp_resource'
      ) || false,

      hasMakePlanTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'make_plan'
      ) || false,

      hasTodoTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'write_todo'
      ) || false,

      hasAskUserQuestionTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'ask_user_question'
      ) || false,

      hasGlobSearchTool: message.tool_calls?.some((tool) =>
        tool.function.name === 'glob_search'
      ) || false,

      hasClaudeEditTool: message.tool_calls?.some((tool) =>
        ['edit', 'write'].includes(tool.function.name)
      ) || false,

      hasTerminalTool,
      hasDangerousCommand,

      isFileRelatedTool: message.tool_calls?.some((tool) =>
        ['read_file', 'list_dir', 'list_files_top_level', 'list_files_recursive',
          'search_files', 'grep_search', 'glob_search', 'edit_file', 'reapply', 'replace_in_file', 'write_to_file']
          .includes(tool.function.name)
      ) || false,

      hasTaskTool: hasTaskTools,
    };

    // 环境检查
    const environmentChecks: EnvironmentChecks = {
      repoNotMatch: (() => {
        let notMatch = false;
        if (workspaceInfo.repoName) {
          if (currentSession?.chat_repo && currentSession?.chat_repo !== workspaceInfo.repoName) {
            notMatch = true;
          }
        } else {
          notMatch = true;
        }
        return notMatch;
      })(),
      isVsCodeIDE: ide === IDE.VisualStudioCode,
      isJetBrainsIDE: ide === IDE.JetBrains,
      enableTerminal,
    };

    // 构建权限对象
    const permissions: AutoExecutePermissions = {
      autoApprove,
      autoApply,
      autoExecute,
      autoTodo,
    };

    // 推断执行上下文
    const executionContext = hasTaskTools
      ? createSubagentContext(message.id || '', currentSessionId || '')
      : createMainAgentContext(message.id || '', currentSessionId || '', permissions);

    return {
      toolGroups,
      executionContext,
      hasTaskTools,
      hasMixedTools,
      hasMultipleSubagents,
      toolTypeChecks,
      environmentChecks,
    };
  }, [
    message,
    currentSessionId,
    currentSession?.chat_repo,
    autoApprove,
    autoApply,
    autoExecute,
    autoTodo,
    workspaceInfo.repoName,
    ide,
    enableTerminal,
    hasTerminalTool,
    hasDangerousCommand
  ]);
}

function getToolType(toolName: string): string {
  if (toolName === 'task') return 'task';
  if (toolName === 'run_terminal_cmd') return 'terminal';
  if (['edit_file', 'reapply', 'replace_in_file', 'write', 'edit'].includes(toolName)) return 'edit';
  if (['use_mcp_tool', 'access_mcp_resource'].includes(toolName)) return 'mcp';
  if (toolName === 'make_plan') return 'plan';
  if (toolName === 'write_todo') return 'todo';
  if (toolName === 'ask_user_question') return 'question';
  if (toolName === 'use_skill') return 'skill';
  if (['read_file', 'list_dir', 'list_files_top_level', 'list_files_recursive',
    'search_files', 'grep_search', 'glob_search', 'write_to_file'].includes(toolName)) return 'file';
  return 'other';
}
