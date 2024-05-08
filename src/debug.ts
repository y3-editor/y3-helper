import * as vscode from 'vscode';
import { env } from './env';
import * as tools from './tools';

const debuggerPath = '3rd/debugger-old';

let debug = require('../' + debuggerPath + '/js/extension.js');

function update_debugger_path(context: vscode.ExtensionContext) {
    if (!env.scriptUri) {
        return;
    }
    tools.writeFile(env.scriptUri, 'log/debugger_path', context.extensionUri.fsPath);
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
    };
    debug.activate(debuggerContext);

    update_debugger_path(debuggerContext);
    env.onDidChange(() => {
        update_debugger_path(debuggerContext);
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
