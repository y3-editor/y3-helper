import * as path from 'path';
import * as vscode from 'vscode';
import { GameLauncher } from '../launchGame';
import { Client } from '../console/client';
import { LogManager } from './logManager';
import { GameSession, MCPError, MCPErrorCode } from './types';
import * as env from '../env';
import * as tools from '../tools';
import { getMcpHub } from '../codemaker/mcpHandlers/index';
import { save as saveGmp } from '../tools/y3SaveGmp';
import { findDuplicateMultiPlayerRoles, findInvalidMultiPlayerRoles } from '../multiPlayerRoles';
import {
    assignMissingLocalArchiveNicknames,
    getLocalArchiveAssignments,
} from '../multiPlayerArchives';
import { killGame } from '../killGame';
import { getMultiLaunchTimeoutMs } from './multiLaunch';

/**
 * 游戏会话管理器
 * 管理游戏会话生命周期、客户端监控、日志拦截
 */
export class GameSessionManager extends vscode.Disposable {
    private currentSession?: GameSession;
    private clientCheckInterval?: NodeJS.Timeout;
    private isLaunching: boolean = false;  // 启动中标记，防止重复启动
    private cancelLaunch: boolean = false;  // 取消启动标记
    // 保存每个 Client 的原始 print，保证 attachClient 幂等，避免多层包装导致日志重复
    private readonly originalClientPrints = new WeakMap<Client, (msg: string) => void>();
    // 每个 Client 独立的日志记录（支持多游戏窗口按 index 选择日志）
    private readonly clientLogManagers = new Map<Client, LogManager>();
    private clientLogSeq = 0;

    // 超时常量
    private readonly LAUNCH_TIMEOUT_MS = 110000;  // 启动超时时间（110秒）
    private readonly RESTART_TIMEOUT_MS = 60000;  // 快速重启超时时间（60秒）
    private readonly MULTI_ROLE_MAPPING_GRACE_MS = 5000;

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

    private failure(code: string, message: string, details?: Record<string, unknown>): any {
        return {
            success: false,
            code,
            message,
            ...(details ? {details} : {}),
        };
    }

    private mcpFailure(error: unknown): any {
        if (error instanceof MCPError) {
            return {
                success: false,
                code: error.code,
                message: error.message,
                ...(error.data ? {details: error.data} : {}),
            };
        }
        return {
            success: false,
            code: MCPErrorCode.INTERNAL_ERROR,
            message: error instanceof Error ? error.message : String(error),
        };
    }

    private getSessionClients(session: GameSession): Client[] {
        return (session.clients ?? []).filter((client) => Client.allClients.includes(client));
    }

    private hasAllExpectedRoles(session: GameSession): boolean {
        const expected = session.expectedPlayers ?? [];
        if (expected.length === 0) {
            return false;
        }
        const observed = new Set(
            this.getSessionClients(session)
                .map((client) => client.roleId)
                .filter((roleId): roleId is number => typeof roleId === 'number'),
        );
        return expected.every((roleId) => observed.has(roleId));
    }

    private refreshMultiSessionStatus(session: GameSession): void {
        if (!session.multiMode) {
            return;
        }
        if (this.hasAllExpectedRoles(session)) {
            session.status = 'running';
            session.errorCode = undefined;
            session.errorMessage = undefined;
            session.errorDetails = undefined;
        } else if (session.status === 'running' || session.status === 'partial') {
            session.status = 'partial';
        }
    }

    private normalizeNicknameOverrides(raw: unknown, players: readonly number[]): any {
        const nicknames: Record<number, string> = {};
        if (raw === undefined) {
            return {success: true, nicknames};
        }
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            return this.failure('MULTI_NICKNAME_INVALID', 'nicknames must be an object keyed by role id.');
        }
        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
            const roleId = Number(key);
            if (!Number.isSafeInteger(roleId) || !players.includes(roleId)) {
                return this.failure(
                    'MULTI_NICKNAME_INVALID',
                    `Nickname override references role ${key}, which is not in players.`,
                    {roleId: key},
                );
            }
            if (typeof value !== 'string' || !value.trim()) {
                return this.failure(
                    'MULTI_NICKNAME_INVALID',
                    `Nickname override for role ${roleId} must be a non-empty string.`,
                    {roleId},
                );
            }
            nicknames[roleId] = value.trim();
        }
        return {success: true, nicknames};
    }

    private async prepareMultiLaunch(options: any): Promise<any> {
        const project = env.env.project;
        if (!project) {
            return this.failure('PROJECT_NOT_READY', 'No Y3 project is currently loaded.');
        }

        const rawPlayers = options.players;
        if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
            return this.failure('MULTI_PLAYERS_REQUIRED', 'multiMode requires a non-empty players list.');
        }
        if (rawPlayers.some((id) => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)) {
            return this.failure(
                'MULTI_PLAYERS_INVALID',
                'players must contain positive integer role ids.',
                {players: rawPlayers},
            );
        }

        const duplicateRoles = findDuplicateMultiPlayerRoles(rawPlayers);
        if (duplicateRoles.length > 0) {
            return this.failure(
                'MULTI_PLAYERS_DUPLICATE',
                `players contains duplicate role ids: ${duplicateRoles.join(', ')}`,
                {roleIds: duplicateRoles},
            );
        }

        const normalizedNicknames = this.normalizeNicknameOverrides(options.nicknames, rawPlayers);
        if (!normalizedNicknames.success) {
            return normalizedNicknames;
        }

        await project.reloadMultiPlayerRoles();
        if (project.multiPlayerRolesError) {
            return this.failure(
                'MULTI_ROLES_UNAVAILABLE',
                'Unable to read campinfo.json. Save the project in the editor and retry.',
            );
        }

        const invalidRoles = findInvalidMultiPlayerRoles(rawPlayers, project.multiPlayerRoles);
        if (invalidRoles.length > 0) {
            return this.failure(
                'MULTI_PLAYERS_INVALID',
                `Role ids are not available in campinfo.json: ${invalidRoles.join(', ')}`,
                {roleIds: invalidRoles, availableRoles: project.multiPlayerRoles.map((role) => role.id)},
            );
        }

        await project.reloadMultiPlayerArchives();
        if (project.multiPlayerArchivesError) {
            return this.failure(
                'MULTI_ARCHIVE_INVALID',
                'Unable to read archive/archive_storage.json. Fix the file and retry.',
            );
        }

        const assigned = assignMissingLocalArchiveNicknames(
            rawPlayers,
            normalizedNicknames.nicknames,
            project.multiPlayerArchives,
            env.env.editorNickname,
        );
        const nicknameOwners = new Map<string, number[]>();
        for (const assignment of assigned.assignments) {
            const owners = nicknameOwners.get(assignment.nickname) ?? [];
            owners.push(assignment.roleId);
            nicknameOwners.set(assignment.nickname, owners);
        }
        const duplicateNicknames = [...nicknameOwners.entries()]
            .filter(([, owners]) => owners.length > 1)
            .map(([nickname, owners]) => ({nickname, roleIds: owners}));
        if (duplicateNicknames.length > 0) {
            return this.failure(
                'MULTI_NICKNAME_INVALID',
                'Different selected roles resolve to the same nickname. Pass explicit nicknames or remove the conflicting archive binding.',
                {duplicates: duplicateNicknames},
            );
        }

        try {
            await project.saveMultiPlayerArchiveAssignments(assigned.assignments);
        } catch (error) {
            return this.failure(
                'MULTI_ARCHIVE_WRITE_FAILED',
                'Failed to write archive/archive_storage.json.',
                {detail: error instanceof Error ? error.message : String(error)},
            );
        }

        const nicknames: Record<number, string> = {};
        for (const assignment of assigned.assignments) {
            nicknames[assignment.roleId] = assignment.nickname;
        }

        return {
            success: true,
            players: [...rawPlayers].sort((a, b) => a - b),
            nicknames,
            generatedRoleIds: assigned.generatedRoleIds,
        };
    }

    /**
     * 启动游戏
     */
    async launchGame(options: any = {}): Promise<any> {
        const multiMode = options.multiMode === true;

        if (!multiMode && (options.players !== undefined || options.nicknames !== undefined)) {
            return this.failure(
                'INVALID_PARAMS',
                'players/nicknames are only valid when multiMode is true.',
            );
        }

        // 检查是否正在启动中
        if (this.isLaunching) {
            return {
                success: true,
                status: 'launching',
                session_id: this.currentSession?.id || null,
                multi_mode: Boolean(this.currentSession?.multiMode),
                expected_players: this.currentSession?.expectedPlayers,
                message: 'Game is already launching, please wait. Use get_game_status to check progress.'
            };
        }

        // 检查是否已有游戏客户端连接
        if (Client.allClients.length > 0) {
            if (multiMode) {
                return this.failure(
                    'GAME_ALREADY_RUNNING',
                    'Game is already running. Call stop_game before launching multi mode.',
                    {clients: Client.allClients.map((client) => ({
                        slot: client.slot,
                        name: client.name,
                        roleId: client.roleId,
                    }))},
                );
            }
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
                return this.failure('LAUNCH_CANCELLED', 'Game launch was cancelled.');
            }
        } catch (error) {
            // 环境初始化失败，清除启动标记
            this.isLaunching = false;
            throw error;
        }

        let prepared: any;
        if (multiMode) {
            try {
                prepared = await this.prepareMultiLaunch(options);
            } catch (error) {
                this.isLaunching = false;
                return this.failure(
                    'MULTI_PREPARE_FAILED',
                    'Failed to prepare multi-player launch.',
                    {detail: error instanceof Error ? error.message : String(error)},
                );
            }
            if (!prepared.success) {
                this.isLaunching = false;
                return prepared;
            }
        }
        if (this.cancelLaunch) {
            this.isLaunching = false;
            return this.failure('LAUNCH_CANCELLED', 'Game launch was cancelled.');
        }

        // 创建会话
        const sessionId = `session_${Date.now()}`;
        const logManager = new LogManager(sessionId);

        const session: GameSession = {
            id: sessionId,
            launcher: new GameLauncher(),
            logManager,
            status: 'launching',
            startTime: Date.now(),
            multiMode,
            expectedPlayers: prepared?.players,
            clients: multiMode ? [] : undefined,
        };

        this.currentSession = session;

        // 非阻塞启动：在后台执行启动流程，捕获未预期的异常
        this.launchGameAsync(session, {...options, multiNicknames: prepared?.nicknames}).catch(error => {
            tools.log.error(`[MCP] Unexpected error in launchGameAsync: ${error}`);
            session.status = 'stopped';
            session.errorCode = 'GAME_LAUNCH_FAILED';
            session.errorMessage = `Unexpected error during launch: ${error instanceof Error ? error.message : String(error)}`;
            this.isLaunching = false;
        });

        return {
            success: true,
            session_id: sessionId,
            status: 'launching',
            multi_mode: multiMode,
            expected_players: session.expectedPlayers,
            message: multiMode
                ? 'Multi-player game is launching. Use get_game_status to check when every player is ready.'
                : 'Game is launching. Use get_game_status to check when it is ready.'
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
                session.errorCode = 'LAUNCH_CANCELLED';
                session.errorMessage = 'Launch cancelled';
                this.isLaunching = false;
                return;
            }

            const luaArgs: Record<string, string> = {};

            // 启动游戏
            const launchResult = await session.launcher.launch({
                luaArgs,
                multi: session.multiMode ? session.expectedPlayers : undefined,
                multiNicknames: session.multiMode ? options.multiNicknames : undefined,
                tracy: options.tracy || false,
                silent: true,
            });

            if (!launchResult.success) {
                session.status = 'stopped';
                session.errorCode = launchResult.error?.code || 'GAME_LAUNCH_FAILED';
                session.errorMessage = launchResult.error?.message || 'Game launch failed';
                session.errorDetails = launchResult.error?.details;
                tools.log.error(`[MCP] 游戏启动失败: ${session.errorMessage}`);
                return;
            }

            // 再次检查是否被取消
            if (this.cancelLaunch) {
                session.status = 'stopped';
                session.errorCode = 'LAUNCH_CANCELLED';
                session.errorMessage = 'Launch cancelled';
                this.isLaunching = false;
                return;
            }

            if (session.multiMode) {
                const expectedCount = session.expectedPlayers?.length ?? 0;
                const timeout = getMultiLaunchTimeoutMs(expectedCount);
                const ready = await this.waitForMultiClients(session, timeout);
                if (!ready) {
                    if (this.cancelLaunch) {
                        session.status = 'stopped';
                        session.errorCode = 'LAUNCH_CANCELLED';
                        session.errorMessage = 'Launch cancelled';
                        return;
                    }
                    this.finishMultiLaunchTimeout(session, timeout);
                    if (session.status === 'partial') {
                        getMcpHub()?.pingMcpServers();
                    }
                    return;
                }
            } else {
                // 等待客户端连接（最多 110 秒，考虑到部分电脑启动较慢）
                const connected = await this.waitForClient(session, this.LAUNCH_TIMEOUT_MS);
                if (!connected) {
                    if (this.cancelLaunch) {
                        session.status = 'stopped';
                        session.errorCode = 'LAUNCH_CANCELLED';
                        session.errorMessage = 'Launch cancelled';
                        return;
                    }
                    session.status = 'stopped';
                    session.errorCode = 'GAME_CONNECTION_TIMEOUT';
                    session.errorMessage = 'Game launched but client connection timeout (waited 110 seconds)';
                    tools.log.error(`[MCP] ${session.errorMessage}`);
                    return;
                }
            }

            // 游戏启动成功，通知 McpHub 重连断开的 MCP servers（如 y3runtime）
            getMcpHub()?.pingMcpServers();
        } catch (error) {
            session.status = 'stopped';
            session.errorCode = 'GAME_LAUNCH_FAILED';
            session.errorMessage = error instanceof Error ? error.message : String(error);
            tools.log.error(`[MCP] 游戏启动失败: ${session.errorMessage}`);
        } finally {
            this.isLaunching = false;
        }
    }

    private finishMultiLaunchTimeout(session: GameSession, timeout: number): void {
        const expected = session.expectedPlayers ?? [];
        const clients = this.getSessionClients(session);
        const observed = new Set(
            clients
                .map((client) => client.roleId)
                .filter((roleId): roleId is number => typeof roleId === 'number'),
        );
        const missing = expected.filter((roleId) => !observed.has(roleId));
        const details = {
            timeoutMs: timeout,
            expectedPlayers: expected,
            missingPlayers: missing,
            connectedClients: clients.map((client) => ({
                slot: client.slot,
                name: client.name,
                roleId: client.roleId,
            })),
        };

        if (clients.length > 0) {
            session.status = 'partial';
            session.errorCode = 'MULTI_LAUNCH_PARTIAL';
            session.errorMessage = observed.size > 0
                ? `Multi-player launch timed out after ${Math.round(timeout / 1000)} seconds. Missing roles: ${missing.join(', ') || '(none)'}`
                : `Multi-player launch timed out after ${Math.round(timeout / 1000)} seconds. Connected windows did not report their role ids.`;
        } else {
            session.status = 'stopped';
            session.errorCode = 'MULTI_LAUNCH_TIMEOUT';
            session.errorMessage = `Multi-player launch timed out after ${Math.round(timeout / 1000)} seconds without any connected player.`;
        }
        session.errorDetails = details;
        tools.log.error(`[MCP] ${session.errorMessage}`);
    }

    /**
     * 等待客户端连接
     */
    private async waitForClient(session: GameSession, timeout: number): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (this.cancelLaunch) {
                return false;
            }
            // 检查客户端是否已连接且状态为 running
            // attachClient 会设置 client 并将状态改为 running（适用于 launching 和 restarting）
            if (session.client && session.status === 'running') {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return false;
    }

    private async waitForMultiClients(session: GameSession, timeout: number): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (this.cancelLaunch) {
                return false;
            }
            if (this.hasAllExpectedRoles(session)) {
                this.refreshMultiSessionStatus(session);
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const ready = this.hasAllExpectedRoles(session);
        if (ready) {
            this.refreshMultiSessionStatus(session);
        }
        return ready;
    }

    private async waitForRoleMapping(client: Client, timeout: number): Promise<void> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout && client.roleId === undefined) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    /**
     * 监控客户端连接
     */
    private startClientMonitoring(): void {
        this.clientCheckInterval = setInterval(() => {
            // 为所有连接的客户端（含未 attach 的多窗口）记录 client 级日志
            this.ensureAllClientsLogging();

            // 清理已断开客户端的日志记录（释放 WriteStream 与日志文件）
            for (const [client, logManager] of this.clientLogManagers) {
                if (!Client.allClients.includes(client)) {
                    try {
                        logManager.cleanup();
                    } catch {
                        // 忽略清理异常
                    }
                    this.clientLogManagers.delete(client);
                }
            }

            if (this.currentSession) {
                const session = this.currentSession;
                if (session.multiMode) {
                    // 多开会话：把新出现的窗口都纳入会话，并同步掉已断开的窗口
                    session.clients = this.getSessionClients(session);
                    for (const client of Client.allClients) {
                        if (!session.clients.includes(client)) {
                            this.attachClient(session, client);
                        }
                    }
                    if (session.client && !Client.allClients.includes(session.client)) {
                        session.client = session.clients[0];
                    }
                    if (session.clients.length === 0
                        && session.status !== 'launching'
                        && session.status !== 'restarting') {
                        session.status = 'stopped';
                    } else {
                        this.refreshMultiSessionStatus(session);
                    }
                } else {
                    // 检查新客户端连接（启动或重启后）
                    if ((session.status === 'launching' || session.status === 'restarting')
                        && !session.client) {
                        const latestClient = Client.allClients[Client.allClients.length - 1];
                        if (latestClient) {
                            this.attachClient(session, latestClient);
                        }
                    }

                    // 检查客户端断开
                    if (session.status === 'running' && session.client) {
                        // 检查客户端是否还在 allClients 数组中
                        const clientExists = Client.allClients.includes(session.client);
                        if (!clientExists) {
                            tools.log.info(`[MCP] Client disconnected from session ${session.id}`);
                            session.status = 'stopped';
                            session.client = undefined;
                        }
                    }

                    // 检查重启后的重新连接
                    if (session.status === 'restarting' && session.client) {
                        // 检查客户端是否断开
                        const clientExists = Client.allClients.includes(session.client);
                        if (!clientExists) {
                            tools.log.info(`[MCP] Client disconnected during restart, waiting for reconnection...`);
                            session.client = undefined;
                        }
                    }
                }
            }
        }, 500);
    }

    /**
     * 附加客户端并拦截日志（幂等：同一 Client 重复 attach 不叠加包装层）
     */
    private attachClient(session: GameSession, client: Client): void {
        if (session.multiMode) {
            session.clients ??= [];
            if (!session.clients.includes(client)) {
                session.clients.push(client);
            }
            session.client ??= client;
            this.refreshMultiSessionStatus(session);
        } else {
            session.client = client;
            session.status = 'running';
        }

        tools.log.info(`[MCP] Client attached to session ${session.id}${client.roleId ? ` (role ${client.roleId})` : ''}`);

        // 拦截 print 方法，同时写入 session 级与 client 级日志
        this.wrapClientPrint(client, session);

        // 注意：Client 类没有 onDidDispose 方法
        // 客户端断开会通过 Client.allClients 数组的变化来检测
    }

    /**
     * 获取（或创建）指定 Client 的独立日志记录
     */
    private getClientLogManager(client: Client): LogManager {
        let logManager = this.clientLogManagers.get(client);
        if (!logManager) {
            this.clientLogSeq += 1;
            logManager = new LogManager(`client_${this.clientLogSeq}`);
            this.clientLogManagers.set(client, logManager);
        }
        return logManager;
    }

    /**
     * 包装 Client 的 print 方法（幂等）：
     * - 始终从原始 print 包装，重复调用不叠加包装层
     * - 写入 client 级日志（多窗口按 index 选择日志的基础）
     * - 若传入 session，同时写入该 session 的日志（供 execute_lua 增量对比使用）
     */
    private wrapClientPrint(client: Client, session?: GameSession): void {
        let originalPrint = this.originalClientPrints.get(client);
        if (!originalPrint) {
            originalPrint = client.print.bind(client);
            this.originalClientPrints.set(client, originalPrint);
        }
        const clientLogManager = this.getClientLogManager(client);
        const sessionRef = session;
        client.print = (msg: string) => {
            clientLogManager.appendLog(msg);
            if (sessionRef) {
                sessionRef.logManager.appendLog(msg);
            }
            return originalPrint!(msg);
        };
    }

    /**
     * 为所有尚未包装的 Client 注册 client 级日志记录（多游戏窗口场景，
     * 让未被 attach 到当前 session 的窗口日志也可通过 get_logs 的 clientSlot 读取）
     */
    private ensureAllClientsLogging(): void {
        for (const client of Client.allClients) {
            if (!this.originalClientPrints.has(client)) {
                this.wrapClientPrint(client);
            }
        }
    }

    /**
     * 解析目标客户端：
     * - 指定 clientSlot → 按稳定窗口编号查找（Client.slot，窗口断开编号释放可复用）
     * - 指定 roleId → 按游戏侧 updatePlayer 上报的角色 id 查找
     * - 都未指定 → 当前 session 绑定的客户端
     */
    private resolveClient(clientSlot?: number, roleId?: number): { client: Client; slot: number } {
        if (typeof clientSlot === 'number' && typeof roleId === 'number') {
            throw new MCPError(
                'clientSlot and roleId are mutually exclusive.',
                MCPErrorCode.INVALID_PARAMS
            );
        }
        if (typeof clientSlot === 'number') {
            const client = Client.allClients.find(c => c.slot === clientSlot);
            if (!client) {
                throw new MCPError(
                    `Client slot ${clientSlot} not found, total clients: ${Client.allClients.length}`,
                    MCPErrorCode.CLIENT_NOT_CONNECTED
                );
            }
            return { client, slot: clientSlot };
        }
        if (typeof roleId === 'number') {
            const client = Client.allClients.find(c => c.roleId === roleId);
            if (!client) {
                throw new MCPError(
                    `Client for role ${roleId} not found. Known roles: ${Client.allClients
                        .map(c => c.roleId)
                        .filter(role => role !== undefined)
                        .join(', ') || '(none)'}`,
                    MCPErrorCode.CLIENT_NOT_CONNECTED
                );
            }
            return { client, slot: client.slot };
        }
        if (!this.currentSession) {
            throw new MCPError('没有活动的游戏会话', MCPErrorCode.SESSION_NOT_FOUND);
        }
        if (!this.currentSession.client) {
            throw new MCPError('游戏客户端未连接', MCPErrorCode.CLIENT_NOT_CONNECTED);
        }
        return {
            client: this.currentSession.client,
            slot: this.currentSession.client.slot
        };
    }

    /**
     * 获取多开角色与本地存档信息
     */
    async getMultiPlayerRoles(): Promise<any> {
        const project = env.env.project;
        if (!project) {
            return this.failure('PROJECT_NOT_READY', 'No Y3 project is currently loaded.');
        }

        await project.reloadMultiPlayerRoles();
        if (project.multiPlayerRolesError) {
            return this.failure(
                'MULTI_ROLES_UNAVAILABLE',
                'Unable to read campinfo.json. Save the project in the editor and retry.',
                {reason: project.multiPlayerRolesError},
            );
        }

        await project.reloadMultiPlayerArchives();
        const archiveAssignments = getLocalArchiveAssignments(project.multiPlayerArchives);
        const nicknameByRole = new Map(
            archiveAssignments.map((assignment) => [assignment.roleId, assignment.nickname]),
        );

        return {
            success: true,
            roles: project.multiPlayerRoles.map((role) => ({
                id: role.id,
                name: role.name
                    ? project.entryMap?.language.get(role.name) ?? role.name
                    : undefined,
                nickname: nicknameByRole.get(role.id),
            })),
            editor_nickname: env.env.editorNickname,
            available_nicknames: Object.keys(project.multiPlayerArchives),
            archive_error: project.multiPlayerArchivesError,
        };
    }

    /**
     * 获取游戏状态
     */
    getGameStatus(): any {
        const hasConnectedClient = Client.allClients.length > 0;
        // 当前连接的客户端窗口列表（供 clientSlot 参数定位窗口；slot 为稳定编号，断开释放可复用）
        const clients = Client.allClients.map(c => ({
            slot: c.slot,
            name: c.name,
            roleId: c.roleId,
            multiMode: c.isMultiMode,
        }));

        // 如果正在启动中，返回启动状态
        if (this.isLaunching) {
            return {
                running: false,
                session_id: this.currentSession?.id || null,
                status: 'launching',
                message: 'Game is launching, please wait...',
                error: this.currentSession?.errorMessage || undefined,
                ...(this.currentSession?.multiMode ? this.getMultiStatusFields(this.currentSession) : {}),
                clients
            };
        }

        if (!this.currentSession) {
            if (hasConnectedClient) {
                return {
                    running: true,
                    session_id: null,
                    status: 'running',
                    message: 'Game is running (connected client detected, no MCP session)',
                    clients
                };
            }
            return {
                running: false,
                session_id: null,
                status: 'no_session',
                clients
            };
        }

        return {
            running: this.currentSession.status === 'running'
                || this.currentSession.status === 'partial'
                || hasConnectedClient,
            session_id: this.currentSession.id,
            status: this.currentSession.status,
            uptime: Date.now() - this.currentSession.startTime,
            client_connected: hasConnectedClient,
            ...(this.currentSession.multiMode ? this.getMultiStatusFields(this.currentSession) : {}),
            clients,
            error: this.currentSession.errorMessage || undefined,
            error_code: this.currentSession.errorCode || undefined,
            error_details: this.currentSession.errorDetails || undefined,
        };
    }

    private getMultiStatusFields(session: GameSession): Record<string, unknown> {
        const expected = session.expectedPlayers ?? [];
        const sessionClients = this.getSessionClients(session);
        const observed = new Set(
            sessionClients
                .map((client) => client.roleId)
                .filter((roleId): roleId is number => typeof roleId === 'number'),
        );
        const describe = (client: Client) => ({
            slot: client.slot,
            name: client.name,
            roleId: client.roleId,
        });
        return {
            expected_players: expected,
            missing_players: expected.filter((roleId) => !observed.has(roleId)),
            unmapped_clients: sessionClients
                .filter((client) => client.roleId === undefined)
                .map(describe),
            unexpected_clients: sessionClients
                .filter((client) => client.roleId !== undefined && !expected.includes(client.roleId))
                .map(describe),
        };
    }

    /**
     * 获取日志
     * @param params.clientSlot 可选：指定读取窗口的稳定编号（Client.slot）
     * @param params.roleId 可选：按角色 id 指定窗口
     *                       默认读取当前 session 绑定的客户端日志
     */
    async getLogs(params: any = {}): Promise<any> {
        const clientSlot = params.clientSlot;
        const roleId = params.roleId;
        let logManager: LogManager | undefined;
        let usedClient: Client | undefined;

        if (typeof clientSlot === 'number' || typeof roleId === 'number') {
            try {
                usedClient = this.resolveClient(clientSlot, roleId).client;
            } catch (error) {
                return this.mcpFailure(error);
            }
            logManager = this.getClientLogManager(usedClient);
        } else {
            if (!this.currentSession) {
                return {
                    success: false,
                    message: 'No active session'
                };
            }
            if (!this.currentSession.client) {
                return {
                    success: false,
                    message: 'No client attached to current session'
                };
            }
            usedClient = this.currentSession.client;
            logManager = this.getClientLogManager(usedClient);
        }

        const limit = params.limit || 100;
        const logs = await logManager.readLogs(limit);

        return {
            success: true,
            client_slot: usedClient.slot,
            client_name: usedClient.name,
            role_id: usedClient.roleId,
            client_count: Client.allClients.length,
            log_count: logs.length,
            logs: logs.join('\n')
        };
    }

    /**
     * 执行 Lua 代码
     * @param params.clientSlot 可选：指定目标游戏窗口的稳定编号
     * @param params.roleId 可选：按角色 id 指定窗口，默认当前 session 绑定的客户端
     */
    async executeLua(params: any): Promise<any> {
        let resolved;
        try {
            resolved = this.resolveClient(params.clientSlot, params.roleId);
        } catch (error) {
            return this.mcpFailure(error);
        }
        const { client, slot } = resolved;

        const { code } = params;
        if (!code) {
            return {
                success: false,
                message: 'No code provided'
            };
        }

        // 记录执行前的日志行数（client 级日志）
        const logsBefore = await this.getClientLogManager(client).readLogs(10000);
        const linesBefore = logsBefore.length;

        // 发送 Lua 代码
        client.notify('command', { data: code });

        // 等待 1 秒收集输出
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取新增的日志
        const logsAfter = await this.getClientLogManager(client).readLogs(10000);
        const newLogs = logsAfter.slice(linesBefore);

        return {
            success: true,
            client_slot: slot,
            client_name: client.name,
            role_id: client.roleId,
            output: newLogs.join('\n')
        };
    }

    /**
     * 等待指定客户端断开并重新连接（用于指定窗口的快速重启）
     * @returns 重连后的新 Client；超时返回 undefined
     */
    private async waitForClientReconnect(oldClient: Client, timeout: number): Promise<Client | undefined> {
        // 快照当前已知客户端集合：排除其它仍在运行的窗口，
        // 只认"重连后新出现"的客户端，避免多窗口下误把其它窗口当重启结果
        const knownClients = new Set(Client.allClients);
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            if (!Client.allClients.includes(oldClient)) {
                // 旧客户端已断开（重启生效），等待新客户端出现
                const waitStart = Date.now();
                while (Date.now() - waitStart < 30000) {
                    const newClient = Client.allClients.find(c => !knownClients.has(c));
                    if (newClient) {
                        return newClient;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                return undefined;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return undefined;
    }

    /**
     * 快速重启游戏（.rr 命令）
     * @param params.clientSlot 可选：指定目标游戏窗口的稳定编号
     * @param params.roleId 可选：按角色 id 指定窗口
     *                       多开会话不指定目标时重启整组已连接窗口
     */
    async quickRestart(params: any = {}): Promise<any> {
        const hasTarget = typeof params.clientSlot === 'number' || typeof params.roleId === 'number';

        if (!hasTarget && this.currentSession?.multiMode) {
            return this.restartMultiSession(this.currentSession);
        }
        if (!this.currentSession) {
            return {
                success: false,
                message: 'No active session'
            };
        }

        let resolved;
        try {
            resolved = this.resolveClient(params.clientSlot, params.roleId);
        } catch (error) {
            return this.mcpFailure(error);
        }
        const { client, slot } = resolved;

        if (hasTarget) {
            // 指定窗口：仅重启该窗口，不影响 session 绑定
            client.notify('command', { data: '.rr' });

            const newClient = await this.waitForClientReconnect(client, this.RESTART_TIMEOUT_MS);
            if (!newClient) {
                return {
                    success: false,
                    message: 'Game restart timeout - client did not reconnect within 60 seconds'
                };
            }

            await this.waitForRoleMapping(newClient, this.MULTI_ROLE_MAPPING_GRACE_MS);
            this.replaceSessionClient(client, newClient);

            // 重启后旧 Client 对象已消失，日志写入新 Client 的 logManager；
            // 无公共基准线，直接返回新客户端自连接以来的全部日志
            const newLogs = await this.getClientLogManager(newClient).readLogs(10000);

            return {
                success: true,
                client_slot: newClient.slot,
                client_name: newClient.name,
                role_id: newClient.roleId ?? client.roleId,
                message: 'Game restarted successfully',
                output: newLogs.join('\n')
            };
        } else {
            // 默认：重启当前 session 绑定的窗口
            this.currentSession.status = 'restarting';

            client.notify('command', { data: '.rr' });

            const reconnected = await this.waitForClient(this.currentSession, this.RESTART_TIMEOUT_MS);
            if (!reconnected) {
                this.currentSession.status = 'stopped';
                this.currentSession.errorMessage = 'Game restart timeout - client did not reconnect within 60 seconds';
                return {
                    success: false,
                    message: this.currentSession.errorMessage
                };
            }
        }

        // 重启后 session.client 已指向重连后的新客户端（监控循环 attachClient），
        // 旧 client 对象的 logManager 不再写入，须从新客户端读取
        const newClient = this.currentSession!.client!;
        const newLogs = await this.getClientLogManager(newClient).readLogs(10000);

        return {
            success: true,
            client_slot: newClient.slot,
            client_name: newClient.name,
            role_id: newClient.roleId,
            message: 'Game restarted successfully',
            output: newLogs.join('\n')
        };
    }

    private replaceSessionClient(oldClient: Client, newClient: Client): void {
        const session = this.currentSession;
        if (!session) {
            return;
        }
        if (session.clients) {
            const index = session.clients.indexOf(oldClient);
            if (index >= 0) {
                session.clients[index] = newClient;
            } else if (!session.clients.includes(newClient)) {
                session.clients.push(newClient);
            }
        }
        if (session.client === oldClient || !session.client) {
            session.client = newClient;
        }
        if (session.multiMode) {
            this.refreshMultiSessionStatus(session);
        }
    }

    private async restartMultiSession(session: GameSession): Promise<any> {
        const oldClients = this.getSessionClients(session);
        if (oldClients.length === 0) {
            return {
                success: false,
                message: 'No connected clients to restart'
            };
        }

        const knownClients = new Set(Client.allClients);
        session.status = 'restarting';
        for (const client of oldClients) {
            client.notify('command', { data: '.rr' });
        }

        const deadline = Date.now() + this.RESTART_TIMEOUT_MS;
        while (Date.now() < deadline && oldClients.some((client) => Client.allClients.includes(client))) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        let newClients: Client[] = [];
        while (Date.now() < deadline) {
            newClients = Client.allClients.filter((client) => !knownClients.has(client));
            if (newClients.length >= oldClients.length) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const graceEnd = Date.now() + this.MULTI_ROLE_MAPPING_GRACE_MS;
        while (Date.now() < graceEnd && newClients.some((client) => client.roleId === undefined)) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        session.clients = newClients;
        session.client = newClients[0];
        if (newClients.length === 0) {
            session.status = 'stopped';
        } else {
            this.refreshMultiSessionStatus(session);
        }

        const expected = session.expectedPlayers?.length
            ? session.expectedPlayers
            : newClients
                .map((client) => client.roleId)
                .filter((roleId): roleId is number => typeof roleId === 'number');
        const results = [];
        for (const roleId of expected) {
            const client = newClients.find((candidate) => candidate.roleId === roleId);
            if (!client) {
                results.push({
                    roleId,
                    success: false,
                    message: 'Client did not reconnect within 60 seconds',
                });
                continue;
            }
            const logs = await this.getClientLogManager(client).readLogs(10000);
            results.push({
                roleId,
                success: true,
                client_slot: client.slot,
                client_name: client.name,
                output: logs.join('\n'),
            });
        }

        const success = results.some((result) => result.success);
        return {
            success,
            status: session.status,
            partial: results.some((result) => !result.success),
            results,
            message: success
                ? 'Multi-player game restarted'
                : 'Multi-player game restart timed out',
        };
    }

    /**
     * 停止游戏
     * @param params.clientSlot 可选：指定停止的游戏窗口（稳定编号）
     * @param params.roleId 可选：按角色 id 指定窗口
     * @param params.forceKillAll 可选：停止后调用 killGame 清理本工程全部游戏进程
     *                            多开会话不指定目标时停止整组已连接窗口
     */
    async stopGame(params: any = {}): Promise<any> {
        const hasTarget = typeof params.clientSlot === 'number' || typeof params.roleId === 'number';

        if (hasTarget) {
            // 指定窗口：仅停止该窗口，不影响当前 session 绑定
            let client: Client;
            try {
                client = this.resolveClient(params.clientSlot, params.roleId).client;
            } catch (error) {
                return this.mcpFailure(error);
            }
            await this.forceQuitClient(client);

            const session = this.currentSession;
            if (session?.multiMode && session.clients) {
                session.clients = session.clients.filter((candidate) => candidate !== client);
                if (session.client === client) {
                    session.client = session.clients[0];
                }
                if (session.clients.length === 0) {
                    session.status = 'stopped';
                } else {
                    this.refreshMultiSessionStatus(session);
                }
            } else if (session?.client === client) {
                session.status = 'stopped';
                session.client = undefined;
            }

            return {
                success: true,
                client_slot: client.slot,
                client_name: client.name,
                role_id: client.roleId,
                message: 'Game stopped'
            };
        }

        // 设置取消标记，防止启动过程继续
        this.cancelLaunch = true;
        // 清除启动中状态，防止启动过程中停止后无法重新启动
        this.isLaunching = false;

        if (!this.currentSession) {
            if (params.forceKillAll === true) {
                const killed = await killGame({silent: true});
                return {
                    success: true,
                    force_kill_all: true,
                    killed_processes: killed,
                    message: killed > 0 ? 'Game processes killed' : 'No running game process found'
                };
            }
            return {
                success: false,
                message: 'No active session'
            };
        }

        const session = this.currentSession;

        if (session.multiMode) {
            const connectedClients = this.getSessionClients(session);
            await Promise.all(connectedClients.map((client) => this.forceQuitClient(client)));

            const expectedCount = session.expectedPlayers?.length ?? 0;
            const unconnectedWindowsMayRemain = Math.max(0, expectedCount - connectedClients.length) > 0;

            session.clients = [];
            session.client = undefined;
            session.status = 'stopped';
            session.logManager.cleanup();
            this.currentSession = undefined;

            let killed = 0;
            if (params.forceKillAll === true) {
                killed = await killGame({silent: true});
            }

            try {
                await getMcpHub()?.restartConnection('y3runtime');
            } catch {
                // 忽略错误
            }

            return {
                success: true,
                stopped_clients: connectedClients.length,
                expected_players: session.expectedPlayers ?? [],
                unconnected_windows_may_remain: unconnectedWindowsMayRemain,
                force_kill_all: params.forceKillAll === true,
                killed_processes: killed,
                message: unconnectedWindowsMayRemain
                    ? 'Connected windows stopped. Some launched windows never connected and may remain; use forceKillAll to clean them up.'
                    : 'Multi-player game stopped',
            };
        }

        // 通过 Lua 代码强制退出游戏
        if (session.client) {
            await this.forceQuitClient(session.client);
        }

        // 更新状态
        session.status = 'stopped';

        // 清理日志管理器
        session.logManager.cleanup();

        // 清除当前会话
        this.currentSession = undefined;

        let killed = 0;
        if (params.forceKillAll === true) {
            killed = await killGame({silent: true});
        }

        // 游戏停止后，主动断开 y3runtime MCP 连接并立即尝试重连
        // 重连必然失败，但会在 connections 中留下 disconnected 状态的条目
        // 这样下次启动游戏时 pingMcpServers 能检测到并重连
        try {
            await getMcpHub()?.restartConnection('y3runtime');
        } catch {
            // 忽略错误
        }

        return {
            success: true,
            force_kill_all: params.forceKillAll === true,
            killed_processes: killed,
            message: 'Game stopped'
        };
    }

    /**
     * 通过 Lua 代码强制退出指定客户端（发退出命令 + 等待关闭 + dispose）
     */
    private async forceQuitClient(client: Client): Promise<void> {
        try {
            // 获取本地玩家并强制退出
            const luaCode = `
                local player = y3.player:get_local()
                if player then
                    GameAPI.role_force_quit(player.handle, '游戏已停止')
                end
            `;
            client.notify('command', { data: luaCode });
            // 等待游戏关闭
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 检查客户端是否还存在再 dispose
            if (typeof client.dispose === 'function') {
                client.dispose();
            }
        } catch (err) {
            // 忽略错误，继续清理
        }
    }

    /**
     * 捕获游戏截图
     * @param params.clientSlot 可选：指定截图的目标游戏窗口（稳定编号）
     * @param params.roleId 可选：按角色 id 指定窗口，默认当前 session 绑定的客户端
     */
    async captureScreenshot(params: any = {}): Promise<any> {
        let client: Client;
        let slot: number;
        try {
            const resolved = this.resolveClient(params.clientSlot, params.roleId);
            client = resolved.client;
            slot = resolved.slot;
        } catch (err) {
            return this.mcpFailure(err);
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

            client.notify('command', { data: luaCode });

            // 构建截图文件路径
            const screenshotPath = path.normalize(
                path.join(env.env.editorUri.fsPath, '../LocalData/mcp_screenshots/screenshot.png')
            );

            return {
                success: true,
                client_slot: slot,
                client_name: client.name,
                role_id: client.roleId,
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
