import { createHash } from 'crypto';
import * as net from 'net';

export const cloudScriptAddress = '127.0.0.1:12306';
const blockStart = '-- BEGIN Y3 HELPER LOCAL CLOUD DEBUG';
const blockEnd = '-- END Y3 HELPER LOCAL CLOUD DEBUG';

export function cloudScriptPipe(projectPath: string): string {
    const key = createHash('sha256').update(projectPath.replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 24);
    return `\\\\.\\pipe\\y3-helper-cloud-${key}`;
}

function luaString(value: string): string {
    let equals = '';
    while (value.includes(`]${equals}]`)) {
        equals += '=';
    }
    return `[${equals}[${value}]${equals}]`;
}

/** Load at entry only when the host exposes the local debugger prerequisites. */
export function installCloudScriptEntry(source: string, bootstrapPath: string, debuggerPath: string, pipe: string): string {
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const start = source.indexOf(blockStart);
    const end = source.indexOf(blockEnd);
    const block = [
        blockStart,
        '-- 本段代码由 Y3 Helper 自动添加和维护，用于在本地附加云脚本调试器。',
        '-- 如果不清楚这段代码的作用，请不要修改本段代码及首尾标记。',
        '-- 入口检查 loadfile、io.open、os.getenv 和 package.loadlib；接口不完整时直接继续业务。',
        '-- 通过 Helper 开启自动附加后启动，会等待调试器就绪，再执行后续 require。',
        '-- 编辑器直接启动不等待，可稍后手动附加；捕获入口断点请使用 Helper 调试启动。',
        'do',
        '    if type(loadfile) == "function"',
        '        and type(io) == "table" and type(io.open) == "function"',
        '        and type(os) == "table" and type(os.getenv) == "function"',
        '        and type(package) == "table" and type(package.loadlib) == "function" then',
        '        local ok, err = pcall(function()',
        `            local bootstrap = assert(loadfile(${luaString(bootstrapPath.replace(/\\/g, '/'))}))`,
        `            bootstrap()(${luaString(debuggerPath.replace(/\\/g, '/'))}, ${luaString(pipe)})`,
        '        end)',
        '        if not ok and type(Log) == "table" and type(Log.warn) == "function" then',
        '            pcall(Log.warn, "[Y3 Helper] cloud debugger: " .. tostring(err))',
        '        end',
        '    end',
        'end',
        blockEnd,
    ].join(newline);
    if (start !== -1 || end !== -1) {
        if (start === -1 || end < start || source.indexOf(blockStart, start + 1) !== -1) {
            throw new Error('云脚本调试引导标记不完整，请检查 main.lua。');
        }
        const suffix = source.slice(end + blockEnd.length);
        return source.slice(0, start) + block + newline.repeat(3) + suffix.replace(/^(?:\r?\n){0,3}/, '');
    }
    const bom = source.startsWith('\uFEFF') ? '\uFEFF' : '';
    return bom + block + newline.repeat(3) + source.slice(bom.length);
}

export function createCloudScriptDebugConfiguration(projectPath: string, attempt?: string) {
    return {
        type: 'lua', request: 'attach', name: 'Y3 Local Cloud Script',
        address: cloudScriptAddress, stopOnEntry: false, sourceCoding: 'utf8',
        sourceMaps: [['./*', projectPath.replace(/\\/g, '/') + '/cloud_script/*']],
        y3HelperDebugKind: 'cloudScript',
        ...(attempt ? { y3HelperCloudAttempt: attempt } : {}),
    };
}

/** A pipe supplies sleeping ticks to Lua without busy loops or debugger-private APIs.
 * Closing it (including when VS Code exits) releases the Lua callback through EOF.
 */
export class CloudScriptBridge {
    private readonly server = net.createServer((socket) => this.accept(socket));
    private sockets = new Map<net.Socket, NodeJS.Timeout>();
    private waiting = false;
    private ready?: () => void;

    constructor(readonly pipe: string) {}

    async listen(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.pipe, () => {
                this.server.off('error', reject);
                resolve();
            });
        });
    }

    beginWait(): Promise<void> {
        this.release();
        this.waiting = true;
        return new Promise((resolve) => { this.ready = resolve; });
    }

    private accept(socket: net.Socket) {
        socket.on('error', () => socket.destroy());
        if (!this.waiting) {
            socket.end('continue\n', () => socket.destroy());
            return;
        }
        socket.write('wait\n');
        const timer = setInterval(() => {
            if (socket.writableLength === 0) {
                socket.write('wait\n');
            }
        }, 100);
        this.sockets.set(socket, timer);
        socket.on('close', () => {
            clearInterval(timer);
            this.sockets.delete(socket);
        });
        this.ready?.();
        this.ready = undefined;
    }

    release() {
        this.waiting = false;
        this.ready = undefined;
        for (const [socket, timer] of this.sockets) {
            clearInterval(timer);
            socket.end('continue\n', () => socket.destroy());
        }
        this.sockets.clear();
    }

    dispose() {
        this.release();
        this.server.close();
    }
}
