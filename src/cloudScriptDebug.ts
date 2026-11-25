import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

const debuggerExtensionPrefix = 'actboy168.lua-debug-';
const debuggerEntry = path.join('script', 'debugger.lua');

function parseVersion(name: string): number[] | undefined {
    const match = name.match(/^actboy168\.lua-debug-(\d+)\.(\d+)\.(\d+)(?:-|$)/);
    if (!match) { return undefined; }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersion(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) { return diff; }
    }
    return 0;
}

function luaString(value: string): string {
    let equals = '';
    while (value.includes(`]${equals}]`)) {
        equals += '=';
    }
    return `[${equals}[${value}]${equals}]`;
}

/**
 * 取本地调试器目录：优先用当前窗口加载的 actboy168.lua-debug，
 * 取不到才扫扩展目录里最新版本的安装。
 */
export async function resolveLuaDebuggerPath(extraDirs: string[] = []): Promise<string | undefined> {
    const loaded = vscode.extensions.getExtension('actboy168.lua-debug')?.extensionPath;
    if (loaded) {
        try {
            await fs.access(path.join(loaded, debuggerEntry));
            return loaded;
        } catch {
            // 当前扩展缺 debugger.lua 时退回扫目录
        }
    }

    const roots = new Set<string>();
    const home = os.homedir();
    for (const dir of ['.vscode', '.vscode-insiders', '.vscode-oss', '.cursor']) {
        roots.add(path.join(home, dir, 'extensions'));
    }
    if (process.env.VSCODE_EXTENSIONS) {
        roots.add(process.env.VSCODE_EXTENSIONS);
    }
    for (const dir of extraDirs) {
        roots.add(dir);
    }

    let best: { version: number[]; full: string } | undefined;
    for (const root of roots) {
        let entries;
        try {
            entries = await fs.readdir(root, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith(debuggerExtensionPrefix)) {
                continue;
            }
            const version = parseVersion(entry.name);
            if (!version) { continue; }
            if (best && compareVersion(version, best.version) <= 0) { continue; }
            const full = path.join(root, entry.name);
            try {
                await fs.access(path.join(full, debuggerEntry));
            } catch {
                continue;
            }
            best = { version, full };
        }
    }
    return best?.full;
}

/** 申请一个空闲端口：监听 0 端口拿到号后立刻释放 */
export async function allocatePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close(() => {
                if (port > 0) {
                    resolve(port);
                } else {
                    reject(new Error('无法分配云脚本调试端口。'));
                }
            });
        });
    });
}

/** 端口是否已经有进程在监听（云脚本已起监听） */
export async function portListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect(port, '127.0.0.1');
        socket.once('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.once('error', () => resolve(false));
    });
}

export function cloudScriptDebugDir(project: string): string {
    return path.join(project, 'cloud_script', 'script_log');
}

/** 云脚本启动前写入调试器目录与端口，云脚本入口读这两个文件起监听 */
export async function writeCloudScriptDebugFiles(project: string, debuggerPath: string, port: number): Promise<void> {
    const dir = cloudScriptDebugDir(project);
    await fs.mkdir(dir, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(dir, 'debugger_path.lua'), `return ${luaString(debuggerPath.replace(/\\/g, '/'))}\n`, 'utf8'),
        fs.writeFile(path.join(dir, 'debugger_port.lua'), `return ${port}\n`, 'utf8'),
    ]);
}

/** 读回上次写入的调试端口，手动附加时用 */
export async function readCloudScriptDebugPort(project: string): Promise<number | undefined> {
    try {
        const text = await fs.readFile(path.join(cloudScriptDebugDir(project), 'debugger_port.lua'), 'utf8');
        const port = Number(text.match(/return\s+(\d+)/)?.[1]);
        return Number.isInteger(port) && port > 0 ? port : undefined;
    } catch {
        return undefined;
    }
}

export function createCloudScriptDebugConfiguration(projectPath: string, port: number, attempt?: string) {
    return {
        type: 'lua', request: 'attach', name: '☁️云脚本',
        address: `127.0.0.1:${port}`, stopOnEntry: false, sourceCoding: 'utf8',
        sourceMaps: [['./*', projectPath.replace(/\\/g, '/') + '/cloud_script/*']],
        y3HelperDebugKind: 'cloudScript',
        ...(attempt ? { y3HelperCloudAttempt: attempt } : {}),
    };
}
