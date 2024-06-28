import * as vscode from 'vscode';
import { env } from './env';
import * as tools from './tools';

const debuggerPath = '3rd/debugger';

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
    };

    let debug = require('../' + debuggerPath + '/js/extension.js');
    debug.activate(debuggerContext);

    function update_debugger_path() {
        if (!env.scriptUri) {
            return;
        }
        tools.fs.writeFile(env.scriptUri, 'log/debugger_path.lua', `return [[${debuggerContext.extensionUri.fsPath}]]`);
    }

    update_debugger_path();
    env.onDidChange(() => {
        update_debugger_path();
    });

    let launch = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    launch.text = '✨启动';
    launch.tooltip = '启动游戏并附加调试器';
    launch.command = 'y3-helper.launchGameAndAttach';

    let attach = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    attach.text = '💡附加';
    attach.tooltip = '附加调试器';
    attach.command = 'y3-helper.attach';

    function update_items() {
        if (vscode.workspace.getConfiguration('Y3-Helper').get('ShowStatusBarItem')) {
            launch.show();
            attach.show();
        } else {
            launch.hide();
            attach.hide();
        }
    }

    update_items();
    vscode.workspace.onDidChangeConfiguration(() => {
        update_items();
    });
}

export async function attach() {
    let session = vscode.debug.activeDebugSession;
    if (session?.type === 'y3lua') {
        vscode.debug.stopDebugging(session);
    }
    let suc = await vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(env.scriptUri!), {
        "type": "y3lua",
        "request": "attach",
        "name": "💡附加",
        "address": "127.0.0.1:12399",
        "outputCapture": [],
        "stopOnEntry": false,
        "sourceCoding": "utf8",
    });
    return suc;
}

export async function prepareForRestart(needDebugger?: boolean) {
    if (needDebugger === undefined) {
        needDebugger = vscode.debug.activeDebugSession !== undefined;
    }
    if (!needDebugger) {
        return;
    }

    let session = vscode.debug.activeDebugSession;
    if (session) {
        let trg = vscode.debug.onDidTerminateDebugSession((e) => {
            if (e === session) {
                trg.dispose();
                attach();
            }
        });
    } else {
        // 等待2秒，避免直接附加到当前的游戏中
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await attach();
        // 但还是有一定几率会附加到当前的游戏中，
        // 因此发现很快又断开后，再次附加
        session = vscode.debug.activeDebugSession;
        if (!session) {
            return;
        }
        let trg = vscode.debug.onDidTerminateDebugSession((e) => {
            if (e === session) {
                trg.dispose();
                attach();
            }
        });
        setTimeout(() => {
            trg.dispose();
        }, 5000);
    }
}
