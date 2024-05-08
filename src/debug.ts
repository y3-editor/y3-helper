import * as vscode from 'vscode';
import { env } from './env';
import * as tools from './tools';

const debuggerPathOld = '3rd/debugger-old';
const debuggerPathNew = '3rd/debugger-new';

export function init(context: vscode.ExtensionContext) {
    let debuggerPath: string;
    if (vscode.workspace.getConfiguration('Y3-Helper').get('DebuggerVersion') === 'new') {
        debuggerPath = debuggerPathNew;
    } else {
        debuggerPath = debuggerPathOld;
    }

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

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('Y3-Helper.DebuggerVersion')) {
            vscode.window.showInformationMessage('修改此设置需要重启VSCode生效！');
        }
    });
}

export async function attach() {
    await vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(env.scriptUri!), {
        "type": "y3lua",
        "request": "attach",
        "name": "💡附加",
        "address": "127.0.0.1:12399",
        "outputCapture": [],
        "stopOnEntry": false,
    });
}
