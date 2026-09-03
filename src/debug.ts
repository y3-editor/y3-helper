import * as vscode from 'vscode';
import { env } from './env';
import * as tools from './tools';
import { config } from './config';
import * as y3 from 'y3-helper';
import * as l10n from '@vscode/l10n';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    debugAddressForPlayer,
    isManagedDebugSession,
    isMapDebugSession,
    planMissingMultiDebugPlayers,
} from './debugPlayerSessions';
import {
    createCloudScriptDebugConfiguration,
    isProcessInjectionFailure,
    selectLatestEntryPointFailure,
    waitForNewProcess,
    waitForProcessStability,
    WindowsTasklistProcessProvider,
} from './cloudScriptProcess';

const debuggerPath = '3rd/debugger';

let debugSessions: vscode.DebugSession[] = [];
let cloudScriptAttachController: AbortController | undefined;

const cloudScriptSessionName = 'Y3 Local Cloud Script';
const cloudScriptProcessTimeoutMs = 30000;
const cloudScriptProcessPollIntervalMs = 100;
const cloudScriptProcessStabilityDelayMs = 1000;

export interface CloudScriptAutoAttachOperation {
    readonly completion: Promise<boolean>;
    cancel(): void;
}

export function init(context: vscode.ExtensionContext) {
    const extensionUri = vscode.Uri.joinPath(context.extensionUri, debuggerPath);
    let debuggerContext: vscode.ExtensionContext = {
        subscriptions:                  context.subscriptions,
        workspaceState:                 context.workspaceState,
        globalState:                    context.globalState,
        secrets:                        context.secrets,
        extensionUri:                   extensionUri,
        extensionPath:                  extensionUri.fsPath,
        environmentVariableCollection:  context.environmentVariableCollection,
        asAbsolutePath: (relativePath: string) => {
            return vscode.Uri.joinPath(extensionUri, relativePath).fsPath;
        },
        storageUri:                     context.storageUri,
        storagePath:                    context.storagePath,
        globalStorageUri:               context.globalStorageUri,
        globalStoragePath:              context.globalStoragePath,
        logUri:                         context.logUri,
        logPath:                        context.logPath,
        extensionMode:                  context.extensionMode,
        extension:                      context.extension,
        languageModelAccessInformation: context.languageModelAccessInformation,
    };

    let debug = require('../' + debuggerPath + '/js/extension.js');
    debug.activate(debuggerContext);

    function updateDebuggerPath() {
        if (!env.project) {
            return;
        }
        for (const map of env.project.maps) {
            tools.fs.writeFile(map.scriptUri, 'log/debugger_path.lua', `return [[${debuggerContext.extensionUri.fsPath}]]`);
        }
        if (env.globalScriptUri) {
            tools.fs.writeFile(env.globalScriptUri, 'log/debugger_path.lua', `return [[${debuggerContext.extensionUri.fsPath}]]`);
        }
    }

    updateDebuggerPath();
    env.onDidChange(() => {
        updateDebuggerPath();
    });

    let launch = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    launch.text = l10n.t('✨启动');
    launch.tooltip = l10n.t('启动游戏');
    launch.command = 'y3-helper.launchGame';

    let attach = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    attach.text = l10n.t('💡附加');
    attach.tooltip = l10n.t('附加调试器');
    attach.command = 'y3-helper.attach';

    function updateItems() {
        if (vscode.workspace.getConfiguration('Y3-Helper', vscode.workspace.workspaceFolders?.[0]).get('ShowStatusBarItem')) {
            launch.show();
            attach.show();
        } else {
            launch.hide();
            attach.hide();
        }
    }

    updateItems();
    vscode.workspace.onDidChangeConfiguration(() => {
        updateItems();
    });

    vscode.debug.onDidStartDebugSession((e) => {
        if (!isManagedDebugSession(e.type, e)) {
            return;
        }
        debugSessions.push(e);
    });

    vscode.debug.onDidTerminateDebugSession((e) => {
        let idx = debugSessions.indexOf(e);
        if (idx !== -1) {
            debugSessions.splice(idx, 1);
            if (isMapDebugSession(e)) {
                checkNeedAttach();
            }
        }
    });

    context.subscriptions.push({
        dispose() {
            cloudScriptAttachController?.abort();
            cloudScriptAttachController = undefined;
        },
    });

    startWaitDebuggerHelper();
}

async function findWaitDebuggerFiles(): Promise<vscode.Uri[]> {
    if (!env.project) {
        return [];
    }
    const waitFiles: vscode.Uri[] = [];
    for (const map of env.project.maps) {
        const logPath = y3.uri(map.scriptUri, '.log', 'wait_debugger');
        if (await y3.fs.isExists(logPath)) {
            waitFiles.push(logPath);
        }
    }

    if (env.globalScriptUri) {
        const logPath = y3.uri(env.globalScriptUri, '.log', 'wait_debugger');
        if (await y3.fs.isExists(logPath)) {
            waitFiles.push(logPath);
        }
    }
    return waitFiles;
}

async function removeWaitDebuggerFiles(waitFiles: readonly vscode.Uri[]) {
    await Promise.all(waitFiles.map((logPath) => y3.fs.removeFile(logPath)));
}

async function checkNeedAttach() {
    const waitFiles = await findWaitDebuggerFiles();
    if (waitFiles.length === 0) {
        return;
    }

    if (!config.multiMode) {
        if (debugSessions.some(isMapDebugSession)) {
            await removeWaitDebuggerFiles(waitFiles);
            return;
        }
        if (await attachForOnePlayer()) {
            await removeWaitDebuggerFiles(waitFiles);
        }
        return;
    }

    const configuredPlayerIds = config.multiPlayers.filter((id) => config.debugPlayers.includes(id));
    const plan = planMissingMultiDebugPlayers(
        configuredPlayerIds,
        debugSessions.filter(isMapDebugSession),
    );
    if (!plan.consumeWaitMarker) {
        return;
    }
    if (plan.missingPlayerIds.length === 0) {
        await removeWaitDebuggerFiles(waitFiles);
        return;
    }

    const results = await Promise.all(
        plan.missingPlayerIds.map((id) => attachForOnePlayer(id)),
    );
    if (results.every((succeeded) => succeeded)) {
        await removeWaitDebuggerFiles(waitFiles);
    }
}

async function startWaitDebuggerHelper() {
    while (true) {
        await y3.sleep(1000);
        await checkNeedAttach();
    }
}

function getName(id?: number) {
    return id ? l10n.t('💡附加【{0}】', id) : l10n.t('💡附加');
}

function findDebugSession(id?: number) {
    let name = getName(id);
    return debugSessions.find((s) => isMapDebugSession(s) && s.name === name);
}

function isCloudScriptDebugSession(session: vscode.DebugSession): boolean {
    return session.configuration.y3HelperDebugKind === 'cloudScript';
}

async function latestEntryPointFailure(
    projectPath: string,
    launchStartedAt: number,
): Promise<string | undefined> {
    const logDirectory = path.join(projectPath, 'cloud_script', 'mls_log');
    try {
        const entries = await fs.readdir(logDirectory, { withFileTypes: true });
        const files = await Promise.all(entries
            .filter((entry) => entry.isFile())
            .map(async (entry) => {
                const filePath = path.join(logDirectory, entry.name);
                const modifiedAt = (await fs.stat(filePath)).mtimeMs;
                const content = modifiedAt >= launchStartedAt
                    ? await fs.readFile(filePath, 'utf8')
                    : '';
                return { filePath, modifiedAt, content };
            }));
        return selectLatestEntryPointFailure(files, launchStartedAt);
    } catch {
        return undefined;
    }
}

async function reportCloudScriptProcessFailure(
    projectPath: string,
    launchStartedAt: number,
    processExited: boolean,
) {
    const failureLog = await latestEntryPointFailure(projectPath, launchStartedAt);
    if (failureLog) {
        vscode.window.showErrorMessage(l10n.t(
            '本地云脚本入口启动失败，请检查日志：{0}',
            failureLog,
        ));
        return;
    }
    vscode.window.showErrorMessage(l10n.t(processExited
        ? '本次启动的 MockMls.exe 在注入前已退出，请检查 cloud_script/mls_log。'
        : '30 秒内未检测到本次启动的 MockMls.exe，请确认项目包含本地云脚本并检查 cloud_script/mls_log。'));
}

export async function beginCloudScriptAutoAttach(
    projectUri: vscode.Uri,
): Promise<CloudScriptAutoAttachOperation | undefined> {
    if (process.platform !== 'win32') {
        vscode.window.showErrorMessage(l10n.t('本地云脚本自动附加仅支持 Windows。'));
        return undefined;
    }

    const launchStartedAt = Date.now();
    cloudScriptAttachController?.abort();
    const controller = new AbortController();
    cloudScriptAttachController = controller;
    const provider = new WindowsTasklistProcessProvider();
    let processIdsBeforeLaunch: readonly number[];
    try {
        processIdsBeforeLaunch = await provider.listMockMlsProcessIds();
    } catch (error) {
        if (cloudScriptAttachController === controller) {
            cloudScriptAttachController = undefined;
        }
        if (controller.signal.aborted) {
            return undefined;
        }
        y3.log.error(l10n.t('读取 MockMls.exe 进程失败：{0}', String(error)));
        vscode.window.showErrorMessage(l10n.t('无法读取 MockMls.exe 进程列表，请检查系统 tasklist 命令。'));
        return undefined;
    }

    const completion = (async () => {
        try {
            const result = await waitForNewProcess(provider, processIdsBeforeLaunch, {
                timeoutMs: cloudScriptProcessTimeoutMs,
                pollIntervalMs: cloudScriptProcessPollIntervalMs,
                signal: controller.signal,
            });
            if (result.kind === 'cancelled') {
                return false;
            }
            if (result.kind === 'timeout') {
                await reportCloudScriptProcessFailure(projectUri.fsPath, launchStartedAt, false);
                return false;
            }
            if (result.kind === 'ambiguous') {
                vscode.window.showErrorMessage(l10n.t(
                    '本次启动检测到多个新的 MockMls.exe（PID：{0}），为避免附加错误实例，已取消自动附加。',
                    result.processIds.join(', '),
                ));
                return false;
            }

            const stability = await waitForProcessStability(provider, result.processId, {
                delayMs: cloudScriptProcessStabilityDelayMs,
                signal: controller.signal,
            });
            if (stability.kind === 'cancelled') {
                return false;
            }
            if (stability.kind === 'exited') {
                await reportCloudScriptProcessFailure(projectUri.fsPath, launchStartedAt, true);
                return false;
            }

            await Promise.all(debugSessions
                .filter(isCloudScriptDebugSession)
                .map((session) => vscode.debug.stopDebugging(session)));
            if (controller.signal.aborted) {
                return false;
            }
            y3.log.info(l10n.t('正在附加本地云脚本调试器（PID：{0}）', result.processId));
            const folder = vscode.workspace.getWorkspaceFolder(projectUri)
                ?? vscode.workspace.workspaceFolders?.[0];
            const succeeded = await vscode.debug.startDebugging(
                folder,
                createCloudScriptDebugConfiguration(
                    projectUri.fsPath,
                    result.processId,
                    cloudScriptSessionName,
                ),
            );
            if (!succeeded) {
                vscode.window.showErrorMessage(l10n.t(
                    '本地云脚本调试器注入失败（PID：{0}），请检查调试控制台和 cloud_script/mls_log。',
                    result.processId,
                ));
            }
            return succeeded;
        } catch (error) {
            if (controller.signal.aborted) {
                return false;
            }
            y3.log.error(l10n.t('自动附加本地云脚本失败：{0}', String(error)));
            if (isProcessInjectionFailure(error)) {
                vscode.window.showErrorMessage(l10n.t(
                    '本地云脚本进程注入失败。请确保 VS Code 与 Y3 使用相同权限；若 Y3 以管理员运行，请以管理员身份启动 VS Code。',
                ));
                return false;
            }
            vscode.window.showErrorMessage(l10n.t(
                '自动附加本地云脚本失败：{0}',
                String(error),
            ));
            return false;
        } finally {
            if (cloudScriptAttachController === controller) {
                cloudScriptAttachController = undefined;
            }
        }
    })();

    return {
        completion,
        cancel() {
            controller.abort();
        },
    };
}

async function attachForOnePlayer(id?: number) {
    y3.log.info(l10n.t('正在启动调试器({0})', getName(id)));
    let folder = vscode.workspace.getWorkspaceFolder(env.scriptUri!)
              ?? vscode.workspace.getWorkspaceFolder(env.globalScriptUri!)
              ?? vscode.workspace.workspaceFolders?.[0];
    let suc = await vscode.debug.startDebugging(folder, {
        "type": "y3lua",
        "request": "attach",
        "name": getName(id),
        "address": debugAddressForPlayer(id),
        "outputCapture": [],
        "stopOnEntry": false,
        "sourceCoding": "utf8",
    });
    return suc;
}

function prepareReconnect(session: vscode.DebugSession, timeout: number) {
    y3.log.info(l10n.t('准备重连调试器({0})', session.name));
    let trg = vscode.debug.onDidTerminateDebugSession(async (e) => {
        if (e === session) {
            trg.dispose();
            y3.log.info(l10n.t('正在重连调试器({0})', session.name));
            let folder = vscode.workspace.getWorkspaceFolder(env.scriptUri!)
                    ?? vscode.workspace.getWorkspaceFolder(env.globalScriptUri!)
                    ?? vscode.workspace.workspaceFolders?.[0];
            await vscode.debug.startDebugging(folder, session.configuration);
        }
    });
    setTimeout(() => {
        trg.dispose();
    }, timeout);
}

export async function attach(): Promise<boolean> {
    await Promise.all(debugSessions.filter(isMapDebugSession).map((s) => vscode.debug.stopDebugging(s)));
    if (config.multiMode) {
        if (config.multiPlayers.length === 0) {
            return false;
        }
        let results = await Promise.all(config.multiPlayers
            . filter((id) => config.debugPlayers.includes(id))
            . map((id) => attachForOnePlayer(id))
        );
        return results.every((suc) => suc);
    } else {
        let suc = await attachForOnePlayer();
        return suc;
    }
}

export async function prepareForRestart(needDebugger?: boolean, id?: number) {
    if (needDebugger === false) {
        return;
    }
    let session = findDebugSession(id);
    // 如果没有传入参数，则重启当前的活动调试器
    if (needDebugger === undefined) {
        if (!session) {
            return;
        }
    }if (session) {
        prepareReconnect(session, 10000);
        return true;
    }

    // 等待2秒，避免直接附加到当前的游戏中
    await y3.sleep(2000);
    await attachForOnePlayer(id);
    // 但还是有一定几率会附加到当前的游戏中，
    // 因此发现很快又断开后，再次附加
    session = findDebugSession(id);
    if (!session) {
        return false;
    }
    prepareReconnect(session, 10000);
    return true;
}
