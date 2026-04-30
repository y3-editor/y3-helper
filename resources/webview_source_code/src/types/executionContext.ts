/**
 * 执行上下文定义
 * 用于区分主agent和subagent的执行环境和权限
 */

export interface ExecutionContext {
  /** 执行类型：主agent需要用户确认，subagent自动执行 */
  type: 'main_agent' | 'subagent';
  /** 关联的消息ID */
  messageId: string;
  /** 会话ID */
  sessionId: string;
  /** 自动执行权限配置（主要用于主agent） */
  permissions?: AutoExecutePermissions;
}

export interface AutoExecutePermissions {
  /** 仓库自动读取 */
  autoApprove: boolean;
  /** 代码自动应用 */
  autoApply: boolean;
  /** 命令自动执行 */
  autoExecute: boolean;
  /** Plan自动执行 */
  autoTodo: boolean;
}

/**
 * 判断是否是subagent执行上下文
 */
export function isSubagentContext(context: ExecutionContext): boolean {
  return context.type === 'subagent';
}

/**
 * 判断是否是主agent执行上下文
 */
export function isMainAgentContext(context: ExecutionContext): boolean {
  return context.type === 'main_agent';
}

/**
 * 创建主agent执行上下文
 */
export function createMainAgentContext(
  messageId: string,
  sessionId: string,
  permissions: AutoExecutePermissions
): ExecutionContext {
  return {
    type: 'main_agent',
    messageId,
    sessionId,
    permissions,
  };
}

/**
 * 创建subagent执行上下文
 */
export function createSubagentContext(
  messageId: string,
  sessionId: string
): ExecutionContext {
  return {
    type: 'subagent',
    messageId,
    sessionId,
  };
}