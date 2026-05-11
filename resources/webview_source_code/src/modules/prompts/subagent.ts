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
  generateOpenSpecPrompt,
  createPromptContext
} from './shared';
import { PromptTemplateLoader } from './template-loader';
import { SubagentPromptOptions, PromptContext } from './types';

/**
 * 增强的子代理 Prompt 构建器
 * 支持 MCP 工具和 Skills 功能
 */
export class EnhancedPromptBuilder {
  async buildSystemPrompt(basePrompt: string, agentType?: string, contextOptions: Partial<PromptContext> = {}): Promise<string> {
    console.log(agentType);

    const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
    const mcpStore = useMCPStore.getState();
    const skillsStore = useSkillsStore.getState();

    const context: PromptContext = createPromptContext({
      workspace: workspaceInfo,
      mcpServers: mcpStore.MCPServers.filter(s => s.status === 'connected' && !s.disabled),
      skills: skillsStore.skills,
      isSubagent: true,
      config: {
        enableSkills: true, // 子代理默认启用 skills
        enableTerminal: true, // 子代理默认启用
        enableEditableMode: true, // 子代理需要代码编辑能力
        ...contextOptions.config
      },
      ...contextOptions
    });

    // Tier 1: Agent 角色定义 + 通用规则 (仅 agent 定义变化时变)
    const tier1Parts: string[] = [basePrompt];

    const toolCallingPrompt = await generateSubagentToolCallingPrompt(context);
    if (toolCallingPrompt) tier1Parts.push(toolCallingPrompt);

    const searchAndReadingPrompt = await generateSearchAndReadingPrompt(context);
    if (searchAndReadingPrompt) tier1Parts.push(searchAndReadingPrompt);

    const tier1 = tier1Parts.filter(Boolean).join('\n\n');

    // Tier 2: Workspace 配置 + 动态内容 (与主 Agent 对齐为 2 层结构)
    const tier2Parts: string[] = [];

    const codeEditPrompt = await generateCodeEditPrompt(context);
    if (codeEditPrompt) tier2Parts.push(codeEditPrompt);

    const terminalPrompt = await generateTerminalPrompt(context);
    if (terminalPrompt) tier2Parts.push(terminalPrompt);

    const userInfoPrompt = await generateUserInfoPrompt(context);
    if (userInfoPrompt) tier2Parts.push(userInfoPrompt);

    const skillsPrompt = await generateSkillsPrompt(context);
    if (skillsPrompt) tier2Parts.push(skillsPrompt);

    const rulesPrompt = await generateRulesPrompt(context);
    if (rulesPrompt) tier2Parts.push(rulesPrompt);

    const openspecPrompt = await generateOpenSpecPrompt(context);
    if (openspecPrompt) tier2Parts.push(openspecPrompt);

    const tier2 = tier2Parts.filter(Boolean).join('\n\n');

    // 使用 CACHE_TIER_BREAK 分隔 2 个 tiers
    const finalPrompt = [tier1, tier2]
      .filter(Boolean)
      .join(CACHE_TIER_BREAK);

    const variables = {
      shell: workspaceInfo.shell,
      osName: workspaceInfo.osName,
      workspace: workspaceInfo.workspace,
      ...context.variables
    };

    return PromptTemplateLoader.interpolateVariables(finalPrompt, variables);
  }

  getSectionContent(): string | null {
    console.warn('[EnhancedPromptBuilder] getSectionContent is deprecated. Use shared generators instead.');
    return null;
  }

  isSectionEnabled(): boolean {
    console.warn('[EnhancedPromptBuilder] isSectionEnabled is deprecated. Use condition functions instead.');
    return false;
  }

  getVersion(): string {
    return '2.0.0'; // 增强版本标识
  }
}

export function useSubagentPromptBuilder() {
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
      isSubagent: true,
      config: {
        enableSkills: true,
        enableTerminal: false, // 子代理一般不直接执行终端命令
        enableEditableMode: true, // 但需要代码编辑能力
        ...options.config
      },
      ...options
    });

    // Tier 1: Agent 角色定义 + 通用规则
    const tier1Parts: string[] = [basePrompt];

    const toolCallingPrompt = await generateSubagentToolCallingPrompt(context);
    if (toolCallingPrompt) tier1Parts.push(toolCallingPrompt);

    const searchAndReadingPrompt = await generateSearchAndReadingPrompt(context);
    if (searchAndReadingPrompt) tier1Parts.push(searchAndReadingPrompt);

    const callingExternalApisPrompt = await generateCallingExternalApisPrompt(context);
    if (callingExternalApisPrompt) tier1Parts.push(callingExternalApisPrompt);

    const tier1 = tier1Parts.filter(Boolean).join('\n\n');

    // Tier 2: Workspace 配置 + 动态内容
    const tier2Parts: string[] = [];

    const codeEditPrompt = await generateCodeEditPrompt(context);
    if (codeEditPrompt) tier2Parts.push(codeEditPrompt);

    const terminalPrompt = await generateTerminalPrompt(context);
    if (terminalPrompt) tier2Parts.push(terminalPrompt);

    const userInfoPrompt = await generateUserInfoPrompt(context);
    if (userInfoPrompt) tier2Parts.push(userInfoPrompt);

    const skillsPrompt = await generateSkillsPrompt(context);
    if (skillsPrompt) tier2Parts.push(skillsPrompt);

    const rulesPrompt = await generateRulesPrompt(context);
    if (rulesPrompt) tier2Parts.push(rulesPrompt);

    const openspecPrompt = await generateOpenSpecPrompt(context);
    if (openspecPrompt) tier2Parts.push(openspecPrompt);

    const tier2 = tier2Parts.filter(Boolean).join('\n\n');

    // 使用 CACHE_TIER_BREAK 分隔 2 个 tiers
    const finalPrompt = [tier1, tier2]
      .filter(Boolean)
      .join(CACHE_TIER_BREAK);

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

export const enhancedPromptBuilder = new EnhancedPromptBuilder();
export const promptBuilder = enhancedPromptBuilder;