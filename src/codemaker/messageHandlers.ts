/**
 * CodeMaker WebView 消息处理器
 * 移植自源码版 webviewProvider/index.ts 的 handleMessage 方法
 * 
 * 对照源码版共 96 个 case，Y3Helper 集成版裁剪了以下不适用的功能：
 * - 登录/认证相关（LOGIN, UPDATE_GATEWAY, OPEN_ON_BOARDING, OPEN_CHECK_UPDATE）
 * - 云端服务（REQUEST_CODE_SEARCH, SEARCH_AND_OPEN, PROXY_REQUEST, CODE_CHAT_COPY_CODE）
 * - Sentry 监控（REPORT_CONSOLE_ERROR, REPORT_CONSOLE_LOG, REPORT_CONSOLE_WARN）
 * - 代码审查（initExtensionData, INIT_REVIEW_DATA, OPEN_LOCAL_REVIEW_FILE）
 * - SVN/Git 仓库（GET_SVN_REPO_URL, GET_WORKSPACE_REPO_URL, GET_REPO_LOCAL_DIFF, GIT_CHECKOUT_BRANCH）
 * - 网络诊断（START_NETWORK_DIAGNOSTIC）
 * - 并行会话（OPEN_PARALLEL_SESSION, WEBVIEW_BROADCAST, OPEN_WEBVIEW_IN_NEW_WINDOW）
 * - OpenSpec 相关（GET_SPEC_INFO, OPEN_SPEC_SETUP, SPECKIT_SETUP, OPENSPEC_UPDATE）— 已加 stub，待完整实现
 */

import * as vscode from 'vscode';
import type { CodeMakerWebviewProvider } from './webviewProvider';

// ─── Handler 导入 ──────────────────────────────────────
import { handleInsertToEditor, handleInsertWithDiff, syncEditFileState } from './handlers/editorHandler';
import { handleOpenFile, handleCreateFile, handleExportFile, handleLoadDirectoryFiles } from './handlers/fileHandler';
import { handleInsertTerminal, handleStopAllTerminal, handleStopTerminalProgress, handleShowTerminalWindow } from './handlers/terminalHandler';
import {
    handlePreviewDiffCode, handlePreviewDiffEdit, handlePreviewDiffFile,
    handleAcceptEdit, handleBatchAcceptEdit,
    handleRevertEdit, handleBatchRevertEdit,
    handleReapplyEdit, handleReapplyReplace,
    handleBatchApplyChanges, handleApplySingleChanges,
} from './handlers/diffHandler';
import { handleGetWorkspaceList, handleGetWorkspaceProblems, handleOpenWorkspace, handleReloadWindow } from './handlers/workspaceHandler';
import { handleOpenDiagram, handleOpenHtml } from './handlers/diagramHandler';
import { handleOpenExtensionSetting, handleAddAuthorizationPath, handleEditCodebaseRules } from './handlers/settingsHandler';
import {
    handleGetMcpServers, handleAddMcpServers, handleUpdateMcpServers, handleRemoveMcpServers,
    handleOpenMcpSetting, handlePingOrRestartMcpServers, handleGetMcpPrompt,
} from './handlers/mcpHandler';
import {
    handleConsoleError, handleConsoleLog, handleConsoleWarn,
    handleUploadLog, handleOpenNewWindow, handleOpenSourceControl,
} from './handlers/logHandler';

// Rules & Skills 仍在 messageHandlers 中处理（已有独立 handler 类）
import { handleGetRules, handleCreateNewRule, handleUpdateRule, handleDeleteRule } from './handlers/rulesHandler/index';
import SkillsHandler from './skillsHandler';
import { AgentsHandler } from './handlers/agentsHandler/index';
import { cleanSessionFiles } from './utils/persistToolResult';

/**
 * 处理所有从 WebView 发来的消息
 * 返回 true 表示已处理，false 表示未处理（交给默认逻辑）
 */
export async function handleExtendedMessage(
    message: any,
    webview: vscode.Webview,
    provider: CodeMakerWebviewProvider,
): Promise<boolean> {
    switch (message.type) {
        // ═══════════════════════════════════════════
        //  编辑器操作
        // ═══════════════════════════════════════════

        case 'INSERT_TO_EDITOR': {
            await handleInsertToEditor(message.data, webview);
            return true;
        }

        case 'INSERT_WITH_DIFF': {
            await handleInsertWithDiff(message.data, webview);
            return true;
        }

        case 'GET_EDITOR_FILE_STATE': {
            syncEditFileState(provider);
            return true;
        }

        // ═══════════════════════════════════════════
        //  文件操作
        // ═══════════════════════════════════════════

        case 'OPEN_FILE': {
            await handleOpenFile(message.data);
            return true;
        }

        case 'CREATE_FILE_AND_INSERT_CODE': {
            await handleCreateFile(message.data);
            return true;
        }

        case 'EXPORT_FILE': {
            await handleExportFile(message.data);
            return true;
        }

        case 'DROP_FILES': {
            return true;
        }

        case 'LOAD_DIRECTORY_FILES': {
            await handleLoadDirectoryFiles(message.data, webview);
            return true;
        }

        // ═══════════════════════════════════════════
        //  终端操作
        // ═══════════════════════════════════════════

        case 'INSERT_TERMINAL': {
            handleInsertTerminal(message.data);
            return true;
        }

        case 'STOP_ALL_TERMINAL': {
            handleStopAllTerminal();
            return true;
        }

        case 'STOP_TERMINAL_PROGRESS': {
            handleStopTerminalProgress(message.data);
            return true;
        }

        case 'SHOW_TERMINAL_WINDOW': {
            handleShowTerminalWindow(message.data);
            return true;
        }

        // ═══════════════════════════════════════════
        //  Diff 预览与代码应用
        // ═══════════════════════════════════════════

        case 'PREVIEW_DIFF_CODE': {
            await handlePreviewDiffCode(message.data, provider);
            return true;
        }

        case 'PREVIEW_DIFF_EDIT': {
            await handlePreviewDiffEdit(message.data, provider);
            return true;
        }

        case 'PREVIEW_DIFF_FILE': {
            await handlePreviewDiffFile(message.data, provider);
            return true;
        }

        case 'ACCEPT_EDIT': {
            await handleAcceptEdit(message.data, provider);
            return true;
        }

        case 'BATCH_ACCEPT_EDIT': {
            await handleBatchAcceptEdit(message.data, provider);
            return true;
        }

        case 'REVERT_EDIT': {
            await handleRevertEdit(message.data, provider);
            return true;
        }

        case 'BATCH_REVERT_EDIT': {
            await handleBatchRevertEdit(message.data, provider);
            return true;
        }

        case 'REAPPLY_EDIT': {
            await handleReapplyEdit(message.data, provider);
            return true;
        }

        case 'REAPPLY_REPLACE': {
            await handleReapplyReplace(message.data, provider);
            return true;
        }

        case 'CANCEL_APPLY': {
            return true;
        }

        case 'BATCH_APPLY_CHANGES': {
            await handleBatchApplyChanges(message.data, provider);
            return true;
        }

        case 'APPLY_SINGLE_CHANGES': {
            await handleApplySingleChanges(message.data, provider);
            return true;
        }

        // ═══════════════════════════════════════════
        //  聊天控制
        // ═══════════════════════════════════════════

        case 'stopCodeChat': {
            return true;
        }

        case 'CHAT_REQUEST_START': {
            return true;
        }

        case 'CHAT_REPLY_DONE': {
            return true;
        }

        case 'UPDATE_PANEL_TITLE': {
            return true;
        }

        // ═══════════════════════════════════════════
        //  工作区信息
        // ═══════════════════════════════════════════

        case 'GET_WORKSPACE_LIST': {
            handleGetWorkspaceList(provider);
            return true;
        }

        case 'GET_WORKSPACE_PROBLEMS': {
            await handleGetWorkspaceProblems(webview);
            return true;
        }

        case 'OPEN_WORKSPACE': {
            await handleOpenWorkspace();
            return true;
        }

        case 'RELOAD_WINDOW': {
            await handleReloadWindow();
            return true;
        }

        // ═══════════════════════════════════════════
        //  可视化（Mermaid / PlantUML / Graphviz / HTML）
        // ═══════════════════════════════════════════

        case 'OPEN_MERMAID':
        case 'OPEN_PLANTUML':
        case 'OPEN_GRAPHVIZ': {
            await handleOpenDiagram(message.type, message.data);
            return true;
        }

        case 'OPEN_HTML': {
            await handleOpenHtml(message.data);
            return true;
        }

        // ═══════════════════════════════════════════
        //  设置/配置
        // ═══════════════════════════════════════════

        case 'OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH': {
            handleOpenExtensionSetting();
            return true;
        }

        case 'ADD_AUTHORIZATION_PATH': {
            handleAddAuthorizationPath();
            return true;
        }

        case 'UPDATE_CHAT_SUBMIT_KEY': {
            return true;
        }

        case 'EDIT_CODEBASE_RULES': {
            await handleEditCodebaseRules();
            return true;
        }

        case 'UPDATE_CODEBASE_IGNORE_PATH': {
            return true;
        }

        // ═══════════════════════════════════════════
        //  MCP 服务器管理
        // ═══════════════════════════════════════════

        case 'GET_MCP_SERVERS': {
            handleGetMcpServers();
            return true;
        }

        case 'ADD_MCP_SERVERS': {
            await handleAddMcpServers(message.data);
            return true;
        }

        case 'UPDATE_MCP_SERVERS': {
            await handleUpdateMcpServers(message.data);
            return true;
        }

        case 'REMOVE_MCP_SERVERS': {
            await handleRemoveMcpServers(message.data);
            return true;
        }

        case 'OPEM_MCP_SETTING': {
            await handleOpenMcpSetting();
            return true;
        }

        case 'PING_MCP_SERVERS':
        case 'RESTART_MCP_SERVERS': {
            await handlePingOrRestartMcpServers(message.data);
            return true;
        }

        case 'GET_MCP_PROMPT': {
            await handleGetMcpPrompt(message.data, provider);
            return true;
        }

        // ═══════════════════════════════════════════
        //  Rules & Skills
        // ═══════════════════════════════════════════

        case 'GET_RULES': {
            await handleGetRules(provider, message.panelId);
            return true;
        }

        case 'GET_SKILLS': {
            const handler = SkillsHandler.getInstance();
            await handler.loadSkills();
            handler.syncSkills();
            return true;
        }

        case 'GET_AGENTS': {
            const agentsHandler = AgentsHandler.getInstance();
            await agentsHandler.initialize();
            agentsHandler.syncAgents(provider);
            return true;
        }

        case 'CREATE_AGENT': {
            const { identifier, scope, markdown, overwrite } = message.data || {};
            console.log(
                `[AgentsHandler] CREATE_AGENT received - identifier: ${identifier}, scope: ${scope}, overwrite: ${overwrite}`
            );

            const agentsHandler = AgentsHandler.getInstance();
            const result = await agentsHandler.createAgent({
                identifier,
                scope,
                markdown,
                overwrite,
            });

            provider.sendMessage({
                type: 'CREATE_AGENT_RESULT',
                data: result,
            });

            if (result.success) {
                agentsHandler.syncAgents(provider);
                // 打开创建的 agent 文件
                if (result.path) {
                    try {
                        const fileUri = vscode.Uri.file(result.path);
                        const document = await vscode.workspace.openTextDocument(fileUri);
                        await vscode.window.showTextDocument(document);
                        console.log(`[AgentsHandler] Agent file opened - path: ${result.path}`);
                    } catch (err: any) {
                        console.log(`[AgentsHandler] Failed to open agent file - path: ${result.path}, error: ${err?.message ?? err}`);
                    }
                }
            } else {
                console.log(`[AgentsHandler] CREATE_AGENT failed - code: ${result.code}, message: ${result.message}`);
                vscode.window.showErrorMessage(result.message ?? 'Failed to create agent.');
            }
            return true;
        }

        case 'CREATE_NEW_RULE': {
            await handleCreateNewRule(message.data, provider);
            return true;
        }

        case 'UPDATE_RULE': {
            await handleUpdateRule(message.data, provider);
            return true;
        }

        case 'DELETE_RULE': {
            await handleDeleteRule(message.data, provider);
            return true;
        }

        case 'CREATE_SKILL_TEMPLATE': {
            const handler = SkillsHandler.getInstance();
            const result = await handler.createSkillTemplate(
                message.data?.templateContent || ''
            );
            provider.sendMessage({
                type: 'CREATE_SKILL_TEMPLATE_RESULT',
                data: result,
            });
            return true;
        }

        case 'INSTALL_BUILTIN_SKILL': {
            const handler = SkillsHandler.getInstance();
            const installResult = await handler.installBuiltinSkill(
                message.data?.skillName,
                message.data?.downloadUrl
            );
            provider.sendMessage({
                type: 'INSTALL_BUILTIN_SKILL_RESULT',
                data: installResult,
            });
            return true;
        }

        case 'UPDATE_SKILL_CONFIG': {
            const handler = SkillsHandler.getInstance();
            handler.handleUpdateSkillConfig(message.data);
            return true;
        }

        case 'REMOVE_SKILL': {
            const handler = SkillsHandler.getInstance();
            const removeResult = await handler.handleRemoveSkill(message.data);
            provider.sendMessage({
                type: 'REMOVE_SKILL_RESULT',
                data: removeResult,
            });
            return true;
        }

        case 'UPLOAD_SKILL': {
            const handler = SkillsHandler.getInstance();
            const uploadResult = await handler.handleUploadSkill(message.data);
            provider.sendMessage({
                type: 'UPLOAD_SKILL_RESULT',
                data: uploadResult,
            });
            return true;
        }

        // ═══════════════════════════════════════════
        //  源码控制
        // ═══════════════════════════════════════════

        case 'OPEN_SOURCE_CONTROL': {
            handleOpenSourceControl();
            return true;
        }

        // ═══════════════════════════════════════════
        //  日志
        // ═══════════════════════════════════════════

        case 'CONSOLE_ERROR': {
            handleConsoleError(message.data);
            return true;
        }

        case 'CONSOLE_LOG':
        case 'PRINT_LOG': {
            handleConsoleLog(message.data);
            return true;
        }

        case 'CONSOLE_WARN': {
            handleConsoleWarn(message.data);
            return true;
        }

        case 'REPORT_CONSOLE_ERROR':
        case 'REPORT_CONSOLE_LOG':
        case 'REPORT_CONSOLE_WARN': {
            return true;
        }

        // ═══════════════════════════════════════════
        //  其他
        // ═══════════════════════════════════════════

        case 'WEBVIEW_ACK': {
            return true;
        }

        case 'keyboardEvent': {
            return true;
        }

        case 'UPLOAD_LOG': {
            handleUploadLog(provider);
            return true;
        }

        case 'OPEN_NEW_WINDOW': {
            await handleOpenNewWindow(message.data);
            return true;
        }

        case 'CLEAN_SESSION_FILES': {
            const { sessionId } = message.data || {};
            if (sessionId && typeof sessionId === 'string') {
                void cleanSessionFiles(sessionId);
            }
            return true;
        }

        // Y3 不需要的功能：静默处理，参见 y3-product-scope.md
        case 'GET_SPEC_INFO':
        case 'OPEN_SPEC_SETUP':
        case 'SPECKIT_SETUP':
        case 'OPENSPEC_UPDATE':
        case 'OPEN_PARALLEL_SESSION':
        case 'WEBVIEW_BROADCAST':
        case 'OPEN_WEBVIEW_IN_NEW_WINDOW': {
            return true;
        }

        // EXECUTE_HOOK: Y3 无 language-server，直接返回 allow
        case 'EXECUTE_HOOK': {
            const { hookId } = message.data || {};
            provider.sendMessage({
                type: 'HOOK_RESULT',
                targetPanelId: message.panelId,
                data: {
                    hookId,
                    result: { decision: 'allow', reason: 'Y3Helper: Hook not supported, auto-allowed' },
                },
            });
            return true;
        }

        default:
            return false;
    }
}
