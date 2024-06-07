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
        tools.writeFile(env.scriptUri, 'log/debugger_path.lua', `return [[${debuggerContext.extensionUri.fsPath}]]`);
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

export async function stop() {
    await vscode.debug.stopDebugging();
}

export async function getSession() {
    return vscode.debug.activeDebugSession;
}
