/**
 * Token 消耗计算工具
 *
 * 提供纯函数来计算主 Agent 的 token 消耗，支持不同模型的差异化处理
 *
 * @see {@link ../../docs/TOKEN_METRICS_CALCULATION_SPEC.md} Token计算规范文档
 *
 * 注意：当前实现基于规范文档，但在某些计算细节上做了优化：
 * - Claude模型的input计算避免了重复计算缓存tokens
 * - 成本计算确保了不同token类型的正确计费
 */

import { ChatModel } from '../services/chatModel';

// ============================================================================
// 类型定义
// ============================================================================

/** 子会话类型 */
export enum SessionType {
  /** 子代理 */
  SUBAGENT = 'subagent',
}

/** 子会话消耗统计 */
export interface ChildSession {
  /** 会话 ID */
  id: string;
  /** 会话类型 */
  type: SessionType;
  /** 会话名称 */
  name: string;
  /** 额外信息 */
  extra: Record<string, any>;
  /** 消耗的 token 统计 */
  consumedTokens?: ConsumedTokens;
}

/**
 * Token 消耗状态
 *
 * 记录对话会话中各种类型的 token 消耗情况，包括输入输出、系统提示、技能等
 */
export interface ConsumedTokens {
  /** 用户输入 tokens 总数 */
  input: number;
  /** AI 输出 tokens 总数 */
  output: number;
  /** 输入成本（积分/费用） */
  inputCost: number;
  /** 输出成本（积分/费用） */
  outputCost: number;
  /** 系统提示词 tokens 总数 */
  systemTokens: number;
  /** 系统工具 tokens 总数（缓存创建等） */
  systemToolTokens: number;
  /** 用户提示词 tokens 累计总数 */
  promptTokens: number;
  /** AI 回复 tokens 累计总数 */
  completionTokens: number;
  /** 缓存创建输入 tokens 总数 */
  cacheCreationInputTokens: number;
  /** 压缩输入 tokens 总数 */
  comporessPromptTokens: number;
  /** 压缩输出 tokens 总数 */
  comporessCompletionTokens: number;
  /** 命中缓存读取的 tokens 总数 */
  readCacheTokens: number;
  /** 技能相关 tokens 总数 */
  skillTokens: number;
  /** 规则相关 tokens 总数 */
  ruleTokens: number;
  /** MCP（Model Context Protocol）相关 tokens 总数 */
  mcpTokens: number;
  /**
   * 通用子会话结构（subagent、plugin、tool 等）
   * 替代原有的 subagentTokens 结构，支持更多类型
   */
  children?: ChildSession[];
}

/** 模型价格信息 */
export interface ModelPriceInfo {
  /** 输入价格 (每1000token费用) */
  promptWeight: number;
  /** 输出token价格 (每1000token费用) */
  completionWeight: number;
  /** 5min缓存价格 (每1000token费用) */
  cacheWeightFor5min: number;
  /** 命中缓存价格 (每1000token费用) */
  hitCacheWeight: number;
}

/** 单次 Token 增量输入 */
export interface TokenIncrement {
  /** 用户提示词 token */
  promptTokens?: number;
  /** AI 回复 token */
  completionTokens?: number;
  /** 缓存创建输入 token */
  cacheCreationInputTokens?: number;
  /** 缓存命中读取 token */
  cacheReadInputTokens?: number;
  /** 系统提示词 token */
  systemTokens?: number;
  /** 压缩输入 token */
  comporessPromptTokens?: number;
  /** 压缩输出 token */
  comporessCompletionTokens?: number;
  /** 技能相关 token */
  skillTokens?: number;
  /** 规则相关 token */
  ruleTokens?: number;
  /** MCP 相关 token */
  mcpTokens?: number;
}

/** 压缩上下文信息 */
export interface TokenCompressionContext {
  /** 待保存的 token 数 */
  pendingSavedTokens: number;
  /** 压缩时的消息数量 */
  messagesCountAtCompression: number;
  /** 当前消息总数 */
  currentMessagesCount: number;
}

/** Token 计算结果 */
export interface TokenCalculationResult {
  /** 更新后的 token 消耗状态 */
  consumedTokens: ConsumedTokens;
  /** 压缩状态更新 (如果需要) */
  compressionUpdate?: {
    pendingSavedTokens: number;
    messagesCountAtCompression: number;
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 判断是否为 Claude 模型
 */
function isClaudeModel(model?: ChatModel | string): boolean {
  return Boolean(model && model.toLowerCase().includes('claude'));
}

/**
 * 格式化会话名称
 * 将自定义名称转换为全小写+下划线格式
 */
export function formatSessionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_') // 将非字母数字字符替换为下划线
    .replace(/_{2,}/g, '_') // 将连续的下划线合并为一个
    .replace(/^_|_$/g, ''); // 移除开头和结尾的下划线
}

/**
 * 创建子会话统计
 */
export function createChildSession(
  id: string,
  type: SessionType,
  name: string,
  extra: Record<string, any> = {},
  tokens?: Partial<ConsumedTokens>,
): ChildSession {
  return {
    id,
    type,
    name: formatSessionName(name),
    extra,
    consumedTokens: {
      ...createInitialConsumedTokens(),
      ...tokens,
    },
  };
}

/**
 * 创建空的子会话集合
 */
export function createEmptyChildSessions(): ChildSession[] {
  return [];
}

/**
 * 更新子会话集合中的统计
 */
export function updateChildSession(
  summary: ChildSession[],
  sessionId: string,
  type: SessionType,
  name: string,
  increment: TokenIncrement,
  extra: Record<string, any> = {},
  model?: ChatModel | string,
  modelPriceInfo?: ModelPriceInfo,
): ChildSession[] {
  const formattedName = formatSessionName(name);

  // 查找或创建子会话
  let session = summary.find((s) => s.id === sessionId);

  if (!session) {
    session = createChildSession(sessionId, type, formattedName, extra);
    summary.push(session);
  }

  // 确保 consumedTokens 存在
  if (!session.consumedTokens) {
    session.consumedTokens = createInitialConsumedTokens();
  }

  // 更新子会话统计
  const result = calculateConsumedTokensUpdate(
    session.consumedTokens,
    increment,
    model,
    modelPriceInfo,
  );

  // 应用更新
  session.consumedTokens = result.consumedTokens;
  session.extra = { ...session.extra, ...extra };

  return summary;
}

function safeNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * 计算成本增量
 */
function calculateCostIncrement(
  increment: TokenIncrement,
  priceInfo: ModelPriceInfo,
): { inputCostDelta: number; outputCostDelta: number } {
  const {
    promptTokens = 0,
    completionTokens = 0,
    cacheCreationInputTokens = 0,
    cacheReadInputTokens = 0,
  } = increment;

  // 防御性编程：确保价格信息是有效数值
  const promptWeight = safeNumber(priceInfo?.promptWeight);
  const completionWeight = safeNumber(priceInfo?.completionWeight);
  const cacheWeightFor5min = safeNumber(priceInfo?.cacheWeightFor5min);
  const hitCacheWeight = safeNumber(priceInfo?.hitCacheWeight);

  const inputCostDelta =
    (promptTokens / 1000) * promptWeight +
    (cacheCreationInputTokens / 1000) * cacheWeightFor5min +
    (cacheReadInputTokens / 1000) * hitCacheWeight;

  const outputCostDelta = (completionTokens / 1000) * completionWeight;

  // 确保返回值不是 NaN
  return {
    inputCostDelta: safeNumber(inputCostDelta),
    outputCostDelta: safeNumber(outputCostDelta),
  };
}

/**
 * Claude 模型的 token 分类逻辑（重新设计的分配算法）
 *
 * 设计原则：
 * 1. 以 API 返回的 cacheCreationInputTokens 为唯一可信基准
 * 2. 确保分配总和始终等于实际值（数学一致性）
 * 3. 当估算超出实际值时，按比例缩放各组件
 * 4. 当估算小于实际值时，余额归入 systemTokens
 */
function calculateClaudeTokens(
  current: ConsumedTokens,
  increment: TokenIncrement,
): Partial<ConsumedTokens> {
  const {
    promptTokens = 0,
    completionTokens = 0,
    cacheCreationInputTokens = 0,
    cacheReadInputTokens = 0,
    // systemTokens = 0,
    comporessPromptTokens = 0,
    comporessCompletionTokens = 0,
    skillTokens = 0,
    ruleTokens = 0,
    mcpTokens = 0,
  } = increment;

  // 防御性编程：确保所有值都是安全的数值
  const safePromptTokens = safeNumber(promptTokens);
  const safeCompletionTokens = safeNumber(completionTokens);
  const safeCacheCreationTokens = safeNumber(cacheCreationInputTokens);
  const safeCacheReadTokens = safeNumber(cacheReadInputTokens);
  // const safeEstimatedSystemTokens = safeNumber(systemTokens);
  const safeCompressPromptTokens = safeNumber(comporessPromptTokens);
  const safeCompressCompletionTokens = safeNumber(comporessCompletionTokens);
  const safeSkillTokens = safeNumber(skillTokens);
  const safeRuleTokens = safeNumber(ruleTokens);
  const safeMcpTokens = safeNumber(mcpTokens);

  const updates: Partial<ConsumedTokens> = {
    input: safeNumber(current.input) + safePromptTokens,
    output: safeNumber(current.output) + safeCompletionTokens,
    // 累计总的 prompt 和 completion tokens
    promptTokens: safeNumber(current.promptTokens) + safePromptTokens,
    completionTokens:
      safeNumber(current.completionTokens) + safeCompletionTokens,
    // 缓存相关 tokens
    cacheCreationInputTokens:
      safeNumber(current.cacheCreationInputTokens) + safeCacheCreationTokens,
    readCacheTokens: safeNumber(current.readCacheTokens) + safeCacheReadTokens,
    comporessPromptTokens:
      safeNumber(current.comporessPromptTokens) + safeCompressPromptTokens,
    comporessCompletionTokens:
      safeNumber(current.comporessCompletionTokens) +
      safeCompressCompletionTokens,
  };

  // 🎯 新的系统 token 分配算法
  if (safeCacheCreationTokens > 0) {
    // 计算各组件估算值总和
    const estimatedComponentsTotal =
      safeSkillTokens + safeRuleTokens + safeMcpTokens;

    if (estimatedComponentsTotal === 0) {
      // 情况1：没有组件估算值，全部归为 systemTokens
      updates.systemTokens =
        safeNumber(current.systemTokens) + safeCacheCreationTokens;
      updates.systemToolTokens = safeNumber(current.systemToolTokens);
      updates.skillTokens = safeNumber(current.skillTokens);
      updates.ruleTokens = safeNumber(current.ruleTokens);
      updates.mcpTokens = safeNumber(current.mcpTokens);
    } else if (estimatedComponentsTotal <= safeCacheCreationTokens) {
      // 情况2：估算值合理，直接分配，余额归入 systemTokens
      const remainingSystemTokens =
        safeCacheCreationTokens - estimatedComponentsTotal;

      updates.systemTokens =
        safeNumber(current.systemTokens) + remainingSystemTokens;
      updates.systemToolTokens = safeNumber(current.systemToolTokens); // 不增加
      updates.skillTokens = safeNumber(current.skillTokens) + safeSkillTokens;
      updates.ruleTokens = safeNumber(current.ruleTokens) + safeRuleTokens;
      updates.mcpTokens = safeNumber(current.mcpTokens) + safeMcpTokens;
    } else {
      // 情况3：估算值超出实际值，按比例缩放
      const scaleFactor = safeCacheCreationTokens / estimatedComponentsTotal;

      const scaledSkillTokens = Math.floor(safeSkillTokens * scaleFactor);
      const scaledRuleTokens = Math.floor(safeRuleTokens * scaleFactor);
      const scaledMcpTokens = Math.floor(safeMcpTokens * scaleFactor);

      // 计算缩放后剩余的tokens（由于Math.floor可能有余数）
      const scaledTotal =
        scaledSkillTokens + scaledRuleTokens + scaledMcpTokens;
      const remainingTokens = safeCacheCreationTokens - scaledTotal;

      updates.systemTokens = safeNumber(current.systemTokens) + remainingTokens;
      updates.systemToolTokens = safeNumber(current.systemToolTokens); // 不增加
      updates.skillTokens = safeNumber(current.skillTokens) + scaledSkillTokens;
      updates.ruleTokens = safeNumber(current.ruleTokens) + scaledRuleTokens;
      updates.mcpTokens = safeNumber(current.mcpTokens) + scaledMcpTokens;
    }
  } else {
    // 没有缓存创建tokens的情况（可能是纯用户输入）
    updates.systemTokens = safeNumber(current.systemTokens);
    updates.systemToolTokens = safeNumber(current.systemToolTokens);
    updates.skillTokens = safeNumber(current.skillTokens) + safeSkillTokens;
    updates.ruleTokens = safeNumber(current.ruleTokens) + safeRuleTokens;
    updates.mcpTokens = safeNumber(current.mcpTokens) + safeMcpTokens;
  }

  return updates;
}

/**
 * 非 Claude 模型的 token 分类逻辑
 */
function calculateNonClaudeTokens(
  current: ConsumedTokens,
  increment: TokenIncrement,
): Partial<ConsumedTokens> {
  const {
    promptTokens = 0,
    completionTokens = 0,
    cacheCreationInputTokens = 0,
    cacheReadInputTokens = 0,
    systemTokens = 0,
    comporessPromptTokens = 0,
    comporessCompletionTokens = 0,
    skillTokens = 0,
    ruleTokens = 0,
    mcpTokens = 0,
  } = increment;

  // 防御性编程：确保所有值都是安全的数值（非Claude模型）
  const safePromptTokens = safeNumber(promptTokens);
  const safeCompletionTokens = safeNumber(completionTokens);
  const safeCacheCreationTokens = safeNumber(cacheCreationInputTokens);
  const safeCacheReadTokens = safeNumber(cacheReadInputTokens);
  const safeSystemTokens = safeNumber(systemTokens);
  const safeCompressPromptTokens = safeNumber(comporessPromptTokens);
  const safeCompressCompletionTokens = safeNumber(comporessCompletionTokens);
  const safeSkillTokens = safeNumber(skillTokens);
  const safeRuleTokens = safeNumber(ruleTokens);
  const safeMcpTokens = safeNumber(mcpTokens);

  const pureSystemTokens =
    safeSystemTokens - safeSkillTokens - safeRuleTokens - safeMcpTokens;
  const pureInputTokens = safePromptTokens - safeSystemTokens;

  return {
    input: safeNumber(current.input) + safeNumber(pureInputTokens),
    output: safeNumber(current.output) + safeCompletionTokens,
    // 累计总的 prompt 和 completion tokens
    promptTokens: safeNumber(current.promptTokens) + safePromptTokens,
    completionTokens:
      safeNumber(current.completionTokens) + safeCompletionTokens,
    // 非 Claude 模型也可能有缓存和压缩 tokens（为了未来扩展性）
    cacheCreationInputTokens:
      safeNumber(current.cacheCreationInputTokens) + safeCacheCreationTokens,
    readCacheTokens: safeNumber(current.readCacheTokens) + safeCacheReadTokens,
    comporessPromptTokens:
      safeNumber(current.comporessPromptTokens) + safeCompressPromptTokens,
    comporessCompletionTokens:
      safeNumber(current.comporessCompletionTokens) +
      safeCompressCompletionTokens,
    // 系统相关 tokens
    systemTokens:
      safeNumber(current.systemTokens) + safeNumber(pureSystemTokens),
    // 非 Claude 模型：如果有缓存创建 tokens，归入 systemToolTokens（为未来缓存支持做准备）
    systemToolTokens:
      safeNumber(current.systemToolTokens) + safeCacheCreationTokens,
    skillTokens: safeNumber(current.skillTokens) + safeSkillTokens,
    ruleTokens: safeNumber(current.ruleTokens) + safeRuleTokens,
    mcpTokens: safeNumber(current.mcpTokens) + safeMcpTokens,
  };
}

/**
 * 检查并计算压缩状态更新
 */
function calculateCompressionUpdate(
  compressionContext?: TokenCompressionContext,
): TokenCalculationResult['compressionUpdate'] {
  if (!compressionContext?.pendingSavedTokens) {
    return undefined;
  }

  const threshold = (compressionContext.messagesCountAtCompression || 0) + 1;
  const shouldResetCompression =
    compressionContext.currentMessagesCount > threshold;

  return shouldResetCompression
    ? {
        pendingSavedTokens: 0,
        messagesCountAtCompression: 0,
      }
    : undefined;
}

// ============================================================================
// 核心计算函数
// ============================================================================

/**
 * 计算更新后的 token 消耗状态
 *
 * @param currentTokens 当前 token 消耗状态
 * @param increment 本次新增的 token 数据
 * @param model 模型名称
 * @param modelPriceInfo 模型价格信息 (可选)
 * @param compressionContext 压缩上下文 (可选)
 * @returns 计算后的新 token 状态
 *
 * @example
 * ```typescript
 * const result = calculateConsumedTokensUpdate(
 *   currentTokens,
 *   { promptTokens: 100, completionTokens: 150 },
 *   ChatModel.Claude35Sonnet,
 *   priceInfo
 * );
 *
 * // 应用结果
 * session.data.consumedTokens = result.consumedTokens;
 * ```
 */
export function calculateConsumedTokensUpdate(
  currentTokens: ConsumedTokens,
  increment: TokenIncrement,
  model?: ChatModel | string,
  modelPriceInfo?: ModelPriceInfo,
  compressionContext?: TokenCompressionContext,
): TokenCalculationResult {
  // 深度克隆当前状态，确保不修改原始数据
  const newTokens: ConsumedTokens = {
    ...currentTokens,
    // 保持 children 字段的原始引用，因为它是独立管理的
    children: currentTokens.children,
  };

  // 1. 计算成本增量 (如果提供了价格信息)
  if (modelPriceInfo) {
    const { inputCostDelta, outputCostDelta } = calculateCostIncrement(
      increment,
      modelPriceInfo,
    );
    newTokens.inputCost = safeNumber(currentTokens.inputCost) + inputCostDelta;
    newTokens.outputCost =
      safeNumber(currentTokens.outputCost) + outputCostDelta;
  }

  // 2. 根据模型类型应用不同的 token 分类逻辑
  const tokenUpdates = isClaudeModel(model)
    ? calculateClaudeTokens(currentTokens, increment)
    : calculateNonClaudeTokens(currentTokens, increment);

  // 应用 token 更新
  Object.assign(newTokens, tokenUpdates);

  // 3. 计算压缩状态更新
  const compressionUpdate = calculateCompressionUpdate(compressionContext);

  return {
    consumedTokens: newTokens,
    compressionUpdate,
  };
}

/**
 * 创建初始的 token 消耗状态
 *
 * @returns 初始化的 token 消耗对象
 */
export function createInitialConsumedTokens(): ConsumedTokens {
  return {
    input: 0,
    output: 0,
    inputCost: 0,
    outputCost: 0,
    systemTokens: 0,
    systemToolTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheCreationInputTokens: 0,
    comporessPromptTokens: 0,
    comporessCompletionTokens: 0,
    readCacheTokens: 0,
    skillTokens: 0,
    ruleTokens: 0,
    mcpTokens: 0,
    children: undefined, // 新的通用子会话结构
  };
}

/**
 * 计算 token 消耗总数 (不包括子会话 tokens)
 *
 * @param consumedTokens token 消耗状态
 * @returns 主 agent 的总 token 消耗
 */
export function calculateMainAgentTotalTokens(
  consumedTokens: ConsumedTokens,
): number {
  return (consumedTokens.input || 0) + (consumedTokens.output || 0);
}

/**
 * 计算所有子会话的 token 总数
 *
 * @param children 子会话列表
 * @returns 所有子会话的总 token 消耗
 */
export function calculateChildrenTotalTokens(children: ChildSession[]): number {
  return children.reduce((total, session) => {
    if (!session.consumedTokens) return total;
    return total + calculateMainAgentTotalTokens(session.consumedTokens);
  }, 0);
}

/**
 * 计算包含子会话在内的总 token 数
 *
 * @param consumedTokens token 消耗状态
 * @returns 主 agent + 所有子会话的总 token 消耗
 */
export function calculateGrandTotalTokens(
  consumedTokens: ConsumedTokens,
): number {
  const mainTokens = calculateMainAgentTotalTokens(consumedTokens);
  const childrenTokens = consumedTokens.children
    ? calculateChildrenTotalTokens(consumedTokens.children)
    : 0;
  return mainTokens + childrenTokens;
}

/**
 * 格式化 token 数量为可读字符串
 *
 * - >= 1B → '1B'
 * - >= 1M → '2M'
 * - >= 1K → '35K'
 * - < 1K  → 原始数值字符串
 * @param tokenCount token 数量
 * @returns 格式化后的字符串 (如: "1.2k", "3.4M")
 *
 */
export function formatTokenCount(tokenCount: number): string {
  const billion = 1_000_000_000;
  const million = 1_000_000;
  const thousand = 1_000;

  if (tokenCount >= billion) return (tokenCount / billion).toFixed(1) + 'B';
  if (tokenCount >= million) return (tokenCount / million).toFixed(1) + 'M';
  if (tokenCount >= thousand) return (tokenCount / thousand).toFixed(1) + 'k';

  return String(tokenCount);
}