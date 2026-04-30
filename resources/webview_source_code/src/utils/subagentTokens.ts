import type {
  LLMCallUsage,
  SubagentAgentStats,
  SubagentTaskSample,
  SubagentTokens,
} from '../modules/subagent/types';
import { estimateTokens } from './tokenEstimate';

/** 创建空的 subagent token 统计对象 - 和主agent保持一致的完整结构 */
export function createEmptySubagentTokens(): SubagentTokens {
  return {
    input: 0,
    output: 0,
    systemTokens: 0,
    systemToolTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    comporessPromptTokens: 0,
    comporessCompletionTokens: 0,
    readCacheTokens: 0,
    skillTokens: 0,
    ruleTokens: 0,
    mcpTokens: 0,
    inputCost: 0,
    outputCost: 0,
    total: 0,
    byAgent: {},
    recentTasks: [],
  };
}

/** 创建空的 agent 统计对象 - 和主agent保持一致的完整结构 */
export function createEmptySubagentAgentStats(): SubagentAgentStats {
  return {
    input: 0,
    output: 0,
    systemTokens: 0,
    systemToolTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    comporessPromptTokens: 0,
    comporessCompletionTokens: 0,
    readCacheTokens: 0,
    skillTokens: 0,
    ruleTokens: 0,
    mcpTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    inputCost: 0,
    outputCost: 0,
    callCount: 0,
  };
}

/**
 * 估算 subagent 系统 prompt 的 token 数
 * 用于在调用 LLM 前预估系统相关的 token 消耗
 */
export function estimateSubagentSystemTokens(
  agentPrompt: string,
  skillPrompts: string[] = [],
  rulePrompts: string[] = [],
  mcpPrompts: string[] = [],
): {
  systemTokens: number;
  skillTokens: number;
  ruleTokens: number;
  mcpTokens: number;
} {
  const systemTokens = estimateTokens(agentPrompt);
  const skillTokens = skillPrompts.reduce((sum, prompt) => sum + estimateTokens(prompt), 0);
  const ruleTokens = rulePrompts.reduce((sum, prompt) => sum + estimateTokens(prompt), 0);
  const mcpTokens = mcpPrompts.reduce((sum, prompt) => sum + estimateTokens(prompt), 0);

  console.log('🔢 %cSubagent System Token Estimation:', 'color: #6366F1; font-weight: bold;', {
    '🎯 System': systemTokens,
    '⚡ Skill': skillTokens,
    '📏 Rule': ruleTokens,
    '🔌 MCP': mcpTokens,
    '📈 Total': systemTokens + skillTokens + ruleTokens + mcpTokens,
  });

  return {
    systemTokens,
    skillTokens,
    ruleTokens,
    mcpTokens,
  };
}

interface ModelCostInfo {
  promptWeight?: number;
  completionWeight?: number;
  cacheWeightFor5min?: number;
  hitCacheWeight?: number;
}

interface SubagentTokenUsage extends LLMCallUsage {
  /** 系统提示token估算 */
  systemTokens?: number;
  /** 技能相关token估算 */
  skillTokens?: number;
  /** 规则相关token估算 */
  ruleTokens?: number;
  /** MCP相关token估算 */
  mcpTokens?: number;
  /** 压缩prompt token数 */
  comporessPromptTokens?: number;
  /** 压缩completion token数 */
  comporessCompletionTokens?: number;
}

/** 将一次 LLM 调用的 usage 累加到指定 agent 统计对象中 - 支持完整token分类 */
export function updateSubagentAgentStats(
  stats: SubagentAgentStats,
  usage: SubagentTokenUsage,
  modelCostInfo?: ModelCostInfo,
): void {
  const oldStats = { ...stats };

  // 基础token统计
  stats.promptTokens += usage.promptTokens;
  stats.completionTokens += usage.completionTokens;
  stats.input += usage.promptTokens;
  stats.output += usage.completionTokens;

  // 缓存相关
  stats.cacheCreationInputTokens += usage.cacheCreationInputTokens || 0;
  stats.cacheReadInputTokens += usage.cacheReadInputTokens || 0;
  stats.readCacheTokens += usage.cacheReadInputTokens || 0;

  // 系统和工具类token
  const systemTokens = usage.systemTokens || 0;
  const skillTokens = usage.skillTokens || 0;
  const ruleTokens = usage.ruleTokens || 0;
  const mcpTokens = usage.mcpTokens || 0;
  const cacheCreationInputTokens = usage.cacheCreationInputTokens || 0;

  // 参考主agent的逻辑进行token分类
  if (systemTokens <= cacheCreationInputTokens) {
    stats.systemTokens += systemTokens - skillTokens - ruleTokens - mcpTokens;
    stats.systemToolTokens += (cacheCreationInputTokens - systemTokens);
  } else {
    stats.systemTokens += cacheCreationInputTokens;
  }

  stats.skillTokens += skillTokens;
  stats.ruleTokens += ruleTokens;
  stats.mcpTokens += mcpTokens;

  // 压缩相关
  stats.comporessPromptTokens += usage.comporessPromptTokens || 0;
  stats.comporessCompletionTokens += usage.comporessCompletionTokens || 0;

  stats.callCount += 1;

  console.log('🔄 %cSubagent Agent Stats Update:', 'color: #6366F1; font-weight: bold;', {
    '🏷️ Agent': 'subagent',
    '📊 Token Changes': {
      '📥 Prompt': `${oldStats.promptTokens} → ${stats.promptTokens} (+${usage.promptTokens})`,
      '✅ Completion': `${oldStats.completionTokens} → ${stats.completionTokens} (+${usage.completionTokens})`,
      '🎯 System': `${oldStats.systemTokens} → ${stats.systemTokens} (+${systemTokens})`,
      '🛠️ System Tools': `${oldStats.systemToolTokens} → ${stats.systemToolTokens}`,
      '💾 Cache Read': `${oldStats.readCacheTokens} → ${stats.readCacheTokens} (+${usage.cacheReadInputTokens || 0})`,
      '⚡ Skill': `${oldStats.skillTokens} → ${stats.skillTokens} (+${skillTokens})`,
      '📏 Rule': `${oldStats.ruleTokens} → ${stats.ruleTokens} (+${ruleTokens})`,
      '🔌 MCP': `${oldStats.mcpTokens} → ${stats.mcpTokens} (+${mcpTokens})`,
      '🗜️ Compress P': `${oldStats.comporessPromptTokens} → ${stats.comporessPromptTokens} (+${usage.comporessPromptTokens || 0})`,
      '🗜️ Compress C': `${oldStats.comporessCompletionTokens} → ${stats.comporessCompletionTokens} (+${usage.comporessCompletionTokens || 0})`,
    },
    '📞 Call Count': `${oldStats.callCount} → ${stats.callCount}`,
  });

  // 成本计算 - 参考主agent的逻辑
  if (modelCostInfo) {
    const inputCostDelta =
      (usage.promptTokens / 1000) * (modelCostInfo.promptWeight || 0) +
      (cacheCreationInputTokens / 1000) * (modelCostInfo.cacheWeightFor5min || 0) +
      (usage.cacheReadInputTokens / 1000) * (modelCostInfo.hitCacheWeight || 0);

    const outputCostDelta = (usage.completionTokens / 1000) * (modelCostInfo.completionWeight || 0);

    stats.inputCost += inputCostDelta;
    stats.outputCost += outputCostDelta;

    console.log('💰 %cSubagent Agent Cost Update:', 'color: #DC2626; font-weight: bold;', {
      '📥 Input Cost': `${oldStats.inputCost.toFixed(6)} → ${stats.inputCost.toFixed(6)} (+${inputCostDelta.toFixed(6)})`,
      '✅ Output Cost': `${oldStats.outputCost.toFixed(6)} → ${stats.outputCost.toFixed(6)} (+${outputCostDelta.toFixed(6)})`,
      '💸 Total Cost': (stats.inputCost + stats.outputCost).toFixed(6),
    });
  }
}

const MAX_RECENT_TASKS = 20;

/**
 * 将子代理的完整 token 消耗写入主会话的 subagentTokens 独立字段。
 * 支持和主agent一致的完整token分类统计。
 * 不影响 main agent 的 systemTokens / skillTokens / ruleTokens 等分类。
 */
export function mergeSubagentUsageIntoTokens(
  subagentTokens: SubagentTokens,
  agentName: string,
  taskId: string,
  usage: SubagentTokenUsage,
  modelCostInfo?: ModelCostInfo,
): void {
  const oldTokens = { ...subagentTokens };

  // 更新全局汇总 - 基础token
  subagentTokens.input += usage.promptTokens;
  subagentTokens.output += usage.completionTokens;
  subagentTokens.promptTokens += usage.promptTokens;
  subagentTokens.completionTokens += usage.completionTokens;

  // 系统和工具相关token
  const systemTokens = usage.systemTokens || 0;
  const skillTokens = usage.skillTokens || 0;
  const ruleTokens = usage.ruleTokens || 0;
  const mcpTokens = usage.mcpTokens || 0;
  const cacheCreationInputTokens = usage.cacheCreationInputTokens || 0;
  const cacheReadInputTokens = usage.cacheReadInputTokens || 0;

  // 参考主agent逻辑进行系统token分类
  if (systemTokens <= cacheCreationInputTokens) {
    subagentTokens.systemTokens += systemTokens - skillTokens - ruleTokens - mcpTokens;
    subagentTokens.systemToolTokens += (cacheCreationInputTokens - systemTokens);
  } else {
    subagentTokens.systemTokens += cacheCreationInputTokens;
  }

  subagentTokens.skillTokens += skillTokens;
  subagentTokens.ruleTokens += ruleTokens;
  subagentTokens.mcpTokens += mcpTokens;

  // 缓存相关
  subagentTokens.readCacheTokens += cacheReadInputTokens;

  // 压缩相关
  subagentTokens.comporessPromptTokens += usage.comporessPromptTokens || 0;
  subagentTokens.comporessCompletionTokens += usage.comporessCompletionTokens || 0;

  // 计算总数
  const totalTokens = usage.promptTokens + usage.completionTokens;
  subagentTokens.total += totalTokens;

  console.log('⚡ %cSubagent Token Statistics Update:', 'color: #F59E0B; font-weight: bold; background: #FEF3C7; padding: 2px 6px; border-radius: 4px;', {
    '🏷️ Agent': agentName,
    '🆔 Task': taskId.substring(0, 8) + '...',
    '📊 Token Changes': {
      '📈 Total': `${oldTokens.total} → ${subagentTokens.total} (+${totalTokens})`,
      '📥 Input': `${oldTokens.input} → ${subagentTokens.input} (+${usage.promptTokens})`,
      '✅ Output': `${oldTokens.output} → ${subagentTokens.output} (+${usage.completionTokens})`,
      '🎯 System': `${oldTokens.systemTokens} → ${subagentTokens.systemTokens}`,
      '🛠️ System Tools': `${oldTokens.systemToolTokens} → ${subagentTokens.systemToolTokens}`,
      '💾 Cache Read': `${oldTokens.readCacheTokens} → ${subagentTokens.readCacheTokens} (+${cacheReadInputTokens})`,
      '⚡ Skill': `${oldTokens.skillTokens} → ${subagentTokens.skillTokens} (+${skillTokens})`,
      '📏 Rule': `${oldTokens.ruleTokens} → ${subagentTokens.ruleTokens} (+${ruleTokens})`,
      '🔌 MCP': `${oldTokens.mcpTokens} → ${subagentTokens.mcpTokens} (+${mcpTokens})`,
    }
  });

  // 成本计算 - 参考主agent的完整逻辑
  if (modelCostInfo) {
    const inputCostDelta =
      (usage.promptTokens / 1000) * (modelCostInfo.promptWeight || 0) +
      (cacheCreationInputTokens / 1000) * (modelCostInfo.cacheWeightFor5min || 0) +
      (cacheReadInputTokens / 1000) * (modelCostInfo.hitCacheWeight || 0);

    const outputCostDelta = (usage.completionTokens / 1000) * (modelCostInfo.completionWeight || 0);

    subagentTokens.inputCost += inputCostDelta;
    subagentTokens.outputCost += outputCostDelta;

    console.log('💰 %cSubagent Cost Update:', 'color: #EF4444; font-weight: bold;', {
      '📥 Input Cost': `${oldTokens.inputCost.toFixed(6)} → ${subagentTokens.inputCost.toFixed(6)} (+${inputCostDelta.toFixed(6)})`,
      '✅ Output Cost': `${oldTokens.outputCost.toFixed(6)} → ${subagentTokens.outputCost.toFixed(6)} (+${outputCostDelta.toFixed(6)})`,
      '💸 Total Cost': (subagentTokens.inputCost + subagentTokens.outputCost).toFixed(6),
    });
  }

  // 按 agent 类型分组统计
  if (!subagentTokens.byAgent[agentName]) {
    subagentTokens.byAgent[agentName] = createEmptySubagentAgentStats();
    console.log('🆕 %cNew Subagent Stats Created:', 'color: #10B981; font-weight: bold;', agentName);
  }

  const agentStatsBefore = { ...subagentTokens.byAgent[agentName] };
  updateSubagentAgentStats(
    subagentTokens.byAgent[agentName],
    usage,
    modelCostInfo,
  );

  console.log('🤖 %cSubagent Agent-Specific Stats Update:', 'color: #8B5CF6; font-weight: bold;', {
    '🏷️ Agent': agentName,
    '📊 Stats Summary': {
      '📞 Calls': `${agentStatsBefore.callCount} → ${subagentTokens.byAgent[agentName].callCount}`,
      '📥 Input': `${agentStatsBefore.input} → ${subagentTokens.byAgent[agentName].input}`,
      '✅ Output': `${agentStatsBefore.output} → ${subagentTokens.byAgent[agentName].output}`,
      '🎯 System': `${agentStatsBefore.systemTokens} → ${subagentTokens.byAgent[agentName].systemTokens}`,
      '💸 Total Cost': (subagentTokens.byAgent[agentName].inputCost + subagentTokens.byAgent[agentName].outputCost).toFixed(6),
    }
  });

  // 记录最近任务样本（上限 MAX_RECENT_TASKS 条）
  if (!subagentTokens.recentTasks) {
    subagentTokens.recentTasks = [];
  }
  const sample: SubagentTaskSample = {
    taskId,
    agent: agentName,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    systemTokens: systemTokens,
    totalTokens: totalTokens,
    timestamp: Date.now(),
    description: `${agentName} task`,
  };
  subagentTokens.recentTasks.unshift(sample);
  if (subagentTokens.recentTasks.length > MAX_RECENT_TASKS) {
    subagentTokens.recentTasks = subagentTokens.recentTasks.slice(
      0,
      MAX_RECENT_TASKS,
    );
  }

  console.log('📝 %cSubagent Task Sample Added:', 'color: #06B6D4; font-weight: bold;', {
    '📋 Recent Tasks Count': subagentTokens.recentTasks.length,
    '📊 Latest Sample': {
      '🆔 Task': taskId.substring(0, 8) + '...',
      '🏷️ Agent': agentName,
      '📥 Prompt': usage.promptTokens,
      '✅ Completion': usage.completionTokens,
      '🎯 System': systemTokens,
      '📈 Total': totalTokens,
      '⏰ Time': new Date(sample.timestamp).toLocaleTimeString(),
    }
  });
}

/**
 * 将 subagent 的完整 token 统计合并到主 agent 的 consumedTokens 中
 * 这个函数用于在主 agent 的 updateConsumedTokens 中调用
 */
export function updateMainAgentWithSubagentTokens(
  mainConsumedTokens: any, // 主 agent 的 consumedTokens 对象
  subagentTokens: SubagentTokens,
): void {
  // 确保 subagentTokens 字段存在
  if (!mainConsumedTokens.subagentTokens) {
    mainConsumedTokens.subagentTokens = createEmptySubagentTokens();
  }

  // 直接使用传入的 subagentTokens，因为它已经包含了完整的统计
  // 这里主要是确保数据结构正确
  mainConsumedTokens.subagentTokens = subagentTokens;

  console.log('🔗 %cMain Agent Updated with Subagent Tokens:', 'color: #7C2D12; font-weight: bold; background: #FED7AA; padding: 2px 6px; border-radius: 4px;', {
    '📊 Subagent Summary': {
      '📈 Total Tokens': subagentTokens.total,
      '📥 Input Tokens': subagentTokens.input,
      '✅ Output Tokens': subagentTokens.output,
      '🎯 System Tokens': subagentTokens.systemTokens,
      '🛠️ System Tool Tokens': subagentTokens.systemToolTokens,
      '💾 Cache Read Tokens': subagentTokens.readCacheTokens,
      '⚡ Skill Tokens': subagentTokens.skillTokens,
      '📏 Rule Tokens': subagentTokens.ruleTokens,
      '🔌 MCP Tokens': subagentTokens.mcpTokens,
      '💰 Total Cost': (subagentTokens.inputCost + subagentTokens.outputCost).toFixed(6),
    },
    '🏷️ Agent Types': Object.keys(subagentTokens.byAgent).length,
    '📝 Recent Tasks': subagentTokens.recentTasks?.length || 0,
  });
}