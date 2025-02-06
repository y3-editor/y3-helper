import * as vscode from 'vscode';
import { env } from './env';
import * as tools from './tools';
import { config } from './config';
import * as y3 from 'y3-helper';
import * as l10n from '@vscode/l10n';

const debuggerPath = '3rd/debugger';

let debugSessions: vscode.DebugSession[] = [];

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
        if (!env.scriptUri) {
            return;
        }
        tools.fs.writeFile(env.scriptUri, 'log/debugger_path.lua', `return [[${debuggerContext.extensionUri.fsPath}]]`);
    }

    updateDebuggerPath();
    env.onDidChange(() => {
        updateDebuggerPath();
    });

    let launch = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    launch.text = l10n.t('✨启动');
    launch.tooltip = l10n.t('启动游戏并附加调试器');
    launch.command = 'y3-helper.launchGameAndAttach';

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
        if (e.type !== 'y3lua') {
            return;
        }
        debugSessions.push(e);
    });

    vscode.debug.onDidTerminateDebugSession((e) => {
        let idx = debugSessions.indexOf(e);
        if (idx !== -1) {
            debugSessions.splice(idx, 1);
        }
    });

    startWaitDebuggerHelper();
}

async function startWaitDebuggerHelper() {
    while (true) {
        await y3.sleep(1000);
        if (!env.project) {
            continue;
        }
        let needAttach = false;
        for (const map of env.project.maps) {
            const logPath = y3.uri(map.scriptUri, '.log', 'wait_debugger');
            if (await y3.fs.isExists(logPath)) {
                await y3.fs.removeFile(logPath);
                needAttach = true;
            }
        }
        if (needAttach && debugSessions.length === 0) {
            await attach();
        }
    }
}

function getName(id?: number) {
    return id ? l10n.t('💡附加【{0}】', id) : l10n.t('💡附加');
}

function findDebugSession(id?: number) {
    let name = getName(id);
    return debugSessions.find((s) => s.name === name);
}

async function attachForOnePlayer(id?: number) {
    y3.log.info(l10n.t('正在启动调试器({0})', getName(id)));
    const port = 12399 - (id ?? 0);
    let suc = vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(env.scriptUri!), {
        "type": "y3lua",
        "request": "attach",
        "name": getName(id),
        "address": `127.0.0.1:${port}`,
        "outputCapture": [],
        "stopOnEntry": false,
        "sourceCoding": "utf8",
    });
    return suc;
}

function prepareReconnect(session: vscode.DebugSession, timeout: number) {
    y3.log.info(l10n.t('准备重连调试器({0})', session.name));
    let trg = vscode.debug.onDidTerminateDebugSession((e) => {
        if (e === session) {
            trg.dispose();
            y3.log.info(l10n.t('正在重连调试器({0})', session.name));
            vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(env.scriptUri!), session.configuration);
        }
    });
    setTimeout(() => {
        trg.dispose();
    }, timeout);
}

export async function attach(): Promise<boolean> {
    await Promise.all(debugSessions.slice().map((s) => vscode.debug.stopDebugging(s)));
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
