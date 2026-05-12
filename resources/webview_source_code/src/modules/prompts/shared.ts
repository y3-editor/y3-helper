/**
 * 共享的 Prompt 片段生成函数
 * 复用现有逻辑，避免重复代码
 */

import { useMCPStore } from '../../store/mcp';
import { generateSkillsPromptSection } from '../../store/skills/prompt';
import { OPENSPEC_RULES } from '../../store/workspace/openSpecRules';
import { versionCompare } from '../../utils/common';
import { PromptContext, PromptGenerator } from './types';
import { PromptTemplateLoader } from './template-loader';

/**
 * 生成 MCP 工具 prompt
 */
export const generateMCPPrompt: PromptGenerator = async (context) => {
  const { mcpServers = [] } = context;

  if (!mcpServers.length) return null;

  const getChineseNameByServerName = useMCPStore.getState().getChineseNameByServerName;

  // 在代码中组装好完整的内容，模板只负责插入变量
  const serversContent = mcpServers
    .filter((server) => server.status === "connected" && !server.disabled)
    .map((server) => {
      const tools = server.tools
        ?.map((tool) => {
          const schemaStr = tool.inputSchema
            ? `    Input Schema:
  ${JSON.stringify(tool.inputSchema, null, 2).split("\n").join("\n    ")}`
            : ""

          return `- ${tool.name}: ${tool.description}\n${schemaStr}`
        })
        .join("\n\n")

      const templates = server.resourceTemplates
        ?.map((template) => `- ${template.uriTemplate} (${template.name}): ${template.description}`)
        .join("\n")

      const resources = server.resources
        ?.map((resource) => `- ${resource.uri} (${resource.name}): ${resource.description}`)
        .join("\n")

      // 获取中文名称
      const chineseName = server.config?.chinese_name || getChineseNameByServerName(server.name);
      const serverTitle = chineseName ? `## ${server.name} (alias: ${chineseName})` : `## ${server.name}`;

      return (
        serverTitle +
        (tools ? `\n\n### Available Tools\n${tools}` : "") +
        (templates ? `\n\n### Resource Templates\n${templates}` : "") +
        (resources ? `\n\n### Direct Resources\n${resources}` : "")
      )
    })
    .join("\n\n");

  const variables = { serversContent };
  return await PromptTemplateLoader.renderTemplate('mcp-tools', variables);
};

/**
 * 生成 Skills prompt
 */
export const generateSkillsPrompt: PromptGenerator = (context) => {
  const { skills = [], config = {} } = context;

  if (!config.enableSkills || !skills.length) return null;

  return generateSkillsPromptSection(skills);
};

/**
 * 生成用户规则 prompt
 */
export const generateRulesPrompt: PromptGenerator = (context) => {
  const { rules = [] } = context;

  if (!rules.length) return null;

  let rulesContent = '';
  rules.forEach((rule, index) => {
    rulesContent += `
<rule-${index} filePath="${rule.filePath}">
${rule.content}
</rule-${index}>
`;
  });

  return `<user_requirement_rules>
These are user-specified response rules derived from preset rule files in the repository. You MUST follow them.
${rulesContent}
</user_requirement_rules>`;
};

/**
 * 生成任务委托 prompt
 */
export const generateTaskDelegationPrompt: PromptGenerator = (context) => {
  const { config = {} } = context;

  if (!config.autoApply || !config.autoExecute) return null;

  return `<task_delegation>
You have the ability to delegate complex, multi-step tasks to specialized subagents using the "task" tool. Key guidelines:

1. **When to delegate**: Use subagents for tasks requiring many steps of file reading, code search, or analysis that can run independently. For simple lookups (1-2 tool calls), handle them directly.
2. **Concurrent execution**: Only when subtasks are **independent and non-overlapping** (different questions or modules). Do not parallelize the same exploration twice.
3. **Result visibility**: Subagent results are NOT visible to the user. After receiving task results, you MUST summarize the findings in your response to the user.
4. **Context isolation**: Each subagent starts fresh. In \`prompt\`, include: **effort level** (quick vs deep), **definition of done**, **output shape**, and **paths already checked** so the subagent does not repeat work.
5. **Resumption**: Task results may include a task_id. Resume only when partial results are insufficient for the user's question; avoid redundant resume loops.

Example - Exploring code across multiple areas concurrently:
\`\`\`
[Tool Call 1] task(description="Find authentication logic", prompt="Search the codebase for authentication and login related code. Look for middleware, route handlers, and token validation. Report all relevant file paths and key function signatures.", subagent_type="explore")

[Tool Call 2] task(description="Find database schema", prompt="Search for database model definitions, migration files, and schema configurations. Report all table/collection definitions with their fields.", subagent_type="explore")
\`\`\`

Example - Single complex task:
\`\`\`
task(description="Refactor logger module", prompt="1. Read src/utils/logger.ts and all files that import it. 2. Refactor the logger to use a singleton pattern. 3. Update all import sites. 4. Verify no TypeScript errors.", subagent_type="general")
\`\`\`
</task_delegation>`;
};

/**
 * 生成代码编辑 prompt
 */
export const generateCodeEditPrompt: PromptGenerator = async (context) => {
  const { config = {} } = context;

  if (!config.enableEditableMode) return null;

  const enableReplaceInFile = config.codeMakerVersion &&
    (versionCompare('2.4.9', config.codeMakerVersion) > 0);

  const variables = {
    replaceInFileRule: enableReplaceInFile
      ? '10. You MUST use replace_in_file when you need to make change for a large file of MORE THAN 300 lines. If you need to make change for a small file, use edit_file.'
      : '',
  };

  return await PromptTemplateLoader.renderTemplate('code-edit', variables);
};

/**
 * 生成终端 prompt
 */
export const generateTerminalPrompt: PromptGenerator = async (context) => {
  const { config = {}, workspace } = context;

  if (!config.enableTerminal) return null;

  const variables = {
    shell: workspace?.shell || 'bash',
    osName: workspace?.osName || 'Unknown',
  };

  return await PromptTemplateLoader.renderTemplate('terminal', variables);
};

/**
 * 生成 OpenSpec prompt
 */
export const generateOpenSpecPrompt: PromptGenerator = (context) => {
  const { config = {} } = context;

  if (config.codebaseChatMode !== 'openspec' || config.openspecVersion === '1.x') {
    return null;
  }

  return `<open_spec>
Now you are in spec driven development mode, called OpenSpec. Follow the <open_spec_rules> as shown.
<open_spec_rules filePath="@/openspec/AGENTS.md">
${OPENSPEC_RULES}
</open_spec_rules>
</open_spec>`;
};

/**
 * 生成用户环境信息 prompt
 */
export const generateUserInfoPrompt: PromptGenerator = async (context) => {
  const { workspace } = context;

  if (!workspace) return null;

  const variables = {
    osName: workspace.osName || 'Unknown',
    workspacePath: workspace.workspace || '/tmp',
  };

  return await PromptTemplateLoader.renderTemplate('user-info', variables);
};

/**
 * 生成搜索和阅读 prompt（主会话用 search-and-reading；子代理用 search-and-reading-subagent）
 */
export const generateSearchAndReadingPrompt: PromptGenerator = async (context) => {
  const template = context?.isSubagent
    ? 'search-and-reading-subagent'
    : 'search-and-reading';
  return await PromptTemplateLoader.renderTemplate(template);
};

/**
 * 生成工具调用规则 prompt
 */
export const generateToolCallingPrompt: PromptGenerator = async () => {
  const variables = {
    subagentRule: '', // 主代理不需要子代理规则
  };
  return await PromptTemplateLoader.renderTemplate('tool-calling', variables);
};

/**
 * 生成子代理专用工具调用规则 prompt（不包含 task 工具）
 */
export const generateSubagentToolCallingPrompt: PromptGenerator = async () => {
  const variables = {
    subagentRule: '9. **NEVER use the "task" tool.** You are a subagent and cannot delegate work to other subagents. Handle all work directly.\n10. **ABSOLUTE LIMIT: Maximum 2 tools per response.** Calling 3 or more tools simultaneously will cause system errors. If you call 3 or more tools, the execution will fail.',
  };
  return await PromptTemplateLoader.renderTemplate('tool-calling', variables);
};

/**
 * 生成子代理通信规范 prompt
 */
export const generateCommunicationPrompt: PromptGenerator = async () => {
  return await PromptTemplateLoader.renderTemplate('communication');
};

/**
 * 生成外部API调用 prompt
 */
export const generateCallingExternalApisPrompt: PromptGenerator = async () => {
  return await PromptTemplateLoader.renderTemplate('external-apis');
};

/**
 * 变量插值处理（同步版本，向后兼容）
 * @deprecated 请使用 PromptTemplateLoader.interpolateVariables
 */
export function interpolateVariables(template: string, variables: Record<string, string>): string {
  return PromptTemplateLoader.interpolateVariables(template, variables);
}

/**
 * 创建 prompt 上下文
 */
export function createPromptContext(options: Partial<PromptContext> = {}): PromptContext {
  return {
    workspace: undefined,
    mcpServers: [],
    skills: [],
    rules: [],
    mentionFiles: [],
    config: {},
    variables: {},
    isSubagent: false,
    ...options,
  };
}