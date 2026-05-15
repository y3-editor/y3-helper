/**
 * 工具分发入口：对齐上游 src/utils/executeFunction.ts
 *
 * Y3Helper 适配：通过 provider 注入依赖（sendMessage / apiServerPort），
 * 避免 tools 反过来依赖 CodeMakerWebviewProvider 类实体。
 */
import SkillsHandler from '../skillsHandler';
import { getMcpHub } from '../mcpHandlers/index';
import { readFile, listFiles, viewSourceCodeDefinitionsTopLevel } from './analyzeProject/index';
import grepSearch from './grepSearch';
import { globSearch } from './globSearch';
import editFile, { writeToFile } from './editFile/index';
import { executeClaudeEdit, executeClaudeWrite } from './editFile/claudeEdit';
import replaceInFile from './replaceInFile/index';
import { normalizeMcpToolArguments } from './mcpToolArguments';
import runTerminalCmd from './terminal/index';
import { ensureRtkBinary } from './rtk/rtkBinaryManager';
import { rewriteCommandViaRtk } from './rtk/rtkRewriter';
import { rewriteCommandWithRtk } from './rtk/rtkCommandRewriter';
import * as vscode from 'vscode';
import * as os from 'os';
import { buildImageDataUrl } from './imageData';
import { internalFs } from './internalFs';
import { persistToolResultToDisk, maybePersistToolResultToDisk } from './persistToolResult';

/**
 * 工具执行所需的 provider 能力（由 CodeMakerWebviewProvider 实现）
 */
export interface ToolProvider {
    sendMessage(message: any): void;
    readonly apiServerPort: number;
}

export interface ExecuteCommandResult {
    content: string;
    isError: boolean;
    path?: string;
    extra?: any;
}

export interface ExecuteFunctionParams {
    toolId: string;
    toolName: string;
    toolParams: any;
    panelId?: string;
    isPrivateModel?: boolean;
    provider: ToolProvider;
}

/**
 * Strip `rtk ` prefix from command segments when RTK binary is unavailable.
 * Handles command chains (&, |, ;) by stripping from each segment independently.
 */
function stripRtkPrefix(command: string): string {
    return command
        .split(/(&&|\|\||[;|])/)
        .map(seg => seg.replace(/^\s*rtk\s+/, ''))
        .join('');
}

/**
 * 工具分发主入口
 * 对齐上游 executeFunction 默认导出的 switch 派发
 */
export default async function executeFunction(
    params: ExecuteFunctionParams,
): Promise<ExecuteCommandResult> {
    const { toolName, toolParams } = params;
    switch (toolName) {
        case 'read_file':
            return readFile(toolParams);
        case 'list_files_top_level':
            return listFiles(toolParams, false);
        case 'list_files_recursive':
            return listFiles(toolParams, true);
        case 'view_source_code_definitions_top_level':
            return viewSourceCodeDefinitionsTopLevel(toolParams);
        case 'grep_search':
            return grepSearch({
                relPath: toolParams?.path || '.',
                regex: toolParams?.regex || toolParams?.pattern,
                filePattern: toolParams?.file_pattern,
                caseSensitive: toolParams?.case_sensitive,
                isPrivateModel: params.isPrivateModel,
            });
        case 'glob_search':
            return globSearch(toolParams?.pattern, toolParams?.path);
        case 'write_to_file':
            return writeToFile(toolParams);
        case 'edit_file':
        case 'reapply':
            return editFile({
                targetFile: toolParams?.target_file || toolParams?.path,
                codeEdit: toolParams?.code_edit ?? toolParams?.content ?? '',
                isCreateFile: toolParams?.is_create_file,
                toolCallId: params.toolId,
                provider: params.provider,
            });
        case 'replace_in_file':
            return replaceInFile({
                targetFile: toolParams?.target_file || toolParams?.path,
                replaceSnippet: toolParams?.diff ?? '',
                isCreateFile: toolParams?.is_create_file,
                toolCallId: params.toolId,
            });
        case 'write':
            // Claude 原生 write 工具：整文件覆写/创建
            return executeClaudeWrite({
                file_path: toolParams?.file_path,
                content: toolParams?.content ?? '',
                toolId: params.toolId,
                autoApply: toolParams?.autoApply ?? false,
            }) as Promise<ExecuteCommandResult>;
        case 'edit':
            // Claude 原生 edit 工具：old_string → new_string 精确替换
            return executeClaudeEdit({
                file_path: toolParams?.file_path,
                old_string: toolParams?.old_string ?? '',
                new_string: toolParams?.new_string ?? '',
                replace_all: toolParams?.replace_all,
                toolId: params.toolId,
                autoApply: toolParams?.autoApply ?? false,
            }) as Promise<ExecuteCommandResult>;
        case 'run_terminal_cmd':
            if (!toolParams.command) {
                return {
                    content: "Error: Missing value for required parameter 'command'. Please retry with complete response.",
                    isError: true,
                };
            }
            // RTK command interception (从前端 tool_params.enableRtk 透传)
            let command = toolParams.command;
            let isRtk = false;
            const rtkEnabled = toolParams.enableRtk === true;
            if (rtkEnabled) {
                const rtkPath = await ensureRtkBinary();
                if (rtkPath) {
                    if (os.platform() !== 'win32') {
                        const rewritten = await rewriteCommandViaRtk(command, rtkPath);
                        isRtk = rewritten !== command;
                        command = rewritten;
                    } else {
                        const rewritten = rewriteCommandWithRtk(command, rtkPath);
                        isRtk = rewritten !== command;
                        command = rewritten;
                    }
                } else {
                    // Fallback: binary unavailable — strip `rtk ` prefix to prevent command failure
                    console.log(`[RTK] binary unavailable, stripping rtk prefix from: "${command}"`);
                    command = stripRtkPrefix(command);
                }
            }
            toolParams.command = command;
            return runTerminalCmd(toolParams, params.toolId, params.provider, isRtk);
        case 'make_plan':
        case 'write_todo':
            return toolMakePlan();
        case 'use_skill':
            return toolUseSkill(toolParams);
        case 'generate_codewiki_structure':
            return toolGenerateCodewiki();
        case 'use_mcp_tool':
            return toolUseMcp(toolParams);
        case 'access_mcp_resource':
            return toolAccessMcpResource(toolParams);
        case 'internal_fs': {
            const result = internalFs(toolParams);
            return { content: result.content, path: toolParams.path || '', isError: result.isError };
        }
        case 'persist_pruned_output': {
            // pruneToolOutputs 专用：将 tool output 落盘并返回 <persisted-output> 引用
            const result = await persistToolResultToDisk({
                toolId: toolParams.tool_call_id,
                sessionId: toolParams.session_id,
                content: toolParams.content,
                skipThresholdCheck: true, // prune 按 token 预算决策，不限字符长度
            });
            if (!result) {
                return { content: '', path: '', isError: true };
            }
            return {
                content: result.content,
                path: result.persistedFilePath,
                isError: false,
            };
        }
        default:
            return {
                content: `Tool "${toolName}" is not supported in Y3Helper integration.`,
                isError: true,
            };
    }
}

// ─────────────────────────────────────────────
//  计划 / TODO
// ─────────────────────────────────────────────

async function toolMakePlan(): Promise<ExecuteCommandResult> {
    return { content: 'ok', path: '', isError: false };
}

// ─────────────────────────────────────────────
//  use_skill
// ─────────────────────────────────────────────

/**
 * use_skill 工具：加载 skill 内容并返回给 AI
 * 支持 skill_name 为字符串或字符串数组
 */
async function toolUseSkill(params: any): Promise<ExecuteCommandResult> {
    const skillName = params?.skill_name;

    if (!skillName) {
        return {
            content: 'Error: skill_name parameter is required.',
            path: '',
            isError: true,
        };
    }

    const handler = SkillsHandler.getInstance();

    // 支持数组参数：一次激活多个 skill
    const names: string[] = Array.isArray(skillName) ? skillName : [skillName];
    const results: any[] = [];

    for (const name of names) {
        const result = await handler.activateSkill(name);
        if (result.success && result.skill) {
            results.push(result.skill);
        } else {
            results.push({ name, error: result.error });
        }
    }

    // 如果只有一个 skill，返回单个对象；否则返回数组
    if (names.length === 1) {
        const r = results[0];
        if (r.error) {
            return {
                content: `Error: ${r.error}`,
                path: r.name || '',
                isError: true,
            };
        }
        return {
            content: JSON.stringify(r),
            path: r.path || '',
            isError: false,
        };
    }

    // 多 skill：返回 JSON 数组
    return {
        content: JSON.stringify(results),
        path: names.join(', '),
        isError: results.some(r => r.error),
    };
}

// ─────────────────────────────────────────────
//  generate_codewiki_structure
// ─────────────────────────────────────────────

async function toolGenerateCodewiki(): Promise<ExecuteCommandResult> {
    return {
        content: 'generate_codewiki_structure is not yet supported in Y3Helper integration.',
        path: '',
        isError: true,
    };
}

// ─────────────────────────────────────────────
//  MCP 工具调用
// ─────────────────────────────────────────────

/**
 * use_mcp_tool 工具：调用 MCP 服务器上的工具
 * tool_params: { server_name: string, tool_name: string, arguments?: object }
 */
async function toolUseMcp(params: any): Promise<ExecuteCommandResult> {
    const hub = getMcpHub();
    if (!hub) {
        return { content: 'MCP Hub 未初始化', isError: true };
    }
    const serverName = params?.server_name;
    const toolName = params?.tool_name;
    if (!serverName || !toolName) {
        return { content: 'Error: server_name and tool_name are required.', isError: true };
    }
    try {
        // 前端传来的 arguments 可能是 JSON 字符串，需要解析
        const normalizedArguments = normalizeMcpToolArguments(params?.arguments);
        if (!normalizedArguments.ok) {
            return {
                content: normalizedArguments.message,
                isError: true,
            };
        }
        const toolArguments = normalizedArguments.value;
        console.log(`[Y3Maker] use_mcp_tool: server=${serverName}, tool=${toolName}, args=`, JSON.stringify(toolArguments));
        const response = await hub.callTool(serverName, toolName, toolArguments);
        // 对齐上游 extension 格式：把 MCP 返回的 content 数组映射为
        // OpenAI-style 的 [{type:'text'|'image_url', ...}] 再 JSON.stringify。
        // 前端 formatMcpToolResult 会 JSON.parse 回数组并做图片压缩 / text 截断，
        // 最终作为 list 类型 content 发给 LLM。
        // 不要返回普通拼接字符串：若其恰为合法 JSON 会被前端误 parse 成对象，
        // 触发 LLM API 400 "content should be a string or a list"。
        const parsedResult = (response?.content || []).map((item: any) => {
            if (item.type === 'text') {
                return { type: 'text', text: item.text };
            } else if (item.type === 'image') {
                const imageUrl = buildImageDataUrl(item.mimeType || '', item.data);
                if (!imageUrl) {
                    return {
                        type: 'text',
                        text: 'Error: MCP tool returned an unreadable or empty image.',
                    };
                }
                return {
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                    },
                };
            } else if (item.type === 'resource') {
                return {
                    type: 'text',
                    text: item.resource?.text || `[Resource: ${item.resource?.uri}]`,
                };
            }
            return { type: 'text', text: '' };
        });
        return {
            content: JSON.stringify(parsedResult),
            isError: response?.isError || false,
        };
    } catch (err: any) {
        return {
            content: `Error calling MCP tool "${toolName}" on "${serverName}": ${err.message}`,
            isError: true,
        };
    }
}

/**
 * access_mcp_resource 工具：访问 MCP 服务器上的资源
 * tool_params: { server_name: string, uri: string }
 */
async function toolAccessMcpResource(params: any): Promise<ExecuteCommandResult> {
    const hub = getMcpHub();
    if (!hub) {
        return { content: 'MCP Hub 未初始化', isError: true };
    }
    const serverName = params?.server_name;
    const uri = params?.uri;
    if (!serverName || !uri) {
        return { content: 'Error: server_name and uri are required.', isError: true };
    }
    try {
        const response = await hub.readResource(serverName, uri);
        const textParts: string[] = [];
        for (const item of (response?.contents || [])) {
            if (item.text) {
                textParts.push(item.text);
            } else if (item.blob) {
                textParts.push(`[Binary data from ${item.uri}]`);
            }
        }
        return {
            content: textParts.join('\n') || '(empty resource)',
            isError: false,
        };
    } catch (err: any) {
        return {
            content: `Error accessing MCP resource "${uri}" on "${serverName}": ${err.message}`,
            isError: true,
        };
    }
}

// ─────────────────────────────────────────────
//  Agents (get_agents/get_agent 已上游迁移至 LSP，删除)
// ─────────────────────────────────────────────
