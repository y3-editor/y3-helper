/**
 * 轻量级 Prompt 构造系统统一入口
 * 提供简洁的 API 和向后兼容接口
 */

// 类型导出
export type * from './types';

// 共享函数导出
export {
  generateMCPPrompt,
  generateSkillsPrompt,
  generateRulesPrompt,
  generateTaskDelegationPrompt,
  generateCodeEditPrompt,
  generateTerminalPrompt,
  generateOpenSpecPrompt,
  generateUserInfoPrompt,
  generateSearchAndReadingPrompt,
  generateToolCallingPrompt,
  generateSubagentToolCallingPrompt,
  generateCallingExternalApisPrompt,
  createPromptContext,
  interpolateVariables
} from './shared';

// 主系统构建器
export { constructMainPrompt } from './main-system';
export { default as constructRemixPrompt } from './main-system';

// 子代理构建器
export {
  EnhancedPromptBuilder,
  useSubagentPromptBuilder,
  buildSubagentPrompt,
  enhancedPromptBuilder,
  promptBuilder
} from './subagent';

// 便捷的统一接口
import { constructMainPrompt } from './main-system';
import { buildSubagentPrompt, useSubagentPromptBuilder } from './subagent';
import { MainPromptOptions, SubagentPromptOptions } from './types';

/**
 * 统一的 Prompt 构建器接口
 */
export const PromptBuilder = {
  /**
   * 构建主系统 prompt
   */
  buildMain: (options: MainPromptOptions): string => {
    return constructMainPrompt(options);
  },

  /**
   * 构建子代理 prompt
   */
  buildSubagent: (options: SubagentPromptOptions): string => {
    return buildSubagentPrompt(options);
  }
};

/**
 * Hook 接口
 */
export const usePromptBuilder = () => {
  const { buildSystemPrompt: buildSubagent } = useSubagentPromptBuilder();

  return {
    buildMain: constructMainPrompt,
    buildSubagent,
    // 向后兼容
    constructRemixPrompt: constructMainPrompt
  };
};