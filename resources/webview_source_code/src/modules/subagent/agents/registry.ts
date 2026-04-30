/**
 * Agent 注册表
 *
 * 管理所有内置 Agent 和查找函数。
 * 未来支持自定义 Agent 时，可扩展为动态注册。
 */

import type { Agent } from '../types';
import { EXPLORE_AGENT } from './explore';
import { GENERAL_AGENT } from './general';

/** 所有内置 Agent 列表 */
export const BUILTIN_AGENTS: Agent[] = [EXPLORE_AGENT, GENERAL_AGENT];

/**
 * 根据名称查找 Agent
 */
export function getAgent(name: string): Agent | undefined {
  return BUILTIN_AGENTS.find((agent) => agent.name === name);
}