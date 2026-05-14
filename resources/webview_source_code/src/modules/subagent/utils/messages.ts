/**
 * 消息构建与格式化函数
 *
 * 构建子代理的初始消息列表、格式化任务结果。
 */

import { ChatMessage } from '../../../services';
import { ChatRole } from '../../../types/chat';
import type { Agent, TaskParams } from '../types';
import { formatSystemPrompt } from './systemPromptFormatter';

// 从统一的工具结果格式化器导出 Task 相关的类型和函数
export {
  formatTaskResult,
  TaskStatus,
  type TaskResultFormatOptions,
} from '../../../utils/toolResultFormatter';

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

// Task 相关的格式化函数已从 ../../../utils/toolResultFormatter 导出

/**
 * 将内容包裹为 system-reminder 格式的标签文本。
 * 与 Claude Code 的 system-reminder 机制一致。
 *
 * @param content - 要包裹的内容
 * @returns 包含 `<system-reminder>` 标签的文本
 *
 * @example
 * wrapSystemReminder('The user wants to invoke explore agent.')
 * // → '<system-reminder>\nThe user wants...\n</system-reminder>'
 */
export function wrapSystemReminder(content: string): string {
  return `<system-reminder>\n${content}\n</system-reminder>`;
}

/**
 * 生成单行 agent 描述（用于 agent listing）。
 *
 * @param agent - Agent 实例
 * @returns 格式化的单行描述
 */
export function formatAgentLine(agent: Agent): string {
  const toolList =
    agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0
      ? agent.tools.join(', ')
      : 'all available tools';
  return `- **${agent.name}**: ${agent.description} (tools: ${toolList})`;
}

/**
 * 生成包含所有 agent 描述的 system-reminder 文本。
 * 每次请求动态生成，避免 agent 定义变化触发 task tool description cache bust。
 *
 * @param agents - Agent 列表
 * @returns 包含 agent listing 的 system-reminder 文本
 *
 * @example
 * buildAgentListingReminder([exploreAgent, generalAgent])
 * // → '<system-reminder>\nAvailable agent types...\n</system-reminder>'
 */
export function buildAgentListingReminder(agents: Agent[]): string {
  const lines = agents.map(formatAgentLine).join('\n');
  const content = `Available agent types for the task tool:\n${lines}`;
  return wrapSystemReminder(content);
}

/**
 * 为指定的子代理生成任务执行约束指令文本。
 * 该文本会作为独立的 system-reminder 消息注入，指示主模型调用 task 工具。
 *
 * @param agentName - 目标子代理名称
 * @returns 自然语言格式的 reminder 内容
 *
 * @internal 通常通过 buildAgentTaskDirective 间接调用
 */
export function generateSubagentConstraintText(agentName: string): string {
  return `The user has explicitly invoked the "${agentName}" subagent via slash command. You MUST immediately call the task tool with subagent_type="${agentName}" and pass the user's full message as the prompt. Do not respond with text, do not call any other tool first. Your only action must be a single task tool call.`;
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