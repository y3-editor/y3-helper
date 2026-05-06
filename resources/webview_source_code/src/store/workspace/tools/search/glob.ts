/**
 * @name glob 检索文件工具
 */
import { ToolCall } from "../../../../services";

export const GLOB_TOOL_NAME = 'glob_search';


// 解析 glob_search 工具参数
export function parseGlobSearchParams(tool: ToolCall): { pattern: string; path?: string } {
  try {
    const params = JSON.parse(tool.function.arguments || '{}');
    return {
      pattern: params.pattern || '*',
      path: params.path
    };
  } catch {
    return { pattern: '*' };
  }
}

export const getGlobTool = ({
  enableSubAgent
}: {
  enableSubAgent: boolean;
}) => {
  const description = `- Fast file pattern matching tool that works with any codebase size
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- You can call multiple tools in a single response. It is always better to speculatively perform multiple searches in parallel if they are potentially useful
${enableSubAgent ? '- When you are doing an open ended search that may require multiple rounds of globbing and grepping, use the Explore Subagent in the task tool instead' : ''}.`;

  return (
    {
      type: 'function',
      function: {
        name: GLOB_TOOL_NAME,
        description: description,
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'The glob pattern to match files against',
            },
            path: {
              type: 'string',
              description: 'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.',
            },
          },
          required: ['pattern'],
        },
      },
    }
  )
}
