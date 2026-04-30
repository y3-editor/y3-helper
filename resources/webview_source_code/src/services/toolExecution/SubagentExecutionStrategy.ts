/**
 * Subagent执行策略
 * 默认所有安全操作自动执行，危险操作拒绝或需要确认
 */

import { ToolCall } from '../../services';
import { ExecutionContext } from '../../types/executionContext';
import { ToolExecutionStrategy } from './ToolExecutionStrategy';
import { terminalCmdFunction } from '../../routes/CodeChat/ChatMessagesList/TermialPanel';

export class SubagentExecutionStrategy implements ToolExecutionStrategy {
  getStrategyName(): string {
    return 'Subagent';
  }

  shouldAutoExecute(toolCall: ToolCall, _context: ExecutionContext): boolean {
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
    return ['edit_file', 'reapply', 'replace_in_file', 'write_to_file'].includes(toolName);
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
      'retrieve_code',
      'retrieve_knowledge',
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
      'retrieve_code',
      'retrieve_knowledge',
    ];
  }

  private getEditTools(): string[] {
    return ['edit_file', 'reapply', 'replace_in_file', 'write_to_file'];
  }

  private getMCPTools(): string[] {
    return ['use_mcp_tool', 'access_mcp_resource'];
  }

  private getPlanTools(): string[] {
    return ['make_plan', 'write_todo'];
  }

  /**
   * 检查终端命令是否安全
   */
  private isSafeCommand(toolCall: ToolCall): boolean {
    try {
      const params = JSON.parse(toolCall.function.arguments || '{}');
      const command = params.command?.toLowerCase() || '';

      // Subagent对危险命令更严格
      const dangerousPatterns = [
        'rm -rf',
        'sudo',
        'chmod 777',
        'chmod +x',
        'mv /',
        'dd if=',
        'format',
        '> /dev/',
        'killall',
        'pkill',
        'init ',
        'shutdown',
        'reboot',
        'halt',
        'systemctl',
        'service ',
        'apt install',
        'yum install',
        'pip install',
        'npm install -g',
        'curl | sh',
        'wget | sh',
        'bash <',
        'sh <',
      ];

      const isDangerous = dangerousPatterns.some(pattern =>
        command.includes(pattern)
      );

      if (isDangerous) {
        console.warn(`[Subagent] Blocking dangerous command: ${command}`);
        return false;
      }

      // 检查是否是安全的常用命令
      const safeCommandPatterns = [
        /^ls\s/,
        /^cat\s/,
        /^grep\s/,
        /^find\s/,
        /^echo\s/,
        /^pwd$/,
        /^whoami$/,
        /^date$/,
        /^which\s/,
        /^node\s.*\.js$/,
        /^python\s.*\.py$/,
        /^npm\s+(run|test|build)$/,
      ];

      return safeCommandPatterns.some(pattern => pattern.test(command));
    } catch (error) {
      console.warn('[Subagent] Command parsing failed, blocking execution:', error);
      return false;
    }
  }
}