/**
 * 轻量级 Prompt 系统类型定义
 */

import { MCPServer } from '../../store/mcp';
import { SkillIndexItem } from '../../store/skills';
import { Rule, WorkspaceInfo } from '../../store/workspace';

/**
 * Prompt 构建上下文
 */
export interface PromptContext {
  /** 工作区信息 */
  workspace?: WorkspaceInfo;
  /** MCP 服务器列表 */
  mcpServers?: MCPServer[];
  /** 技能列表 */
  skills?: SkillIndexItem[];
  /** 用户规则 */
  rules?: Rule[];
  /** 提及的文件 */
  mentionFiles?: string[];
  /** 功能配置 */
  config?: {
    enableTerminal?: boolean;
    enableEditableMode?: boolean;
    enableSkills?: boolean;
    autoApply?: boolean;
    autoExecute?: boolean;
    openspecVersion?: string;
    codeMakerVersion?: string;
    codebaseChatMode?: string;
  };
  /** 自定义变量 */
  variables?: Record<string, string>;
}

/**
 * 主系统 Prompt 构建选项
 */
export interface MainPromptOptions {
  info: Partial<WorkspaceInfo>;
  MCPServers: MCPServer[];
  enableTerminal?: boolean;
  codeMakerVersion?: string;
  effectiveRules: Rule[];
  mentionFiles?: string[];
  skills?: SkillIndexItem[];
  openspecVersion?: string;
}

/**
 * 子代理 Prompt 构建选项
 */
export interface SubagentPromptOptions {
  /** 基础 prompt */
  basePrompt: string;
  /** 代理类型（可选） */
  agentType?: string;
  /** 上下文选项 */
  context?: Partial<PromptContext>;
}

/**
 * Prompt 片段生成器函数类型
 */
export type PromptGenerator = (context: PromptContext) => string | null;

/**
 * 条件判断函数类型
 */
export type PromptCondition = (context: PromptContext) => boolean;