/**
 * 子代理 Prompt 构建器 - 使用新的增强构建系统
 * 提供完整的 MCP、Skills、代码编辑等功能支持
 */

// 直接使用新的增强构建器
import { enhancedPromptBuilder, EnhancedPromptBuilder } from '../../prompts/subagent';

/**
 * 现代化的 PromptBuilder，具备完整功能
 */
export class PromptBuilder extends EnhancedPromptBuilder {
  constructor() {
    super();
  }
}

// 导出增强的单例实例
export const promptBuilder = enhancedPromptBuilder;