/**
 * 工具过滤函数
 *
 * 根据 Agent 的白名单和黑名单过滤工具列表。
 */

import { Tool } from '../../../store/workspace';
import type { Agent } from '../types';


/**
 * 根据 Agent 的白名单和黑名单过滤工具列表。
 * 1. 先从全量工具中保留 Agent.tools 白名单中的工具
 * 2. 再根据 Agent.disallowedTools 黑名单排除
 * 3. 子代理自动排除 task 工具，避免无限递归
 */
export function getToolsForAgent(allTools: Tool[], agent: Agent): Tool[] {
  const disallowedSet = new Set(agent.disallowedTools || []);

  // 子代理自动禁用 task 工具，避免无限递归
  disallowedSet.add('task');

  // tools 未指定时表示允许所有工具（不做白名单过滤），仅走黑名单
  if (!agent.tools) {
    return allTools.filter((tool) => !disallowedSet.has(tool.function.name));
  }

  const allowedSet = new Set(agent.tools);
  return allTools.filter((tool) => {
    const name = tool.function.name;
    return allowedSet.has(name) && !disallowedSet.has(name);
  });
}