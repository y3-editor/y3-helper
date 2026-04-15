import { Tool } from ".";
import { versionCompare } from "../../utils/common";
import { useChatStore } from "../chat";
import { useChatConfig } from "../chat-config";
import { MCPServer } from "../mcp";
import { generateCodewikiStructure } from "./tools/codewiki";
import { Tool as PlanTool } from "./tools/plan";
import { getV2ReadFileToolZHTool } from "./tools/read";
import { Tool as TodoTool } from "./tools/todo";

export function getTools(options: {
  workspace: string;
  hasCodeTable: boolean;
  MCPServers: MCPServer[];
  isVSCode?: boolean;
  isJetbrains?: boolean;
  enableTerminal?: boolean;
  codeMakerVersion?: string;
}) {
  const {
    workspace,
    hasCodeTable,
    MCPServers,
    enableTerminal,
    isVSCode,
    codeMakerVersion
  } = options;
  const { enableCodeMapSearch, enableKnowledgeLibSearch } = useChatConfig.getState();
  const enablePlanMode = useChatStore.getState().currentSession()?.data?.enablePlanMode || false;
  const planModeState = useChatStore.getState().currentSession()?.data?.planModeState || 'off';
  const enableCloudSearch = enableCodeMapSearch && enableKnowledgeLibSearch;
  const enableGrep = true;

  const tools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'list_files_top_level',
        description:
          '列出指定目录顶层的所有文件和目录。仅当无嵌套结构的通用目录使用，例如桌面。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `指定目录的路径（相对于当前工作目录 ${workspace}）`,
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
          '递归列出指定目录中的所有文件和目录。此工具可以获取项目结构的全面视图，并可以指导决策处理或进一步探索哪些文件。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `指定目录的路径（相对于当前工作目录 ${workspace}）`,
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
          '解析指定目录顶层的所有源代码文件，以提取类和函数等关键元素的名称。此工具可以深入了解代码库结构和重要构造，理解整体架构至关重要的概念和关系。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: `指定目录的路径（相对于当前工作目录 ${workspace}）`,
            },
          },
          required: ['path'],
        },
      },
    },
    getV2ReadFileToolZHTool({ hasCodeTable }),
  ];
  if (enableGrep) {
    tools.push({
      type: 'function',
      function: {
        description: `基于 ripgrep 构建的强大搜索工具

使用说明：
- 对于精确的符号/字符串搜索，优先使用 grep。尽可能使用此工具而非终端的 grep/rg。此工具更快且遵循 .gitignore 规则。
- 支持完整的正则表达式语法，例如 \"log.*Error\"、\"function\\s+\\w+\"。确保转义特殊字符以获得精确匹配，例如 \"functionCall\\(\"
- 避免过于宽泛的通配符模式（如 '--glob *'），因为它们会绕过 .gitignore 规则且可能很慢
- 只有在确定所需文件类型时才使用 'file_pattern'。注意：导入路径可能与源文件类型不匹配（.js vs .ts）
- 正则语法：使用 ripgrep（非 grep）- 字面大括号需要转义（例如使用 interface\\{\\} 来查找 Go 代码中的 interface{}）
- 为避免输出过多，结果限制在 50 个匹配项内。`,
        name: 'grep_search',
        parameters: {
          properties: {
            path: {
              description: '要搜索的目录路径（相对于当前工作目录）。此目录将被递归搜索。',
              type: 'string'
            },
            file_pattern: {
              description: "用于过滤文件的通配符模式（例如，'*.ts' 表示 TypeScript 文件）。如果未提供，将搜索所有文件 (*)",
              type: 'string'
            },
            regex: {
              description: "要搜索的正则表达式模式。使用 Rust 正则语法",
              type: "string"
            },
            case_sensitive: {
              description: "搜索是否区分大小写。默认为 false。",
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
  if (enableTerminal) {
    tools.push({
      type: 'function',
      function: {
        name: 'run_terminal_cmd',
        description: '提供一条可执行的命令给用户\n 请注意，你具备直接在用户系统上运行命令的能力。\n 需要注意的是，该命令在执行前必须得到用户的批准。\n 如果用户不喜欢这条命令，他们可能会拒绝；也可能在批准前对命令进行修改。若用户确实进行了修改，需将这些修改考虑在内。\n 实际上，在用户批准之前，命令不会执行。用户可能不会立即批准。切勿假定命令已开始运行。\n 如果此步骤正在等待用户批准，那么它尚未开始运行。\n 在使用这些工具时，需遵循以下准则：\n1. 根据对话内容，系统会告知你与前一步骤是在同一个 shell 中还是不同的 shell 中。\n2. 如果是在新的 shell 中，除了运行命令外，你还应该cd到适当的目录并进行必要的设置。\n3. 如果是在同一个 shell 中，状态会持续存在。\n4. 命令中不要包含任何换行符。',
        parameters: {
          type: 'object',
          properties: {
            command: {
              description: '可执行的终端命令',
              type: 'string'
            }
          },
          required: ['command'],
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
          '从代码库中通过语义相似度检索代码片段。此工具可以通过向量检索获取到目录和文件名中无法获取的信息，这对于查找特定函数和代码特别有用。建议在 `read_file` 工具获取的信息关联性较低时使用此工具。由于是通过语义相似度检索，使用此工具时请传用户的原始输入，禁止自行分词和附加其他内容。这个工具必须跟 `retrieve_knowledge` 同时使用',
        parameters: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description:
                '检索内容，请传用户的原始输入，禁止自行分词和附加其他内容。',
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
          '从知识库检索知识片段，当用户提到一些特有名词或者专业术语，你可以使用此工具来获取相关知识片段。若 `retrieve_code` 工具存在，必须跟 `retrieve_code` 同时使用',
        parameters: {
          type: 'object',
          properties: {
            search_query: {
              type: 'string',
              description:
                '检索知识库片段的输入，来自用户问题，可以进行一些信息补充和润色。',
            },
            docset_id: {
              type: 'string',
              description:
                '指定要检索的数据集代号。',
            },
          },
          required: ['search_query', 'docset_id'],
        },
      },
    })
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

  if (enablePlanMode) {
    if (planModeState === 'off' || planModeState === 'pending_approval' || !planModeState || planModeState === 'rejected')
      tools.push(PlanTool);
    else if (planModeState === 'approved' || planModeState === 'draft' || planModeState === 'executing' || planModeState === 'completed')
      tools.push(TodoTool);
  }

  if (isVSCode && versionCompare('2.9.9', codeMakerVersion || '') >= 0) {
    tools.push(generateCodewikiStructure({ language: 'zh' }));
  }
  return tools;
}
