import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { ChildProcess, fork } from 'child_process';
import { getCodeMakerConfig } from './configProvider';

const DEFAULT_PORT = 3001;
const MAX_PORT_ATTEMPTS = 100;

/**
 * CodeMaker API Server 管理器
 * 负责启动/停止 API Server 子进程、端口冲突自动递增
 */
export class CodeMakerApiServer {
    private _process: ChildProcess | undefined;
    private _port: number = DEFAULT_PORT;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _globalStoragePath: string,
    ) {}

    /**
     * 启动 API Server，返回实际使用的端口号
     */
    public async start(): Promise<number> {
        if (this._process) {
            return this._port;
        }

        // 找一个可用端口
        this._port = await this._findAvailablePort(DEFAULT_PORT);

        // API Server 入口路径
        const serverEntryPath = path.join(this._extensionUri.fsPath, 'resources', 'codemaker', 'api-server', 'index.mjs');

        // 从 VSCode Settings 读取用户配置
        const config = getCodeMakerConfig();

        // 环境变量注入
        const env: Record<string, string> = {
            ...process.env as Record<string, string>,
            PORT: String(this._port),
            CHAT_HISTORY_PATH: this._globalStoragePath,
            // 禁用 Node.js 严格 TLS 证书验证（解决 Windows 下 CRYPT_E_NO_REVOCATION_CHECK 问题）
            NODE_TLS_REJECT_UNAUTHORIZED: '0',
        };
        if (config.apiKey) {
            env['AI_API_KEY'] = config.apiKey;
        }
        if (config.apiBaseUrl) {
            env['AI_API_BASE_URL'] = config.apiBaseUrl;
        }
        if (config.wireApi) {
            env['AI_WIRE_API'] = config.wireApi;
        }

        return this._tryStartOnPort(serverEntryPath, env, this._port, MAX_PORT_ATTEMPTS);
    }

    /**
     * 尝试在指定端口启动 API Server，如果端口被占用则自动递增重试
     */
    private _tryStartOnPort(serverEntryPath: string, env: Record<string, string>, port: number, remainingAttempts: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            if (remainingAttempts <= 0) {
                reject(new Error(`无法找到可用端口（已尝试 ${DEFAULT_PORT}~${DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1}）`));
                return;
            }

            env['PORT'] = String(port);
            let settled = false;

            try {
                const child = fork(serverEntryPath, [], {
                    env: { ...env },
                    stdio: 'pipe',
                    silent: true,
                });

                const startupTimeout = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        // 超时 3 秒还没出错，认为启动成功
                        this._process = child;
                        this._port = port;
                        resolve(port);
                    }
                }, 3000);

                child.stdout?.on('data', (data: Buffer) => {
                    console.log(`[Y3Maker API] ${data.toString().trim()}`);
                });

                child.stderr?.on('data', (data: Buffer) => {
                    const msg = data.toString().trim();
                    console.error(`[Y3Maker API Error] ${msg}`);

                    // 检测端口冲突错误
                    if (!settled && msg.includes('EADDRINUSE')) {
                        settled = true;
                        clearTimeout(startupTimeout);
                        child.kill();
                        console.log(`[Y3Maker API] Port ${port} is in use, trying ${port + 1}...`);
                        // 递归尝试下一个端口
                        this._tryStartOnPort(serverEntryPath, env, port + 1, remainingAttempts - 1)
                            .then(resolve)
                            .catch(reject);
                    }
                });

                child.on('error', (err) => {
                    console.error('[Y3Maker API] Process error:', err);
                    if (!settled) {
                        settled = true;
                        clearTimeout(startupTimeout);
                        reject(err);
                    }
                });

                child.on('exit', (code) => {
                    console.log(`[Y3Maker API] Process exited with code ${code}`);
                    if (!settled) {
                        settled = true;
                        clearTimeout(startupTimeout);
                        // 非零退出码，尝试下一个端口
                        if (code !== 0) {
                            console.log(`[Y3Maker API] Port ${port} failed (exit code ${code}), trying ${port + 1}...`);
                            this._tryStartOnPort(serverEntryPath, env, port + 1, remainingAttempts - 1)
                                .then(resolve)
                                .catch(reject);
                        }
                    } else {
                        // 已启动成功后退出，清理状态
                        this._process = undefined;
                    }
                });
            } catch (err) {
                if (!settled) {
                    settled = true;
                    reject(err);
                }
            }
        });
    }

    /**
     * 停止 API Server
     */
    public stop() {
        if (this._process) {
            this._process.kill();
            this._process = undefined;
            console.log('[Y3Maker API] Server stopped');
        }
    }

    /**
     * 获取当前端口号
     */
    public get port(): number {
        return this._port;
    }

    /**
     * 从指定端口开始，自动递增寻找可用端口
     * 最多尝试 MAX_PORT_ATTEMPTS 次
     */
    private async _findAvailablePort(startPort: number): Promise<number> {
        for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
            const port = startPort + i;
            const available = await this._isPortAvailable(port);
            if (available) {
                return port;
            }
        }
        throw new Error(`无法找到可用端口（已尝试 ${startPort}~${startPort + MAX_PORT_ATTEMPTS - 1}）`);
    }

    /**
     * 检测端口是否可用
     */
    private _isPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => {
                resolve(false);
            });
            server.once('listening', () => {
                server.close(() => {
                    resolve(true);
                });
            });
            server.listen(port, '127.0.0.1');
        });
    }
}
