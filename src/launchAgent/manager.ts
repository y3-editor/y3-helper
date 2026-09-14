// 扩展宿主侧的提权代理管理：创建管道、拉起代理、下发启动请求、失联兜底

import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import * as tools from '../tools';
import * as l10n from '@vscode/l10n';
import { AgentMessage, LineDecoder, encodeMessage } from './protocol';

/** 握手凭据在 globalState 中的键名，用于扩展宿主重启后重连 */
const TOKEN_KEY = 'launchAgent.token';
/** 拉起代理后等待握手的最长时间 */
const HANDSHAKE_TIMEOUT = 15000;
/** 复用上一个宿主留下的代理时等待重连的时间 */
const RECONNECT_WAIT = 2500;
/** 等待代理确认进程创建的最长时间 */
const LAUNCH_TIMEOUT = 20000;
/** 代理断线后等待重连的时间，超过则代理自行退出 */
const GRACE = 30000;

function quoteShellArg(value: string): string {
    return value.includes(' ') ? `"${value}"` : value;
}

function quotePowerShell(value: string): string {
    return "'" + value.replace(/'/g, "''") + "'";
}

export class LaunchAgentManager {
    private readonly context: vscode.ExtensionContext;
    private readonly token: string;
    private readonly pipeName: string;
    private readonly lockPath: string;
    private readonly logPath: string;
    private readonly launcherPath: string;
    private server?: net.Server;
    private socket?: net.Socket;
    private allowDir?: string;
    private nextId = 1;
    private starting?: Promise<void>;
    private listening?: Promise<void>;
    private waiter?: { done: (connected: boolean) => void };
    private readonly launching = new Map<number, { resolve: (code: number | undefined) => void, timer: NodeJS.Timeout }>();
    private readonly running = new Map<number, string>();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        let token = context.globalState.get<string>(TOKEN_KEY);
        if (!token) {
            token = crypto.randomBytes(16).toString('hex');
            context.globalState.update(TOKEN_KEY, token);
        }
        this.token = token;
        let root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.env.USERPROFILE ?? '';
        let suffix = crypto.createHash('sha1').update(root.toLowerCase()).digest('hex').slice(0, 12);
        this.pipeName = '\\\\.\\pipe\\y3-helper-agent-' + suffix;
        this.lockPath = path.join(context.globalStorageUri.fsPath, 'launchAgent-' + suffix + '.lock');
        this.logPath = path.join(context.globalStorageUri.fsPath, 'launchAgent-' + suffix + '.log');
        this.launcherPath = path.join(context.globalStorageUri.fsPath, 'launchAgent-launcher.ps1');
    }

    /**
     * 通过提权代理启动一个进程，返回其退出码之外的结果与 runShell 保持一致：
     * 进程创建成功即返回 0，失败返回非 0。
     */
    public async launch(exe: string, args: string[], cwd?: string): Promise<number | undefined> {
        await this.ensureAgent(path.dirname(exe));
        let socket = this.socket;
        if (!socket || socket.destroyed) {
            throw new Error('launch agent is not connected');
        }
        let id = this.nextId++;
        return await new Promise<number | undefined>((resolve) => {
            let timer = setTimeout(() => {
                this.launching.delete(id);
                tools.log.warn(l10n.t('提权代理响应超时：{0}', exe));
                resolve(1);
            }, LAUNCH_TIMEOUT);
            this.launching.set(id, { resolve: resolve, timer: timer });
            this.running.set(id, exe);
            socket!.write(encodeMessage({ type: 'launch', id: id, exe: exe, args: args, cwd: cwd }));
        });
    }

    /** 扩展宿主退出时只断开连接，不结束代理，以便重载窗口后直接复用（避免再次弹 UAC） */
    public shutdown() {
        if (this.socket) {
            this.socket.destroy();
        }
        this.socket = undefined;
        this.server?.close();
        this.server = undefined;
        this.listening = undefined;
        this.onAgentLost();
    }

    private async ensureAgent(allowDir: string): Promise<void> {
        if (this.socket && !this.socket.destroyed) {
            if (this.allowDir === allowDir) {
                return;
            }
            throw new Error('launch agent was started for another directory: ' + this.allowDir);
        }
        if (this.starting) {
            return await this.starting;
        }
        this.starting = this.startAgent(allowDir).finally(() => {
            this.starting = undefined;
        });
        return await this.starting;
    }

    private async startAgent(allowDir: string): Promise<void> {
        await this.listen();
        this.allowDir = allowDir;
        // 存活标记存在时，说明上一个扩展宿主留下的代理还在等待重连
        if (fs.existsSync(this.lockPath)) {
            if (await this.waitForAgent(RECONNECT_WAIT)) {
                tools.log.info(l10n.t('已重连到提权代理'));
                return;
            }
            fs.rmSync(this.lockPath, { force: true });
        }
        this.elevate(allowDir);
        if (await this.waitForAgent(HANDSHAKE_TIMEOUT)) {
            tools.log.info(l10n.t('提权代理已启动'));
            return;
        }
        this.allowDir = undefined;
        throw new Error('failed to start launch agent');
    }

    private async listen(): Promise<void> {
        if (this.listening) {
            return await this.listening;
        }
        this.listening = new Promise<void>((resolve, reject) => {
            let server = net.createServer((socket) => this.onConnection(socket));
            server.on('error', (error) => {
                this.server = undefined;
                this.listening = undefined;
                reject(error);
            });
            server.listen(this.pipeName, () => resolve());
            this.server = server;
        });
        return await this.listening;
    }

    private waitForAgent(timeout: number): Promise<boolean> {
        if (this.socket && !this.socket.destroyed) {
            return Promise.resolve(true);
        }
        return new Promise<boolean>((resolve) => {
            let timer = setTimeout(() => {
                this.waiter = undefined;
                resolve(false);
            }, timeout);
            this.waiter = {
                done: (connected: boolean) => {
                    clearTimeout(timer);
                    this.waiter = undefined;
                    resolve(connected);
                },
            };
        });
    }

    /**
     * 生成自提权启动脚本。
     *
     * 不用命令行字符串拼 `Start-Process -ArgumentList`：Node 把参数交给 powershell 时会再做一层引号转义，
     * 嵌套引号会被破坏（且 PowerShell 不认反斜杠转义），导致提权出来的进程参数错乱。
     *
     * 也不用环境变量继承：`-Verb RunAs` 经 ShellExecuteEx → AppInfo 服务创建进程，
     * 提权进程的环境变量由系统重建，拿不到调用者设置的 `ELECTRON_RUN_AS_NODE`，
     * 所以必须由提权后的脚本自己设置。
     */
    private prepareLauncher(allowDir: string): string {
        let agent = this.context.asAbsolutePath(path.join('dist', 'launchAgent.js'));
        let agentArgs = [
            agent,
            '--pipe', this.pipeName,
            '--token', this.token,
            '--allow-dir', allowDir,
            '--grace', String(GRACE),
            '--lock', this.lockPath,
            '--log', this.logPath,
        ].map(quoteShellArg).map(quotePowerShell).join(', ');
        let content = [
            'param([switch]$Elevated)',
            '',
            'if (-not $Elevated) {',
            '    $inner = \'-NoProfile -ExecutionPolicy Bypass -File "\' + $PSCommandPath + \'" -Elevated\'',
            '    Start-Process -FilePath \'powershell.exe\' -ArgumentList $inner -Verb RunAs -WindowStyle Hidden',
            '    exit 0',
            '}',
            '',
            "$env:ELECTRON_RUN_AS_NODE = '1'",
            `$p = Start-Process -FilePath ${quotePowerShell(process.execPath)} -ArgumentList @(${agentArgs}) -PassThru -Wait`,
            'exit $p.ExitCode',
            '',
        ].join('\r\n');
        fs.mkdirSync(path.dirname(this.launcherPath), { recursive: true });
        fs.writeFileSync(this.launcherPath, content);
        return this.launcherPath;
    }

    private elevate(allowDir: string): void {
        let launcher = this.prepareLauncher(allowDir);
        tools.log.info(l10n.t('正在请求管理员权限启动代理...'));
        let child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher], {
            stdio: 'ignore',
            windowsHide: true,
        });
        child.on('error', (error) => {
            tools.log.error(l10n.t('启动提权代理失败：{0}', String(error)));
        });
    }

    private onConnection(socket: net.Socket) {
        socket.setEncoding('utf8');
        let handshaked = false;
        let decoder = new LineDecoder((message: any) => {
            if (!handshaked) {
                if (message?.type === 'ready' && message.token === this.token) {
                    handshaked = true;
                    this.onAgentReady(socket);
                } else {
                    socket.destroy();
                }
                return;
            }
            this.onMessage(message);
        });
        socket.on('data', (chunk: string) => decoder.push(chunk));
        socket.on('error', () => {
        });
        socket.on('close', () => {
            if (this.socket === socket) {
                this.socket = undefined;
                this.onAgentLost();
            }
        });
    }

    private onAgentReady(socket: net.Socket) {
        if (this.socket && this.socket !== socket) {
            this.socket.destroy();
        }
        this.socket = socket;
        this.waiter?.done(true);
    }

    private onAgentLost() {
        this.running.clear();
        for (let entry of this.launching.values()) {
            clearTimeout(entry.timer);
            entry.resolve(undefined);
        }
        this.launching.clear();
    }

    private onMessage(message: AgentMessage) {
        switch (message.type) {
            case 'launched': {
                let entry = this.launching.get(message.id);
                if (entry) {
                    clearTimeout(entry.timer);
                    this.launching.delete(message.id);
                    entry.resolve(0);
                }
                break;
            }
            case 'exit': {
                let exe = this.running.get(message.id);
                this.running.delete(message.id);
                if (exe) {
                    tools.log.info(l10n.t('{0} 已退出，退出码：{1}', exe, String(message.code)));
                }
                break;
            }
            case 'error': {
                tools.log.error(l10n.t('提权代理错误：{0}', message.message));
                let entry = message.id === undefined ? undefined : this.launching.get(message.id);
                if (entry && message.id !== undefined) {
                    clearTimeout(entry.timer);
                    this.launching.delete(message.id);
                    this.running.delete(message.id);
                    entry.resolve(1);
                }
                break;
            }
            default:
                break;
        }
    }
}

let current: LaunchAgentManager | undefined;

export function initLaunchAgent(context: vscode.ExtensionContext) {
    current = new LaunchAgentManager(context);
}

export function getLaunchAgent(): LaunchAgentManager | undefined {
    return current;
}

export function shutdownLaunchAgent() {
    current?.shutdown();
    current = undefined;
}
