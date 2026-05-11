/**
 * 工具结果格式化器
 * 
 * 统一管理所有工具调用结果的格式化，包括：
 * - Task 工具（Subagent）执行结果
 * - 用户拒绝工具调用的结果
 * - 其他工具的标准化输出
 * 
 * 设计原则：
 * 1. 使用结构化的 XML 标签包裹内容
 * 2. 提供明确的状态标识
 * 3. 包含 [NOTE] 说明和后续建议
 * 4. 保持格式统一，便于 AI 解析
 */

import type { ChatMessage } from '../services';

// ============================================================
// Task 工具结果格式化
// ============================================================

/** 聊天消息角色（本地定义，避免循环依赖） */
enum ChatRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool',
}

/**
 * Task 执行状态枚举
 */
export enum TaskStatus {
  /** 任务成功完成 */
  Success = 'success',
  /** 任务失败（执行错误） */
  Failed = 'failed',
  /** 任务被用户中止 */
  Aborted = 'aborted',
  /** 任务因达到最大步数被截断（部分完成） */
  Truncated = 'truncated',
}

/**
 * Task 执行结果格式化选项
 * 
 * 包含格式化子代理任务执行结果所需的所有上下文信息
 */
export interface TaskResultFormatOptions {
  /** 任务会话 ID，用于标识和恢复任务 */
  id: string;
  
  /** 任务描述，说明任务的目标和范围 */
  description?: string;
  
  /** 任务执行状态 */
  status: TaskStatus;
  
  /** 会话消息列表，用于提取任务执行结果 */
  messages?: ChatMessage[];
  
  /** 执行错误描述（status 为 Failed 时必填） */
  error?: string;
  
  /** 中止原因说明（status 为 Aborted 时可选） */
  abortReason?: string;
  
  /** 执行此任务的代理类型（如 'explore', 'general'） */
  agent?: string;
  
  /** 任务执行的总步数 */
  steps?: number;
}

/**
 * 格式化 Task 工具的执行结果为统一的结构化格式
 * 
 * 统一格式：
 * ```
 * <task_id>xxx</task_id>
 * <task_request>描述</task_request>
 * <task_status>success|failed|aborted|truncated</task_status>
 * <task_result>结果内容</task_result>
 * <task_rejection>拒绝原因</task_rejection>  # 仅当 status = aborted
 * [NOTE] 额外说明
 * ```
 *
 * @param params - 格式化参数
 * @returns 格式化后的结果字符串
 */
export function formatTaskResult(options: TaskResultFormatOptions): string {
  const {
    id,
    description,
    status,
    messages = [],
    error,
    abortReason,
    agent,
    steps,
  } = options;

  const resultLines: string[] = [];

  // 1. Task ID
  resultLines.push(
    '<task_id>',
    `${id}`,
    '</task_id>',
    '',
  );

  // 2. Task Request（任务描述）
  if (description) {
    resultLines.push(
      '<task_request>',
      description,
      '</task_request>',
      '',
    );
  }

  // 3. Task Status
  resultLines.push(
    '<task_status>',
    status,
    '</task_status>',
    '',
  );

  // 4. Task Result 或 Task Rejection
  if (status === TaskStatus.Aborted) {
    // 用户中止：显示中止信息
    resultLines.push(
      '<task_rejection>',
      abortReason || 'Request interrupted by user for tool use.',
      '</task_rejection>',
      '',
    );
  } else if (status === TaskStatus.Failed) {
    // 执行失败：显示错误描述
    resultLines.push(
      '<task_result>',
      `Error: ${error || 'Task execution failed'}`,
      '</task_result>',
      '',
    );
  } else {
    // 成功或截断：提取最后一条 assistant 消息作为结果
    let lastAssistantText = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        msg.role === ChatRole.Assistant &&
        typeof msg.content === 'string' &&
        msg.content.trim()
      ) {
        lastAssistantText = msg.content;
        break;
      }
    }

    if (!lastAssistantText) {
      lastAssistantText = '(No response from subagent)';
    }

    resultLines.push(
      '<task_result>',
      lastAssistantText,
      '</task_result>',
      '',
    );
  }

  // 5. NOTE 说明与建议
  if (status === TaskStatus.Truncated) {
    resultLines.push(
      '[NOTE] The task was interrupted because it reached the maximum step limit before completing.',
      `Task ID: "${id}" | Agent: ${agent || 'unknown'} | Steps: ${steps || 'N/A'}`,
      '',
      'The task may need further exploration to fully address the original request.',
      'You can either:',
      '  (1) Resume the task by calling task() with the task_id to continue from where it left off.',
      "  (2) Proceed with the partial results above if they are sufficient to answer the user's question.",
    );
  } else if (status === TaskStatus.Success) {
    resultLines.push(
      `[NOTE] Task completed successfully. Task ID: "${id}" for reference.`,
    );
  } else if (status === TaskStatus.Aborted) {
    resultLines.push(
      '[NOTE] The user has interrupted this task. You should:',
      '  (1) Acknowledge the interruption and explain what the task was trying to accomplish.',
      '  (2) Ask the user if they want to proceed with an alternative approach.',
      '  (3) Do NOT retry the same task without explicit user approval.',
    );
  } else if (status === TaskStatus.Failed) {
    resultLines.push(
      '[NOTE] Task execution failed. Review the error message above and consider:',
      '  (1) Whether the task parameters need adjustment.',
      '  (2) If a different approach or agent might be more suitable.',
      '  (3) Whether to ask the user for clarification.',
    );
  }

  return resultLines.join('\n');
}

// ============================================================
// 用户拒绝工具调用结果格式化
// ============================================================

/**
 * 格式化用户拒绝工具调用的结果参数
 */
export interface FormatToolRejectionParams {
  /** 被拒绝的工具名称 */
  toolName: string;
  /** 工具调用 ID */
  toolId?: string;
  /** 可选的拒绝原因说明 */
  reason?: string;
}

/**
 * 格式化用户拒绝工具调用的结果信息
 * 
 * 统一格式：
 * ```
 * <tool_rejection>
 * Tool: xxx
 * Tool Call ID: xxx
 * 
 * Status: User denied this operation.
 * 
 * [NOTE] 后续建议
 * </tool_rejection>
 * ```
 * 
 * @param params - 格式化参数
 * @returns 格式化后的拒绝信息
 */
export function formatToolRejection(params: FormatToolRejectionParams): string {
  const { toolName, toolId, reason } = params;
  
  const lines = [
    '<tool_rejection>',
    `Tool: ${toolName || 'unknown'}`,
  ];
  
  if (toolId) {
    lines.push(`Tool Call ID: ${toolId}`);
  }
  
  lines.push(
    '',
    reason || 'Status: User denied this operation.',
    '',
    '[NOTE] The user has rejected this tool call. You should:',
    '  (1) Acknowledge the rejection and explain what you were trying to do.',
    '  (2) Ask the user if they want to proceed with an alternative approach.',
    '  (3) Do NOT retry the same operation without explicit user approval.',
    '</tool_rejection>'
  );
  
  return lines.join('\n');
}

/**
 * 格式化用户拒绝工具调用的结果（向后兼容的简化版本）
 * @deprecated 推荐使用 formatToolRejection，参数更清晰
 */
export function formatUserDeniedResult(
  toolName: string,
  toolId?: string
): string {
  return formatToolRejection({ toolName, toolId });
}

// ============================================================
// 工具执行错误格式化
// ============================================================

/**
 * 格式化工具执行错误的参数
 */
export interface FormatToolErrorParams {
  /** 工具名称 */
  toolName: string;
  /** 工具调用 ID */
  toolId?: string;
  /** 错误信息 */
  errorMessage: string;
  /** 错误类型（可选） */
  errorType?: string;
}

/**
 * 格式化工具执行错误信息
 * 
 * @param params - 格式化参数
 * @returns 格式化后的错误信息
 */
export function formatToolError(params: FormatToolErrorParams): string {
  const { toolName, toolId, errorMessage, errorType } = params;
  
  const lines = [
    '<tool_error>',
    `Tool: ${toolName}`,
  ];
  
  if (toolId) {
    lines.push(`Tool Call ID: ${toolId}`);
  }
  
  if (errorType) {
    lines.push(`Error Type: ${errorType}`);
  }
  
  lines.push(
    '',
    'Error Message:',
    errorMessage,
    '</tool_error>'
  );
  
  return lines.join('\n');
}