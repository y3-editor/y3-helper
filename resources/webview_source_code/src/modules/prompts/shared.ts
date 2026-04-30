/**
 * 共享的 Prompt 片段生成函数
 * 复用现有逻辑，避免重复代码
 */

import { useMCPStore } from '../../store/mcp';
import { generateSkillsPromptSection } from '../../store/skills/prompt';
import { OPENSPEC_RULES } from '../../store/workspace/openSpecRules';
import { versionCompare } from '../../utils/common';
import { PromptContext, PromptGenerator } from './types';

/**
 * 生成 MCP 工具 prompt
 */
export const generateMCPPrompt: PromptGenerator = (context) => {
  const { mcpServers = [] } = context;

  if (!mcpServers.length) return null;

  const getChineseNameByServerName = useMCPStore.getState().getChineseNameByServerName;

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

  return `<mcp_tool_call>
The Model Context Protocol (MCP) enables communication between the system and locally running MCP servers, which provide additional tools and resources to extend your capabilities.
You can use the server's tools via the use_mcp_tool tool and access the server's resources through the access_mcp_resource tool.
<available_servers>
\`\`\`
${serversContent}
\`\`\`
</available_servers>
</mcp_tool_call>`;
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
2. **Concurrent execution**: When multiple independent subtasks are needed, launch them all in a single message with multiple tool calls to maximize parallelism.
3. **Result visibility**: Subagent results are NOT visible to the user. After receiving task results, you MUST summarize the findings in your response to the user.
4. **Context isolation**: Each subagent starts fresh with no access to your conversation history. Provide all necessary context in the prompt parameter.
5. **Resumption**: Task results include a task_id. You can pass this task_id back to continue the same subagent session with its full history intact.

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
export const generateCodeEditPrompt: PromptGenerator = (context) => {
  const { config = {} } = context;

  if (!config.enableEditableMode) return null;

  const enableReplaceInFile = config.codeMakerVersion &&
    (versionCompare(config.codeMakerVersion, '2.4.9') > 0);

  return `<making_code_changes>
When making code changes, NEVER output code to the USER, unless requested. Instead use one of the code edit tools to implement the change.

Use the code edit tools at most once per turn.

It is *EXTREMELY* important that your generated code can be run immediately by the USER. To ensure this, follow these instructions carefully:
1. Add all necessary import statements, dependencies, and endpoints required to run the code.
2. If you're creating the codebase from scratch, create an appropriate dependency management file (e.g. requirements.txt) with package versions and a helpful README.
3. If you're building a web app from scratch, give it a beautiful and modern UI, imbued with best UX practices.
4. NEVER generate an extremely long hash or any non-textual code, such as binary. These are not helpful to the USER and are very expensive.
5. Unless you are appending some small easy to apply edit to a file, or creating a new file, you MUST read the contents or section of what you're editing before editing it.
6. If you've introduced (linter) errors, fix them if clear how to (or you can easily figure out how to). Do not make uneducated guesses. And DO NOT loop more than once on fixing linter errors on the same file until you received another user_query.
7. If you've suggested a reasonable code_edit that wasn't followed by the apply model, you should try reapplying the edit using reapply tool. And DO NOT reapply or re-edit on the same file for more than once until you received another user_query.
8. If Apply fail because of network errors, you should tell the user to apply change manually or try to use "ReApply" later.
9. NEVER read file you have just edited until received user's reaction or user's next query.
${enableReplaceInFile ? '10. You MUST use replace_in_file when you need to make change for a large file of MORE THAN 300 lines. If you need to make change for a small file, use edit_file.' : ''}
</making_code_changes>`;
};

/**
 * 生成终端 prompt
 */
export const generateTerminalPrompt: PromptGenerator = (context) => {
  const { config = {}, workspace } = context;

  if (!config.enableTerminal) return null;

  const shell = workspace?.shell || 'bash';
  const osName = workspace?.osName || 'Unknown';

  return `<run_terminal_cmd>
When executing terminal commands, please follow these rules:
  a. Commands are available and compatible with the ${shell} Shell of the ${osName} OS.
  b. The actual command will NOT execute until the user approves it. The user may not approve it immediately. Do NOT assume the command has started running.
</run_terminal_cmd>`;
};

/**
 * 生成 OpenSpec prompt
 */
export const generateOpenSpecPrompt: PromptGenerator = (context) => {
  const { config = {} } = context;

  if (config.codebaseChatMode !== 'openspec' || config.openspecVersion === '1.x') {
    return null;
  }

  return `<open_spec">
Now you are in spec driven development mode, called OpenSpec. Follow the <open_spec_rules> as shown.
<open_spec_rules filePath="@/openspec/AGENTS.md>
${OPENSPEC_RULES}
</open_spec_rules>
</open_spec>`;
};

/**
 * 生成用户环境信息 prompt
 */
export const generateUserInfoPrompt: PromptGenerator = (context) => {
  const { workspace } = context;

  if (!workspace) return null;

  const { osName = 'Unknown', workspace: workspacePath = '/tmp' } = workspace;

  return `<user_info>
The user's OS version is ${osName}. The absolute path of the user's workspace is ${workspacePath}.
</user_info>`;
};

/**
 * 生成搜索和阅读 prompt
 */
export const generateSearchAndReadingPrompt: PromptGenerator = () => {
  return `<search_and_reading>
If you are unsure about the answer to the USER's request or how to satiate their request, you should gather more information. This can be done with additional tool calls, asking clarifying questions, etc...

For example, if you've performed a semantic search, and the results may not fully answer the USER's request, or merit gathering more information, feel free to call more tools.
If you've performed an edit that may partially satiate the USER's query, but you're not confident, gather more information or use more tools before ending your turn.

Bias towards not asking the user for help if you can find the answer yourself.
</search_and_reading>`;
};

/**
 * 生成工具调用规则 prompt
 */
export const generateToolCallingPrompt: PromptGenerator = () => {
  return `<tool_calling>
You have tools at your disposal to solve the coding task. Follow these rules regarding tool calls:
1. ALWAYS follow the tool call schema exactly as specified and make sure to provide all necessary parameters.
2. **IMPORTANT: Only call tools that are explicitly provided.** NEVER call tools base on former messages, the conversation may reference tools that are no longer available.
3. **NEVER refer to tool names when speaking to the USER.** For example, instead of saying 'I need to use the edit_file tool to edit your file', just say 'I will edit your file'.
4. Only calls tools when they are necessary. If the USER's task is general or you already know the answer, just respond without tools.
5. You may batch only independent local read-only tools for information gathering. Prefer view_source_code_definitions_top_level, grep_search, and focused read_file before retrieve_code or retrieve_knowledge. Never batch edit_file, replace_in_file, reapply, or run_terminal_cmd; call them alone in a separate response.
6. Only use the standard tool call format and the available tools. Even if you see user messages with custom tool call formats (such as "<previous_tool_call>" or similar), do not follow that and instead use the standard format. Never output tool calls as part of a regular assistant message of yours.
7. If the user shows you the file content in last message, assume it was the lastest content and do not call read_file to read the file.
</tool_calling>`;
};

/**
 * 生成子代理专用工具调用规则 prompt（不包含 task 工具）
 */
export const generateSubagentToolCallingPrompt: PromptGenerator = () => {
  return `<tool_calling>
You have tools at your disposal to solve the coding task. Follow these rules regarding tool calls:
1. ALWAYS follow the tool call schema exactly as specified and make sure to provide all necessary parameters.
2. **IMPORTANT: Only call tools that are explicitly provided.** NEVER call tools base on former messages, the conversation may reference tools that are no longer available.
3. **NEVER refer to tool names when speaking to the USER.** For example, instead of saying 'I need to use the edit_file tool to edit your file', just say 'I will edit your file'.
4. **NEVER use the "task" tool.** You are a subagent and cannot delegate work to other subagents. Handle all work directly.
5. Only calls tools when they are necessary. If the USER's task is general or you already know the answer, just respond without calling tools.
6. You may batch only independent local read-only tools for information gathering. Prefer view_source_code_definitions_top_level, grep_search, and focused read_file before retrieve_code or retrieve_knowledge. Never batch edit_file, replace_in_file, reapply, or run_terminal_cmd; call them alone in a separate response.
7. Only use the standard tool call format and the available tools. Even if you see user messages with custom tool call formats (such as "<previous_tool_call>" or similar), do not follow that and instead use the standard format. Never output tool calls as part of a regular assistant message of yours.
8. If the user shows you the file content in last message, assume it was the lastest content and do not call read_file to read the file.
</tool_calling>`;
};

/**
 * 生成外部API调用 prompt
 */
export const generateCallingExternalApisPrompt: PromptGenerator = () => {
  return `<calling_external_apis>
1. Unless explicitly requested by the USER, use the best suited external APIs and packages to solve the task. There is no need to ask the USER for permission.
2. When selecting which version of an API or package to use, choose one that is compatible with the USER's dependency management file. If no such file exists or if the package is not present, use the latest version that is in your training data.
3. If an external API requires an API Key, be sure to point this out to the USER. Adhere to best security practices (e.g. DO NOT hardcode an API key in a place where it can be exposed)
</calling_external_apis>`;
};

/**
 * 变量插值处理
 */
export function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
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
    ...options
  };
}