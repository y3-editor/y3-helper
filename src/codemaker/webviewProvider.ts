import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { getCodeMakerConfig } from './configProvider';
import { handleExtendedMessage, loadSkillsFromDir, handleGetRules, handleGetSkills } from './messageHandlers';
import { getWorkspaceTracker } from './handlers/workspaceTracker';
import { getOpenFilesHandler } from './handlers/openFilesHandler';
import { isDocsetFile } from './utils/file';
import { readFileSync } from 'fs';
import { initMcpHub, getMcpHub, disposeMcpHub } from './mcpHandlers/index';
import SkillsHandler from './skillsHandler';

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
                codeMakerVersion: '1.0.0',

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
        const { tool_name, tool_params, tool_id } = data || {};
        if (!tool_name || !tool_id) {
            return;
        }

        console.log(`[Y3Maker] TOOL_CALL: ${tool_name}, id: ${tool_id}`);

        try {
            let result: any;
            switch (tool_name) {
                case 'read_file':
                    result = await this._toolReadFile(tool_params);
                    break;
                case 'list_files_top_level':
                    result = await this._toolListFiles(tool_params, false);
                    break;
                case 'list_files_recursive':
                    result = await this._toolListFiles(tool_params, true);
                    break;
                case 'view_source_code_definitions_top_level':
                    result = await this._toolViewDefinitions(tool_params);
                    break;
                case 'grep_search':
                    result = await this._toolGrepSearch(tool_params);
                    break;
                case 'write_to_file':
                    result = await this._toolWriteToFile(tool_params);
                    break;
                case 'edit_file':
                    result = await this._toolEditFile(tool_params);
                    break;
                case 'replace_in_file':
                    result = await this._toolReplaceInFile(tool_params);
                    break;
                case 'reapply':
                    result = await this._toolEditFile(tool_params);
                    break;
                case 'run_terminal_cmd':
                    result = await this._toolRunTerminalCmd(tool_params, tool_id);
                    break;
                case 'make_plan':
                case 'write_todo':
                    result = await this._toolMakePlan(tool_params);
                    break;
                case 'use_skill':
                    result = await this._toolUseSkill(tool_params);
                    break;
                case 'generate_codewiki_structure':
                    result = await this._toolGenerateCodewiki(tool_params);
                    break;
                case 'use_mcp_tool':
                    result = await this._toolUseMcp(tool_params);
                    break;
                case 'access_mcp_resource':
                    result = await this._toolAccessMcpResource(tool_params);
                    break;
                default:
                    result = {
                        content: `Tool "${tool_name}" is not supported in Y3Helper integration.`,
                        isError: true,
                    };
                    break;
            }

            this.sendMessage({
                type: 'TOOL_CALL_RESULT',
                data: {
                    tool_result: result,
                    tool_id: tool_id,
                    tool_name: tool_name,
                    extra: result?.extra || {},
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
                },
            });
        }
    }

    /**
     * read_file 工具：读取指定文件内容
     * tool_params: { path: string, offset?: number, limit?: number }
     */
    private async _toolReadFile(params: any): Promise<any> {
        let filePath: string = params?.path || params?.file_path || '';
        if (!filePath) {
            return { content: 'Error: No file path provided.', isError: true };
        }

        // 如果是相对路径，解析为绝对路径
        if (!path.isAbsolute(filePath)) {
            const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspace) {
                filePath = path.join(workspace, filePath);
            }
        }

        try {
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
                return { content: `Error: "${filePath}" is a directory, not a file.`, path: filePath, isError: true };
            }

            const buffer = await fs.promises.readFile(filePath, 'utf-8');
            let lines = buffer.split('\n');

            const offset = Math.max(0, (params?.offset || 1) - 1);
            const limit = params?.limit || 500;
            lines = lines.slice(offset, offset + limit);

            // 添加行号（cat -n 格式）
            const numbered = lines.map((line, i) => {
                const lineNum = offset + i + 1;
                return `${String(lineNum).padStart(6, ' ')}\t${line}`;
            }).join('\n');

            return {
                content: numbered,
                path: filePath,
                isError: false,
            };
        } catch (err: any) {
            return {
                content: `Error reading file "${filePath}": ${err.message}`,
                path: filePath,
                isError: true,
            };
        }
    }

    /**
     * list_files_top_level / list_files_recursive 工具
     * tool_params: { path: string }
     */
    private async _toolListFiles(params: any, recursive: boolean): Promise<any> {
        let dirPath: string = params?.path || '.';
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!path.isAbsolute(dirPath)) {
            if (workspace) {
                dirPath = path.join(workspace, dirPath);
            }
        }

        try {
            const stat = await fs.promises.stat(dirPath);
            if (!stat.isDirectory()) {
                return { content: `Error: "${dirPath}" is not a directory.`, isError: true };
            }

            const entries = await this._listDir(dirPath, recursive, workspace || dirPath, 0, 5);
            return {
                content: entries.join('\n'),
                isError: false,
            };
        } catch (err: any) {
            return {
                content: `Error listing directory "${dirPath}": ${err.message}`,
                isError: true,
            };
        }
    }

    private async _listDir(dirPath: string, recursive: boolean, basePath: string, depth: number, maxDepth: number): Promise<string[]> {
        const results: string[] = [];
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                // 跳过常见无关目录
                if (['.git', 'node_modules', '.DS_Store', '__pycache__'].includes(entry.name)) {
                    continue;
                }
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

                if (entry.isDirectory()) {
                    results.push(relativePath + '/');
                    if (recursive && depth < maxDepth) {
                        const subEntries = await this._listDir(fullPath, true, basePath, depth + 1, maxDepth);
                        results.push(...subEntries);
                    }
                } else {
                    results.push(relativePath);
                }

                if (results.length > 500) {
                    results.push('... (truncated, too many entries)');
                    break;
                }
            }
        } catch (err) {
            // 忽略权限错误等
        }
        return results;
    }

    /**
     * view_source_code_definitions_top_level 工具（简化版：返回文件列表）
     */
    private async _toolViewDefinitions(params: any): Promise<any> {
        // 简化实现：列出目录下的源码文件
        const result = await this._toolListFiles(params, false);
        return result;
    }

    /**
     * grep_search 工具：在工作区搜索匹配的文本
     * tool_params: { regex: string, path?: string, file_pattern?: string }
     */
    private async _toolGrepSearch(params: any): Promise<any> {
        const regex = params?.regex || params?.pattern;
        if (!regex) {
            return { content: 'Error: No search pattern provided.', isError: true };
        }

        let searchPath = params?.path || '.';
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!path.isAbsolute(searchPath) && workspace) {
            searchPath = path.join(workspace, searchPath);
        }

        try {
            const results: string[] = [];
            const re = new RegExp(regex, params?.case_sensitive ? '' : 'i');
            await this._grepDir(searchPath, re, params?.file_pattern, results, 50);

            if (results.length === 0) {
                return { content: 'No matches found.', isError: false };
            }
            return { content: results.join('\n'), isError: false };
        } catch (err: any) {
            return { content: `Error during search: ${err.message}`, isError: true };
        }
    }

    private async _grepDir(dirPath: string, regex: RegExp, filePattern: string | undefined, results: string[], maxResults: number): Promise<void> {
        if (results.length >= maxResults) { return; }
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (results.length >= maxResults) { return; }
                if (['.git', 'node_modules', 'dist', 'out', '__pycache__'].includes(entry.name)) {
                    continue;
                }
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await this._grepDir(fullPath, regex, filePattern, results, maxResults);
                } else {
                    // 文件模式过滤
                    if (filePattern) {
                        const ext = filePattern.replace('*', '');
                        if (!entry.name.endsWith(ext)) { continue; }
                    }
                    try {
                        const content = await fs.promises.readFile(fullPath, 'utf-8');
                        const lines = content.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            if (regex.test(lines[i])) {
                                results.push(`${fullPath}:${i + 1}: ${lines[i].trimEnd()}`);
                                if (results.length >= maxResults) { return; }
                            }
                        }
                    } catch {
                        // 跳过无法读取的文件（二进制等）
                    }
                }
            }
        } catch {
            // 忽略权限错误
        }
    }

    // ─────────────────────────────────────────────
    //  文件写入/编辑工具（对齐源码版 executeFunction.ts）
    // ─────────────────────────────────────────────

    /**
     * write_to_file 工具：创建新文件或完全覆写已有文件
     */
    private async _toolWriteToFile(params: any): Promise<any> {
        try {
            const filePath = params?.path;
            const content = params?.content ?? '';
            if (!filePath) {
                return { content: 'Error: path is required.', isError: true, path: '' };
            }
            const absolutePath = this._resolvePath(filePath);
            const fsModule = require('fs');
            const fileExist = fsModule.existsSync(absolutePath);
            const currentContent = fileExist ? fsModule.readFileSync(absolutePath, 'utf-8') : '';

            // 不在这里写磁盘，前端通过 ACCEPT_EDIT 执行真正写入
            return {
                content: content,
                isError: false,
                path: filePath,
                extra: {
                    beforeEdit: currentContent,
                    finalResult: content,
                    isCreateFile: !fileExist,
                    filePath: filePath,
                    taskId: '',
                },
            };
        } catch (err: any) {
            return { content: `Error writing file: ${err.message}`, isError: true, path: '' };
        }
    }

    /**
     * edit_file / reapply 工具：对齐源码版 editFile
     * 新文件/空文件 → 直接使用 codeEdit
     * 已有内容 → 调用本地 API Server 的 /api/v1/apply/edit 做 AI 智能合并
     */
    private async _toolEditFile(params: any): Promise<any> {
        try {
            const targetFile = params?.target_file || params?.path;
            const codeEdit = params?.code_edit ?? params?.content ?? '';
            const isCreateFile = params?.is_create_file || false;
            if (!targetFile) {
                return { content: 'Error: target_file is required.', isError: true, path: '' };
            }
            const absolutePath = this._resolvePath(targetFile);
            const fsModule = require('fs');
            const fileExist = fsModule.existsSync(absolutePath);
            let currentContent = '';

            if (!fileExist) {
                // 宽容处理：AI 经常省略 is_create_file
            } else {
                const doc = await vscode.workspace.openTextDocument(absolutePath);
                currentContent = doc.getText();
            }

            let updatedContent: string;
            if (currentContent === '' || !fileExist) {
                // 新文件或空文件：直接使用 codeEdit
                updatedContent = codeEdit;
            } else {
                // 已有内容的文件：调用 apply API 做智能合并
                try {
                    updatedContent = await this._applyEditViaApi(currentContent, codeEdit, absolutePath);
                    console.log(`[Y3Maker] edit_file: apply API 合并成功, result.length=${updatedContent.length}`);
                } catch (applyErr: any) {
                    console.warn(`[Y3Maker] edit_file: apply API 失败 (${applyErr.message}), 回退为直接覆写`);
                    // 回退：直接使用 codeEdit
                    updatedContent = codeEdit;
                }
            }

            // 不在这里写磁盘！前端会通过 ACCEPT_EDIT 来执行真正的写入
            return {
                content: updatedContent,
                path: targetFile,
                extra: {
                    editSnippet: codeEdit,
                    beforeEdit: currentContent,
                    finalResult: updatedContent,
                    isCreateFile: !fileExist,
                    filePath: targetFile,
                    taskId: '',
                },
                isError: false,
            };
        } catch (err: any) {
            return { content: `Error editing file: ${err.message}`, isError: true, path: params?.target_file || '' };
        }
    }

    /**
     * 调用本地 API Server 的 /api/v1/apply/edit 做智能合并
     * 对齐源码版 getFinalResultStream
     */
    private async _applyEditViaApi(beforeEdit: string, editSnippet: string, filePath: string): Promise<string> {
        const http = require('http');
        const apiPort = this._apiServerPort;
        if (!apiPort) {
            throw new Error('API Server 未启动');
        }

        // 换行符归一化
        const normalizedBefore = beforeEdit.replace(/\r\n/g, '\n');
        const normalizedSnippet = editSnippet.replace(/\r\n/g, '\n');

        // 构建和源码版 getFinalResultStream 一样的请求体
        const systemPrompt = "You are a coding assistant that helps merge code updates, ensuring every modification is fully integrated.";
        const userPrompt = `Merge all changes from the <update> snippet into the <code> below.
- Preserve the code's structure, order, comments, and indentation exactly.
- Output only the updated code, enclosed within <updated-code> and </updated-code> tags.
- Do not include any additional text, explanations, placeholders, ellipses, or code fences.
- Do not change unrelavant parts beyond the update.

<code>${normalizedBefore}</code>

<update>${normalizedSnippet}</update>

Provide the complete updated code.`;

        const requestBody = JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: 'fast_apply_7b',
            temperature: 0,
            original_content: normalizedBefore,
            code_edit: normalizedSnippet,
            task_id: '',
            stream: true,
            filePath: filePath,
            isFallback: false,
        });

        return new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port: apiPort,
                path: '/api/v1/apply/edit',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                },
                timeout: 30000,
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => {
                    // 解析 SSE 流式响应，提取合并结果
                    let content = '';
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            try {
                                const json = JSON.parse(line.slice(6));
                                const delta = json?.choices?.[0]?.delta?.content;
                                if (delta) { content += delta; }
                            } catch { /* 跳过非 JSON 行 */ }
                        }
                    }

                    if (!content) {
                        reject(new Error('apply API 返回空内容'));
                        return;
                    }

                    // 提取 <updated-code> 标签内的内容
                    let finalResult = content;
                    if (finalResult.includes('<updated-code>') && finalResult.includes('</updated-code>')) {
                        const match = finalResult.match(/<updated-code>([\s\S]*?)<\/updated-code>/);
                        if (match) { finalResult = match[1]; }
                    }

                    // 去掉可能的 code fence
                    const trimmed = finalResult.trim();
                    const fenceMatch = trimmed.match(/^```(\w+)?\s*\n([\s\S]*?)\n```$/);
                    if (fenceMatch) { finalResult = fenceMatch[2]; }

                    // 还原换行符
                    if (beforeEdit.includes('\r\n')) {
                        finalResult = finalResult.replace(/\n/g, '\r\n');
                    }

                    resolve(finalResult);
                });
            });

            req.on('error', (err: any) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('apply API 请求超时'));
            });
            req.write(requestBody);
            req.end();
        });
    }

    /**
     * replace_in_file 工具：对齐源码版 replaceInFile（三层匹配策略）
     */
    private async _toolReplaceInFile(params: any): Promise<any> {
        const { constructNewFileContent } = require('./tools/constructNewFileContent');
        try {
            const targetFile = params?.target_file || params?.path;
            const replaceSnippet = params?.diff ?? '';
            const isCreateFile = params?.is_create_file || false;
            if (!targetFile) {
                return { content: 'Error: target_file is required.', isError: true, path: '' };
            }
            const absolutePath = this._resolvePath(targetFile);
            const fsModule = require('fs');
            const fileExist = fsModule.existsSync(absolutePath);
            let currentContent = '';

            if (!fileExist) {
                if (!isCreateFile) {
                    // 宽容处理：文件不存在时自动创建（AI 经常省略 is_create_file）
                    console.log(`[Y3Maker] replace_in_file: file not exist, auto creating: ${absolutePath}`);
                }
            } else {
                const doc = await vscode.workspace.openTextDocument(absolutePath);
                currentContent = doc.getText();
            }

            // 换行符归一化
            const normalizedContent = currentContent.replace(/\r\n/g, '\n');
            const normalizedSnippet = replaceSnippet.replace(/\r\n/g, '\n');

            // 使用源码版三层匹配引擎
            const updatedContent = constructNewFileContent(normalizedSnippet, normalizedContent);

            // 还原换行符
            const originalUseCRLF = currentContent.includes('\r\n');
            const finalContent = originalUseCRLF ? updatedContent.replace(/\n/g, '\r\n') : updatedContent;

            // 不在这里写磁盘！前端会通过 ACCEPT_EDIT 来执行真正的写入
            return {
                content: finalContent,
                path: targetFile,
                extra: {
                    beforeEdit: currentContent,
                    finalResult: finalContent,
                    isCreateFile: !fileExist,
                    filePath: targetFile,
                    taskId: '',
                    fallbackApply: false,
                },
                isError: false,
            };
        } catch (err: any) {
            return { content: `Error replace in file: ${err.message}`, isError: true, path: params?.target_file || '' };
        }
    }

    // 对齐源码版 ETerminalStatus 枚举
    private static readonly ETerminalStatus = {
        START: '',
        CANCELED: 'Canceled',
        RUNNING: 'Running',
        FAILED: 'Failed',
        SUCCESS: 'Success',
    } as const;

    /**
     * run_terminal_cmd 工具：在终端中执行命令
     * 对齐源码版 TerminalManager 的完整流程：
     * 1. 发送 TERMINAL_TRANSFER_LOG (status: START) 通知前端命令开始
     * 2. 使用 spawn 执行命令，实时发送 TERMINAL_TRANSFER_LOG (status: RUNNING) 推送输出
     * 3. 命令结束后返回 TOOL_CALL_RESULT (terminalStatus: Success/Failed)
     */
    private async _toolRunTerminalCmd(params: any, toolId: string): Promise<any> {
        const command = params?.command;
        const messageId = params?.messageId || '';
        const terminalId = toolId || '';

        if (!command) {
            return { content: 'Error: command is required.', isError: true, path: '' };
        }

        const ETS = CodeMakerWebviewProvider.ETerminalStatus;
        const result = {
            content: 'The user is not allowed to execute commands',
            path: command,
            isError: false,
            extra: {
                messageId: messageId,
                terminalId: terminalId,
                terminalStatus: ETS.START as string,
                hasShellIntegration: false,
                status: ETS.START as string,
            },
        };

        // 发送 TERMINAL_TRANSFER_LOG 消息给前端（对齐源码版 sendLog）
        const sendTerminalLog = (log: string, status: string, isHot: boolean = false) => {
            this.sendMessage({
                type: 'TERMINAL_TRANSFER_LOG',
                data: {
                    messageId,
                    terminalId,
                    log,
                    extra: {
                        terminalStatus: status,
                        hasShellIntegration: isHot,
                        status: isHot ? ETS.RUNNING : ETS.START,
                    },
                },
            });
        };

        if (!params?.is_approve) {
            // 用户拒绝执行
            result.extra.terminalStatus = ETS.CANCELED;
            return result;
        }

        try {
            const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const { spawn } = require('child_process') as typeof import('child_process');

            // 1. 发送初始 START 状态
            sendTerminalLog('', ETS.START, false);

            return new Promise<any>((resolve) => {
                const shell = process.env.COMSPEC || 'cmd.exe';
                const childProcess = spawn(command, [], {
                    cwd: workspace || process.cwd(),
                    shell: true,
                    stdio: 'pipe',
                    env: {
                        ...process.env,
                        PYTHONIOENCODING: 'utf-8',
                        PYTHONUTF8: '1',
                        NODE_OPTIONS: process.env.NODE_OPTIONS
                            ? `${process.env.NODE_OPTIONS} --no-warnings`
                            : '--no-warnings',
                        LANG: 'C.UTF-8',
                        LC_ALL: 'C.UTF-8',
                        CHCP: '65001',
                    },
                });

                let lines: string[] = [];
                let exitCode = 0;
                let hasError = false;

                // 解码 Buffer 为 UTF-8 字符串
                const decodeBuffer = (data: Buffer): string => {
                    try {
                        return data.toString('utf-8');
                    } catch {
                        return data.toString();
                    }
                };

                // 2. stdout 实时推送
                childProcess.stdout?.on('data', (data: Buffer) => {
                    const output = decodeBuffer(data);
                    lines.push(output);
                    sendTerminalLog(output, ETS.RUNNING, true);
                });

                // 2. stderr 实时推送（stderr 不一定代表错误，很多工具用 stderr 输出进度信息）
                childProcess.stderr?.on('data', (data: Buffer) => {
                    const output = decodeBuffer(data);
                    lines.push(output);
                    sendTerminalLog(output, ETS.RUNNING, true);
                });

                childProcess.on('error', (error: Error) => {
                    hasError = true;
                    console.error(`[Y3Maker] run_terminal_cmd spawn error:`, error);
                });

                childProcess.on('exit', (code: number | null) => {
                    exitCode = code || 0;
                    if (exitCode !== 0) {
                        sendTerminalLog(`exit code is ${exitCode}\n`, ETS.SUCCESS, false);
                    }
                });

                childProcess.on('close', () => {
                    // 3. 命令执行完毕，发送完成状态的 log
                    sendTerminalLog('', ETS.SUCCESS, false);

                    const outputText = lines.join('').trim();

                    console.log(`[Y3Maker] run_terminal_cmd: exitCode=${exitCode}, hasError=${hasError}, output.len=${outputText.length}`);

                    // 对齐源码版：如果状态不是执行失败，默认是执行成功
                    if (result.extra.terminalStatus !== ETS.FAILED) {
                        result.extra.terminalStatus = ETS.SUCCESS;
                    }

                    if (exitCode !== 0 && !outputText.length) {
                        result.content = `Command executed successfully. \n The code of Executed command is ${exitCode}.This output is nothing \n`;
                    } else {
                        result.content = `Command executed successfully.\nOutput: ${outputText}\n`;
                    }
                    result.isError = hasError;

                    resolve(result);
                });

                // 超时保护：防止命令无限挂起
                const timeout = 120000; // 2分钟
                setTimeout(() => {
                    if (!childProcess.killed) {
                        childProcess.kill();
                        const outputText = lines.join('').trim();
                        result.content = `Command timed out after ${timeout / 1000}s.\nOutput so far: ${outputText}\n`;
                        result.isError = true;
                        result.extra.terminalStatus = ETS.FAILED;
                        result.extra.status = ETS.FAILED;
                        resolve(result);
                    }
                }, timeout);
            });
        } catch (err: any) {
            result.content = `Error running command: ${err.message}`;
            result.isError = true;
            result.extra.terminalStatus = ETS.FAILED;
            result.extra.status = ETS.FAILED;
            return result;
        }
    }

    /**
     * make_plan / write_todo 工具：源码版直接返回 ok
     */
    private async _toolMakePlan(_params: any): Promise<any> {
        return { content: 'ok', path: '', isError: false };
    }

    /**
     * use_skill 工具：加载 skill 内容并返回给 AI
     * 支持 skill_name 为字符串或字符串数组
     */
    private async _toolUseSkill(params: any): Promise<any> {
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

    /**
     * generate_codewiki_structure 工具：暂不支持
     */
    private async _toolGenerateCodewiki(_params: any): Promise<any> {
        return {
            content: 'generate_codewiki_structure is not yet supported in Y3Helper integration.',
            path: '',
            isError: true,
        };
    }

    /**
     * 将相对路径解析为绝对路径（相对于工作区根目录）
     */
    private _resolvePath(filePath: string): string {
        const path = require('path');
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspace) {
            return path.join(workspace, filePath);
        }
        return filePath;
    }

    // ─────────────────────────────────────────────
    //  MCP 工具调用
    // ─────────────────────────────────────────────

    /**
     * use_mcp_tool 工具：调用 MCP 服务器上的工具
     * tool_params: { server_name: string, tool_name: string, arguments?: object }
     */
    private async _toolUseMcp(params: any): Promise<any> {
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
            let toolArguments = params?.arguments;
            if (typeof toolArguments === 'string') {
                try {
                    toolArguments = JSON.parse(toolArguments);
                } catch {
                    // 如果解析失败，保持原样
                }
            }
            console.log(`[Y3Maker] use_mcp_tool: server=${serverName}, tool=${toolName}, args=`, JSON.stringify(toolArguments));
            const response = await hub.callTool(serverName, toolName, toolArguments);
            // 将 MCP 响应格式化为文本
            const textParts: string[] = [];
            for (const item of (response?.content || [])) {
                if (item.type === 'text') {
                    textParts.push(item.text);
                } else if (item.type === 'image') {
                    textParts.push(`[Image: ${item.mimeType}]`);
                } else if (item.type === 'resource') {
                    textParts.push(item.resource?.text || `[Resource: ${item.resource?.uri}]`);
                }
            }
            return {
                content: textParts.join('\n') || '(empty response)',
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
    private async _toolAccessMcpResource(params: any): Promise<any> {
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
                        if (isDocsetFile(absolutePath)) {
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
        await handleGetSkills(this);
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