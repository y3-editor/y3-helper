import { Tool } from ".";
import { versionCompare } from "../../utils/common";
import { useChatStore } from "../chat";
import { useChatConfig } from "../chat-config";
import { MCPServer } from "../mcp";
import { useSkillsStore } from "../skills";
import { generateCodewikiStructure } from "./tools/codewiki";
import { Tool as PlanTool } from "./tools/plan";
import { getV2ReadFileTool } from "./tools/read";
import { Tool as TodoTool } from "./tools/todo";
import { Tool as AskUserQuestionTool } from "./tools/askUserQuestion";

export function getToolsEN(options: {
  workspace: string;
  hasCodeTable: boolean;
  MCPServers: MCPServer[];
  enableTerminal?: boolean;
  codeMakerVersion?: string;
  isVSCode: boolean;
}) {
  const {
    workspace,
    hasCodeTable,
    MCPServers,
    enableTerminal,
    codeMakerVersion,
    isVSCode
  } = options;
  const { enableEditableMode, enableSkills, enableUserQuestion } = useChatConfig.getState();
  const planModeState = useChatStore.getState().currentSession()?.data?.planModeState || 'off';
  const enableCloudSearch = false;
  const enableKnowledgeLibSearch = true;

  const enableReplaceInFile = true;
  const enableGrep = true;

  let enablePlanMode = useChatStore.getState().currentSession()?.data?.enablePlanMode || false;
  const codebaseChatMode = useChatStore.getState().codebaseChatMode;
  if (['openspec', 'speckit'].includes(codebaseChatMode || '')) {
    enablePlanMode = false;
  }

  const tools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'list_files_top_level',
        description:
          'List all files and directories at the top level of the specified directory. Use only for generic directories with no nested structure, such as the desktop.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `Path of the specified directory (relative to the current working directory ${workspace})`,
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_files_recursive',
        description:
          'Recursively list all files and directories in the specified directory. This tool can provide a comprehensive view of the project structure and guide decisions on which files to process or explore further.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `Path of the specified directory (relative to the current working directory ${workspace})`,
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'view_source_code_definitions_top_level',
        description:
          'Parse all source code files at the top level of the specified directory to extract names of key elements such as classes and functions. This tool provides a deeper understanding of the codebase structure and important constructs, essential for understanding the overall architecture concepts and relationships.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `Path of the specified directory (relative to the current working directory ${workspace})`,
            },
          },
          required: ['path'],
        },
      },
    },
    getV2ReadFileTool({ hasCodeTable }),
    // {
    //   type: 'function',
    //   function: {
    //     "description": `Calls a smarter model to apply the last edit to the specified file.
    //   Use this tool immediately after the result of an edit_file tool call ONLY IF the diff is not what you expected, indicating the model applying the changes was not smart enough to follow your instructions.`,
    //     "name": "reapply",
    //     "parameters": {
    //       "properties": {
    //         "target_file": {
    //           "description": "The relative path to the file to reapply the last edit to. You can use either a relative path in the workspace or an absolute path. If an absolute path is provided, it will be preserved as is.",
    //           "type": "string"
    //         }
    //       },
    //       "required": [
    //         "target_file"
    //       ],
    //       "type": "object"
    //     }
    //   }
    // }
  ];
  if (enableGrep) {
    tools.push({
      type: 'function',
      function: {
        //   description: `Fast text-based regex search that finds exact pattern matches within files or directories, utilizing the ripgrep command for efficient searching.
        // Results will be formatted in the style of ripgrep and can be configured to include line numbers and content.
        // To avoid overwhelming output, the results are capped at 50 matches.
        // Use file_pattern to filter the search scope by file type or specific paths.

        // This is best for finding exact text matches or regex patterns.
        // More precise than semantic search for finding specific strings or patterns.
        // This is preferred over semantic search when we know the exact symbol/function name/etc. to search in some set of directories/file types.

        // The query MUST be a valid regex, so special characters must be escaped.
        // e.g. to search for a method call 'foo.bar(', you could use the query '\\\\bfoo\\\\.bar\\\\('.`,
        description: `A powerful search tool built on ripgrep

Usage:
- Prefer grep for exact symbol/string searches. Whenever possible, use this instead of terminal grep/rg. This tool is faster and respects .gitignore.
- Supports full regex syntax, e.g. \"log.*Error\", \"function\\s+\\w+\". Ensure you escape special chars to get exact matches, e.g. \"functionCall\\(\"
- Avoid overly broad glob patterns (e.g., '--glob *') as they bypass .gitignore rules and may be slow
- Only use 'file_pattern' when certain of the file type needed. Note: import paths may not match source file types (.js vs .ts)
- regex syntax: Uses ripgrep (not grep) - literal braces need escaping (e.g. use interface\\{\\} to find interface{} in Go code)
- To avoid overwhelming output, the results are capped at 50 matches.`,
        name: 'grep_search',
        parameters: {
          properties: {
            path: {
              description: 'The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.',
              type: 'string'
            },
            file_pattern: {
              description: "Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*)",
              type: 'string'
            },
            regex: {
              description: "The regular expression pattern to search for. Uses Rust regex syntax",
              type: "string"
            },
            case_sensitive: {
              description: "Whether the search should be case sensitive. Default is false.",
              type: "boolean"
            }
          },
          required: [
            'path',
            "regex"
          ],
          type: 'object'
        }
      }
    })
  }
  if (enableReplaceInFile && enableEditableMode) {
    tools.push({
      type: 'function',
      function: {
        description: `## Purpose

- Make targeted edits to specific parts of an existing file without overwriting the entire file.

## When to Use

- Especially useful for long files where much of the file will remain unchanged.
- Small, localized changes like updating a few lines, function implementations, changing variable names, modifying a section of text, etc.
- Targeted improvements where only specific portions of the file's content needs to be altered.

## Advantages

- More efficient for minor edits, since you don't need to supply the entire file content.
- Reduces the chance of errors that can occur when overwriting large files.`,
        name: 'replace_in_file',
        parameters: {
          properties: {
            target_file: {
              description: "The target file to modify. Always specify the target file as the first argument. You can use either a relative path in the workspace or an absolute path. If an absolute path is provided, it will be preserved as is.",
              type: "string"
            },
            diff: {
              description: `One or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
------- SEARCH
[exact content to find]
=======
[new content to replace with]
+++++++ REPLACE
\`\`\`
Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
  * Match character-for-character including whitespace, indentation, line endings
  * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
  * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
  * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
  * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. Keep SEARCH/REPLACE blocks concise:
  * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
  * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
  * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
  * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
4. Special operations:
  * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
  * To delete code: Use empty REPLACE section`,
              type: "string"
            },
            is_create_file: {
              description: "Whether the target file is a new file or an existing one. Defaults to false. If true, the target file is a new file.",
              type: "boolean"
            }
          },
          required: [
            "target_file",
            "diff"
          ],
          type: "object"
        }
      }
    })
  }
  if (enableTerminal) {
    tools.push({
      type: 'function',
      function: {
        "description": "PROPOSE a command to run on behalf of the user.\\nIf you have this tool, note that you DO have the ability to run commands directly on the USER's system.\\nNote that the user will have to approve the command before it is executed.\\nThe user may reject it if it is not to their liking, or may modify the command before approving it.  If they do change it, take those changes into account.\\nThe actual command will NOT execute until the user approves it. The user may not approve it immediately. Do NOT assume the command has started running.\\nIf the step is WAITING for user approval, it has NOT started running.\\nIn using these tools, adhere to the following guidelines:\\n1. Based on the contents of the conversation, you will be told if you are in the same shell as a previous step or a different shell.\\n2. If in a new shell, you should `cd` to the appropriate directory and do necessary setup in addition to running the command.\\n3. If in the same shell, the state will persist (eg. if you cd in one step, that cwd is persisted next time you invoke this tool).\\n4. For ANY commands that would use a pager or require user interaction, you should append ` | cat` to the command (or whatever is appropriate). Otherwise, the command will break. You MUST do this for: git, less, head, tail, more, etc.\\n5. For commands that are long running/expected to run indefinitely until interruption, please run them in the background. To run jobs in the background, set `is_background` to true rather than changing the details of the command.\\n6. Dont include any newlines in the command.",
        "name": "run_terminal_cmd",
        "parameters": {
          "properties": {
            "command": {
              "description": "The terminal command to execute",
              "type": "string"
            }
          },
          "required": [
            "command"
          ],
          "type": "object"
        }
      }
    })
  }
  if (hasCodeTable && enableCloudSearch) {
    tools.push({
      type: 'function',
      function: {
        name: 'retrieve_code',
        description:
          'Retrieve code snippets from the codebase through semantic similarity. This tool can obtain information not available in directory and file names through vector retrieval, which is particularly useful for finding specific functions and code. It is recommended to use this tool when the information obtained by the `read_file` tool has low relevance. Since retrieval is based on semantic similarity, when using this tool, please pass the user\'s original input and do not tokenize or append additional content yourself. This tool must be used together with `retrieve_knowledge`.',
        parameters: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description:
                'Content to retrieve. Please pass the user\'s original input and do not tokenize or append additional content yourself.',
            },
          },
          required: ['search_query'],
        },
      },
    });
  }
  if (enableKnowledgeLibSearch) {
    tools.push({
      type: 'function',
      function: {
        name: 'retrieve_knowledge',
        description:
          'Retrieve knowledge snippets from the knowledge base. You can use this tool to get related knowledge snippets.',
        parameters: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description:
                'Input for retrieving knowledge base snippets, derived from the user\'s question, with some information supplementation and refinement.',
            },
            docset_id: {
              type: 'string',
              description:
                'The docset code specifying which knowledge base dataset to search.',
            },
          },
          required: ['search_query', 'docset_id'],
        },
      },
    })
  }

  if (enablePlanMode) {
    if (planModeState === 'off' || planModeState === 'pending_approval' || !planModeState || planModeState === 'rejected')
      tools.push(PlanTool);
    else if (planModeState === 'approved' || planModeState === 'draft' || planModeState === 'executing' || planModeState === 'completed')
      tools.push(TodoTool);
  }

  if (MCPServers.length) {
    tools.push({
      type: 'function',
      function: {
        name: 'use_mcp_tool',
        description:
          '请求使用由已连接的MCP服务器提供的工具。每个MCP服务器可以提供多个具有不同功能的工具。这些工具都有定义好的输入模式，用于指定必需和可选的参数',
        parameters: {
          type: 'object',
          properties: {
            server_name: {
              type: 'string',
              description:
                '提供该工具的MCP服务器名称',
            },
            tool_name: {
              type: 'string',
              description:
                '要执行的工具名称',
            },
            arguments: {
              type: 'string',
              description:
                '一个JSON对象，包含该工具的输入参数，需符合工具的输入模式',
            },
          },
          required: ['server_name', 'tool_name', 'arguments'],
        },
      },
    });
    tools.push({
      type: 'function',
      function: {
        name: 'access_mcp_resource',
        description:
          '请求访问由已连接的MCP服务器提供的资源。资源可用作上下文的数据源，如文件、API响应或系统信息',
        parameters: {
          type: 'object',
          properties: {
            server_name: {
              type: 'string',
              description:
                '提供该资源的MCP服务器名称',
            },
            uri: {
              type: 'string',
              description:
                '用于标识特定资源的URI',
            },
          },
          required: ['server_name', 'uri'],
        },
      },
    });
  }

  if (isVSCode && versionCompare('2.9.9', codeMakerVersion || '') >= 0) {
    tools.push(generateCodewikiStructure({ language: 'en' }));
  }

  const skills = useSkillsStore.getState().skills;
  if (enableSkills && skills.length > 0) {
    const skillNames = skills.map(s => s.name);
    tools.push({
      type: 'function',
      function: {
        name: 'use_skill',
        description: 'Load and activate a skill to get specialized instructions for a specific task. Skills provide detailed guidance, workflows, and best practices for common development tasks. Only call this when the user\'s request clearly matches an available skill.',
        parameters: {
          type: 'object',
          properties: {
            skill_name: {
              type: 'string',
              description: `The name of the skill to activate. Must be one of the available skills: ${skillNames.join(', ')}`,
              enum: skillNames,
            },
          },
          required: ['skill_name'],
        },
      },
    });
  }

  if (enableUserQuestion) {
    // Add ask_user_question tool
    tools.push(AskUserQuestionTool);
  }

  return tools;
}
