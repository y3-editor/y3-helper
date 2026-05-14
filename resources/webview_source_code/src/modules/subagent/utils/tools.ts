/**
 * 工具过滤函数
 *
 * 根据 Agent 的白名单和黑名单过滤工具列表。
 */

import { Tool } from '../../../store/workspace';
import type { Agent } from '../types';

/**
 * 旧工具名到规范工具名的映射（向后兼容）
 */
const LEGACY_TO_CANONICAL: Record<string, string> = {
  edit_file: 'write',
  replace_in_file: 'edit',
};

/**
 * 规范工具名到模式特定工具名的别名映射（单向映射）。
 *
 * Agent.tools 白名单应使用规范名（ClaudeEdit 风格），系统自动展开为兼容工具名：
 *   - 当 agent.tools=['write'] 时：
 *     * ClaudeEdit 模式：allTools 含 'write'，直接命中
 *     * CodemakerEdit 模式：allTools 含 'edit_file'，通过别名命中
 *   - 当 agent.tools=['edit'] 时同理
 */
const CANONICAL_TOOL_ALIASES: Record<string, string[]> = {
  // ClaudeEdit 规范名 → CodemakerEdit 等价工具（单向映射）
  write: ['edit_file'],
  edit: ['replace_in_file'],
};

/**
 * 标准化工具名：将旧工具名转换为规范名
 */
function normalizeToolName(toolName: string): string {
  return LEGACY_TO_CANONICAL[toolName] || toolName;
}

/**
 * 根据 Agent 的白名单和黑名单过滤工具列表。
 * 1. 标准化工具名：将旧工具名（edit_file/replace_in_file）转换为规范名（write/edit）
 * 2. 展开规范名别名：使规范名同时命中各模式对应的实际工具
 * 3. 应用白名单过滤
 * 4. 应用黑名单排除
 * 5. 子代理自动排除 task 工具，避免无限递归
 */
export function getToolsForAgent(allTools: Tool[], agent: Agent): Tool[] {
  const disallowedSet = new Set(agent.disallowedTools || []);

  // 子代理自动禁用的工具：
  // - task：避免无限递归
  // - ask_user_question：子代理不应直接打断用户流程
  disallowedSet.add('task');
  disallowedSet.add('ask_user_question');
  // TODO: 暂时屏蔽
  disallowedSet.add('search_tool');

  // tools 未指定时表示允许所有工具（不做白名单过滤），仅走黑名单
  if (!agent.tools) {
    return allTools.filter((tool) => !disallowedSet.has(tool.function.name));
  }

  // 1. 标准化工具名（旧名→规范名）
  const normalizedTools = agent.tools.map(normalizeToolName);

  // 2. 展开规范名别名，使 write/edit 同时命中各模式对应的实际工具
  const allowedSet = new Set<string>();
  for (const toolName of normalizedTools) {
    allowedSet.add(toolName);
    CANONICAL_TOOL_ALIASES[toolName]?.forEach((alias) => allowedSet.add(alias));
  }

  return allTools.filter((tool) => {
    const name = tool.function.name;
    return allowedSet.has(name) && !disallowedSet.has(name);
  });
}