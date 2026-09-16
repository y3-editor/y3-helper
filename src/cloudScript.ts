import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';
import { randomUUID } from 'crypto';
import { env } from './env';
import { config } from './config';
import { CloudScriptBridge, cloudScriptPipe, createCloudScriptDebugConfiguration, installCloudScriptEntry, hasCloudScriptEntry, removeCloudScriptEntry } from './cloudScriptDebug';

let context: vscode.ExtensionContext;
let active: { project: string; bridge: CloudScriptBridge } | undefined;
let preparing: Promise<boolean> = Promise.resolve(false);
let cancelPending: (() => void) | undefined;
const sessions = new Set<vscode.DebugSession>();
let disposed = false;
const timeoutMs = 30000;

export function init(extensionContext: vscode.ExtensionContext) {
    context = extensionContext;
    disposed = false;
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('lua', {
            async resolveDebugConfiguration(_folder, debugConfig) {
                if (debugConfig.y3HelperDebugKind !== 'cloudScript') { return debugConfig; }
                try {
                    if (config.multiMode) { throw new Error('本地多开使用远程云脚本服，不能附加本地云脚本。'); }
                    if (!env.projectUri) { throw new Error('请先打开云脚本项目。'); }
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(env.projectUri.fsPath, 'cloud_script/main.lua')));
                    if (!hasCloudScriptEntry(doc.getText()) || doc.isDirty) {
                        throw new Error('请先执行“启用本地云脚本调试”并保存，然后重新启动游戏；也可以勾选自动附加后通过 Helper 启动。');
                    }
                    return debugConfig;
                } catch (error) { reportError(error); return undefined; }
            },
        }),
    );
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('lua', {
        async provideDebugConfigurations(folder) {
            const project = env.projectUri;
            if (!project || config.multiMode || process.platform !== 'win32') { return []; }
            const projectFolder = vscode.workspace.getWorkspaceFolder(project) ?? vscode.workspace.workspaceFolders?.[0];
            if (folder && projectFolder && folder.uri.fsPath !== projectFolder.uri.fsPath) { return []; }
            try {
                await fs.access(path.join(project.fsPath, 'cloud_script', 'main.lua'));
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { reportError(error); }
                return [];
            }
            return [{ ...createCloudScriptDebugConfiguration(project.fsPath), name: '附加本地云脚本' }];
        },
    }, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        if (session.configuration.y3HelperDebugKind === 'cloudScript') { sessions.add(session); }
    }));
    context.subscriptions.push(vscode.debug.onDidTerminateDebugSession((session) => sessions.delete(session)));
    context.subscriptions.push(env.onDidChange(() => {
        if (active && active.project !== env.projectUri?.fsPath) {
            cancelPending?.();
            active.bridge.dispose();
            active = undefined;
        }
    }));
    context.subscriptions.push({ dispose() {
        disposed = true;
        cancelPending?.();
        active?.bridge.dispose();
        active = undefined;
    } });
}

async function saveEntry(doc: vscode.TextDocument, updated: string) {
    if (updated === doc.getText()) { return; }
    if (doc.isDirty) { throw new Error('请先保存 cloud_script/main.lua，再修改调试引导。'); }
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), updated);
    if (!await vscode.workspace.applyEdit(edit) || !await doc.save()) { throw new Error('无法保存云脚本调试引导。'); }
}

export async function enable(): Promise<boolean> {
    try {
        const project = env.projectUri;
        if (!project) { throw new Error('请先打开云脚本项目。'); }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(project.fsPath, 'cloud_script/main.lua')));
        const installed = hasCloudScriptEntry(doc.getText());
        if (!installed) {
            const choice = await vscode.window.showWarningMessage(
                '启用本地云脚本调试会在 main.lua 开头插入调试器引导代码。确认要修改 main.lua 吗？',
                { modal: true },
                '确认修改',
            );
            if (choice !== '确认修改') { return false; }
        }
        if (env.projectUri?.fsPath !== project.fsPath) { throw new Error('项目已切换，请重新启用云脚本调试。'); }
        if (!await prepare()) { throw new Error('未找到 cloud_script/main.lua，或当前平台不支持本地调试。'); }
        if (!installed) { void vscode.window.showInformationMessage('本地云脚本调试引导已准备好，请重新启动游戏后附加。'); }
        return true;
    } catch (error) { reportError(error); return false; }
}

export async function remove(): Promise<boolean> {
    preparing = preparing.catch(() => false).then(async () => {
        if (!env.projectUri || disposed) { return false; }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(env.projectUri.fsPath, 'cloud_script/main.lua')));
        await saveEntry(doc, removeCloudScriptEntry(doc.getText()));
        config.attachCloudScriptWhenLaunch = false;
        cancelPending?.();
        active?.bridge.dispose();
        active = undefined;
        void vscode.window.showInformationMessage('本地云脚本调试引导已移除，自动附加已关闭。');
        return true;
    });
    try { return await preparing; } catch (error) { reportError(error); return false; }
}

function reportError(error: unknown) {
    void vscode.window.showErrorMessage(`本地云脚本调试：${String(error)}`);
}

export function prepare(): Promise<boolean> {
    // Serialize explicit entry edits and launch preparation.
    preparing = preparing.catch(() => false).then(async () => {
        if (disposed) { return false; }
        const project = env.projectUri?.fsPath;
        if (active && active.project !== project) {
            cancelPending?.();
            active.bridge.dispose();
            active = undefined;
        }
        if (!project || process.platform !== 'win32') { return false; }
        const entry = path.join(project, 'cloud_script', 'main.lua');
        try { await fs.access(entry); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') { return false; }
            throw error;
        }
        const luaDebug = vscode.extensions.getExtension('actboy168.lua-debug');
        if (!luaDebug) { throw new Error('请安装 actboy168 的 Lua Debug 插件。'); }
        await luaDebug.activate();
        const debuggerPath = path.join(luaDebug.extensionPath, 'script', 'debugger.lua');
        const bootstrapPath = context.asAbsolutePath('resources/cloudScriptDebugger.lua');
        await Promise.all([fs.access(debuggerPath), fs.access(bootstrapPath)]);
        if (disposed) { return false; }
        if (!active) {
            const bridge = new CloudScriptBridge(cloudScriptPipe(project));
            await bridge.listen();
            active = { project, bridge };
        }
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(entry));
        const source = doc.getText();
        const updated = installCloudScriptEntry(source, bootstrapPath, debuggerPath, active.bridge.pipe);
        await saveEntry(doc, updated);
        return true;
    });
    return preparing;
}

async function portAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.listen(12306, '127.0.0.1', () => server.close(() => resolve(true)));
    });
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve after DAP configurationDone, not merely after creation of a VS Code session. */
async function connect(project: string, signal: AbortSignal): Promise<boolean> {
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
        void vscode.debug.startDebugging(folder, createCloudScriptDebugConfiguration(project, attempt))
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

export function cancelAutoAttach() { cancelPending?.(); }

export async function beginAutoAttach(): Promise<CloudScriptAutoAttachOperation | undefined> {
    cancelPending?.();
    if (config.multiMode) { return undefined; }
    if (!await prepare() || !active) { throw new Error('未找到可调试的本地 cloud_script/main.lua（仅支持 Windows）。'); }
    if (!await portAvailable()) {
        throw new Error('端口 12306 已被占用，请先关闭现有本地云脚本实例；当前仅支持单实例调试。');
    }
    const { project, bridge } = active;
    const controller = new AbortController();
    const ready = bridge.beginWait().then(() => true);
    let abort!: () => void;
    const cancelled = new Promise<boolean>((resolve) => { abort = () => resolve(false); });
    const cancel = () => { controller.abort(); bridge.release(); abort(); };
    cancelPending = cancel;
    const completion = (async () => {
        try {
            let found = false;
            while (!controller.signal.aborted) {
                if (!found) {
                    let timer: NodeJS.Timeout | undefined;
                    try {
                        found = await Promise.race([ready, cancelled, new Promise<boolean>((resolve) => {
                            timer = setTimeout(() => resolve(false), timeoutMs);
                        })]);
                    } finally { clearTimeout(timer); }
                }
                // The debugger starts its listener on a background thread before opening the pipe.
                if (found) {
                    await delay(200);
                    if (await connect(project, controller.signal)) { return true; }
                }
                if (controller.signal.aborted) { return false; }
                const action = await Promise.race([vscode.window.showWarningMessage(
                    found ? '本地云脚本附加失败或超时。请选择重试，或继续运行云脚本。'
                        : '30 秒内未收到本地云脚本调试就绪信号（main.lua 入口），请检查云脚本日志。',
                    '重试', '继续运行',
                ), cancelled.then(() => undefined)]);
                if (action !== '重试') { return false; }
            }
            return false;
        } catch (error) {
            if (!controller.signal.aborted) { reportError(error); }
            return false;
        } finally {
            if (cancelPending === cancel) {
                bridge.release();
                cancelPending = undefined;
            }
        }
    })();
    return { completion, cancel };
}

