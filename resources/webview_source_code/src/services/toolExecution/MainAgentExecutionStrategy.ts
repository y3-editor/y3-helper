/**
 * 主Agent执行策略
 * 保持现有的交互逻辑，但支持auto选项自动执行
 */

import { ToolCall } from '../../services';
import { ExecutionContext } from '../../types/executionContext';
import { ToolExecutionStrategy } from './ToolExecutionStrategy';
import { terminalCmdFunction } from '../../routes/CodeChat/ChatMessagesList/TermialPanel';
import { useSkillsStore } from '../../store/skills';

export class MainAgentExecutionStrategy implements ToolExecutionStrategy {
  getStrategyName(): string {
    return 'MainAgent';
  }

  shouldAutoExecute(
    toolCall: ToolCall,
    context: ExecutionContext,
    toolResult?: { isError?: boolean },
  ): boolean {
    // 工具执行出错时，强制自动执行以便 AI 获得错误信息并重试
    if (toolResult?.isError === true) {
      return true;
    }

    const permissions = context.permissions;
    if (!permissions) {
      return false; // 没有权限配置，不自动执行
    }

    const toolName = toolCall.function.name;

    // 按工具类型检查对应的auto选项
    if (this.isEditFileTool(toolName)) {
      return permissions.autoApply;
    }

    if (this.isTerminalTool(toolName)) {
      const isSafe = this.isSafeCommand(toolCall);
      return permissions.autoExecute && isSafe;
    }

    if (this.isTodoTool(toolName)) {
      return permissions.autoTodo;
    }

    if (this.isPlanTool(toolName)) {
      // Plan工具需要特殊处理，通常不自动执行
      return false;
    }

    if (this.isUserQuestionTool(toolName)) {
      // ask_user_question 总是自动处理
      return true;
    }

    if (this.isMCPTool(toolName)) {
      // MCP工具由 handleMCPTools 单独处理，这里返回false，避免在标准流程中处理
      return false;
    }

    if (this.isSkillTool(toolName)) {
      // use_skill 工具：启用（未禁用）即自动执行
      try {
        const skillsStore = useSkillsStore.getState();
        const params = JSON.parse(toolCall.function.arguments || '{}');
        const skillNames: string | string[] = params.skill_name;
        const names = Array.isArray(skillNames) ? skillNames : [skillNames];
        return names.every((name: string) => !skillsStore.skillConfigs[name]?.disabled);
      } catch {
        return false;
      }
    }

    // 其他工具使用总的 autoApprove 开关
    const isGenerallySafe = this.isGenerallySafeTool(toolName);
    return permissions.autoApprove && isGenerallySafe;
  }

  /**
   * 是否是文件编辑工具
   */
  private isEditFileTool(toolName: string): boolean {
    return ['edit_file', 'reapply', 'replace_in_file', 'write', 'edit'].includes(toolName);
  }

  /**
   * 是否是终端工具
   */
  private isTerminalTool(toolName: string): boolean {
    return toolName === terminalCmdFunction;
  }

  /**
   * 是否是Todo工具
   */
  private isTodoTool(toolName: string): boolean {
    return ['write_todo'].includes(toolName);
  }

  /**
   * 是否是Plan工具
   */
  private isPlanTool(toolName: string): boolean {
    return ['make_plan'].includes(toolName);
  }

  /**
   * 是否是用户问答工具
   */
  private isUserQuestionTool(toolName: string): boolean {
    return ['ask_user_question'].includes(toolName);
  }

  /**
   * 是否是MCP工具
   */
  private isMCPTool(toolName: string): boolean {
    return ['use_mcp_tool', 'access_mcp_resource'].includes(toolName);
  }

  /**
   * 是否是Skill工具
   */
  private isSkillTool(toolName: string): boolean {
    return toolName === 'use_skill';
  }

  /**
   * 是否是通常安全的工具
   */
  private isGenerallySafeTool(toolName: string): boolean {
    const safeTools = [
      'read_file',
      'list_files_top_level',
      'list_files_recursive',
      'view_source_code_definitions_top_level',
      'search_files',
      'grep_search',
      'glob_search',
      'retrieve_code',
      'retrieve_knowledge',
    ];
    return safeTools.includes(toolName);
  }

  /**
   * 检查命令是否安全
   */
  private isSafeCommand(toolCall: ToolCall): boolean {
    try {
      const params = JSON.parse(toolCall.function.arguments || '{}');
      const command = params.command?.toLowerCase() || '';

      // 检查危险命令模式
      const dangerousPatterns = [
        'rm -rf',
        'sudo',
        'chmod 777',
        'mv /',
        'dd if=',
        'format',
        '> /dev/',
        'killall',
        'pkill',
        'init 0',
        'shutdown',
        'reboot',
        'halt',
      ];

      return !dangerousPatterns.some(pattern => command.includes(pattern));
    } catch {
      // 解析失败认为不安全
      return false;
    }
  }
}