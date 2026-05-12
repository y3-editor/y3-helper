/**
 * 工具执行策略接口
 * 定义不同执行环境下的工具调用行为
 */

import { ToolCall } from '../../services';
import { ExecutionContext } from '../../types/executionContext';

export interface ToolExecutionStrategy {
  /**
   * 判断工具是否应该自动执行
   * @param toolResult 工具执行结果，若 isError 为 true 则强制自动执行
   */
  shouldAutoExecute(
    toolCall: ToolCall,
    context: ExecutionContext,
    toolResult?: { isError?: boolean },
  ): boolean;

  /**
   * 获取策略名称（用于调试）
   */
  getStrategyName(): string;
}

/**
 * 工具安全级别
 */
export enum ToolSecurityLevel {
  SAFE = 0,        // read_file, list_files - 可以自动执行
  MODERATE = 1,    // edit_file - 需要简化确认
  DANGEROUS = 2,   // run_command, delete_file - 需要完整确认
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  securityLevel: ToolSecurityLevel;
  autonomousExecutable: boolean;
  requiredPermissions: string[];
}

/**
 * 获取执行策略
 */
export function getExecutionStrategy(context: ExecutionContext): ToolExecutionStrategy {
  if (context.type === 'subagent') {
    return new SubagentExecutionStrategy();
  } else {
    return new MainAgentExecutionStrategy();
  }
}

// 导入具体实现
import { MainAgentExecutionStrategy } from './MainAgentExecutionStrategy';
import { SubagentExecutionStrategy } from './SubagentExecutionStrategy';