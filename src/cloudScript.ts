import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { env } from './env';
import { config } from './config';
import {
    allocatePort,
    createCloudScriptDebugConfiguration,
    portListening,
    readCloudScriptDebugPort,
    resolveLuaDebuggerPath,
    writeCloudScriptDebugFiles,
} from './cloudScriptDebug';

let context: vscode.ExtensionContext;
let active: { project: string; port: number } | undefined;
let preparing: Promise<boolean> = Promise.resolve(false);
let cancelPending: (() => void) | undefined;
const sessions = new Set<vscode.DebugSession>();
let disposed = false;
const timeoutMs = 30000;

export function init(extensionContext: vscode.ExtensionContext) {
    context = extensionContext;
    disposed = false;
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('lua', {
        async provideDebugConfigurations(folder) {
            const project = env.projectUri;
            if (!project || config.multiMode || process.platform !== 'win32') { return []; }
            const projectFolder = vscode.workspace.getWorkspaceFolder(project) ?? vscode.workspace.workspaceFolders?.[0];
            if (folder && projectFolder && folder.uri.fsPath !== projectFolder.uri.fsPath) { return []; }
            const port = await readCloudScriptDebugPort(project.fsPath);
            if (!port) { return []; }
            return [{ ...createCloudScriptDebugConfiguration(project.fsPath, port), name: '☁️附加本地云脚本' }];
        },
    }, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        if (session.configuration.y3HelperDebugKind === 'cloudScript') { sessions.add(session); }
    }));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession((session) => sessions.delete(session)));
    context.subscriptions.push({ dispose() {
        disposed = true;
        cancelPending?.();
        active = undefined;
    } });
}

function reportError(error: unknown) {
    void vscode.window.showErrorMessage(`本地云脚本调试：${String(error)}`);
}

/**
 * 启动游戏前准备调试信息：写入调试器目录与随机端口到 cloud_script/script_log。
 * 云脚本入口读这两个文件起监听；没装调试器插件时静默跳过。
 */
export function prepare(): Promise<boolean> {
    preparing = preparing.catch(() => false).then(async () => {
        if (disposed) { return false; }
        const project = env.projectUri?.fsPath;
        if (!project || process.platform !== 'win32') { return false; }
        try {
            await fs.access(path.join(project, 'cloud_script'));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') { return false; }
            throw error;
        }
        const debuggerPath = await resolveLuaDebuggerPath([path.dirname(context.extensionPath)]);
        if (!debuggerPath) {
            throw new Error('未找到 actboy168 的 Lua Debug 插件，请先安装后再启动游戏。');
        }
        const port = await allocatePort();
        await writeCloudScriptDebugFiles(project, debuggerPath, port);
        active = { project, port };
        return true;
    });
    return preparing;
}

export async function cancelAutoAttach() { cancelPending?.(); }

/** 手动附加：云脚本已经在跑，直接连上它监听的那个端口。 */
export async function attach(): Promise<boolean> {
    try {
        const project = env.projectUri?.fsPath;
        if (!project || process.platform !== 'win32') {
            throw new Error('请先打开云脚本项目（仅 Windows 支持本地调试）。');
        }
        if (config.multiMode) {
            throw new Error('本地多开使用远程云脚本服，不能附加本地云脚本。');
        }
        const port = await readCloudScriptDebugPort(project);
        if (!port) {
            throw new Error('还没有云脚本调试端口，请先启动一次游戏。');
        }
        if (!await waitListening(port, 2000)) {
            throw new Error('未检测到正在运行的本地云脚本，请先启动游戏。');
        }
        const controller = new AbortController();
        const cancel = () => controller.abort();
        cancelPending = cancel;
        try {
            return await connect(project, port, controller.signal);
        } finally {
            if (cancelPending === cancel) { cancelPending = undefined; }
        }
    } catch (error) { reportError(error); return false; }
}

async function waitListening(port: number, ms: number): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (await portListening(port)) { return true; }
        await delay(100);
    }
    return false;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve after DAP configurationDone, not merely after creation of a VS Code session. */
async function connect(project: string, port: number, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) { return false; }
    await Promise.all([...sessions].map((session) => vscode.debug.stopDebugging(session)));
    const attempt = randomUUID();
    let session: vscode.DebugSession | undefined;
    let abandoned = false;
    let finish!: (value: boolean) => void;
    const completed = new Promise<boolean>((resolve) => { finish = resolve; });
    const abort = () => finish(false);
    const tracker = vscode.debug.registerDebugAdapterTrackerFactory('lua', {
        createDebugAdapterTracker(candidate) {
            if (candidate.configuration.y3HelperCloudAttempt !== attempt) { return; }
            session = candidate;
            return {
                onDidSendMessage(message) {
                    if (message.type === 'response' && message.command === 'configurationDone') {
                        finish(message.success === true);
                    }
                    if (message.type === 'response' && message.success === false
                        && ['initialize', 'attach'].includes(message.command)) { finish(false); }
                },
                onError() { finish(false); },
                onExit() { finish(false); },
            };
        },
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    try {
        if (signal.aborted) { return false; }
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(project)) ?? vscode.workspace.workspaceFolders?.[0];
        const startedListener = vscode.debug.onDidStartDebugSession((candidate) => {
            if (candidate.configuration.y3HelperCloudAttempt !== attempt) { return; }
            session = candidate;
            if (abandoned || signal.aborted) { void vscode.debug.stopDebugging(candidate); }
        });
        void vscode.debug.startDebugging(folder, createCloudScriptDebugConfiguration(project, port, attempt))
            .then((started) => {
                if (!started) { finish(false); }
                if ((abandoned || signal.aborted) && session) { void vscode.debug.stopDebugging(session); }
                startedListener.dispose();
            }, () => { startedListener.dispose(); finish(false); });
        const success = await completed;
        abandoned = !success;
        if (!success && session) { await vscode.debug.stopDebugging(session); }
        return success;
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        tracker.dispose();
    }
}

export interface CloudScriptAutoAttachOperation {
    readonly completion: Promise<boolean>;
    cancel(): void;
}

export async function beginAutoAttach(): Promise<CloudScriptAutoAttachOperation | undefined> {
    cancelAutoAttach();
    if (config.multiMode) { return undefined; }
    if (!active && !await prepare()) { return undefined; }
    if (!active) { return undefined; }
    const { project, port } = active;
    const controller = new AbortController();
    let abort!: () => void;
    const cancelled = new Promise<boolean>((resolve) => { abort = () => resolve(false); });
    const cancel = () => { controller.abort(); abort(); };
    cancelPending = cancel;
    const completion = (async () => {
        try {
            let listening = false;
            while (!controller.signal.aborted) {
                if (!listening) {
                    listening = await Promise.race([
                        waitListening(port, timeoutMs),
                        cancelled.then(() => false),
                    ]);
                }
                if (listening && await connect(project, port, controller.signal)) { return true; }
                if (controller.signal.aborted) { return false; }
                const action = await Promise.race([vscode.window.showWarningMessage(
                    listening ? '本地云脚本附加失败或超时。请选择重试，或继续运行云脚本。'
                        : '30 秒内未检测到本地云脚本调试端口，请检查云脚本日志。',
                    '重试', '继续运行',
                ), cancelled.then(() => undefined)]);
                if (action !== '重试') { return false; }
            }
            return false;
        } catch (error) {
            if (!controller.signal.aborted) { reportError(error); }
            return false;
        } finally {
            if (cancelPending === cancel) { cancelPending = undefined; }
        }
    })();
    return { completion, cancel };
}
