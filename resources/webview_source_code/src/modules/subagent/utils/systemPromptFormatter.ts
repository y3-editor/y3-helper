/**
 * System Prompt 格式化工具
 * 
 * 职责：
 * 1. 将分层的 system prompt 转换为支持 Prompt Caching 的格式
 * 2. 提供统一的格式化接口，隐藏实现细节
 * 3. 确保格式一致性（新建/Resume 场景）
 */

import { ChatMessageContent, ChatMessageContentText, ChatMessageContentUnion } from '../../../services';
import { CACHE_TIER_BREAK } from '../../../store/workspace/constructRemixPrompt';

/**
 * System Prompt 内容类型
 * - string: 简单文本格式（无缓存）
 * - ChatMessageContentUnion[]: 分层格式（支持缓存）
 */
export type SystemPromptContent = string | ChatMessageContentUnion[];

/**
 * Cache Control 配置
 */
const CACHE_CONTROL_EPHEMERAL = { type: 'ephemeral' as const };

/**
 * 创建文本内容块
 */
function createTextBlock(text: string, enableCache: boolean): ChatMessageContentText {
  const block: ChatMessageContentText = {
    type: ChatMessageContent.Text,
    text: text.trim(),
  };
  
  if (enableCache) {
    block.cache_control = CACHE_CONTROL_EPHEMERAL;
  }
  
  return block;
}

/**
 * 检查 prompt 是否包含分层标记
 */
function hasTierBreaks(prompt: string): boolean {
  return prompt.includes(CACHE_TIER_BREAK);
}

/**
 * 将分层 prompt 文本分割为 tiers
 */
function splitIntoTiers(prompt: string): string[] {
  return prompt.split(CACHE_TIER_BREAK).filter(Boolean);
}

/**
 * System Prompt 格式化器
 * 
 * 提供两种格式化策略：
 * - Simple: 返回纯文本（向后兼容、无缓存）
 * - Tiered: 返回分层结构（支持 Prompt Caching）
 */
export class SystemPromptFormatter {
  /**
   * 格式化 system prompt 为适合缓存的格式
   * 
   * @param prompt - 原始 prompt 文本
   * @param cacheEnable - 是否启用缓存
   * @returns 格式化后的内容
   * 
   * @example
   * // 缓存禁用
   * formatter.format(prompt, false) // → "text content"
   * 
   * // 缓存启用且有分层
   * formatter.format(tierPrompt, true) // → [{ type: 'text', text: '...', cache_control }, ...]
   * 
   * // 缓存启用但无分层
   * formatter.format(simplePrompt, true) // → "text content"
   */
  static format(prompt: string, cacheEnable: boolean): SystemPromptContent {
    // 策略选择：只有启用缓存且包含分层标记时才使用分层格式
    if (!cacheEnable || !hasTierBreaks(prompt)) {
      return prompt;
    }
    
    return this.formatTiered(prompt);
  }
  
  /**
   * 格式化为分层结构
   * 规则：除最后一个 tier 外，所有 tier 都标记为可缓存
   */
  private static formatTiered(prompt: string): ChatMessageContentUnion[] {
    const tiers = splitIntoTiers(prompt);
    
    return tiers.map((tierText, index) => {
      const isNotLastTier = index < tiers.length - 1;
      return createTextBlock(tierText, isNotLastTier);
    });
  }
  
  /**
   * 规范化已有的 system message content
   * 用于 Resume 场景，确保格式与新建 session 一致
   * 
   * @param content - 已有的 content (可能是旧格式的 string)
   * @param cacheEnable - 当前是否启用缓存
   * @returns 规范化后的 content
   */
  static normalize(content: string | ChatMessageContentUnion[], cacheEnable: boolean): SystemPromptContent {
    // 如果已经是 array 格式，且缓存启用，直接返回
    if (Array.isArray(content)) {
      return content;
    }
    
    // 如果是 string，按当前缓存配置重新格式化
    return this.format(content, cacheEnable);
  }
  
  /**
   * 获取格式化后的统计信息（用于日志）
   */
  static getStats(content: SystemPromptContent): {
    format: 'simple' | 'tiered';
    tierCount?: number;
    cacheableBlocks?: number;
  } {
    if (typeof content === 'string') {
      return { format: 'simple' };
    }
    
    const cacheableBlocks = content.filter(block => 
      'cache_control' in block && block.cache_control?.type === 'ephemeral'
    ).length;
    
    return {
      format: 'tiered',
      tierCount: content.length,
      cacheableBlocks,
    };
  }
}

/**
 * 便捷函数：格式化 system prompt
 */
export function formatSystemPrompt(prompt: string, cacheEnable: boolean): SystemPromptContent {
  return SystemPromptFormatter.format(prompt, cacheEnable);
}

/**
 * 便捷函数：规范化 system message content
 */
export function normalizeSystemContent(
  content: string | ChatMessageContentUnion[],
  cacheEnable: boolean
): SystemPromptContent {
  return SystemPromptFormatter.normalize(content, cacheEnable);
}