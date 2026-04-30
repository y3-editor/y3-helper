/**
 * 消息构建与格式化函数
 *
 * 构建子代理的初始消息列表、格式化任务结果。
 */

import { ChatMessage } from '../../../services';
import type { Agent, TaskParams } from '../types';
import { formatSystemPrompt } from './systemPromptFormatter';

/** 聊天消息角色 */
export enum ChatRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool',
}

/**
 * 构建子代理的初始消息列表：system prompt + user prompt。
 * 
 * @param agent - 子代理实例
 * @param params - 任务参数
 * @param cacheEnable - 是否启用 Prompt Caching（默认 false）
 * 
 * @returns 包含 system 和 user 消息的初始消息列表
 * 
 * @example
 * // 无缓存模式
 * buildInitialMessages(agent, params, false)
 * // → [{ role: 'system', content: "text" }, { role: 'user', content: "..." }]
 * 
 * // 缓存模式（prompt 包含分层）
 * buildInitialMessages(agent, params, true)
 * // → [{ role: 'system', content: [{ type: 'text', ... }] }, ...]
 */
export function buildInitialMessages(
  agent: Agent,
  params: TaskParams,
  cacheEnable = false,
): ChatMessage[] {
  const systemContent = formatSystemPrompt(agent.prompt, cacheEnable);

  return [
    {
      role: ChatRole.System,
      content: systemContent,
    },
    {
      role: ChatRole.User,
      content: params.prompt,
    },
  ];
}

/**
 * 从 messages 中取最后一条 assistant 消息的文本内容，
 * 包裹为 `task_id: xxx\n\n<task_result>\n{text}\n</task_result>` 格式。
 */
export function formatTaskResult(
  taskId: string,
  messages: ChatMessage[],
): string {
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

  return [
    `task_id: ${taskId} (for resuming to continue this task if needed)`,
    '',
    '<task_result>',
    lastAssistantText,
    '</task_result>',
  ].join('\n');
}


/**
 * 为指定的子代理生成任务执行约束指令文本。
 * 该文本会被注入到用户消息中，强制主模型调用 task 工具。
 *
 * @internal 通常通过 buildAgentTaskDirective 间接调用
 */
export function generateSubagentConstraintText(agentName: string): string {
  return ` Use the above message and context to generate a prompt and call the task tool with subagent: ${agentName}`;
}

/**
 * Agent 任务执行约束指令
 * 表示"向主模型注入的、要求其以指定子代理执行 task 工具调用的强制指令"
 */
export interface AgentTaskDirective {
  /** 目标子代理名称，对应 subagent_type */
  agentName: string;
  /** 约束指令文本，会作为额外 text part 注入到用户消息末尾 */
  constraintText: string;
}

interface BuildAgentTaskDirectiveOptions {
  /** 当前聊天类型，仅 'codebase' 模式支持 agent 任务 */
  chatType: string;
  /** 用户选择的子代理名称 */
  agentName?: string;
  /** 约束文本生成函数，默认使用 generateSubagentConstraintText（可用于测试替换）*/
  generateConstraint?: (agentName: string) => string;
}

/**
 * 构建 Agent 任务执行约束指令。
 *
 * 仅在 codebase 模式且已选择 agent 时返回有效指令，否则返回 undefined。
 *
 * @example
 * buildAgentTaskDirective({ chatType: 'codebase', agentName: 'explore' })
 * // → { agentName: 'explore', constraintText: ' Use the above...' }
 *
 * buildAgentTaskDirective({ chatType: 'default', agentName: 'explore' })
 * // → undefined
 */
export function buildAgentTaskDirective(
  options: BuildAgentTaskDirectiveOptions,
): AgentTaskDirective | undefined {
  const {
    chatType,
    agentName,
    generateConstraint = generateSubagentConstraintText,
  } = options;

  if (chatType !== 'codebase' || !agentName) {
    return undefined;
  }

  return {
    agentName,
    constraintText: generateConstraint(agentName),
  };
}