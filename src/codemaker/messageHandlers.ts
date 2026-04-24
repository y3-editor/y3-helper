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
import * as fs from 'fs';
import * as path from 'path';
import type { CodeMakerWebviewProvider } from './webviewProvider';
import { getMcpHub } from './mcpHandlers/index';
import SkillsHandler from './skillsHandler';

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
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                webview.postMessage({
                    type: 'actionInfo',
                    data: { tab: 'chat', content: '请先打开一个文件' },
                });
                return true;
            }
            const selection = new vscode.Selection(
                editor.selection.start.line, 0,
                editor.selection.end.line,
                editor.document.lineAt(editor.selection.end.line).text.length
            );
            await editor.edit((editBuilder) => {
                editBuilder.replace(
                    new vscode.Range(selection.start, selection.end),
                    message.data
                );
            });
            return true;
        }

        case 'INSERT_WITH_DIFF': {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                webview.postMessage({
                    type: 'actionInfo',
                    data: { tab: 'chat', content: '请先打开一个文件' },
                });
                return true;
            }
            const selection = new vscode.Selection(
                editor.selection.start.line, 0,
                editor.selection.end.line,
                editor.document.lineAt(editor.selection.end.line).text.length
            );
            const selectText = editor.document.getText(selection);
            if (selectText && selectText.trim().length > 0) {
                await editor.edit((editBuilder) => {
                    editBuilder.replace(
                        new vscode.Range(selection.start, selection.end),
                        generateConflictText(selectText, message.data)
                    );
                });
            } else {
                await editor.edit((editBuilder) => {
                    editBuilder.replace(
                        new vscode.Range(selection.start, selection.end),
                        message.data
                    );
                });
            }
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
            // 简化：不处理拖放文件
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
            const { content, execute } = message.data;
            let terminal = vscode.window.activeTerminal;
            if (!terminal) {
                terminal = vscode.window.createTerminal();
            }
            terminal.show(true);
            terminal.sendText(content, execute);
            return true;
        }

        case 'STOP_ALL_TERMINAL': {
            vscode.window.terminals.forEach(t => t.dispose());
            return true;
        }

        case 'STOP_TERMINAL_PROGRESS': {
            const { terminalId } = message.data;
            const terminal = vscode.window.terminals.find(
                t => t.name === terminalId
            );
            if (terminal) { terminal.dispose(); }
            return true;
        }

        case 'SHOW_TERMINAL_WINDOW': {
            const { terminalId } = message.data;
            const terminal = vscode.window.terminals.find(
                t => t.name === terminalId
            );
            if (terminal) {
                terminal.show(true);
            } else {
                vscode.window.showErrorMessage('当前终端窗口已无法打开！');
            }
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
            // 简化：暂不处理取消
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
            // 简化：Y3Helper 集成版由前端直接控制请求
            return true;
        }

        case 'CHAT_REQUEST_START': {
            // 简化：无需额外处理
            return true;
        }

        case 'CHAT_REPLY_DONE': {
            // 简化：无需额外处理
            return true;
        }

        case 'UPDATE_PANEL_TITLE': {
            // 简化：单面板模式，无需更新标题
            return true;
        }

        // ═══════════════════════════════════════════
        //  工作区信息
        // ═══════════════════════════════════════════

        case 'GET_WORKSPACE_LIST': {
            // 简化：返回当前工作区
            const folders = vscode.workspace.workspaceFolders || [];
            provider.sendMessage({
                type: 'SYNC_WORKSPACE_LIST',
                data: {
                    workspaces: folders.map(f => ({
                        name: f.name,
                        path: f.uri.fsPath,
                    })),
                },
            });
            return true;
        }

        case 'GET_WORKSPACE_PROBLEMS': {
            await handleGetWorkspaceProblems(webview);
            return true;
        }

        case 'OPEN_WORKSPACE': {
            const uris = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: '选择工作区文件夹',
            });
            if (uris && uris.length > 0) {
                await vscode.commands.executeCommand('vscode.openFolder', uris[0], false);
            }
            return true;
        }

        case 'RELOAD_WINDOW': {
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
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
            vscode.commands.executeCommand(
                'workbench.action.openSettings', 'Y3Maker'
            );
            return true;
        }

        case 'ADD_AUTHORIZATION_PATH': {
            // 简化：直接打开设置
            vscode.commands.executeCommand(
                'workbench.action.openSettings', 'Y3Maker'
            );
            return true;
        }

        case 'UPDATE_CHAT_SUBMIT_KEY': {
            // 简化：不持久化此设置
            return true;
        }

        case 'EDIT_CODEBASE_RULES': {
            await handleEditCodebaseRules();
            return true;
        }

        case 'UPDATE_CODEBASE_IGNORE_PATH': {
            // 简化：暂不处理
            return true;
        }

        // ═══════════════════════════════════════════
        //  MCP 服务器管理
        // ═══════════════════════════════════════════

        case 'GET_MCP_SERVERS': {
            const hub = getMcpHub();
            if (hub) {
                hub.sendLatestMcpServers();
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法获取 MCP servers');
            }
            return true;
        }

        case 'ADD_MCP_SERVERS': {
            const hub = getMcpHub();
            if (hub) {
                await hub.addMcpServer(message.data);
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法添加 MCP server');
            }
            return true;
        }

        case 'UPDATE_MCP_SERVERS': {
            const hub = getMcpHub();
            if (hub) {
                await hub.upDataMcpConfig(message.data);
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法更新 MCP server');
            }
            return true;
        }

        case 'REMOVE_MCP_SERVERS': {
            const hub = getMcpHub();
            if (hub) {
                const name = message.data?.name;
                if (name) { await hub.removeMcpServer(name); }
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法删除 MCP server');
            }
            return true;
        }

        case 'OPEM_MCP_SETTING': {
            const hub = getMcpHub();
            if (hub) {
                await hub.openMCPSettingFile();
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法打开 MCP 配置');
            }
            return true;
        }

        case 'PING_MCP_SERVERS':
        case 'RESTART_MCP_SERVERS': {
            const hub = getMcpHub();
            if (hub) {
                const serverName = message.data?.name || message.data?.serverName;
                if (serverName) {
                    await hub.restartConnection(serverName);
                } else {
                    await hub.restartAllConnections();
                }
            } else {
                console.warn('[Y3Maker] McpHub 未初始化，无法重启 MCP servers');
            }
            return true;
        }

        case 'GET_MCP_PROMPT': {
            const hub = getMcpHub();
            const { requestId, serverName, promptName, args } = message.data || {};
            if (hub) {
                try {
                    const result = await hub.getPrompt(serverName, promptName, args);
                    provider.sendMessage({
                        type: 'GET_MCP_PROMPT_RESULT',
                        data: { requestId, serverName, promptName, result },
                    });
                } catch (err: any) {
                    provider.sendMessage({
                        type: 'GET_MCP_PROMPT_ERROR',
                        data: { requestId, serverName, promptName, error: err.message },
                    });
                }
            } else {
                provider.sendMessage({
                    type: 'GET_MCP_PROMPT_ERROR',
                    data: { requestId, serverName, promptName, error: 'MCP Hub 未初始化' },
                });
            }
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
            await handleCreateSkillTemplate(message.data, provider);
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
            vscode.commands.executeCommand('workbench.view.scm');
            return true;
        }

        // ═══════════════════════════════════════════
        //  日志
        // ═══════════════════════════════════════════

        case 'CONSOLE_ERROR': {
            if (Array.isArray(message.data)) {
                console.error('[Y3Maker WebView]', ...message.data);
            }
            return true;
        }

        case 'CONSOLE_LOG':
        case 'PRINT_LOG': {
            if (Array.isArray(message.data)) {
                console.log('[Y3Maker WebView]', ...message.data);
            } else if (typeof message.data === 'string') {
                console.log('[Y3Maker WebView]', message.data);
            }
            return true;
        }

        case 'CONSOLE_WARN': {
            if (Array.isArray(message.data)) {
                console.warn('[Y3Maker WebView]', ...message.data);
            }
            return true;
        }

        case 'REPORT_CONSOLE_ERROR':
        case 'REPORT_CONSOLE_LOG':
        case 'REPORT_CONSOLE_WARN': {
            // 简化：不上报 Sentry
            return true;
        }

        // ═══════════════════════════════════════════
        //  其他
        // ═══════════════════════════════════════════

        case 'WEBVIEW_ACK': {
            // 前端已准备好的确认
            return true;
        }

        case 'keyboardEvent': {
            // 简化：不处理键盘事件转发
            return true;
        }

        case 'UPLOAD_LOG': {
            // 简化：不支持日志上传
            provider.sendMessage({
                type: 'UPLOAD_LOG_RESULT',
                data: { error: 'Not supported in Y3Helper integration' },
            });
            return true;
        }

        case 'OPEN_NEW_WINDOW': {
            const { path: localPath } = message.data || {};
            if (localPath && typeof localPath === 'string') {
                await vscode.commands.executeCommand(
                    'vscode.openFolder',
                    vscode.Uri.file(localPath),
                    true
                );
            }
            return true;
        }

        // Y3 不需要的功能：静默处理，参见 y3-product-scope.md
        case 'GET_SPEC_INFO':      // OpenSpec
        case 'OPEN_SPEC_SETUP':    // OpenSpec
        case 'SPECKIT_SETUP':      // OpenSpec
        case 'OPENSPEC_UPDATE':    // OpenSpec
        case 'OPEN_PARALLEL_SESSION':   // 多会话
        case 'WEBVIEW_BROADCAST':       // 多会话
        case 'OPEN_WEBVIEW_IN_NEW_WINDOW': { // 多会话
            return true;
        }

        default:
            return false;
    }
}


// ═══════════════════════════════════════════════════════
//  具体处理函数实现
// ═══════════════════════════════════════════════════════

// ─── 编辑器辅助 ───────────────────────────────────────

function generateConflictText(original: string, incoming: string): string {
    return `<<<<<<< Current\n${original}\n=======\n${incoming}\n>>>>>>> Incoming`;
}

function syncEditFileState(provider: CodeMakerWebviewProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        provider.sendMessage({
            type: 'EDITOR_FILE_STATE',
            data: { current_file: null },
        });
        return;
    }
    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = doc.getText(selection);
    const relativePath = vscode.workspace.asRelativePath(doc.uri, false);

    provider.sendMessage({
        type: 'EDITOR_FILE_STATE',
        data: {
            current_file: {
                content: doc.getText(),
                path: relativePath,
                file_name: path.basename(doc.fileName),
                language: doc.languageId,
            },
            selection: selectedText || '',
            cursor_position: {
                line: selection.active.line,
                character: selection.active.character,
            },
        },
    });
}

// ─── 文件操作 ─────────────────────────────────────────

async function handleOpenFile(data: any) {
    const { filePath, code, startLine, endLine } = data;
    let openFilePath = filePath;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!path.isAbsolute(openFilePath) && workspaceFolder) {
        openFilePath = path.join(workspaceFolder.uri.fsPath, filePath);
    }

    try {
        if (!fs.existsSync(openFilePath)) {
            vscode.window.showInformationMessage(`未找到该文件: ${openFilePath}`);
            return;
        }
        const targetDocument = await vscode.workspace.openTextDocument(openFilePath);
        const targetEditor = await vscode.window.showTextDocument(targetDocument);

        if (typeof startLine === 'number' && startLine >= 0) {
            const locateStart = startLine > 0 ? startLine - 1 : 0;
            const locateEnd = typeof endLine === 'number' && endLine >= startLine
                ? endLine - 1 : locateStart;
            const maxLine = targetDocument.lineCount - 1;
            const safeStart = Math.min(locateStart, maxLine);
            const safeEnd = Math.min(locateEnd, maxLine);

            targetEditor.selection = new vscode.Selection(
                new vscode.Position(safeStart, 0),
                new vscode.Position(safeEnd, targetDocument.lineAt(safeEnd).text.length)
            );
            targetEditor.revealRange(
                targetEditor.selection,
                vscode.TextEditorRevealType.InCenter
            );
        } else if (code) {
            const codeLines = code.split('\n');
            let locateStart = findLineNumber(targetDocument, codeLines[0]);
            if (locateStart < 0 && codeLines[1]) {
                locateStart = findLineNumber(targetDocument, codeLines[1]);
            }
            if (locateStart < 0) { locateStart = 0; }
            let locateEnd = findLineNumber(
                targetDocument, codeLines[codeLines.length - 1], locateStart
            );
            if (locateEnd < 0) { locateEnd = locateStart; }

            targetEditor.selection = new vscode.Selection(
                new vscode.Position(locateStart, 0),
                new vscode.Position(locateEnd,
                    targetDocument.lineAt(locateEnd).text.length)
            );
            targetEditor.revealRange(
                targetEditor.selection,
                vscode.TextEditorRevealType.InCenter
            );
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`未能打开文件: ${openFilePath}`);
        console.error('[Y3Maker] OPEN_FILE error:', err);
    }
}

function findLineNumber(
    document: vscode.TextDocument,
    searchText: string,
    startLine: number = 0
): number {
    if (!searchText || !searchText.trim()) { return -1; }
    const trimmed = searchText.trim();
    for (let i = startLine; i < document.lineCount; i++) {
        if (document.lineAt(i).text.includes(trimmed)) {
            return i;
        }
    }
    return -1;
}

async function handleCreateFile(data: any) {
    const { language, content, filePath } = data;
    try {
        if (filePath) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('No workspace folder is opened');
                return;
            }
            const fileUri = vscode.Uri.file(
                path.isAbsolute(filePath)
                    ? filePath
                    : path.join(workspaceRoot.fsPath, filePath)
            );
            try {
                await vscode.workspace.fs.stat(fileUri);
                vscode.window.showInformationMessage(
                    `File already exists: ${fileUri.fsPath}`
                );
            } catch {
                await vscode.workspace.fs.createDirectory(
                    vscode.Uri.file(path.dirname(fileUri.fsPath))
                );
                await vscode.workspace.fs.writeFile(
                    fileUri,
                    new Uint8Array(Buffer.from(content, 'utf8'))
                );
                vscode.window.showInformationMessage(
                    `File created: ${fileUri.fsPath}`
                );
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document);
            }
        } else {
            const document = await vscode.workspace.openTextDocument({
                language, content,
            });
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        console.error('[Y3Maker] CREATE_FILE_AND_INSERT_CODE error:', error);
    }
}

async function handleExportFile(data: any) {
    try {
        const { filename, content } = data;
        const saveDialogOptions: vscode.SaveDialogOptions = {
            saveLabel: `Save ${filename?.includes('.md') ? 'Markdown' : 'File'}`,
            defaultUri: vscode.Uri.file(filename || 'export'),
        };
        const fileUri = await vscode.window.showSaveDialog(saveDialogOptions);
        if (fileUri) {
            let fileData: Uint8Array;
            if (filename?.toLowerCase().endsWith('.png')) {
                const binaryString = atob(content);
                fileData = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    fileData[i] = binaryString.charCodeAt(i);
                }
            } else {
                fileData = new Uint8Array(Buffer.from(content));
            }
            await vscode.workspace.fs.writeFile(fileUri, fileData);
            vscode.window.showInformationMessage(
                `文件已成功保存到: ${fileUri.fsPath}`
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`下载失败: ${error.message}`);
    }
}

async function handleLoadDirectoryFiles(data: any, webview: vscode.Webview) {
    const { folderPath, recursive = false } = data || {};
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            webview.postMessage({
                type: 'DIRECTORY_FILES',
                data: { folderPath, error: '未找到工作区' },
            });
            return;
        }

        const absPath = path.isAbsolute(folderPath)
            ? folderPath
            : path.join(workspaceFolder.uri.fsPath, folderPath);

        const files: string[] = [];
        await collectFiles(absPath, recursive, files, 0, 3, 500);

        webview.postMessage({
            type: 'DIRECTORY_FILES',
            data: {
                folderPath,
                files: files,
                loadedDirectories: [folderPath],
                isTimeout: false,
            },
        });
    } catch (error: any) {
        webview.postMessage({
            type: 'DIRECTORY_FILES',
            data: { folderPath, error: error.message || '获取目录文件失败' },
        });
    }
}

async function collectFiles(
    dirPath: string,
    recursive: boolean,
    results: string[],
    depth: number,
    maxDepth: number,
    maxFiles: number
): Promise<void> {
    if (results.length >= maxFiles || depth > maxDepth) { return; }
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= maxFiles) { return; }
            if (['.git', 'node_modules', '__pycache__'].includes(entry.name)) {
                continue;
            }
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                results.push(fullPath + path.sep);
                if (recursive) {
                    await collectFiles(fullPath, true, results, depth + 1, maxDepth, maxFiles);
                }
            } else {
                results.push(fullPath);
            }
        }
    } catch {
        // 忽略权限错误
    }
}

// ─── Diff 预览与代码应用 ──────────────────────────────

function resolveFilePath(filePath: string): string {
    if (path.isAbsolute(filePath)) { return filePath; }
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return workspace ? path.join(workspace, filePath) : filePath;
}

async function handlePreviewDiffCode(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, searchCodes = [], replacedCodes = [] } = data;
    const absPath = resolveFilePath(filePath);

    try {
        let originalContent = '';
        if (fs.existsSync(absPath)) {
            originalContent = await fs.promises.readFile(absPath, 'utf-8');
        }

        // 执行搜索替换生成新内容
        let newContent = originalContent;
        for (let i = 0; i < searchCodes.length; i++) {
            const search = searchCodes[i] || '';
            const replace = replacedCodes[i] || '';
            if (search) {
                newContent = newContent.replace(search, replace);
            } else if (replace) {
                newContent = newContent ? newContent + '\n' + replace : replace;
            }
        }

        // 创建临时文档展示 diff
        const originalDoc = await vscode.workspace.openTextDocument({
            content: originalContent,
            language: getLanguageId(filePath),
        });
        const newDoc = await vscode.workspace.openTextDocument({
            content: newContent,
            language: getLanguageId(filePath),
        });

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            newDoc.uri,
            `Diff: ${path.basename(filePath)}`
        );
    } catch (err: any) {
        console.error('[Y3Maker] PREVIEW_DIFF_CODE error:', err);
    }
}

async function handlePreviewDiffEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, finalResult, isCreateFile, beforeEdit } = data;
    const absPath = resolveFilePath(filePath);

    try {
        let originalContent = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            originalContent = await fs.promises.readFile(absPath, 'utf-8');
        }

        const originalDoc = await vscode.workspace.openTextDocument({
            content: originalContent,
            language: getLanguageId(filePath),
        });
        const newDoc = await vscode.workspace.openTextDocument({
            content: finalResult || '',
            language: getLanguageId(filePath),
        });

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalDoc.uri,
            newDoc.uri,
            `${isCreateFile ? 'New' : 'Edit'}: ${path.basename(filePath)}`
        );

        provider.sendMessage({
            type: 'PREVIEW_DIFF_RESULT',
            data: { success: true, filePath },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'PREVIEW_DIFF_RESULT',
            data: { success: false, message: err.message, filePath },
        });
    }
}

async function handlePreviewDiffFile(data: any, provider: CodeMakerWebviewProvider) {
    // 与 handlePreviewDiffEdit 逻辑相同
    await handlePreviewDiffEdit(data, provider);
}

async function handleAcceptEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { item, force } = data;
    const { toolCallId, filePath, beforeEdit, finalResult, isCreateFile } = item;

    try {
        const absPath = resolveFilePath(filePath);
        let fileExist = fs.existsSync(absPath);

        if (isCreateFile && !fileExist) {
            // 真正的新建文件：目标不存在，先创建空文件
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
            await fs.promises.writeFile(absPath, '', 'utf-8');
        }

        // 打开文档（通过 VSCode Document API）
        const currentDocument = await vscode.workspace.openTextDocument(absPath);
        
        // 检查文件是否有未保存的修改
        if (currentDocument.isDirty) {
            console.log(`[Y3Maker] ACCEPT_EDIT: 文件有未保存改动, path=${absPath}`);
            provider.sendMessage({
                type: 'ACCEPT_EDIT_RESULT',
                data: {
                    result: {
                        success: false,
                        message: '文件有未保存改动，请先保存文件后再应用',
                        item,
                    },
                },
            });
            return;
        }

        const currentContent = currentDocument.getText();
        const afterEdit = finalResult || '';

        // 如果内容已经一致，说明已经应用过了，直接返回成功（对齐源码版）
        if (currentContent.replace(/\r\n/g, '\n') === afterEdit.replace(/\r\n/g, '\n') && fileExist) {
            console.log(`[Y3Maker] ACCEPT_EDIT: 内容已一致，跳过写入`);
            provider.sendMessage({
                type: 'ACCEPT_EDIT_RESULT',
                data: { result: { success: true, item } },
            });
            return;
        }

        // 冲突检查：忽略空白字符后比较（对齐源码版 replace(/\s/g, '')）
        if (!force && fileExist && beforeEdit) {
            if (currentContent.replace(/\s/g, '') !== beforeEdit.replace(/\s/g, '')) {
                console.log(`[Y3Maker] ACCEPT_EDIT: 文件内容有变动, beforeEdit.length=${beforeEdit.length}, currentContent.length=${currentContent.length}`);
                provider.sendMessage({
                    type: 'ACCEPT_EDIT_RESULT',
                    data: {
                        result: {
                            success: false,
                            message: '文件内容有变动，请尝试 reapply',
                            item,
                        },
                    },
                });
                return;
            }
        }

        // 通过 VSCode Document API 写入（对齐源码版 updateDocumentContent）
        await vscode.window.showTextDocument(currentDocument, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active,
            preserveFocus: true,
        });
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
                currentDocument.uri,
                new vscode.Range(0, 0, currentDocument.lineCount, 0),
                afterEdit,
            );
            await vscode.workspace.applyEdit(edit);
            await currentDocument.save();
        }

        provider.sendMessage({
            type: 'ACCEPT_EDIT_RESULT',
            data: { result: { success: true, message: '', item } },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'ACCEPT_EDIT_RESULT',
            data: { result: { success: false, message: err.message, item } },
        });
    }
}

async function handleBatchAcceptEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { items = [] } = data;
    const results: any[] = [];

    for (const item of items) {
        try {
            const absPath = resolveFilePath(item.filePath);
            if (item.isCreateFile) {
                await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
            }
            await fs.promises.writeFile(absPath, item.finalResult || '', 'utf-8');
            results.push({ success: true, message: '', item });
        } catch (err: any) {
            results.push({ success: false, message: err.message, item });
        }
    }

    provider.sendMessage({
        type: 'BATCH_ACCEPT_EDIT_RESULT',
        data: { results },
    });
}

async function handleRevertEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { item } = data;
    const { filePath, originalContent, finalResult, isCreateFile } = item;

    try {
        const absPath = resolveFilePath(filePath);
        if (isCreateFile) {
            // 撤销新建 → 删除文件
            if (fs.existsSync(absPath)) {
                await fs.promises.unlink(absPath);
            }
        } else {
            // 恢复原始内容
            await fs.promises.writeFile(
                absPath, originalContent || '', 'utf-8'
            );
        }

        provider.sendMessage({
            type: 'REVERT_EDIT_RESULT',
            data: { result: { success: true, message: '', item } },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REVERT_EDIT_RESULT',
            data: { result: { success: false, message: err.message, item } },
        });
    }
}

async function handleBatchRevertEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { items = [] } = data;
    const results: any[] = [];

    for (const item of items) {
        try {
            const absPath = resolveFilePath(item.filePath);
            if (item.isCreateFile) {
                if (fs.existsSync(absPath)) {
                    await fs.promises.unlink(absPath);
                }
            } else {
                await fs.promises.writeFile(
                    absPath, item.originalContent || '', 'utf-8'
                );
            }
            results.push({ success: true, message: '', item });
        } catch (err: any) {
            results.push({ success: false, message: err.message, item });
        }
    }

    provider.sendMessage({
        type: 'BATCH_REVERT_EDIT_RESULT',
        data: { results },
    });
}

async function handleReapplyEdit(data: any, provider: CodeMakerWebviewProvider) {
    const { target_file, code_edit, toolCallId, isCreateFile } = data;
    try {
        const absPath = resolveFilePath(target_file);
        let beforeEdit = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            beforeEdit = await fs.promises.readFile(absPath, 'utf-8');
        }

        // 对于 edit_file / reapply，code_edit 就是最终内容
        const finalResult = code_edit || '';
        if (isCreateFile) {
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        }
        await fs.promises.writeFile(absPath, finalResult, 'utf-8');

        provider.sendMessage({
            type: 'REAPPLY_EDIT_RESULT',
            data: {
                toolCallId,
                filePath: absPath,
                finalResult,
                beforeEdit,
                isError: false,
                isCreateFile,
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REAPPLY_EDIT_RESULT',
            data: {
                toolCallId,
                filePath: target_file,
                finalResult: '',
                beforeEdit: '',
                isError: true,
                isCreateFile,
            },
        });
    }
}

async function handleReapplyReplace(data: any, provider: CodeMakerWebviewProvider) {
    const { target_file, diff, toolCallId, isCreateFile } = data;
    try {
        const absPath = resolveFilePath(target_file);
        let beforeEdit = '';
        if (!isCreateFile && fs.existsSync(absPath)) {
            beforeEdit = await fs.promises.readFile(absPath, 'utf-8');
        }

        // 应用 SEARCH/REPLACE diff
        let finalResult = beforeEdit;
        if (diff) {
            finalResult = applySearchReplaceDiff(beforeEdit, diff);
        }

        if (isCreateFile) {
            await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
        }
        await fs.promises.writeFile(absPath, finalResult, 'utf-8');

        provider.sendMessage({
            type: 'REAPPLY_REPLACE_RESULT',
            data: {
                toolCallId,
                filePath: absPath,
                finalResult,
                beforeEdit,
                isError: false,
                isCreateFile,
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'REAPPLY_REPLACE_RESULT',
            data: {
                toolCallId,
                filePath: target_file,
                finalResult: '',
                beforeEdit: '',
                isError: true,
                isCreateFile,
            },
        });
    }
}

/**
 * 简化版 SEARCH/REPLACE diff 应用
 * diff 格式：
 * ------- SEARCH
 * <search content>
 * =======
 * <replace content>
 * +++++++ REPLACE
 */
function applySearchReplaceDiff(content: string, diff: string): string {
    let result = content;
    const blocks = diff.split('------- SEARCH');

    for (const block of blocks) {
        if (!block.trim()) { continue; }
        const parts = block.split('=======');
        if (parts.length < 2) { continue; }

        const searchPart = parts[0].trim();
        let replacePart = parts.slice(1).join('=======');
        // 移除尾部 +++++++ REPLACE
        replacePart = replacePart.replace(/\+{7}\s*REPLACE\s*$/, '').trim();

        if (searchPart) {
            result = result.replace(searchPart, replacePart);
        }
    }
    return result;
}

async function handleBatchApplyChanges(data: any, provider: CodeMakerWebviewProvider) {
    const { type: actionType, fileChanges = {} } = data;
    const isRevert = actionType === 'revert';
    const appliedCodeBlockIds: string[] = [];
    let hasError = false;

    try {
        for (const [filePath, codeBlocks] of Object.entries(fileChanges as Record<string, any>)) {
            const absPath = resolveFilePath(filePath);
            let content = '';

            if (fs.existsSync(absPath)) {
                content = await fs.promises.readFile(absPath, 'utf-8');
            }

            for (const [codeBlockId, blockData] of Object.entries(codeBlocks as Record<string, any>)) {
                try {
                    const searchCode = isRevert
                        ? (blockData.replacedCode || '')
                        : (blockData.searchCode || '');
                    const replaceCode = isRevert
                        ? (blockData.searchCode || '')
                        : (blockData.replacedCode || '');

                    if (searchCode) {
                        content = content.replace(searchCode, replaceCode);
                    } else if (replaceCode) {
                        content += '\n' + replaceCode;
                    }

                    appliedCodeBlockIds.push(codeBlockId);
                } catch {
                    hasError = true;
                }
            }

            await fs.promises.writeFile(absPath, content, 'utf-8');
        }

        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_SUCCESS',
            data: {
                appliedCodeBlockIds,
                status: hasError ? 'part' : 'all',
            },
        });
    } catch (err: any) {
        provider.sendMessage({
            type: 'BATCH_APPLY_CHANGES_FAILED',
            data: { message: err.message },
        });
    }
}

async function handleApplySingleChanges(data: any, provider: CodeMakerWebviewProvider) {
    // 复用批量逻辑
    await handleBatchApplyChanges(data, provider);
}

// ─── 工作区问题 ───────────────────────────────────────

async function handleGetWorkspaceProblems(webview: vscode.Webview) {
    const diagnostics = vscode.languages.getDiagnostics();
    const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const lines: string[] = [];

    for (const [uri, diags] of diagnostics) {
        // 只处理工作区内的文件
        if (workspace && !uri.fsPath.startsWith(workspace)) {
            continue;
        }
        const relativePath = vscode.workspace.asRelativePath(uri, false);

        for (const diag of diags) {
            if (diag.severity > vscode.DiagnosticSeverity.Warning) {
                continue; // 只报告 Error 和 Warning
            }
            const severity = diag.severity === vscode.DiagnosticSeverity.Error
                ? 'Error' : 'Warning';
            const source = diag.source ? `[${diag.source}]` : '';
            lines.push(
                `${relativePath} - ${source} ${severity} Line ${diag.range.start.line + 1}: ${diag.message}`
            );
        }
    }

    webview.postMessage({
        type: 'ON_GET_WORKSPACE_PROBLEMS',
        data: lines.length > 0 ? lines.join('\n') : '',
    });
}

// ─── 可视化 ───────────────────────────────────────────

async function handleOpenDiagram(type: string, data: string) {
    const typeMap: Record<string, string> = {
        'OPEN_MERMAID': 'Mermaid',
        'OPEN_PLANTUML': 'PlantUML',
        'OPEN_GRAPHVIZ': 'GraphViz',
    };
    // 创建一个临时文档展示图表代码（title 可扩展用于 WebviewPanel 标题）
    const doc = await vscode.workspace.openTextDocument({
        content: data,
        language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
}

async function handleOpenHtml(data: string) {
    const doc = await vscode.workspace.openTextDocument({
        content: data,
        language: 'html',
    });
    await vscode.window.showTextDocument(doc);
}

// ─── 配置 ─────────────────────────────────────────────

async function handleEditCodebaseRules() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('未找到工作区文件夹');
            return;
        }
        const filePath = path.join(
            workspaceFolder.uri.fsPath, '.y3maker.codebase.md'
        );
        const fileUri = vscode.Uri.file(filePath);

        try {
            await vscode.workspace.fs.stat(fileUri);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        } catch {
            await vscode.workspace.fs.writeFile(
                fileUri, new Uint8Array(Buffer.from('', 'utf8'))
            );
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage(
                '已创建 .y3maker.codebase.md 文件'
            );
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`操作失败：${error.message}`);
    }
}

// ─── Rules ────────────────────────────────────────────

export async function handleGetRules(provider: CodeMakerWebviewProvider, panelId?: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        provider.sendMessage({ type: 'SYNC_RULES', data: [] });
        return;
    }

    const rules: any[] = [];

    // 1. 加载 .codemaker/rules/*.mdc 文件（源码版只支持 .mdc 格式）
    const rulesDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'rules');
    try {
        if (fs.existsSync(rulesDir)) {
            const files = await fs.promises.readdir(rulesDir);
            for (const file of files) {
                if (!file.endsWith('.mdc')) { continue; }
                const filePath = path.join(rulesDir, file);
                try {
                    const content = await fs.promises.readFile(filePath, 'utf-8');
                    const parsed = parseMdcFile(content);
                    rules.push({
                        filePath: filePath,
                        name: path.basename(file, '.mdc'),
                        content: parsed.content,
                        isEnabled: true,
                        source: 'codemaker',
                        metaData: {
                            description: parsed.description,
                            alwaysApply: parsed.alwaysApply,
                            globs: parsed.globs,
                        },
                    });
                } catch {
                    // 忽略读取错误
                }
            }
        }
    } catch {
        // 忽略目录错误
    }

    // 2. 加载 .y3maker.codebase.md（特殊硬编码文件）
    const codebaseMdPath = path.join(workspaceFolder.uri.fsPath, '.y3maker.codebase.md');
    try {
        if (fs.existsSync(codebaseMdPath)) {
            const content = await fs.promises.readFile(codebaseMdPath, 'utf-8');
            if (content.trim()) {
                rules.push({
                    filePath: codebaseMdPath,
                    name: '.y3maker.codebase',
                    content: content,
                    isEnabled: true,
                    source: 'codemaker',
                    metaData: {
                        description: 'Codebase rule',
                        alwaysApply: true,
                        globs: [],
                    },
                });
            }
        }
    } catch {
        // 忽略
    }

    provider.sendMessage({ type: 'SYNC_RULES', data: rules });
}

/**
 * 解析 .mdc 文件格式
 * .mdc 文件格式：
 * ---
 * description: 描述
 * alwaysApply: true/false
 * ---
 * 内容
 */
function parseMdcFile(raw: string): { description: string; alwaysApply: boolean; globs: string[]; content: string } {
    // 统一换行符：将 CRLF 转为 LF，避免 \r 残留导致 YAML 解析异常
    raw = raw.replace(/\r\n/g, '\n');
    const result: { description: string; alwaysApply: boolean; globs: string[]; content: string } = {
        description: '', alwaysApply: true, globs: [], content: raw,
    };
    const frontMatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (frontMatterMatch) {
        const meta = frontMatterMatch[1];
        result.content = frontMatterMatch[2];
        const descMatch = meta.match(/description:\s*(.+)/);
        if (descMatch) { result.description = descMatch[1].trim(); }
        const alwaysMatch = meta.match(/alwaysApply:\s*(true|false)/);
        if (alwaysMatch) { result.alwaysApply = alwaysMatch[1] === 'true'; }
        // 解析 globs，格式: globs: *.ts, *.js 或 globs: ["*.ts", "*.js"]
        const globsMatch = meta.match(/globs:\s*(.+)/);
        if (globsMatch) {
            const globsStr = globsMatch[1].trim();
            if (globsStr.startsWith('[')) {
                try {
                    result.globs = JSON.parse(globsStr);
                } catch {
                    result.globs = [];
                }
            } else {
                result.globs = globsStr.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
    }
    return result;
}

/**
 * 生成 .mdc 文件内容
 */
function stringifyMdcFile(description: string, alwaysApply: boolean, content: string): string {
    return `---\ndescription: ${description}\nalwaysApply: ${alwaysApply}\n---\n${content}`;
}

async function handleCreateNewRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filename } = data;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }

    const rulesDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'rules');
    await fs.promises.mkdir(rulesDir, { recursive: true });

    // 强制 .mdc 扩展名
    const normalizedFileName = filename.endsWith('.mdc') ? filename : `${filename}.mdc`;
    const filePath = path.join(rulesDir, normalizedFileName);

    if (!fs.existsSync(filePath)) {
        const defaultContent = stringifyMdcFile('请填写规则描述', true, '');
        await fs.promises.writeFile(filePath, defaultContent, 'utf-8');
    }

    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);

    // 创建后自动刷新 Rules 列表
    await handleGetRules(provider);
}

async function handleUpdateRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath, content } = data;
    if (filePath && content !== undefined) {
        await fs.promises.writeFile(filePath, content, 'utf-8');
        // 更新后自动刷新 Rules 列表
        await handleGetRules(provider);
    }
}

async function handleDeleteRule(data: any, provider: CodeMakerWebviewProvider) {
    const { filePath } = data;
    if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        // 删除后自动刷新 Rules 列表
        await handleGetRules(provider);
    }
}

// ─── Skills 相关 ─────────────────────────────────────────

/**
 * 解析 skill .md 文件格式
 * 格式与 .mdc 类似：
 * ---
 * name: skill-name
 * description: 描述
 * ---
 * 内容
 */
function parseSkillFile(raw: string, fileName: string): { name: string; description: string; content: string } {
    const result = {
        name: path.basename(fileName, '.md'),
        description: '',
        content: raw,
    };
    const frontMatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (frontMatterMatch) {
        const meta = frontMatterMatch[1];
        result.content = frontMatterMatch[2];
        const nameMatch = meta.match(/name:\s*(.+)/);
        if (nameMatch) { result.name = nameMatch[1].trim(); }
        const descMatch = meta.match(/description:\s*(.+)/);
        if (descMatch) { result.description = descMatch[1].trim(); }
    }
    return result;
}

interface SkillInfo {
    name: string;
    description: string;
    content: string;
    source: string;
    path: string;
}

/**
 * 从指定目录加载所有 skill 文件
 * 支持两种结构：
 *   1. skills/*.md         — 直接放在根目录的 skill 文件
 *   2. skills/<name>/SKILL.md — 子目录形式的 skill（源码版格式）
 */
export async function loadSkillsFromDir(dir: string, source: string): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];
    try {
        if (!fs.existsSync(dir)) { return skills; }
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            try {
                if (entry.isFile() && entry.name.endsWith('.md')) {
                    // 情况 1：根目录下的 .md 文件
                    const filePath = path.join(dir, entry.name);
                    const raw = await fs.promises.readFile(filePath, 'utf-8');
                    const parsed = parseSkillFile(raw, entry.name);
                    skills.push({
                        name: parsed.name,
                        description: parsed.description,
                        content: parsed.content,
                        source: source,
                        path: filePath,
                    });
                } else if (entry.isDirectory()) {
                    // 情况 2：子目录下的 SKILL.md
                    const skillMdPath = path.join(dir, entry.name, 'SKILL.md');
                    if (fs.existsSync(skillMdPath)) {
                        const raw = await fs.promises.readFile(skillMdPath, 'utf-8');
                        const parsed = parseSkillFile(raw, entry.name + '.md');
                        skills.push({
                            name: parsed.name,
                            description: parsed.description,
                            content: parsed.content,
                            source: source,
                            path: skillMdPath,
                        });
                    }
                }
            } catch {
                // 解析失败的文件静默跳过
            }
        }
    } catch {
        // 目录读取错误静默跳过
    }
    return skills;
}

/**
 * 获取项目 skills 目录下的所有 skills
 */
export async function handleGetSkills(provider: CodeMakerWebviewProvider) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        provider.sendMessage({ type: 'SYNC_SKILLS', data: [] });
        return;
    }

    const skillsDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'skills');
    const skills = await loadSkillsFromDir(skillsDir, 'codemaker-project');

    provider.sendMessage({ type: 'SYNC_SKILLS', data: skills });
}

/**
 * 创建 skill 模板文件
 */
async function handleCreateSkillTemplate(data: any, provider: CodeMakerWebviewProvider) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        provider.sendMessage({
            type: 'CREATE_SKILL_TEMPLATE_RESULT',
            data: { success: false, message: 'No workspace folder found' },
        });
        return;
    }

    const skillsDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'skills');
    await fs.promises.mkdir(skillsDir, { recursive: true });

    const templateContent = data?.templateContent || '---\nname: template-skill\ndescription: Replace with description of the skill and when Codemaker should use it.\n---\n\n# Insert instructions below\n';

    // 文件名去重：new-skill.md, new-skill-1.md, new-skill-2.md...
    let fileName = 'new-skill.md';
    let filePath = path.join(skillsDir, fileName);
    let counter = 1;
    while (fs.existsSync(filePath)) {
        fileName = `new-skill-${counter}.md`;
        filePath = path.join(skillsDir, fileName);
        counter++;
    }

    try {
        await fs.promises.writeFile(filePath, templateContent, 'utf-8');

        // 返回结果（前端收到 path 后会自己发 OPEN_FILE 打开文件）
        provider.sendMessage({
            type: 'CREATE_SKILL_TEMPLATE_RESULT',
            data: { success: true, path: filePath },
        });

        // 创建后自动刷新 skills 列表
        await handleGetSkills(provider);
    } catch (err: any) {
        provider.sendMessage({
            type: 'CREATE_SKILL_TEMPLATE_RESULT',
            data: { success: false, message: err?.message || 'Failed to create skill template' },
        });
    }
}

/**
 * 安装内置 skill（从 URL 下载）
 */
async function handleInstallBuiltinSkill(data: any, provider: CodeMakerWebviewProvider) {
    const { skillName, downloadUrl } = data || {};

    if (!skillName || !downloadUrl) {
        provider.sendMessage({
            type: 'INSTALL_BUILTIN_SKILL_RESULT',
            data: { success: false, error: 'Missing skillName or downloadUrl' },
        });
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        provider.sendMessage({
            type: 'INSTALL_BUILTIN_SKILL_RESULT',
            data: { success: false, error: 'No workspace folder found' },
        });
        return;
    }

    const skillsDir = path.join(workspaceFolder.uri.fsPath, '.y3maker', 'skills');
    await fs.promises.mkdir(skillsDir, { recursive: true });

    const filePath = path.join(skillsDir, `${skillName}.md`);

    try {
        // 使用 Node.js 内置 http/https 模块下载
        const content = await new Promise<string>((resolve, reject) => {
            const mod = downloadUrl.startsWith('https') ? require('https') : require('http');
            const req = mod.get(downloadUrl, { timeout: 30000 }, (res: any) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    res.resume();
                    return;
                }
                let body = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk: string) => { body += chunk; });
                res.on('end', () => { resolve(body); });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        });

        await fs.promises.writeFile(filePath, content, 'utf-8');

        provider.sendMessage({
            type: 'INSTALL_BUILTIN_SKILL_RESULT',
            data: {
                success: true,
                skillName: skillName,
                installPath: `.y3maker/skills/${skillName}.md`,
            },
        });

        // 安装后自动刷新 skills 列表
        await handleGetSkills(provider);
    } catch (err: any) {
        provider.sendMessage({
            type: 'INSTALL_BUILTIN_SKILL_RESULT',
            data: { success: false, error: err?.message || 'Download failed' },
        });
    }
}

// ─── 辅助函数 ─────────────────────────────────────────


function getLanguageId(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.h': 'c',
        '.hpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.lua': 'lua',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.sql': 'sql',
        '.sh': 'shellscript',
        '.bat': 'bat',
        '.ps1': 'powershell',
    };
    return langMap[ext] || 'plaintext';
}
