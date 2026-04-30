/**
 * 子代理 Prompt 构建器
 * 为子代理提供 MCP、Skills 等功能支持
 */

import { useWorkspaceStore } from '../../store/workspace';
import { useMCPStore } from '../../store/mcp';
import { useSkillsStore } from '../../store/skills';
import { CACHE_TIER_BREAK } from '../../store/workspace/constructRemixPrompt';
import {
  generateSkillsPrompt,
  generateRulesPrompt,
  generateUserInfoPrompt,
  generateSearchAndReadingPrompt,
  generateCodeEditPrompt,
  generateTerminalPrompt,
  generateCallingExternalApisPrompt,
  generateSubagentToolCallingPrompt,
  createPromptContext
} from './shared';
import { PromptTemplateLoader } from './template-loader';
import { SubagentPromptOptions, PromptContext } from './types';

/**
 * 增强的子代理 Prompt 构建器
 * 支持 MCP 工具和 Skills 功能
 */
export class EnhancedPromptBuilder {
  /**
   * 构建增强的子代理 system prompt
   */
  async buildSystemPrompt(basePrompt: string, agentType?: string, contextOptions: Partial<PromptContext> = {}): Promise<string> {
    console.log(agentType);

    // 获取当前状态（在非 React 环境中需要手动获取）
    const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
    const mcpStore = useMCPStore.getState();
    const skillsStore = useSkillsStore.getState();

    // 创建上下文
    const context: PromptContext = createPromptContext({
      workspace: workspaceInfo,
      mcpServers: mcpStore.MCPServers.filter(s => s.status === 'connected' && !s.disabled),
      skills: skillsStore.skills,
      config: {
        enableSkills: true, // 子代理默认启用 skills
        enableTerminal: true, // 子代理默认启用
        enableEditableMode: true, // 子代理需要代码编辑能力
        ...contextOptions.config
      },
      ...contextOptions
    });

    // ================================================================
    // Tier 1: Agent 角色定义 + 通用规则 (仅 agent 定义变化时变)
    // ================================================================
    const tier1Parts: string[] = [basePrompt];

    // 基础系统规则（工具调用等）- 使用子代理专用版本
    const toolCallingPrompt = await generateSubagentToolCallingPrompt(context);
    if (toolCallingPrompt) tier1Parts.push(toolCallingPrompt);

    // 搜索和阅读指令
    const searchAndReadingPrompt = await generateSearchAndReadingPrompt(context);
    if (searchAndReadingPrompt) tier1Parts.push(searchAndReadingPrompt);

    // TODO: 后续再支持 外部API调用规则
    // const callingExternalApisPrompt = await generateCallingExternalApisPrompt(context);
    // if (callingExternalApisPrompt) tier1Parts.push(callingExternalApisPrompt);

    const tier1 = tier1Parts.filter(Boolean).join('\n\n');

    // ================================================================
    // Tier 2: 代码编辑 + 终端 + 用户信息 (workspace 级)
    // ================================================================
    const tier2Parts: string[] = [];

    // 代码编辑功能（子代理可能需要）
    const codeEditPrompt = await generateCodeEditPrompt(context);
    if (codeEditPrompt) tier2Parts.push(codeEditPrompt);

    // 终端功能（如果启用）
    const terminalPrompt = await generateTerminalPrompt(context);
    if (terminalPrompt) tier2Parts.push(terminalPrompt);

    // 用户环境信息
    const userInfoPrompt = await generateUserInfoPrompt(context);
    if (userInfoPrompt) tier2Parts.push(userInfoPrompt);

    const tier2 = tier2Parts.filter(Boolean).join('\n\n');

    // ================================================================
    // Tier 3: Skills + Rules (session 级)
    // ================================================================
    const tier3Parts: string[] = [];

    // Skills 功能支持（同步）
    const skillsPrompt = await generateSkillsPrompt(context);
    if (skillsPrompt) tier3Parts.push(skillsPrompt);

    // 用户规则支持（同步）
    const rulesPrompt = await generateRulesPrompt(context);
    if (rulesPrompt) tier3Parts.push(rulesPrompt);

    const tier3 = tier3Parts.filter(Boolean).join('\n\n');

    // 用 CACHE_TIER_BREAK 分隔各 tier，cache 路径下按此标记 split 为多个 content block
    const finalPrompt = [tier1, tier2, tier3]
      .filter(Boolean)
      .join(CACHE_TIER_BREAK);

    // 变量插值处理
    const variables = {
      shell: workspaceInfo.shell,
      osName: workspaceInfo.osName,
      workspace: workspaceInfo.workspace,
      ...context.variables
    };

    // 使用新的模板系统进行变量插值
    return PromptTemplateLoader.interpolateVariables(finalPrompt, variables);
  }

  /**
   * 获取指定 section 的内容（向后兼容）
   */
  getSectionContent(): string | null {
    console.warn('[EnhancedPromptBuilder] getSectionContent is deprecated. Use shared generators instead.');
    return null;
  }

  /**
   * 检查 section 是否启用（向后兼容）
   */
  isSectionEnabled(): boolean {
    console.warn('[EnhancedPromptBuilder] isSectionEnabled is deprecated. Use condition functions instead.');
    return false;
  }

  /**
   * 获取版本
   */
  getVersion(): string {
    return '2.0.0'; // 增强版本标识
  }
}

/**
 * Hook 式构建器
 * 在 React 组件中使用
 */
export function useSubagentPromptBuilder() {
  // 这里可以使用 React hooks
  const workspaceInfo = useWorkspaceStore(state => state.workspaceInfo);
  const mcpServers = useMCPStore(state =>
    state.MCPServers.filter(s => s.status === 'connected' && !s.disabled)
  );
  const skills = useSkillsStore(state => state.skills);

  const buildSystemPrompt = async (basePrompt: string, agentType?: string, options: Partial<PromptContext> = {}): Promise<string> => {
    console.log(agentType);
    const context: PromptContext = createPromptContext({
      workspace: workspaceInfo,
      mcpServers,
      skills,
      config: {
        enableSkills: true,
        enableTerminal: false, // 子代理一般不直接执行终端命令
        enableEditableMode: true, // 但需要代码编辑能力
        ...options.config
      },
      ...options
    });

    // ================================================================
    // Tier 1: Agent 角色定义 + 通用规则 (仅 agent 定义变化时变)
    // ================================================================
    const tier1Parts: string[] = [basePrompt];

    // 基础系统规则（工具调用等）- 使用子代理专用版本
    const toolCallingPrompt = await generateSubagentToolCallingPrompt(context);
    if (toolCallingPrompt) tier1Parts.push(toolCallingPrompt);

    // 搜索和阅读指令
    const searchAndReadingPrompt = await generateSearchAndReadingPrompt(context);
    if (searchAndReadingPrompt) tier1Parts.push(searchAndReadingPrompt);

    // 外部API调用规则
    const callingExternalApisPrompt = await generateCallingExternalApisPrompt(context);
    if (callingExternalApisPrompt) tier1Parts.push(callingExternalApisPrompt);

    const tier1 = tier1Parts.filter(Boolean).join('\n\n');

    // ================================================================
    // Tier 2: 代码编辑 + 终端 + 用户信息 (workspace 级)
    // ================================================================
    const tier2Parts: string[] = [];

    // 代码编辑功能（子代理可能需要）
    const codeEditPrompt = await generateCodeEditPrompt(context);
    if (codeEditPrompt) tier2Parts.push(codeEditPrompt);

    // 终端功能（如果启用）
    const terminalPrompt = await generateTerminalPrompt(context);
    if (terminalPrompt) tier2Parts.push(terminalPrompt);

    // 用户环境信息
    const userInfoPrompt = await generateUserInfoPrompt(context);
    if (userInfoPrompt) tier2Parts.push(userInfoPrompt);

    const tier2 = tier2Parts.filter(Boolean).join('\n\n');

    // ================================================================
    // Tier 3: Skills + Rules (session 级)
    // ================================================================
    const tier3Parts: string[] = [];

    // Skills 功能支持（同步）
    const skillsPrompt = await generateSkillsPrompt(context);
    if (skillsPrompt) tier3Parts.push(skillsPrompt);

    // 用户规则支持（同步）
    const rulesPrompt = await generateRulesPrompt(context);
    if (rulesPrompt) tier3Parts.push(rulesPrompt);

    const tier3 = tier3Parts.filter(Boolean).join('\n\n');

    // 用 CACHE_TIER_BREAK 分隔各 tier，cache 路径下按此标记 split 为多个 content block
    const finalPrompt = [tier1, tier2, tier3]
      .filter(Boolean)
      .join(CACHE_TIER_BREAK);

    // 变量插值
    const variables = {
      shell: workspaceInfo.shell,
      osName: workspaceInfo.osName,
      workspace: workspaceInfo.workspace,
      ...context.variables
    };

    return PromptTemplateLoader.interpolateVariables(finalPrompt, variables);
  };

  return {
    buildSystemPrompt
  };
}

/**
 * 简化的构建函数
 * 直接使用现有数据构建子代理 prompt
 */
export async function buildSubagentPrompt(options: SubagentPromptOptions): Promise<string> {
  const { basePrompt, agentType, context = {} } = options;
  const builder = new EnhancedPromptBuilder();
  return await builder.buildSystemPrompt(basePrompt, agentType, context);
}

// 创建单例实例（向后兼容）
export const enhancedPromptBuilder = new EnhancedPromptBuilder();

// 导出向后兼容的接口
export const promptBuilder = enhancedPromptBuilder;