import * as path from 'path';
import * as vscode from 'vscode';
import { GameLauncher } from '../launchGame';
import { Client } from '../console/client';
import { LogManager } from './logManager';
import { GameSession, MCPError, MCPErrorCode } from './types';
import * as env from '../env';
import * as tools from '../tools';
import { save as saveGmp } from '../tools/y3SaveGmp';

/**
 * 游戏会话管理器
 * 管理游戏会话生命周期、客户端监控、日志拦截
 */
export class GameSessionManager extends vscode.Disposable {
    private currentSession?: GameSession;
    private clientCheckInterval?: NodeJS.Timeout;
    private isLaunching: boolean = false;  // 启动中标记，防止重复启动
    private cancelLaunch: boolean = false;  // 取消启动标记

    // 超时常量
    private readonly LAUNCH_TIMEOUT_MS = 110000;  // 启动超时时间（110秒）
    private readonly RESTART_TIMEOUT_MS = 60000;  // 快速重启超时时间（60秒）

    constructor() {
        super(() => this.dispose());
        this.startClientMonitoring();
    }

    /**
     * 启动游戏（非阻塞）
     * 立即返回启动状态，通过 get_game_status 轮询启动结果
     * 调用 TypeScript 版本保存 GMP（物编、UI 和语言）
     */
    private async saveGmpBeforeLaunch(): Promise<void> {
        const mapUri = env.env.triggerMapUri ?? env.env.mapUri;
        if (!mapUri) {
            tools.log.warn('[MCP] 未找到地图路径，跳过 GMP 保存');
            return;
        }

        const mapPath = mapUri.fsPath;

        try {
            tools.log.info(`[MCP] 正在保存 GMP (物编 + UI + 语言)...`);
            const result = await saveGmp(mapPath, {
                updatePrefabs: true,
                updateUI: true,
                updateUSLanguage: true,
                updateZHLanguage: true
            });
            
            if (result.success) {
                tools.log.info(`[MCP] GMP 保存完成: ${result.message}`);
            } else {
                tools.log.warn(`[MCP] GMP 保存失败: ${result.message}`);
            }
        } catch (error) {
            // 保存失败不阻止游戏启动，只记录警告
            tools.log.warn(`[MCP] GMP 保存失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 启动游戏
     */
    async launchGame(options: any = {}): Promise<any> {

        // 检查是否正在启动中
        if (this.isLaunching) {
            return {
                success: true,
                status: 'launching',
                session_id: this.currentSession?.id || null,
                message: 'Game is already launching, please wait. Use get_game_status to check progress.'
            };
        }

        // 检查是否已有游戏客户端连接
        if (Client.allClients.length > 0) {
            // 如果当前没有会话但有客户端，重新绑定
            if (!this.currentSession || this.currentSession.status === 'stopped') {
                const sessionId = `session_${Date.now()}`;
                const logManager = new LogManager(sessionId);
                const session: GameSession = {
                    id: sessionId,
                    launcher: new GameLauncher(),
                    logManager,
                    status: 'running',
                    startTime: Date.now()
                };
                this.currentSession = session;
                this.attachClient(session, Client.allClients[Client.allClients.length - 1]);
            }
            return {
                success: true,
                session_id: this.currentSession!.id,
                status: 'running',
                message: 'Game is already running'
            };
        }

        // 如果已有运行中的会话，先停止
        if (this.currentSession && this.currentSession.status !== 'stopped') {
            await this.stopGame();
        }

        // 设置启动标记（必须在 await 之前，防止并发调用通过检查）
        this.isLaunching = true;
        this.cancelLaunch = false;

        try {
            // 等待环境就绪
            await env.env.editorReady();
            await env.env.mapReady();

            // 检查是否在等待期间被取消
            if (this.cancelLaunch) {
                this.isLaunching = false;
                return {
                    success: false,
                    status: 'stopped',
                    message: 'Game launch was cancelled'
                };
            }
        } catch (error) {
            // 环境初始化失败，清除启动标记
            this.isLaunching = false;
            throw error;
        }

        // 创建会话
        const sessionId = `session_${Date.now()}`;
        const logManager = new LogManager(sessionId);

        const session: GameSession = {
            id: sessionId,
            launcher: new GameLauncher(),
            logManager,
            status: 'launching',
            startTime: Date.now()
        };

        this.currentSession = session;

        // 非阻塞启动：在后台执行启动流程，捕获未预期的异常
        this.launchGameAsync(session, options).catch(error => {
            tools.log.error(`[MCP] Unexpected error in launchGameAsync: ${error}`);
            session.status = 'stopped';
            session.errorMessage = `Unexpected error during launch: ${error instanceof Error ? error.message : String(error)}`;
            this.isLaunching = false;
        });

        return {
            success: true,
            session_id: sessionId,
            status: 'launching',
            message: 'Game is launching. Use get_game_status to check when it is ready.'
        };
    }

    /**
     * 异步启动游戏（后台执行）
     */
    private async launchGameAsync(session: GameSession, options: any): Promise<void> {
        try {
            // 检查是否被取消
            if (this.cancelLaunch) {
                session.status = 'stopped';
                session.errorMessage = 'Launch cancelled';
                this.isLaunching = false;
                return;
            }

            const luaArgs: Record<string, string> = {};

            // 启动游戏
            await session.launcher.launch({
                luaArgs,
                multi: options.multi_mode ? options.multi_players : undefined,
                tracy: options.tracy || false
            });

            // 再次检查是否被取消
            if (this.cancelLaunch) {
                session.status = 'stopped';
                session.errorMessage = 'Launch cancelled';
                this.isLaunching = false;
                return;
            }

            // 等待客户端连接（最多 110 秒，考虑到部分电脑启动较慢）
            const connected = await this.waitForClient(session, this.LAUNCH_TIMEOUT_MS);

            if (!connected) {
                session.status = 'stopped';
                session.errorMessage = 'Game launched but client connection timeout (waited 110 seconds)';
                tools.log.error(`[MCP] ${session.errorMessage}`);
                this.isLaunching = false;
                return;
            }
        } catch (error) {
            session.status = 'stopped';
            session.errorMessage = error instanceof Error ? error.message : String(error);
            tools.log.error(`[MCP] 游戏启动失败: ${session.errorMessage}`);
        } finally {
            this.isLaunching = false;
        }
    }

    /**
     * 等待客户端连接
     */
    private async waitForClient(session: GameSession, timeout: number): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            // 检查客户端是否已连接且状态为 running
            // attachClient 会设置 client 并将状态改为 running（适用于 launching 和 restarting）
            if (session.client && session.status === 'running') {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return false;
    }

    /**
     * 监控客户端连接
     */
    private startClientMonitoring(): void {
        this.clientCheckInterval = setInterval(() => {
            if (this.currentSession) {
                // 检查新客户端连接（启动或重启后）
                if ((this.currentSession.status === 'launching' || this.currentSession.status === 'restarting')
                    && !this.currentSession.client) {
                    const latestClient = Client.allClients[Client.allClients.length - 1];
                    if (latestClient) {
                        this.attachClient(this.currentSession, latestClient);
                    }
                }

                // 检查客户端断开
                if (this.currentSession.status === 'running' && this.currentSession.client) {
                    // 检查客户端是否还在 allClients 数组中
                    const clientExists = Client.allClients.includes(this.currentSession.client);
                    if (!clientExists) {
                        tools.log.info(`[MCP] Client disconnected from session ${this.currentSession.id}`);
                        this.currentSession.status = 'stopped';
                        this.currentSession.client = undefined;
                    }
                }

                // 检查重启后的重新连接
                if (this.currentSession.status === 'restarting' && this.currentSession.client) {
                    // 检查客户端是否断开
                    const clientExists = Client.allClients.includes(this.currentSession.client);
                    if (!clientExists) {
                        tools.log.info(`[MCP] Client disconnected during restart, waiting for reconnection...`);
                        this.currentSession.client = undefined;
                    }
                }
            }
        }, 500);
    }

    /**
     * 附加客户端并拦截日志
     */
    private attachClient(session: GameSession, client: Client): void {
        session.client = client;
        session.status = 'running';

        tools.log.info(`[MCP] Client attached to session ${session.id}`);

        // 拦截 print 方法
        const originalPrint = client.print.bind(client);
        client.print = (msg: string) => {
            session.logManager.appendLog(msg);
            return originalPrint(msg);
        };

        // 注意：Client 类没有 onDidDispose 方法
        // 客户端断开会通过 Client.allClients 数组的变化来检测
    }

    /**
     * 获取游戏状态
     */
    getGameStatus(): any {
        const hasConnectedClient = Client.allClients.length > 0;

        // 如果正在启动中，返回启动状态
        if (this.isLaunching) {
            return {
                running: false,
                session_id: this.currentSession?.id || null,
                status: 'launching',
                message: 'Game is launching, please wait...',
                error: this.currentSession?.errorMessage || undefined
            };
        }

        if (!this.currentSession) {
            if (hasConnectedClient) {
                return {
                    running: true,
                    session_id: null,
                    status: 'running',
                    message: 'Game is running (connected client detected, no MCP session)'
                };
            }
            return {
                running: false,
                session_id: null,
                status: 'no_session'
            };
        }

        return {
            running: this.currentSession.status === 'running' || hasConnectedClient,
            session_id: this.currentSession.id,
            status: this.currentSession.status,
            uptime: Date.now() - this.currentSession.startTime,
            client_connected: hasConnectedClient,
            error: this.currentSession.errorMessage || undefined
        };
    }

    /**
     * 获取日志
     */
    async getLogs(params: any = {}): Promise<any> {
        if (!this.currentSession) {
            return {
                success: false,
                message: 'No active session'
            };
        }

        const limit = params.limit || 100;
        const logs = await this.currentSession.logManager.readLogs(limit);

        return {
            success: true,
            log_count: logs.length,
            logs: logs.join('\n')
        };
    }

    /**
     * 执行 Lua 代码
     */
    async executeLua(params: any): Promise<any> {
        if (!this.currentSession) {
            throw new MCPError(
                '没有活动的游戏会话',
                MCPErrorCode.SESSION_NOT_FOUND
            );
        }

        if (!this.currentSession.client) {
            throw new MCPError(
                '游戏客户端未连接',
                MCPErrorCode.CLIENT_NOT_CONNECTED
            );
        }

        const { code } = params;
        if (!code) {
            return {
                success: false,
                message: 'No code provided'
            };
        }

        // 记录执行前的日志行数
        const logsBefore = await this.currentSession.logManager.readLogs(10000);
        const linesBefore = logsBefore.length;

        // 发送 Lua 代码
        this.currentSession.client.notify('command', { data: code });

        // 等待 1 秒收集输出
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取新增的日志
        const logsAfter = await this.currentSession.logManager.readLogs(10000);
        const newLogs = logsAfter.slice(linesBefore);

        return {
            success: true,
            output: newLogs.join('\n')
        };
    }

    /**
     * 快速重启游戏（.rr 命令）
     */
    async quickRestart(): Promise<any> {

        if (!this.currentSession) {
            throw new MCPError(
                '没有活动的游戏会话',
                MCPErrorCode.SESSION_NOT_FOUND
            );
        }

        if (!this.currentSession.client) {
            throw new MCPError(
                '游戏客户端未连接',
                MCPErrorCode.CLIENT_NOT_CONNECTED
            );
        }

        // 记录执行前的日志行数
        const logsBefore = await this.currentSession.logManager.readLogs(10000);
        const linesBefore = logsBefore.length;

        // 设置为重启状态
        this.currentSession.status = 'restarting';

        // 发送 .rr 命令
        this.currentSession.client.notify('command', { data: '.rr' });

        // 等待客户端重新连接（最多 60 秒，游戏重启可能需要较长时间）
        const reconnected = await this.waitForClient(this.currentSession, this.RESTART_TIMEOUT_MS);

        if (!reconnected) {
            this.currentSession.status = 'stopped';
            this.currentSession.errorMessage = 'Game restart timeout - client did not reconnect within 60 seconds';
            return {
                success: false,
                message: this.currentSession.errorMessage
            };
        }

        // 获取新增的日志
        const logsAfter = await this.currentSession.logManager.readLogs(10000);
        const newLogs = logsAfter.slice(linesBefore);

        return {
            success: true,
            message: 'Game restarted successfully',
            output: newLogs.join('\n')
        };
    }

    /**
     * 停止游戏
     */
    async stopGame(params: any = {}): Promise<any> {
        // 设置取消标记，防止启动过程继续
        this.cancelLaunch = true;
        // 清除启动中状态，防止启动过程中停止后无法重新启动
        this.isLaunching = false;

        if (!this.currentSession) {
            return {
                success: false,
                message: 'No active session'
            };
        }

        const session = this.currentSession;

        // 通过 Lua 代码强制退出游戏
        if (session.client) {
            try {
                // 获取本地玩家并强制退出
                const luaCode = `
                    local player = y3.player:get_local()
                    if player then
                        GameAPI.role_force_quit(player.handle, '游戏已停止')
                    end
                `;
                session.client.notify('command', { data: luaCode });
                // 等待游戏关闭
                await new Promise(resolve => setTimeout(resolve, 1000));

                // 检查客户端是否还存在再 dispose
                if (session.client && typeof session.client.dispose === 'function') {
                    session.client.dispose();
                }
            } catch (err) {
                // 忽略错误，继续清理
            }
        }

        // 更新状态
        session.status = 'stopped';

        // 清理日志管理器
        session.logManager.cleanup();

        // 清除当前会话
        this.currentSession = undefined;

        return {
            success: true,
            message: 'Game stopped'
        };
    }

    /**
     * 捕获游戏截图
     */
    async captureScreenshot(): Promise<any> {
        // 检查是否有活动会话
        if (!this.currentSession || this.currentSession.status === 'stopped') {
            return {
                success: false,
                error: '游戏未运行，请先启动游戏'
            };
        }

        const session = this.currentSession;

        // 检查客户端是否连接
        if (!session.client) {
            return {
                success: false,
                error: '游戏客户端未连接'
            };
        }

        // 检查编辑器路径
        if (!env.env.editorUri) {
            return {
                success: false,
                error: '编辑器路径未找到'
            };
        }

        try {
            // 执行 Lua 代码获取分辨率并截图
            const luaCode = `
            local width = GameAPI.get_game_x_resolution()
            local height = GameAPI.get_game_y_resolution()
            GameAPI.screenshot_func_for_lua("mcp_screenshots", "screenshot", width, height)
        `;

            session.client.notify('command', { data: luaCode });

            // 构建截图文件路径
            const screenshotPath = path.normalize(
                path.join(env.env.editorUri.fsPath, '../LocalData/mcp_screenshots/screenshot.png')
            );

            return {
                success: true,
                screenshot_path: screenshotPath,
                message: `重要提示：如果你需要查看截图内容，请使用合适的 Read 工具读取此文件。如果 Read 工具无法读取图片或返回空内容，请不要猜测图片内容，而应该：1) 明确告知用户"无法读取截图文件"；2) 提供截图文件路径让用户手动查看；3) 不要编造或假设图片中的内容。`
            };
        } catch (error) {
            return {
                success: false,
                error: `截图命令执行失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * 读取 Lua 文件的诊断问题
     * 调用 sumneko.vscode-operator 扩展的 vscodeOperator_readProblems 功能
     * @param params 参数对象
     * @param params.pathGlob 可选的路径过滤模式（glob 格式），会与 **\/*.lua 组合使用
     * @returns 诊断问题列表
     */
    async readProblemsLua(params?: { pathGlob?: string | string[] }): Promise<any> {
        const maxItems = 100;
        const minSeverity = 'warning';
        
        // 构建 pathGlob：始终包含 **/*.lua，如果用户指定了额外路径则组合使用
        let finalPathGlob: string | string[];
        const userPathGlob = params?.pathGlob;
        
        if (userPathGlob) {
            // 用户指定了路径，组合 lua 过滤和用户路径
            // 需要同时匹配当前目录和子目录下的 .lua 文件
            // 例如用户传入 "maps/EntryMap"，则组合为 ["maps/EntryMap/*.lua", "maps/EntryMap/**/*.lua"]
            if (Array.isArray(userPathGlob)) {
                finalPathGlob = userPathGlob.flatMap(p => {
                    // 如果路径已经以 .lua 结尾，直接使用
                    if (p.endsWith('.lua')) {
                        return [p];
                    }
                    // 否则添加 *.lua 和 **/*.lua 后缀，匹配当前目录和子目录
                    const basePath = p.endsWith('/') ? p : `${p}/`;
                    return [`${basePath}*.lua`, `${basePath}**/*.lua`];
                });
            } else {
                if (userPathGlob.endsWith('.lua')) {
                    finalPathGlob = userPathGlob;
                } else {
                    const basePath = userPathGlob.endsWith('/') ? userPathGlob : `${userPathGlob}/`;
                    // 同时匹配当前目录和子目录
                    finalPathGlob = [`${basePath}*.lua`, `${basePath}**/*.lua`];
                }
            }
        } else {
            // 默认匹配所有目录下的 .lua 文件（根目录和子目录）
            finalPathGlob = ['*.lua', '**/*.lua'];
        }

        try {
            const result = await vscode.lm.invokeTool(
                'vscodeOperator_readProblems',
                {
                    toolInvocationToken: undefined,
                    input: {
                        maxItems,
                        minSeverity,
                        pathGlob: finalPathGlob
                    }
                }
            );

            // 解析返回结果
            let textContent = '';
            for (const part of result.content) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    textContent += part.value;
                }
            }

            if (textContent) {
                const parsed = JSON.parse(textContent);
                return {
                    success: true,
                    ...parsed
                };
            }

            return {
                success: true,
                filter: {
                    minSeverity,
                    pathGlob: finalPathGlob
                },
                total: 0,
                returned: 0,
                items: []
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            tools.log.error(`[MCP] readProblemsLua 调用失败: ${message}`);
            return {
                success: false,
                error: message,
                message: '调用 vscodeOperator_readProblems 失败，请确保已安装 sumneko.vscode-operator 扩展'
            };
        }
    }

    /**
     * 清理资源
     */
    dispose(): void {
        if (this.clientCheckInterval) {
            clearInterval(this.clientCheckInterval);
        }

        if (this.currentSession) {
            this.stopGame();
        }
    }
}