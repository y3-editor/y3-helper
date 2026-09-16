// 提权代理：以管理员权限常驻，接收扩展宿主下发的启动请求。
// 本文件作为独立进程运行（ELECTRON_RUN_AS_NODE=1），不得引用 vscode 模块。

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execFileSync, ChildProcess } from 'child_process';
import { AgentMessage, AgentRequest, KillRequest, LaunchRequest, LineDecoder, encodeMessage } from './protocol';

/** 白名单：只允许启动游戏主程序 */
const ALLOWED_EXE = 'game_x64h.exe';
/** 断线后重连的间隔 */
const RETRY_INTERVAL = 2000;

interface Options {
    pipe: string;
    token: string;
    allowDir: string;
    grace: number;
    lock?: string;
    log?: string;
}

function parseArgs(argv: string[]): Options | undefined {
    function get(name: string): string | undefined {
        for (let i = 0; i < argv.length; i++) {
            if (argv[i] === name) {
                return argv[i + 1];
            }
            if (argv[i].startsWith(name + '=')) {
                return argv[i].slice(name.length + 1);
            }
        }
        return undefined;
    }
    let pipe = get('--pipe');
    let token = get('--token');
    let allowDir = get('--allow-dir');
    if (!pipe || !token || !allowDir) {
        return undefined;
    }
    return {
        pipe: pipe,
        token: token,
        allowDir: path.resolve(allowDir),
        grace: Number(get('--grace')) || 30000,
        lock: get('--lock'),
        log: get('--log'),
    };
}

const options = parseArgs(process.argv.slice(2));
if (!options) {
    process.exit(1);
}

/** 代理运行在提权进程中，stdout 不可见，只能落文件排查 */
function log(message: string) {
    let file = options!.log;
    if (!file) {
        return;
    }
    try {
        fs.appendFileSync(file, new Date().toISOString() + ' ' + message + '\n');
    } catch (error) {
    }
}

if (options.log) {
    try {
        fs.mkdirSync(path.dirname(options.log), { recursive: true });
        fs.writeFileSync(options.log, '');
    } catch (error) {
    }
}
log('started: pipe=' + options.pipe + ' allowDir=' + options.allowDir + ' grace=' + options.grace);

let socket: net.Socket | undefined;
let retryTimer: NodeJS.Timeout | undefined;
let deadline: number | undefined;
let exiting = false;
let locked = false;
const children = new Map<number, ChildProcess>();

function send(message: AgentMessage) {
    if (socket && !socket.destroyed) {
        socket.write(encodeMessage(message));
    }
}

/** 留下存活标记，供扩展宿主判断是否有可复用的代理 */
function writeLock() {
    if (!options!.lock || locked) {
        return;
    }
    locked = true;
    try {
        fs.mkdirSync(path.dirname(options!.lock), { recursive: true });
        fs.writeFileSync(options!.lock, String(process.pid));
    } catch (error) {
    }
}

function exit() {
    if (exiting) {
        return;
    }
    exiting = true;
    log('exiting');
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
    }
    if (socket) {
        socket.destroy();
        socket = undefined;
    }
    if (options!.lock) {
        try {
            fs.rmSync(options!.lock, { force: true });
        } catch (error) {
        }
    }
    process.exit(0);
}

function checkExe(exe: string): string | undefined {
    if (path.basename(exe).toLowerCase() !== ALLOWED_EXE) {
        return 'not allowed executable: ' + path.basename(exe);
    }
    let relative = path.relative(options!.allowDir, path.resolve(path.dirname(exe)));
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        // 带上两侧目录，便于区分「用户换了编辑器目录」和「路径被编码破坏」两类问题
        return 'path is outside of the allowed directory: allowDir=' + options!.allowDir
            + ' exeDir=' + path.resolve(path.dirname(exe));
    }
    return undefined;
}

function handleLaunch(request: LaunchRequest) {
    log('launch request id=' + request.id + ' exe=' + request.exe);
    let reason = checkExe(request.exe);
    if (reason) {
        log('rejected: ' + reason);
        send({ type: 'error', id: request.id, message: reason });
        return;
    }
    let child: ChildProcess;
    try {
        child = spawn(request.exe, request.args, {
            cwd: request.cwd,
            // detached: 游戏必须独立于代理存活（代理会在断开 30s 后自杀），
            // 且避免挂在代理的控制台上被连带关闭。
            detached: true,
            stdio: 'ignore',
        });
    } catch (error) {
        send({ type: 'error', id: request.id, message: String(error) });
        return;
    }
    children.set(request.id, child);
    child.on('spawn', () => {
        log('spawned pid=' + child.pid);
        send({ type: 'launched', id: request.id, pid: child.pid ?? 0 });
    });
    child.on('error', (error) => {
        log('spawn error: ' + String(error));
        children.delete(request.id);
        send({ type: 'error', id: request.id, message: String(error) });
    });
    child.on('exit', (code) => {
        log('child exited id=' + request.id + ' code=' + code);
        children.delete(request.id);
        send({ type: 'exit', id: request.id, code: code });
    });
    // 代理退出不影响已启动的游戏
    child.unref();
}

/** 游戏以管理员权限启动，只有同样提权的代理才能终止它 */
function killTree(pid: number) {
    if (process.platform === 'win32') {
        try {
            // /T 连同游戏拉起的子进程一起终止
            execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        } catch (error) {
            log('taskkill failed pid=' + pid + ': ' + String(error));
        }
        return;
    }
    try {
        process.kill(-pid, 'SIGKILL');
    } catch (error) {
        try {
            process.kill(pid, 'SIGKILL');
        } catch (error) {
            log('kill failed pid=' + pid);
        }
    }
}

function handleKill(request: KillRequest) {
    let count = 0;
    for (let [id, child] of children) {
        let pid = child.pid;
        if (pid === undefined) {
            continue;
        }
        log('kill request id=' + request.id + ' target id=' + id + ' pid=' + pid);
        killTree(pid);
        count += 1;
    }
    send({ type: 'killed', id: request.id, count: count });
}

function handleMessage(message: AgentRequest) {
    switch (message.type) {
        case 'launch':
            handleLaunch(message);
            break;
        case 'kill':
            handleKill(message);
            break;
        case 'ping':
            send({ type: 'pong' });
            break;
        case 'shutdown':
            exit();
            break;
        default:
            break;
    }
}

function scheduleRetry() {
    if (exiting) {
        return;
    }
    if (deadline === undefined) {
        deadline = Date.now() + options!.grace;
    }
    if (retryTimer) {
        return;
    }
    retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (deadline !== undefined && Date.now() >= deadline) {
            exit();
            return;
        }
        connect();
    }, RETRY_INTERVAL);
}

function connect() {
    if (exiting) {
        return;
    }
    log('connecting to ' + options!.pipe);
    let connection = net.connect(options!.pipe);
    connection.setEncoding('utf8');
    let decoder = new LineDecoder((message: any) => {
        if (message?.type === 'ready') {
            return;
        }
        handleMessage(message);
    });
    connection.on('data', (chunk: string) => decoder.push(chunk));
    connection.on('connect', () => {
        socket = connection;
        deadline = undefined;
        writeLock();
        log('connected');
        send({ type: 'ready', token: options!.token });
    });
    connection.on('error', (error: NodeJS.ErrnoException) => {
        log('connect error: ' + (error.code ?? '') + ' ' + error.message);
    });
    connection.on('close', () => {
        if (socket === connection) {
            socket = undefined;
        }
        log('connection closed, retry in ' + RETRY_INTERVAL + 'ms');
        scheduleRetry();
    });
}

connect();
