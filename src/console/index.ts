import { env } from '../env';
import { randomInt } from '../utility';
import * as tools from '../tools';
import { ConsoleServer } from './server';
import { registerMethod } from './client';
import * as debug from '../debug';
import * as vscode from 'vscode';
import * as terminal from './terminal';

function setPort(port: number) {
    if (!env.scriptUri) {
        return;
    }
    tools.fs.writeFile(env.scriptUri, 'log/helper_port.lua', `return ${port}`);
}

let server: ConsoleServer | undefined;

function registerAllMethods() {
    interface PrintParams {
        message: string;
    }

    registerMethod('print', async (client, params: PrintParams) => {
        let level = params.message.match(/^\[\s*(.*?)\]/)?.[1]?.toLowerCase();
        switch (level) {
            case 'fatal':
            case 'error':
                client.print(terminal.COLOR.RED + params.message + terminal.COLOR.RESET);
                break;
            case 'warn':
                client.print(terminal.COLOR.YELLOW + params.message + terminal.COLOR.RESET);
                break;
            case 'info':
                client.print(terminal.COLOR.CYAN + params.message + terminal.COLOR.RESET);
                break;
            case 'debug':
                client.print(terminal.COLOR.GREEN + params.message + terminal.COLOR.RESET);
                break;
            default:
                client.print(params.message);
                break;
        }
    });

    interface CreateTreeViewParams {
        id: number;
        name: string;
        root: number;
    }

    registerMethod('createTreeView', async (client, params: CreateTreeViewParams) => {
        await client.treeViewManager.createTreeView(params.id, params.name, params.root);
    });

    interface RemoveTreeViewParams {
        id: number;
    }

    registerMethod('removeTreeView', async (client, params: RemoveTreeViewParams) => {
        client.treeViewManager.removeTreeView(params.id);
    });

    interface refreshTreeNodeParams {
        id: number;
    }

    registerMethod('refreshTreeNode', async (client, params: refreshTreeNodeParams) => {
        client.treeViewManager.refreshTreeNode(params.id);
    });

    interface CommandParams {
        command: string;
        args?: any[];
    }

    registerMethod('command', async (client, params: CommandParams) => {
        let res = await vscode.commands.executeCommand(params.command, ...(params.args || []));
        return res;
    });

    interface PrepareForRestartParams {
        debugger?: boolean;
    }

    registerMethod('prepareForRestart', async (client, params: PrepareForRestartParams) => {
        debug.prepareForRestart(params.debugger);
    });
}

export function init() {
    registerAllMethods();

    let port: number | undefined = vscode.workspace.getConfiguration('Y3-Helper').get('ServerPort');
    if (port === 0 || typeof port !== 'number') {
        port = randomInt(10000, 65535);
    }

    server = new ConsoleServer(port);

    env.onDidChange(() => {
        setPort(port!);
    });
    setPort(port);
}

export function getServer(): ConsoleServer {
    if (!server) {
        init();
    }
    return server!;
}
