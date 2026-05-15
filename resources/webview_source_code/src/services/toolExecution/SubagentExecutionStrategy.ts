/**
 * Subagent执行策略
 * 
 * 此策略在 Subagent executor 中被调用，用于判断工具是否应该自动执行。
 * 
 * 策略规则：
 * - 安全操作（只读工具、文件编辑、MCP工具等）：自动执行（返回 true）
 * - 危险操作（危险的终端命令）：需要用户确认（返回 false）
 * - 嵌套 task 工具：自动执行（返回 true）
 * 
 * 使用位置：src/modules/subagent/core/executor.ts
 * 确认方式：WebView 蒙层显示确认对话框
 * 
 * 注意：危险命令判断与主 Agent 保持一致，使用统一的 codeBaseCheckCommands 配置
 */

import { ToolCall } from '../../services';
import { ExecutionContext } from '../../types/executionContext';
import { ToolExecutionStrategy } from './ToolExecutionStrategy';
import { terminalCmdFunction } from '../../routes/CodeChat/ChatMessagesList/TermialPanel';
import { useConfigStore } from '../../store/config';
import { isCommandSafe } from '../../utils';

export class SubagentExecutionStrategy implements ToolExecutionStrategy {
  getStrategyName(): string {
    return 'Subagent';
  }

  shouldAutoExecute(
    toolCall: ToolCall,
    _context: ExecutionContext,
    toolResult?: { isError?: boolean },
  ): boolean {
    // 工具执行出错时，强制自动执行以便 AI 获得错误信息并重试
    if (toolResult?.isError === true) {
      return true;
    }

    const toolName = toolCall.function.name;

    // Subagent 特殊工具处理
    if (this.isTaskTool(toolName)) {
      // task 工具（嵌套subagent）自动执行
      return true;
    }

    if (this.isUserQuestionTool(toolName)) {
      // ask_user_question 自动处理
      return true;
    }

    if (this.isTerminalTool(toolName)) {
      // 终端命令需要安全检查
      return this.isSafeCommand(toolCall);
    }

    if (this.isEditFileTool(toolName)) {
      // 文件编辑操作自动执行
      return true;
    }

    if (this.isReadOnlyTool(toolName)) {
      // 只读操作总是安全的
      return true;
    }

    if (this.isMCPTool(toolName)) {
      // MCP工具调用自动执行
      return true;
    }

    if (this.isPlanOrTodoTool(toolName)) {
      // Plan和Todo工具自动执行
      return true;
    }

    if (this.isSkillTool(toolName)) {
      // Skill工具自动执行（安全的知识获取操作）
      return true;
    }

    // 其他未知工具，默认自动执行（subagent应该是可信的）
    return this.isGenerallySafeTool(toolName);
  }

  /**
   * 是否是task工具（嵌套subagent）
   */
  private isTaskTool(toolName: string): boolean {
    return toolName === 'task';
  }

  /**
   * 是否是用户问答工具
   */
  private isUserQuestionTool(toolName: string): boolean {
    return toolName === 'ask_user_question';
  }

  /**
   * 是否是终端工具
   */
  private isTerminalTool(toolName: string): boolean {
    return toolName === terminalCmdFunction;
  }

  /**
   * 是否是文件编辑工具
   */
  private isEditFileTool(toolName: string): boolean {
    return ['edit_file', 'reapply', 'replace_in_file', 'write_to_file', 'write', 'edit'].includes(toolName);
  }

  /**
   * 是否是只读工具
   */
  private isReadOnlyTool(toolName: string): boolean {
    const readOnlyTools = [
      'read_file',
      'list_dir',
      'list_files_top_level',
      'list_files_recursive',
      'view_source_code_definitions_top_level',
      'search_files',
      'grep_search',
      'glob_search',
      'retrieve_code',
      'retrieve_knowledge',
      'search_tool', // MCP 工具搜索，只读操作
    ];
    return readOnlyTools.includes(toolName);
  }

  /**
   * 是否是MCP工具
   */
  private isMCPTool(toolName: string): boolean {
    return ['use_mcp_tool', 'access_mcp_resource'].includes(toolName);
  }

  /**
   * 是否是Plan或Todo工具
   */
  private isPlanOrTodoTool(toolName: string): boolean {
    return ['make_plan', 'write_todo'].includes(toolName);
  }

  /**
   * 是否是技能工具
   */
  private isSkillTool(toolName: string): boolean {
    return toolName === 'use_skill';
  }

  /**
   * 是否是通常安全的工具
   */
  private isGenerallySafeTool(toolName: string): boolean {
    // 对于未知工具，subagent保守一些，只允许明确安全的
    const knownSafeTools = [
      ...this.getReadOnlyTools(),
      ...this.getEditTools(),
      ...this.getMCPTools(),
      ...this.getPlanTools(),
      'task',
      'ask_user_question',
      'use_skill',
    ];
    return knownSafeTools.includes(toolName);
  }

  private getReadOnlyTools(): string[] {
    return [
      'read_file',
      'list_dir',
      'list_files_top_level',
      'list_files_recursive',
      'view_source_code_definitions_top_level',
      'search_files',
      'grep_search',
      'glob_search',
      'retrieve_code',
      'retrieve_knowledge',
    ];
  }

  private getEditTools(): string[] {
    return ['edit_file', 'reapply', 'replace_in_file', 'write_to_file', 'write', 'edit'];
  }

  private getMCPTools(): string[] {
    return ['use_mcp_tool', 'access_mcp_resource'];
  }

  private getPlanTools(): string[] {
    return ['make_plan', 'write_todo'];
  }

  /**
   * 检查终端命令是否安全
   * 使用与主 Agent 相同的判断逻辑和配置
   */
  private isSafeCommand(toolCall: ToolCall): boolean {
    try {
      const params = JSON.parse(toolCall.function.arguments || '{}');
      const command = params.command || '';

      // 获取 IDE 配置的危险命令列表（与主 Agent 统一）
      const dangerousCommands = useConfigStore.getState().config.codeBaseCheckCommands;

      // 使用统一的 isCommandSafe 函数判断
      const isSafe = isCommandSafe(dangerousCommands, command);

      if (!isSafe) {
        console.warn(`[Subagent] Blocking dangerous command: ${command}`);
      }

      return isSafe;
    } catch (error) {
      console.warn('[Subagent] Command parsing failed, blocking execution:', error);
      return false;
    }
  }
}