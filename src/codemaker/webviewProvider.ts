import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { getCodeMakerConfig } from './configProvider';
import { handleExtendedMessage } from './messageHandlers';
import { handleGetRules } from './handlers/rulesHandler/index';
import { getWorkspaceTracker } from './handlers/workspaceTracker';
import { getOpenFilesHandler } from './handlers/openFilesHandler';
import { isDocsetFile, isImageFile, maxDocsetFileSize } from './utils/file';
import { readFileSync, statSync } from 'fs';
import { initMcpHub, getMcpHub, disposeMcpHub } from './mcpHandlers/index';
import SkillsHandler from './skillsHandler';
import executeFunction from './utils/executeFunction';
import { isRtkBinaryAvailable } from './utils/rtk/rtkBinaryManager';
import { maybePersistToolResultToDisk } from './utils/persistToolResult';

/**
 * CodeMaker WebView 视图提供者
 * 在右侧 Secondary Side Bar 中展示 CodeMaker 完整 UI
 * 
 * 消息流与源码版完全一致：
 *   iframe(React) ←postMessage→ outer HTML ←postMessage→ VSCode Extension
 *   outer HTML 做全量双向转发，不拦截任何消息类型
 */
export class CodeMakerWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codemaker.webview';

    private _view?: vscode.WebviewView;
    private _apiServerPort: number = 3001;

    public get apiServerPort(): number {
        return this._apiServerPort;
    }

    /** 源码版的 leftOverMessages 机制：在 webview 首次发消息前缓存待发送的消息 */
    private _hasInit: boolean = false;
    private _leftOverMessages: any[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {
        // 初始化 McpHub 单例，回调用于向前端推送 MCP 状态变更
        initMcpHub((message) => {
            this.sendMessage(message);
        });
    }

    /**
     * 设置 API Server 端口号（启动后回调）
     */
    public setApiServerPort(port: number) {
        this._apiServerPort = port;
        // 如果 WebView 已加载，刷新 iframe 并重新初始化
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview();
            // 重置 init 状态，因为 HTML 重载了
            this._hasInit = false;
        }
    }

    /**
     * 获取 WebviewView 实例
     */
    public get view(): vscode.WebviewView | undefined {
        return this._view;
    }

    // ─────────────────────────────────────────────
    //  resolveWebviewView —— 与源码版一致
    // ─────────────────────────────────────────────

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview();

        // ── 注册消息监听（与源码版一致：在 resolveWebviewView 内直接注册）──
        webviewView.webview.onDidReceiveMessage(async (message) => {
            // 收到消息可以认为 webview 已完成渲染，清空 leftOverMessages
            if (!this._hasInit) {
                this._hasInit = true;
                if (this._leftOverMessages.length > 0) {
                    setTimeout(() => {
                        for (const msg of this._leftOverMessages) {
                            this._sendToWebview(msg);
                        }
                        this._leftOverMessages = [];
                    }, 1000);
                }
            }
            this._handleMessage(message, webviewView.webview);
        });

        // ── 视图 dispose 时重置状态 ──
        webviewView.onDidDispose(() => {
            this._view = undefined;
            this._hasInit = false;
            disposeMcpHub();
        });

        // 监听主题变化
        vscode.window.onDidChangeActiveColorTheme(() => {
            const themeStyle = [
                vscode.ColorThemeKind.Dark,
                vscode.ColorThemeKind.HighContrast
            ].includes(vscode.window.activeColorTheme.kind) ? 'dark' : 'light';

            this.sendMessage({
                type: 'THEME_CHANGED',
                data: { themeStyle },
            });
        });
    }

    // ─────────────────────────────────────────────
    //  消息处理 —— 对应源码版 handleMessage
    // ─────────────────────────────────────────────

    private async _handleMessage(message: any, webview: vscode.Webview) {
        // ── 所有消息都日志输出，便于排查 ──
        if (!['CONSOLE_LOG', 'CONSOLE_WARN', 'CONSOLE_ERROR', 'PRINT_LOG',
              'REPORT_CONSOLE_LOG', 'REPORT_CONSOLE_WARN', 'REPORT_CONSOLE_ERROR'].includes(message.type)) {
            console.log(`[Y3Maker MSG] type=${message.type}`);
        }

        switch (message.type) {
            case 'GET_INIT_DATA': {
                this._sendInitData(webview);
                break;
            }
            case 'GET_WORKSPACE_INFO': {
                this._sendWorkspaceInfo();
                break;
            }
            case 'COPY_TO_CLIPBOARD': {
                vscode.env.clipboard.writeText(message.data);
                break;
            }
            case 'OPEN_IN_BROWSER': {
                const url = message.data?.url;
                if (url) {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
                break;
            }
            case 'KEYBOARD_PASTE': {
                vscode.env.clipboard.readText().then(text => {
                    if (text) {
                        this.sendMessage({
                            type: 'APPLY_KEYBOARD_PASTE',
                            data: text,
                        });
                    }
                });
                break;
            }
            case 'GET_WORKSPACE_FILES': {
                // 源码版 GET_WORKSPACE_FILES 实际调用 searchWorkspacePath（带 folderDisabled: true）
                const keyword: string = message.data?.keyword ?? '';
                const max: number = message.data?.max ?? 50;
                this._searchWorkspacePaths(keyword, max, message.data?.type, true).then(files => {
                    this.sendMessage({
                        type: 'WORKSPACE_FILES',
                        data: files,
                    });
                });
                break;
            }
            case 'SEARCH_WORKSPACE_PATH': {
                const keyword: string = message.data?.keyword ?? '';
                const max: number = message.data?.max ?? 10;
                const searchType: string | undefined = message.data?.type; // "file" | "folder" | undefined
                this._searchWorkspacePaths(keyword, max, searchType).then(files => {
                    this.sendMessage({
                        type: 'WORKSPACE_FILES',
                        data: files,
                    });
                });
                break;
            }
            case 'TOOL_CALL': {
                this._handleToolCall(message.data);
                break;
            }
            default: {
                // 尝试使用扩展消息处理器（覆盖源码版 96 个 case 中的大部分）
                try {
                    const handled = await handleExtendedMessage(message, webview, this);
                    if (!handled) {
                        console.log('[Y3Maker] Unhandled message:', message.type);
                    }
                } catch (err) {
                    console.error('[Y3Maker] Error handling message:', message.type, err);
                }
                break;
            }
        }
    }

    // ─────────────────────────────────────────────
    //  发送 INIT_DATA —— 与源码版 sendInitData 一致
    // ─────────────────────────────────────────────

    private _sendInitData(targetWebview?: vscode.Webview) {
        const config = getCodeMakerConfig();

        const themeStyle = [
            vscode.ColorThemeKind.Dark,
            vscode.ColorThemeKind.HighContrast
        ].includes(vscode.window.activeColorTheme.kind) ? 'dark' : 'light';

        const initDataMessage = {
            type: 'INIT_DATA',
            data: {
                // 认证相关（Y3Helper 集成模式，使用本地凭证）
                username: 'y3helper-user',
                accessToken: 'y3helper-local',
                isLogin: true,

                // IDE 标识
                IDE: 'vscode',
                app_version: vscode.version,
                // 版本门已在 webview 源码里被打掉（versionCompare 恒返 1），
                // 这里写什么都行，保留一个能与 codemaker 对得上的值即可。
                codeMakerVersion: '26.5.0',

                // 配置项
                codeChatApiKey: config.apiKey,
                codeChatApiBaseUrl: config.apiBaseUrl,
                codeChatModel: config.model,
                // 固定模型：非空时前端会锁定模型选择器，直接显示该值
                fixedModel: config.model,

                // UI 设置
                submitKey: 'Enter',
                themeStyle: themeStyle,
                enableAutoExecuteCommand: false,
                newCodeReview: true,

                // 源码版的默认值
                codeGenerateModel: '',
                codeGenerateModelCode: '',
                gatewayName: '',
                isMhxy: false,
                codebaseDefaultAuthorizationPath: [],
                codeBaseCheckCommands: [],
                currentFileAutoAttach: false,
                disableNewApply: false,
                planModeEnabled: false,
                subagentEnable: true,
                subagentManualTriggerOnly: false,
                // 强制使用 ClaudeEdit 应用模式：
                // - AI 走 write / edit 原生工具（配合 autoApply=true 可静默落盘）
                // - 避免回答里出现「文件变更」推荐面板（FileRecommendApplyPanel）
                chatApplyMode: 'claudeedit',
                rtkBinaryAvailable: isRtkBinaryAvailable(),
            },
        };

        if (targetWebview) {
            targetWebview.postMessage(initDataMessage);
        } else {
            this.sendMessage(initDataMessage);
        }
    }

    // ─────────────────────────────────────────────
    //  发送 SYNC_WORKSPACE_INFO —— 与源码版 getWorkspaceInfo 一致
    // ─────────────────────────────────────────────

    private _sendWorkspaceInfo() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspace = workspaceFolders?.[0]?.uri.fsPath || '';
        const repoName = workspaceFolders?.[0]?.name || '';

        let currentFilePath = '';
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            currentFilePath = editor.document.fileName;
        }

        let openFiles = vscode.workspace.textDocuments || [];
        openFiles = openFiles.filter((file) => {
            return file.fileName.indexOf(workspace) >= 0;
        });

        const shell = this._getShellFromEnv();

        this.sendMessage({
            type: 'SYNC_WORKSPACE_INFO',
            data: {
                workspace: workspace,
                repoUrl: '',
                repoName: repoName,
                repoType: 'git',
                osName: os.type(),
                shell: shell,
                currentFilePath: currentFilePath,
                openFilePaths: openFiles.map((f) => f.fileName),
                repoCodeTable: '',
                codebaseCustomPrompt: '',
            },
        });

        // 同步 .y3makerignore 配置状态
        const { syncIgnoreState } = require('./syncIgnoreState');
        syncIgnoreState();
    }

    private _getShellFromEnv(): string {
        const env = process.env;
        if (process.platform === 'win32') {
            return env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
        }
        if (process.platform === 'darwin') {
            return env.SHELL || '/bin/zsh';
        }
        return env.SHELL || '/bin/bash';
    }

    // ─────────────────────────────────────────────
    //  TOOL_CALL 处理 —— AI 模型调用的工具（read_file、list_files 等）
    // ─────────────────────────────────────────────

    /**
     * 处理前端发来的 TOOL_CALL 消息
     * AI 模型通过 function_call 调用 read_file / list_files 等工具时，
     * 前端会发送 TOOL_CALL，Extension 执行后返回 TOOL_CALL_RESULT
     */
    private async _handleToolCall(data: any) {
        const { tool_name, tool_params, tool_id, task_id, session_id } = data || {};
        if (!tool_name || !tool_id) {
            return;
        }

        console.log(`[Y3Maker] TOOL_CALL: ${tool_name}, id: ${tool_id}`);

        try {
            const result = await executeFunction({
                toolId: tool_id,
                toolName: tool_name,
                toolParams: tool_params,
                provider: this,
            });

            // 对齐 CC: read_file 工具不落盘（自循环引用问题）
            const shouldSkipPersist = tool_name === 'read_file';
            let responseContent = result.content;
            let responseExtra = result?.extra ? { ...result.extra } : {};
            if (!shouldSkipPersist) {
                const persisted = await maybePersistToolResultToDisk({
                    toolId: tool_id,
                    sessionId: session_id || task_id,
                    content: result.content,
                    isError: result.isError,
                });
                if (persisted) {
                    responseContent = persisted.content;
                    responseExtra = { ...responseExtra, ...persisted.extra };
                }
            }

            this.sendMessage({
                type: 'TOOL_CALL_RESULT',
                data: {
                    tool_result: {
                        path: result.path,
                        content: responseContent,
                        isError: result.isError,
                    },
                    tool_id: tool_id,
                    tool_name: tool_name,
                    extra: responseExtra,
                    // SubAgent 工具调用：透传 task_id 以便 WebView 路由到正确的流
                    ...(task_id && { task_id }),
                },
            });
        } catch (err: any) {
            console.error(`[Y3Maker] TOOL_CALL error (${tool_name}):`, err);
            this.sendMessage({
                type: 'TOOL_CALL_RESULT',
                data: {
                    tool_result: {
                        content: `Error executing ${tool_name}: ${err.message || err}`,
                        isError: true,
                    },
                    tool_id: tool_id,
                    tool_name: tool_name,
                    extra: {},
                    ...(task_id && { task_id }),
                },
            });
        }
    }

    // ─────────────────────────────────────────────
    //  文件写入/编辑工具（对齐源码版 executeFunction.ts）
    // ─────────────────────────────────────────────
    // 实际实现已搬迁至 utils/executeFunction.ts + utils/editFile/index.ts + utils/replaceInFile/index.ts
    // 本类只保留 WebView 生命周期、消息路由等职责

    // 工具执行相关逻辑已搬迁到 utils/executeFunction.ts 及各 tool 子目录
    // - utils/terminal/index.ts           : run_terminal_cmd（含 ETerminalStatus）
    // - utils/editFile/index.ts           : edit_file
    // - utils/replaceInFile/index.ts      : replace_in_file
    // - utils/analyzeProject/index.ts     : read_file / list_files / definitions
    // - utils/globSearch.ts               : glob_search
    // - utils/getWorkspaceInfo.ts         : resolveWorkspacePath()

    // ─────────────────────────────────────────────
    //  工作区文件/目录搜索
    // ─────────────────────────────────────────────

    /**
     * 搜索工作区路径（用于 SEARCH_WORKSPACE_PATH / GET_WORKSPACE_FILES）
     * 完全移植自源码版 searchWorkspacePath.ts
     */
    private async _searchWorkspacePaths(keyword: string, max: number, type?: string, folderDisabled?: boolean): Promise<any[]> {
        try {
            const workspaceTracker = getWorkspaceTracker();
            const filePaths = workspaceTracker.getFilePaths({
                keyword,
                type
            });
            const slicedFilePaths = filePaths.slice(0, max);
            const activedDocument = vscode.window.activeTextEditor?.document;
            const result: any[] = [];
            let hasActiveFilePath = false;
            let hasPreviewFile = false;
            let uniqueFilePaths: string[] = [];

            if (!keyword) {
                // 补充最近打开的文件（源码版 L30-41）
                const openFiles = getOpenFilesHandler()?.getRecentlyOpenedTop(10) || [];
                const openFilesPaths = openFiles.map((file: any) => file.relative_path || file.path);
                ([openFilesPaths, slicedFilePaths].flat()).forEach((filePath: string) => {
                    if (!uniqueFilePaths.includes(filePath)) {
                        uniqueFilePaths.push(filePath);
                    }
                });
            } else {
                uniqueFilePaths = slicedFilePaths;
            }

            for (const filePath of uniqueFilePaths) {
                if (filePath.endsWith('/') && !folderDisabled) {
                    // 目录处理（源码版 L44-63）
                    const absolutePath = path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
                    const uri = vscode.Uri.file(absolutePath);
                    try {
                        const entities = await vscode.workspace.fs.readDirectory(uri);
                        const pathList = entities.reduce((prev: string, current: [string, vscode.FileType]) => {
                            let next = prev;
                            if (next) { next += '\n'; }
                            next += filePath + current[0];
                            return next;
                        }, '');
                        result.push({
                            path: filePath,
                            fileName: path.basename(filePath),
                            content: pathList
                        });
                    } catch {
                        workspaceTracker.removeFilePath(filePath);
                    }
                } else {
                    // 文件处理（源码版 L65-97）
                    try {
                        const absolutePath = path.resolve(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', filePath);
                        const uri = vscode.Uri.file(absolutePath);
                        await vscode.workspace.fs.stat(uri);
                        let content: Buffer | string = '';
                        if (isImageFile(absolutePath)) {
                            // 图片文件：检查大小限制（20MB），base64 编码
                            const stats = statSync(absolutePath);
                            if (stats.size > maxDocsetFileSize * 2) {
                                content = `Please note: ${absolutePath} larger than 20MB cannot be parsed.`;
                            } else {
                                content = readFileSync(absolutePath).toString('base64');
                            }
                        } else if (isDocsetFile(absolutePath)) {
                            content = readFileSync(absolutePath).toString('base64');
                        } else {
                            const document = await vscode.workspace.openTextDocument(uri);
                            content = document.getText() || '';
                        }

                        hasPreviewFile = true;
                        if (activedDocument?.uri?.path === absolutePath || activedDocument?.uri?.fsPath === absolutePath) {
                            hasActiveFilePath = true;
                            result.unshift({
                                path: filePath,
                                fileName: path.basename(filePath),
                                content: content,
                                isActive: true,
                            });
                        } else {
                            result.push({
                                path: filePath,
                                fileName: path.basename(filePath),
                                content: content,
                            });
                        }
                    } catch {
                        workspaceTracker.removeFilePath(filePath);
                    }
                }
            }

            // 源码版关键兜底修复（L99-113）：如果当前活动文件不在结果中，强制插入到最前面
            if (!keyword && !hasActiveFilePath && hasPreviewFile && activedDocument?.uri?.scheme === 'file') {
                try {
                    await vscode.workspace.fs.stat(activedDocument.uri);
                    const absolutePath = activedDocument.uri.fsPath;
                    result.unshift({
                        path: vscode.workspace.asRelativePath(activedDocument.uri),
                        fileName: path.basename(activedDocument.uri.path),
                        content: isDocsetFile(activedDocument.uri.path)
                            ? readFileSync(absolutePath).toString('base64')
                            : (activedDocument.getText() || ''),
                        isActive: true,
                    });
                } catch { }
            }

            return result;
        } catch (e) {
            console.error('[Y3Maker] Error searching workspace paths:', e);
            return [];
        }
    }

    // ─────────────────────────────────────────────
    //  sendMessage —— 带 leftOverMessages 队列
    // ─────────────────────────────────────────────

    /**
     * 公开方法：重新发送 INIT_DATA（配置变化时由 index.ts 调用）
     */
    public refreshInitData() {
        this._sendInitData();
    }

    /**
     * 公开方法：重新加载 .codemaker 资源（Rules/Skills/MCP）
     * 用于地图初始化后 从git上拉取.y3maker到工程目录时，通知前端刷新
     */
    public async reloadCodemakerResources() {
        console.log('[Y3Maker] reloadCodemakerResources: 重新加载 Rules/Skills/MCP');
        // 直接调用 handler 函数重新读取并推送给前端
        await handleGetRules(this);
        const skillsHandler = SkillsHandler.getInstance();
        await skillsHandler.loadSkills();
        skillsHandler.syncSkills();
        // 重新初始化 MCP（重新读取 mcp_settings.json 并重启所有连接）
        const hub = getMcpHub();
        if (hub) {
            try {
                await hub.restartAllConnections();
            } catch (e) {
                console.warn('[Y3Maker] MCP 重新初始化失败:', e);
            }
        }
    }

    public sendMessage(message: any) {
        if (this._view && this._hasInit) {
            this._sendToWebview(message);
        } else {
            this._leftOverMessages.push(message);
        }
    }


    private _sendToWebview(message: any) {
        this._view?.webview.postMessage(message);
    }

    // ─────────────────────────────────────────────
    //  生成 HTML —— 消息桥与源码版完全一致（全量双向转发）
    // ─────────────────────────────────────────────

    private _getHtmlForWebview(): string {
        const origin = `http://localhost:${this._apiServerPort}`;
        const hash = new Date().getTime();
        const iframeUrl = `${origin}?hash=${hash}`;

        // 与源码版 _getHtmlForWebview 完全一致的消息桥逻辑：
        // 1. 来自 iframe (origin === localhost) → vscode.postMessage(event.data)
        // 2. 来自 VSCode (origin.startsWith('vscode-webview')) → iframe.contentWindow.postMessage(event.data, iframeuri)
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Y3Maker</title>
    <style>::selection {background: transparent;}</style>
</head>
<body style="padding-left: 0; padding-right: 0; margin: 0; overflow: hidden;">
    <iframe
        src="${iframeUrl}"
        frameborder="0"
        style="width: 100%; height: calc(100vh - 3px)"
        id="codemaker-webui"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads"
        allow="cross-origin-isolated; autoplay; local-network-access; clipboard-read; clipboard-write"
    ></iframe>
    <script>
        const iframeuri = "${iframeUrl}";
        const iframe = document.getElementById("codemaker-webui");
        const vscode = acquireVsCodeApi();

        window.addEventListener("message", (event) => {
            // 来自 iframe 的消息 → 转发给 VSCode Extension
            if (event.origin === "${origin}") {
                vscode.postMessage(event.data);
                console.log("[Y3Maker Bridge] iframe → vscode:", event.data?.type);
            }
            // 来自 VSCode Extension 的消息 → 转发给 iframe
            else if (event.origin && event.origin.startsWith("vscode-webview")) {
                if (iframe.contentWindow) {
                    iframe.contentWindow.postMessage(event.data, iframeuri);
                    console.log("[Y3Maker Bridge] vscode → iframe:", event.data?.type);
                }
            }
            // 未知来源
            else {
                console.log("[Y3Maker Bridge] Unknown origin:", event.origin, event.data?.type);
            }
        });
    </script>
</body>
</html>`;
    }
}