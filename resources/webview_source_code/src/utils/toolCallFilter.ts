/**
 * 工具调用过滤器
 * 用于在代码层面约束工具调用的组合规则
 */

import { ToolCall } from '../services';

/**
 * 不能与其他工具混合调用的工具列表
 */
const EXCLUSIVE_TOOLS = new Set([
  'task',                // subagent 任务
  'edit_file',           // 文件编辑
  'replace_in_file',     // 文件替换
  'reapply',             // 重新应用
  'run_terminal_cmd',    // 终端命令
]);

/**
 * 只读工具列表（可以批量调用）
 */
const READ_ONLY_TOOLS = new Set([
  'read_file',
  'grep_search',
  'glob_search',
  'view_source_code_definitions_top_level',
  'retrieve_code',
  'retrieve_knowledge',
]);

export const MAX_READ_ONLY_TOOLS = 2;
export const MAX_TASK_TOOLS = 5;

/**
 * 过滤工具调用，确保符合批处理规则
 *
 * 规则：
 * 1. 可以批量调用多个只读工具（最多 5 个）
 * 2. 可以批量调用多个 task 工具（最多 5 个）
 * 3. exclusive 工具（edit_file, run_terminal_cmd 等）必须单独调用
 * 4. 不能混合 task 和其他工具类别
 *
 * 处理策略：
 * - 如果同时包含 task 和其他工具，只保留第一个 task
 * - 如果同时包含多个 exclusive 工具，只保留第一个
 * - 如果包含 exclusive 工具和其他工具，只保留 exclusive 工具
 *
 * @param toolCalls 原始工具调用列表
 * @returns 过滤后的工具调用列表
 */
export function filterToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  // 过滤掉空值
  const validCalls = toolCalls.filter(call => !!call && !!call.function?.name);

  if (validCalls.length <= 1) {
    return validCalls;
  }

  // 统计工具类型
  const hasTasks = validCalls.some(call => call.function.name === 'task');
  const hasOtherExclusive = validCalls.some(
    call => EXCLUSIVE_TOOLS.has(call.function.name) && call.function.name !== 'task'
  );
  const hasOtherTools = validCalls.some(
    call => !EXCLUSIVE_TOOLS.has(call.function.name)
  );

  // 场景 1: 同时包含 task 和其他工具 -> 只保留 task
  if (hasTasks && (hasOtherTools || hasOtherExclusive)) {
    console.warn(
      '[ToolCallFilter] Detected task calls mixed with other tools. Only keeping task calls.',
      {
        original: validCalls.map(c => c.function.name),
        filtered: validCalls.filter(c => c.function.name === 'task').map(c => c.function.name)
      }
    );
    return validCalls.filter(call => call.function.name === 'task').slice(0, MAX_TASK_TOOLS);
  }

  // 场景 2: 同时包含多个不同的 exclusive 工具 -> 只保留第一个
  if (hasOtherExclusive) {
    const exclusiveTools = validCalls.filter(call =>
      EXCLUSIVE_TOOLS.has(call.function.name) && call.function.name !== 'task'
    );

    if (exclusiveTools.length > 1 || (exclusiveTools.length > 0 && hasOtherTools)) {
      const firstExclusive = exclusiveTools[0];
      console.warn(
        '[ToolCallFilter] Detected exclusive tool with other tools. Only keeping the first exclusive tool.',
        {
          original: validCalls.map(c => c.function.name),
          kept: firstExclusive.function.name
        }
      );
      return [firstExclusive];
    }

    // 如果只有一个 exclusive 工具且没有其他工具，直接返回
    return [exclusiveTools[0]];
  }

  // 场景 3: 全是只读工具 -> 最多保留 MAX_READ_ONLY_TOOLS 个
  if (validCalls.every(call => READ_ONLY_TOOLS.has(call.function.name))) {
    if (validCalls.length > MAX_READ_ONLY_TOOLS) {
      console.warn(
        `[ToolCallFilter] Too many read-only tools. Limiting to ${MAX_READ_ONLY_TOOLS}.`,
        {
          original: validCalls.length,
          filtered: MAX_READ_ONLY_TOOLS
        }
      );
      return validCalls.slice(0, MAX_READ_ONLY_TOOLS);
    }
    return validCalls;
  }

  // 场景 4: 全是 task -> 最多保留 MAX_TASK_TOOLS 个
  if (validCalls.every(call => call.function.name === 'task')) {
    if (validCalls.length > MAX_TASK_TOOLS) {
      console.warn(
        `[ToolCallFilter] Too many task calls. Limiting to ${MAX_TASK_TOOLS}.`,
        {
          original: validCalls.length,
          filtered: MAX_TASK_TOOLS
        }
      );
      return validCalls.slice(0, MAX_TASK_TOOLS);
    }
    return validCalls;
  }

  // 默认情况：返回所有有效的调用（不应该到达这里）
  console.warn('[ToolCallFilter] Unexpected tool call combination:', validCalls.map(c => c.function.name));
  return validCalls;
}

/**
 * 检查工具调用组合是否违反规则
 * @param toolCalls 工具调用列表
 * @returns 违规信息，如果没有违规返回 null
 */
export function validateToolCalls(toolCalls: ToolCall[]): {
  isValid: boolean;
  reason?: string;
  suggestion?: string;
} | null {
  const validCalls = toolCalls.filter(call => !!call && !!call.function?.name);

  if (validCalls.length <= 1) {
    return { isValid: true };
  }

  const toolNames = validCalls.map(c => c.function.name);
  const hasTasks = toolNames.includes('task');
  const hasOtherExclusive = toolNames.some(name => EXCLUSIVE_TOOLS.has(name) && name !== 'task');
  const hasOtherTools = toolNames.some(name => !EXCLUSIVE_TOOLS.has(name));

  // 违规 1: task 和其他工具混合
  if (hasTasks && (hasOtherTools || hasOtherExclusive)) {
    return {
      isValid: false,
      reason: 'task 工具不能与其他工具混合调用',
      suggestion: '请先调用 task，在下一轮再调用其他工具，或者只调用 task'
    };
  }

  // 违规 2: exclusive 工具和其他工具混合
  if (hasOtherExclusive && hasOtherTools) {
    const exclusiveName = toolNames.find(name => EXCLUSIVE_TOOLS.has(name) && name !== 'task');
    return {
      isValid: false,
      reason: `${exclusiveName} 工具必须单独调用`,
      suggestion: `请单独调用 ${exclusiveName}，不要与其他工具混合`
    };
  }

  return { isValid: true };
}