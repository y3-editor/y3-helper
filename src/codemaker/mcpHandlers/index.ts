/**
 * MCP Server 连接管理器
 * 移植自 CodeMaker 源码版 mcpHandlers/index.ts，适配 Y3Helper 架构
 *
 * 适配变更：
 * - getWebviewProvider() → notifyCallback 回调
 * - getExtensionContext() / getAccessToken() → 移除认证逻辑
 * - printLog() → console.log/error
 * - ensureSettingsDirectoryExists() → 直接使用 .codemaker 目录
 * - delay() → setTimeout + Promise
 * - extensionVersion → 'Y3Helper/1.0'
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport, StreamableHTTPClientTransportOptions } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport, SSEClientTransportOptions } from "@modelcontextprotocol/sdk/client/sse.js";
import {
    CallToolResultSchema,
    GetPromptResultSchema,
    ListPromptsResultSchema,
    ListResourcesResultSchema,
    ListResourceTemplatesResultSchema,
    ListToolsResultSchema,
    ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";

import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { z } from "zod";
import deepEqual from "fast-deep-equal";
import * as iconv from "iconv-lite";
import * as os from "os";

import {
    DEFAULT_MCP_TIMEOUT_SECONDS,
    McpPrompt,
    McpPromptResult,
    McpResource,
    McpResourceResponse,
    McpResourceTemplate,
    McpServer,
    McpTool,
} from "./mcp";
import { McpSettingsSchema, ServerConfigSchema } from "./schema";

// ─── 辅助类型和函数 ────────────────────────────────────

export type Transport = StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport;

export type McpConnection = {
    server: McpServer;
    client: Client;
    transport: Transport;
};

/** WebView 消息发送回调 */
export type McpNotifyCallback = (message: { type: string; data: any }) => void;

function secondsToMs(seconds: number): number {
    return seconds * 1000;
}

function msToSeconds(ms: number): number {
    return ms / 1000;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const USER_AGENT = `Y3Helper/1.0 VSCode ${os.type()}`;

/**
 * 解析子进程的完整 shell 环境变量
 * 对齐上游 TerminalProcess.resolveShellEnv（commit 28d6e037）
 *
 * 用 -l -i shell 执行 `env -0` 获取登录+交互式环境，确保 nvm/pyenv 等工具
 * 在 ~/.bashrc / ~/.zshrc 中注入的 PATH 能被 MCP 子进程继承。
 * Windows 直接返回 process.env。结果缓存。
 */
let _resolvedShellEnv: NodeJS.ProcessEnv | undefined;
let _resolvingShellEnv: Promise<NodeJS.ProcessEnv> | undefined;
async function resolveShellEnv(): Promise<NodeJS.ProcessEnv> {
    if (_resolvedShellEnv) { return _resolvedShellEnv; }
    if (_resolvingShellEnv) { return _resolvingShellEnv; }

    _resolvingShellEnv = new Promise<NodeJS.ProcessEnv>((resolve) => {
        if (process.platform === 'win32') {
            _resolvedShellEnv = { ...process.env };
            resolve(_resolvedShellEnv);
            return;
        }
        const { spawn } = require('child_process') as typeof import('child_process');
        const shell = process.env.SHELL || '/bin/bash';
        const child = spawn(shell, ['-l', '-i', '-c', 'env -0'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
        });

        let stdout = '';
        child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
        child.stderr?.on('data', () => { /* ignore noisy interactive shell warnings */ });

        const timeout = setTimeout(() => { child.kill('SIGKILL'); }, 10000);

        child.on('close', () => {
            clearTimeout(timeout);
            const env: NodeJS.ProcessEnv = { ...process.env };
            if (stdout) {
                for (const entry of stdout.split('\0')) {
                    const eqIndex = entry.indexOf('=');
                    if (eqIndex > 0) {
                        env[entry.substring(0, eqIndex)] = entry.substring(eqIndex + 1);
                    }
                }
            }
            _resolvedShellEnv = env;
            resolve(env);
        });

        child.on('error', () => {
            clearTimeout(timeout);
            _resolvedShellEnv = { ...process.env };
            resolve(_resolvedShellEnv);
        });

        child.stdin?.end();
    });

    return _resolvingShellEnv;
}

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
    if (!headers) { return {}; }
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        normalized[key.toLowerCase()] = value;
    }
    return normalized;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) { return error.message; }
    return String(error);
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// ─── McpHub 类 ─────────────────────────────────────────

export class McpHub {
    private disposables: vscode.Disposable[] = [];
    connections: McpConnection[] = [];
    isConnecting: boolean = false;
    private notifyCallback: McpNotifyCallback;
    // 配置文件写入锁，防止并发读写竞态
    private configLock: Promise<void> = Promise.resolve();

    constructor(notifyCallback: McpNotifyCallback) {
        this.notifyCallback = notifyCallback;
    }

    /**
     * 使用 Promise 链实现简易互斥锁，确保配置文件读写操作串行执行
     * @param fn 需要串行执行的异步操作
     */
    private async withConfigLock<T>(fn: () => Promise<T>): Promise<T> {
        let release: () => void;
        const waitForLock = this.configLock;
        this.configLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        await waitForLock;
        try {
            return await fn();
        } finally {
            release!();
        }
    }

    /**
     * 启动 McpHub：注册文件监听 + 初始化 MCP servers。
     * 应在确认项目已初始化后调用（如 startTCPServer 时），
     * 避免构造时过早创建 .y3maker 目录。
     */
    async start(): Promise<void> {
        this.watchMcpSettingsFile();
        await this.initializeMcpServers();
    }

    // ─── 配置文件路径 ───────────────────────────────

    async getMcpSettingsFilePath(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error("No workspace folder found");
        }
        const settingsDir = path.join(workspaceFolder.uri.fsPath, ".y3maker");
        const settingsPath = path.join(settingsDir, "mcp_settings.json");

        if (!(await fileExists(settingsPath))) {
            await fs.mkdir(settingsDir, { recursive: true });
            await fs.writeFile(settingsPath, JSON.stringify({ mcpServers: {} }, null, 2));
        }
        return settingsPath;
    }

    // ─── 配置文件监听 ───────────────────────────────

    private async watchMcpSettingsFile(): Promise<void> {
        try {
            const settingsPath = await this.getMcpSettingsFilePath();
            this.disposables.push(
                vscode.workspace.onDidSaveTextDocument(async (document) => {
                    if (document.uri.fsPath === settingsPath) {
                        const content = await fs.readFile(settingsPath, "utf-8");
                        const result = this.parseMCPConfig(content);
                        if (!result.success || !result.data) { return; }
                        try {
                            vscode.window.showInformationMessage("MCP servers 更新中");
                            console.log("[McpHub] MCP servers 更新中");
                            await this.updateServerConnections(result.data.mcpServers || {});
                            vscode.window.showInformationMessage("MCP servers 已更新");
                            console.log("[McpHub] MCP servers 已更新");
                        } catch (error) {
                            console.error("[McpHub] MCP servers 更新异常:", getErrorMessage(error));
                            vscode.window.showErrorMessage(
                                "MCP servers 更新异常: " + getErrorMessage(error),
                            );
                        }
                    }
                }),
            );
        } catch (error) {
            console.error("[McpHub] Failed to watch MCP settings file:", getErrorMessage(error));
        }
    }

    // ─── 获取 servers ────────────────────────────────

    getServers(): McpServer[] {
        return this.connections.filter((conn) => !conn.server.disabled).map((conn) => conn.server);
    }

    // ─── 初始化 ──────────────────────────────────────

    private async initializeMcpServers(): Promise<void> {
        try {
            const result = await this.getMcpServersConfig({ silent: true });
            if (!result.success || !result.mcpServers) { return; }
            console.log("[McpHub] MCP servers 初始化中");
            await this.updateServerConnections(result.mcpServers);
            console.log("[McpHub] MCP servers 已初始化");
        } catch (error) {
            console.error("[McpHub] 初始化 MCP servers 失败:", getErrorMessage(error));
        }
    }

    // ─── 核心连接方法 ────────────────────────────────

    private async connectToServer(name: string, config: z.infer<typeof ServerConfigSchema>): Promise<void> {
        this.connections = this.connections.filter((conn) => conn.server.name !== name);

        const placeholderConnection: McpConnection = {
            server: {
                name,
                config: JSON.stringify(config),
                status: "connecting",
                disabled: false,
                error: "",
            },
            client: null as any,
            transport: null as any,
        };
        this.connections.push(placeholderConnection);

        let parsedConfig: z.infer<typeof ServerConfigSchema>;
        try {
            parsedConfig = ServerConfigSchema.parse(config);
            placeholderConnection.server.disabled = parsedConfig.disabled;
            placeholderConnection.server.autoApprove = parsedConfig.autoApprove;
            placeholderConnection.server.status = parsedConfig.disabled ? "disconnected" : "connecting";
        } catch (error) {
            placeholderConnection.server.status = "disconnected";
            placeholderConnection.server.error = getErrorMessage(error);
            throw error;
        }

        const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

        try {
            const client = new Client(
                { name: "Y3Helper", version: "1.0.0" },
                { capabilities: {} },
            );

            let transport: Transport;

            switch (config.type) {
                case "stdio": {
                    const resolveWorkspaceVars = (value: string): string =>
                        value.replace(/\$\{WORKSPACE\}/g, workspace);

                    const shellEnv = await resolveShellEnv();
                    transport = new StdioClientTransport({
                        command: resolveWorkspaceVars(config.command || ""),
                        args: config.args?.map(resolveWorkspaceVars),
                        env: {
                            ...shellEnv,
                            ...(config.env || {}),
                            WORKSPACE: encodeURIComponent(workspace),
                            ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
                        },
                        stderr: "pipe",
                    });

                    transport.onerror = async (error) => {
                        console.error(`[McpHub] Transport error for "${name}":`, error);
                        const connection = this.connections.find((conn) => conn.server.name === name);
                        if (connection) {
                            this.appendErrorMessage(connection, error.message);
                        }
                    };

                    transport.onclose = async () => {
                        console.log(`Transport closed for "${name}"`);
                    };

                    if (!parsedConfig.disabled) {
                        await transport.start();
                        const stderrStream = transport.stderr;
                        if (stderrStream) {
                            stderrStream.on("data", async (data: Buffer) => {
                                let output: string;
                                try {
                                    output = data.toString("utf-8");
                                    if (output.includes("\uFFFD")) {
                                        throw new Error("UTF-8 decode failed");
                                    }
                                } catch {
                                    try {
                                        output = iconv.decode(data, "gbk");
                                    } catch {
                                        try {
                                            output = iconv.decode(data, "gb2312");
                                        } catch {
                                            output = data.toString("latin1");
                                        }
                                    }
                                }
                                console.error(`[McpHub] Server "${name}" stderr:`, output);
                                const connection = this.connections.find((conn) => conn.server.name === name);
                                if (connection) {
                                    this.appendErrorMessage(connection, output);
                                    if (connection.server.status === "disconnected") {
                                        await this.notifyWebviewOfServerChanges();
                                    }
                                }
                            });
                        }
                        transport.start = async () => {};
                    }
                    break;
                }
                case "sse": {
                    const normalizedConfigHeaders = normalizeHeaders(config.headers);
                    const sseOptions: SSEClientTransportOptions = {
                        requestInit: {
                            headers: {
                                workspace: encodeURIComponent(workspace),
                                "user-agent": USER_AGENT,
                                ...normalizedConfigHeaders,
                            },
                        },
                    };
                    const reconnectingEventSourceOptions = {
                        max_retry_time: 5000,
                        withCredentials: !!normalizedConfigHeaders["authorization"],
                    };
                    transport = new SSEClientTransport(new URL(config.url), {
                        ...sseOptions,
                        eventSourceInit: reconnectingEventSourceOptions,
                    });

                    transport.onerror = async (error) => {
                        console.error(`[McpHub] Transport error for "${name}":`, error);
                        const connection = this.connections.find((conn) => conn.server.name === name);
                        if (connection) {
                            this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`);
                        }
                    };
                    break;
                }
                case "streamableHttp": {
                    const normalizedConfigHeaders = normalizeHeaders(config.headers);
                    const httpOptions: StreamableHTTPClientTransportOptions = {
                        requestInit: {
                            headers: {
                                workspace: encodeURIComponent(workspace),
                                "user-agent": USER_AGENT,
                                ...normalizedConfigHeaders,
                            },
                        },
                    };
                    transport = new StreamableHTTPClientTransport(new URL(config.url), httpOptions);

                    transport.onerror = async (error) => {
                        console.error(`[McpHub] Transport error for "${name}":`, error);
                        const connection = this.connections.find((conn) => conn.server.name === name);
                        if (connection) {
                            this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`);
                        }
                    };
                    break;
                }
                default:
                    throw new Error(`Unknown transport type: ${(config as any).type}`);
            }

            placeholderConnection.client = client;
            placeholderConnection.transport = transport;

            if (parsedConfig.disabled) { return; }

            await client.connect(transport);
            placeholderConnection.server.status = "connected";
            placeholderConnection.server.error = "";

            placeholderConnection.server.tools = await this.fetchToolsList(name);
            placeholderConnection.server.resources = await this.fetchResourcesList(name);
            placeholderConnection.server.resourceTemplates = await this.fetchResourceTemplatesList(name);
            placeholderConnection.server.prompts = await this.fetchPromptsList(name);
        } catch (error) {
            const connection = this.connections.find((conn) => conn.server.name === name);
            if (connection) {
                connection.server.status = "disconnected";
                this.appendErrorMessage(connection, getErrorMessage(error));
            }
            throw error;
        }
    }

    private appendErrorMessage(connection: McpConnection, error: string) {
        // 优化 fetch failed 等连接错误的提示信息
        const friendlyError = this.getFriendlyErrorMessage(connection.server.name, error);
        // 避免重复追加相同的错误信息（transport.onerror 和 catch 块可能触发同一错误）
        if (connection.server.error?.includes(friendlyError)) {
            return;
        }
        connection.server.error = connection.server.error
            ? `${connection.server.error}\n${friendlyError}`
            : friendlyError;
    }

    /**
     * 在实际调用（callTool / readResource / getPrompt 等）失败时，
     * 判断是否属于连接级别的错误，若是则将状态标记为 disconnected 并通知 UI。
     */
    private handleTransportError(connection: McpConnection, error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTransportError =
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('ECONNRESET') ||
            errorMessage.includes('EPIPE') ||
            errorMessage.includes('Client has already been closed') ||
            errorMessage.includes('Not connected') ||
            errorMessage.includes('Connection closed') ||
            errorMessage.includes('transport') ||
            errorMessage.includes('SSE stream disconnected');

        if (isTransportError && connection.server.status === 'connected') {
            console.log(`[McpHub] MCP server "${connection.server.name}" 调用时发现连接已断开: ${errorMessage}`);
            connection.server.status = 'disconnected';
            this.appendErrorMessage(connection, errorMessage);
            this.notifyWebviewOfServerChanges();
        }
    }

    /**
     * 将原始错误信息转换为用户友好的提示
     */
    private getFriendlyErrorMessage(serverName: string, error: string): string {
        // fetch failed / ECONNREFUSED 通常意味着目标服务未启动
        if (/fetch failed|ECONNREFUSED/i.test(error)) {
            if (serverName === "y3editor") {
                return `无法连接到 Y3 编辑器 MCP 服务，请确认 Y3 编辑器已打开`;
            }
            return `无法连接到 ${serverName} 服务，请确认对应服务已启动`;
        }
        return error;
    }

    // ─── 获取工具/资源/模板/Prompt 列表 ──────────────

    private async fetchToolsList(serverName: string): Promise<McpTool[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "tools/list" }, ListToolsResultSchema);

            const configResult = await this.getMcpServersConfig({ silent: true });
            const autoApproveConfig = configResult.mcpServers?.[serverName]?.autoApproveTools || [];

            return (response?.tools || []).map((tool) => ({
                ...tool,
                autoApprove: autoApproveConfig.includes(tool.name),
            }));
        } catch {
            return [];
        }
    }

    private async fetchResourcesList(serverName: string): Promise<McpResource[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "resources/list" }, ListResourcesResultSchema);
            return (response?.resources || []) as McpResource[];
        } catch {
            return [];
        }
    }

    private async fetchResourceTemplatesList(serverName: string): Promise<McpResourceTemplate[]> {
        try {
            const response = await this.connections
                .find((conn) => conn.server.name === serverName)
                ?.client.request({ method: "resources/templates/list" }, ListResourceTemplatesResultSchema);
            return response?.resourceTemplates || [];
        } catch {
            return [];
        }
    }

    private async fetchPromptsList(serverName: string): Promise<McpPrompt[]> {
        try {
            const connection = this.connections.find((conn) => conn.server.name === serverName);
            if (!connection) { return []; }

            const prompts: McpPrompt[] = [];
            let cursor: string | undefined = undefined;

            do {
                const response = await connection.client.request(
                    cursor ? { method: "prompts/list", params: { cursor } } : { method: "prompts/list" },
                    ListPromptsResultSchema as any,
                ) as any;
                prompts.push(...(response?.prompts || []));
                cursor = response?.nextCursor || undefined;
            } while (cursor);

            return prompts;
        } catch {
            return [];
        }
    }

    // ─── 连接生命周期管理 ────────────────────────────

    async deleteConnection(name: string): Promise<void> {
        const connection = this.connections.find((conn) => conn.server.name === name);
        if (connection) {
            try {
                if (connection.transport) { await connection.transport.close(); }
                if (connection.client) { await connection.client.close(); }
            } catch (error) {
                console.error(`[McpHub] Failed to close transport for ${name}:`, error);
            }
            this.connections = this.connections.filter((conn) => conn.server.name !== name);
        }
    }

    async updateServerConnections(newServers: Record<string, any>, force?: boolean): Promise<void> {
        this.isConnecting = true;
        const currentNames = new Set(this.connections.map((conn) => conn.server.name));
        const newNames = new Set(Object.keys(newServers));
        const failedServers: string[] = [];

        // 删除已移除的 server
        for (const name of currentNames) {
            if (!newNames.has(name)) {
                await this.deleteConnection(name);
                console.log(`[McpHub] Deleted MCP server: ${name}`);
            }
        }

        // 新增或更新 server
        for (const [name, config] of Object.entries(newServers)) {
            const currentConnection = this.connections.find((conn) => conn.server.name === name);

            if (!currentConnection) {
                try {
                    await this.connectToServer(name, config);
                } catch (error) {
                    console.error(`[McpHub] MCP server ${name} 连接失败:`, getErrorMessage(error));
                    failedServers.push(name);
                }
            } else if (!deepEqual(JSON.parse(currentConnection.server.config), config)) {
                try {
                    await this.deleteConnection(name);
                    await this.connectToServer(name, config);
                    console.log(`[McpHub] MCP server ${name} 配置更新并重启`);
                } catch (error) {
                    console.error(`[McpHub] MCP server ${name} 重启失败:`, getErrorMessage(error));
                    failedServers.push(name);
                }
            } else if (force) {
                try {
                    await this.deleteConnection(name);
                    await this.connectToServer(name, config);
                    console.log(`[McpHub] MCP server ${name} 已重启`);
                } catch (error) {
                    console.error(`[McpHub] MCP server ${name} 重启失败:`, getErrorMessage(error));
                    failedServers.push(name);
                }
            }
        }

        await this.notifyWebviewOfServerChanges();
        this.isConnecting = false;

        if (failedServers.length > 0) {
            const errorMessage = `部分 MCP servers 启动失败: ${failedServers.join(", ")}`;
            console.error(`[McpHub] ${errorMessage}`);
            throw new Error(errorMessage);
        }
    }

    async restartConnection(serverName: string): Promise<void> {
        this.isConnecting = true;
        const connection = this.connections.find((conn) => conn.server.name === serverName);

        if (connection) {
            vscode.window.showInformationMessage(`正在重启 MCP server: ${serverName}`);
            connection.server.status = "connecting";
            connection.server.error = "";
            await this.notifyWebviewOfServerChanges();
            await delay(500);

            try {
                const result = await this.getMcpServersConfig();
                if (!result.success || !result.mcpServers) {
                    throw new Error("无法读取 MCP 配置文件");
                }
                const config = result.mcpServers[serverName];
                if (!config) {
                    throw new Error(`配置文件中未找到服务器 "${serverName}"`);
                }
                await this.deleteConnection(serverName);
                await this.connectToServer(serverName, config);
                vscode.window.showInformationMessage(`MCP server 已连接: ${serverName}`);
            } catch (error) {
                console.error(`[McpHub] MCP server ${serverName} 重启失败:`, getErrorMessage(error));
                vscode.window.showErrorMessage(`MCP server ${serverName} 重启失败: ${getErrorMessage(error)}`);
            }
        }

        await this.notifyWebviewOfServerChanges();
        this.isConnecting = false;
    }

    async restartAllConnections(): Promise<void> {
        vscode.window.showInformationMessage("重启 MCP servers");
        console.log("[McpHub] 重启 MCP servers");

        const result = await this.getMcpServersConfig();
        if (!result.success || !result.mcpServers) {
            vscode.window.showErrorMessage("MCP servers 重启异常: " + (result.error || "配置解析失败"));
            return;
        }

        try {
            await this.updateServerConnections(result.mcpServers, true);
            console.log("[McpHub] MCP servers 状态已更新");
            vscode.window.showInformationMessage("MCP servers 状态已更新");
        } catch (error) {
            vscode.window.showErrorMessage("MCP servers 重启异常: " + getErrorMessage(error));
        }
    }

    async pingMcpServers(): Promise<void> {
        try {
            const result = await this.getMcpServersConfig({ silent: true });
            if (!result.success || !result.mcpServers) {
                throw new Error("MCP 配置解析失败");
            }
            for (const [name, config] of Object.entries(result.mcpServers)) {
                try {
                    const server = this.connections.find((conn) => conn.server.name === name)?.server;
                    if (!server?.disabled && server?.status === "disconnected") {
                        await this.deleteConnection(name);
                        await this.connectToServer(name, config);
                    }
                } catch { /* ignore */ }
            }
        } finally {
            this.notifyWebviewOfServerChanges();
        }
    }

    // ─── 配置解析 ────────────────────────────────────

    private parseMCPConfig(content: string, options?: { silent?: boolean }) {
        if (!content) {
            return { success: false as const, error: "MCP 配置文件为空", data: null };
        }
        let config: any;
        try {
            config = JSON.parse(content);
        } catch (error) {
            if (!options?.silent) {
                vscode.window.showErrorMessage("MCP 配置解析失败: " + getErrorMessage(error));
            }
            return { success: false as const, error: getErrorMessage(error), data: null };
        }
        const result = McpSettingsSchema.safeParse(config);
        if (!result.success) {
            if (!options?.silent) {
                vscode.window.showErrorMessage("MCP 配置格式有误: " + result.error.toString());
            }
        }
        return result;
    }

    async getMcpServersConfig(options?: { silent?: boolean }): Promise<{
        success: boolean;
        error?: string;
        mcpServers: Record<string, z.infer<typeof ServerConfigSchema>> | null;
    }> {
        try {
            const settingsPath = await this.getMcpSettingsFilePath();
            const content = await fs.readFile(settingsPath, "utf-8");
            const result = this.parseMCPConfig(content, options);

            if (!result.success || !result.data) {
                return {
                    success: false,
                    error: result.error?.toString() || "配置解析失败",
                    mcpServers: null,
                };
            }

            return {
                success: true,
                mcpServers: result.data.mcpServers || {},
            };
        } catch (error) {
            if (!options?.silent) {
                console.error("[McpHub] 读取 MCP 配置失败:", getErrorMessage(error));
            }
            return { success: false, error: getErrorMessage(error), mcpServers: null };
        }
    }

    // ─── WebView 通知 ────────────────────────────────

    private async notifyWebviewOfServerChanges(): Promise<void> {
        this.notifyCallback({
            type: "SYNC_MCP_SERVERS",
            data: {
                servers: this.connections.map((conn) => ({
                    name: conn.server.name,
                    status: conn.server.status,
                    error: conn.server.error,
                    tools: conn.server.tools,
                    resources: conn.server.resources,
                    resourceTemplates: conn.server.resourceTemplates,
                    prompts: conn.server.prompts,
                    disabled: conn.server.disabled,
                    autoApprove: conn.server.autoApprove,
                    config: conn.server.config ? JSON.parse(conn.server.config) : null,
                })),
            },
        });
    }

    async sendLatestMcpServers(): Promise<void> {
        await this.notifyWebviewOfServerChanges();
    }

    // ─── 自动重试 ────────────────────────────────────

    /**
     * 判断错误是否属于「会话已失效、重建连接可恢复」的类型。
     * SSE transport 在服务端重启后，EventSource 会自动重连 SSE 流，但 SDK
     * 不会重新读取新的 endpoint，client 仍往旧 sessionId POST，服务端通常
     * 回 -32602 Invalid request parameters / Session not found。
     */
    private isSessionExpiredError(error: unknown, connection: McpConnection): boolean {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        if (errorMessage.includes("SessionExpired") || errorMessage.includes("HTTP 401")) {
            return true;
        }
        if (connection.transport instanceof SSEClientTransport && (
            errorMessage.includes("-32602") ||
            errorMessage.includes("Invalid request parameters") ||
            errorMessage.includes("Session not found") ||
            errorMessage.includes("Bad Request")
        )) {
            return true;
        }
        return false;
    }

    private async executeWithRetry<T>(
        serverName: string,
        operation: (connection: McpConnection) => Promise<T>,
        options?: {
            noConnectionErrorMessage?: string;
        },
    ): Promise<T> {
        let connection = this.connections.find((conn) => conn.server.name === serverName);
        if (!connection) {
            throw new Error(options?.noConnectionErrorMessage || `No connection found for server: ${serverName}`);
        }
        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`);
        }

        try {
            return await operation(connection);
        } catch (error) {
            if (this.isSessionExpiredError(error, connection)) {
                console.log(`[McpHub] Session expired for ${serverName}, reconnecting...`);
                await this.restartConnection(serverName);
                const retriedConnection = this.connections.find((conn) => conn.server.name === serverName);
                if (retriedConnection && !retriedConnection.server.disabled && retriedConnection.server.status === 'connected') {
                    return await operation(retriedConnection);
                }
            }
            if (connection) {
                await this.handleTransportError(connection, error);
            }
            throw error;
        }
    }

    // ─── 公共 API: 工具调用 / 资源读取 / Prompt ─────

    async callTool(serverName: string, toolName: string, toolArguments?: Record<string, unknown>): Promise<any> {
        return this.executeWithRetry(
            serverName,
            async (connection) => {
                let timeout = secondsToMs(DEFAULT_MCP_TIMEOUT_SECONDS);
                try {
                    const config = JSON.parse(connection.server.config);
                    const parsedConfig = ServerConfigSchema.parse(config);
                    timeout = secondsToMs(parsedConfig.timeout);
                } catch { /* use default */ }

                console.log(`[McpHub] Calling ${serverName}.${toolName} (timeout: ${msToSeconds(timeout)}s)`);

                const result = await connection.client.request(
                    { method: "tools/call", params: { name: toolName, arguments: toolArguments } },
                    CallToolResultSchema,
                    { timeout },
                );

                return { ...result, content: result.content ?? [] };
            },
            {
                noConnectionErrorMessage: `No connection found for server: ${serverName}. Available: ${this.connections.map(c => c.server.name).join(", ")}`,
            },
        );
    }

    async readResource(serverName: string, uri: string): Promise<McpResourceResponse> {
        const connection = this.connections.find((conn) => conn.server.name === serverName);
        if (!connection) {
            throw new Error(`No connection found for server: ${serverName}`);
        }
        if (connection.server.disabled) {
            throw new Error(`Server "${serverName}" is disabled`);
        }

        try {
            return await connection.client.request(
                { method: "resources/read", params: { uri } },
                ReadResourceResultSchema,
            );
        } catch (error) {
            await this.handleTransportError(connection, error);
            throw error;
        }
    }

    async getPrompt(serverName: string, promptName: string, promptArguments?: Record<string, unknown>): Promise<McpPromptResult> {
        return this.executeWithRetry(serverName, async (connection) => {
            const sanitizedArgs = promptArguments
                ? Object.fromEntries(
                    Object.entries(promptArguments).filter(([, value]) => value !== undefined && value !== null),
                )
                : undefined;

            const params: { name: string; arguments?: Record<string, unknown> } = { name: promptName };
            if (sanitizedArgs && Object.keys(sanitizedArgs).length > 0) {
                params.arguments = sanitizedArgs;
            }

            return await connection.client.request(
                { method: "prompts/get", params },
                GetPromptResultSchema,
            );
        });
    }

    // ─── 公共 API: 配置管理 ──────────────────────────

    async addMcpServer(serverData: { name: string; [key: string]: any }): Promise<void> {
        try {
            // 使用锁保护配置文件读写，防止并发竞态
            const config = await this.withConfigLock(async () => {
                const settingsPath = await this.getMcpSettingsFilePath();
                const content = await fs.readFile(settingsPath, "utf-8");
                const config = JSON.parse(content);

                if (!config.mcpServers) { config.mcpServers = {}; }
                const { name, ...serverConfig } = serverData;
                config.mcpServers[name] = { ...serverConfig };
                await fs.writeFile(settingsPath, JSON.stringify(config, null, 2));
                return config;
            });

            const { name } = serverData;
            this.notifyCallback({
                type: "NOTIFY_MCP_SERVER_SUCCESS",
                data: { message: `MCP 服务器 "${name}" 已成功添加` },
            });

            try {
                vscode.window.showInformationMessage("MCP servers 更新中");
                await this.updateServerConnections(config.mcpServers);
                vscode.window.showInformationMessage("MCP servers 已更新");
                console.log(`[McpHub] MCP server "${name}" 已添加并连接`);
            } catch (error) {
                console.error(`[McpHub] MCP server "${name}" 添加成功但连接失败:`, getErrorMessage(error));
            }
        } catch (error) {
            vscode.window.showErrorMessage(`添加 MCP server 失败: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async upDataMcpConfig(serverData: any): Promise<void> {
        const serverName = serverData.name;
        const originalName = serverData.originalName;
        if (!serverName) {
            throw new Error("Server name is required");
        }

        try {
            // 使用锁保护配置文件读写，防止并发竞态
            const currentConfig = await this.withConfigLock(async () => {
                const settingsPath = await this.getMcpSettingsFilePath();
                const content = await fs.readFile(settingsPath, "utf-8");
                const currentConfig = JSON.parse(content);

                if (!currentConfig.mcpServers) { currentConfig.mcpServers = {}; }

                if (originalName && originalName !== serverName) {
                    if (currentConfig.mcpServers[originalName]) {
                        delete currentConfig.mcpServers[originalName];
                    }
                }

                if (serverData.mcpServers) {
                    currentConfig.mcpServers = { ...currentConfig.mcpServers, ...serverData.mcpServers };
                } else {
                    const { name, originalName: _, status, error, tools, resources, resourceTemplates, prompts, ...serverConfig } = serverData;
                    currentConfig.mcpServers[serverName] = {
                        ...currentConfig.mcpServers[serverName],
                        ...serverConfig,
                    };
                }

                await fs.writeFile(settingsPath, JSON.stringify(currentConfig, null, 2));
                return currentConfig;
            });

            const successMessage = originalName && originalName !== serverName
                ? `MCP 服务器 "${originalName}" 已重命名为 "${serverName}"`
                : `MCP 服务器 "${serverName}" 已更新`;
            this.notifyCallback({
                type: "NOTIFY_MCP_SERVER_SUCCESS",
                data: { message: successMessage },
            });

            try {
                vscode.window.showInformationMessage("MCP servers 更新中");
                await this.updateServerConnections(currentConfig.mcpServers);
                vscode.window.showInformationMessage("MCP servers 已更新");
                console.log(`[McpHub] ${successMessage}`);
            } catch (error) {
                console.error(`[McpHub] MCP server 配置更新成功但重连失败:`, getErrorMessage(error));
            }

            await this.notifyWebviewOfServerChanges();
        } catch (error) {
            vscode.window.showErrorMessage(`更新 MCP 配置失败: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async removeMcpServer(serverName: string): Promise<void> {
        try {
            // 使用锁保护配置文件读写，防止并发竞态
            await this.withConfigLock(async () => {
                const settingsPath = await this.getMcpSettingsFilePath();
                const content = await fs.readFile(settingsPath, "utf-8");
                const config = JSON.parse(content);

                if (!config.mcpServers || !config.mcpServers[serverName]) {
                    throw new Error(`MCP 服务器 "${serverName}" 不存在`);
                }

                delete config.mcpServers[serverName];
                await fs.writeFile(settingsPath, JSON.stringify(config, null, 2));
            });

            await this.deleteConnection(serverName);

            this.notifyCallback({
                type: "NOTIFY_MCP_SERVER_SUCCESS",
                data: { message: `MCP 服务器 "${serverName}" 已移除` },
            });

            await this.notifyWebviewOfServerChanges();
            console.log(`[McpHub] MCP 服务器 "${serverName}" 已移除`);
        } catch (error) {
            vscode.window.showErrorMessage(`移除 MCP 服务器失败: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async openMCPSettingFile(): Promise<void> {
        try {
            const settingPath = await this.getMcpSettingsFilePath();
            console.log(`[McpHub] MCP 配置文件地址: ${settingPath}`);
            const doc = await vscode.workspace.openTextDocument(settingPath);
            await vscode.window.showTextDocument(doc);
        } catch (err) {
            vscode.window.showErrorMessage(`未能打开 MCP 设置文件: ${getErrorMessage(err)}`);
        }
    }

    // ─── 重置连接（项目切换时清理缓存并重新初始化） ────

    async resetConnections(): Promise<void> {
        console.log("[McpHub] 清理所有 MCP 连接缓存...");
        for (const connection of this.connections) {
            try {
                await this.deleteConnection(connection.server.name);
            } catch (error) {
                console.error(`[McpHub] Failed to close connection for ${connection.server.name}:`, error);
            }
        }
        this.connections = [];
        this.notifyWebviewOfServerChanges();
        console.log("[McpHub] MCP 连接缓存已清理，重新初始化...");
        await this.initializeMcpServers();
    }

    // ─── 清理 ────────────────────────────────────────

    async dispose(): Promise<void> {
        for (const connection of this.connections) {
            try {
                await this.deleteConnection(connection.server.name);
            } catch (error) {
                console.error(`[McpHub] Failed to close connection for ${connection.server.name}:`, error);
            }
        }
        this.connections = [];
        this.disposables.forEach((d) => d.dispose());
    }
}

// ─── 单例管理 ─────────────────────────────────────────

let mcpHub: McpHub | undefined;

export function initMcpHub(notifyCallback: McpNotifyCallback): McpHub {
    if (!mcpHub) {
        mcpHub = new McpHub(notifyCallback);
    }
    return mcpHub;
}

export function getMcpHub(): McpHub | undefined {
    return mcpHub;
}

export function disposeMcpHub(): void {
    mcpHub?.dispose();
    mcpHub = undefined;
}
