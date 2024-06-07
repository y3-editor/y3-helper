import { env } from '../env';
import { randomInt } from '../utility';
import * as tools from '../tools';
import { ConsoleServer } from './server';
import { registerMethod } from './client';
import * as debug from '../debug';
import * as vscode from 'vscode';

function setPort(port: number) {
    if (!env.scriptUri) {
        return;
    }
    tools.writeFile(env.scriptUri, 'log/helper_port.lua', `return ${port}`);
}

let server: ConsoleServer | undefined;

function registerAllMethods() {
    interface PrintParams {
        message: string;
    }

    registerMethod('print', async (client, params: PrintParams) => {
        client.print(params.message);
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

    interface startDebuggerParams {
        delay?: number;
    }

    registerMethod('startDebugger', async (client, params: startDebuggerParams) => {
        if (await debug.getSession()) {
            return {
                suc: false,
                err: '调试器已经启动',
            };
        }
        if (params.delay) {
            await new Promise(resolve => setTimeout(resolve, params.delay! * 1000));
        }
        try {
            let suc = await debug.attach();
            if (suc) {
                return {
                    suc: true,
                };
            } else {
                return {
                    suc: false,
                    err: '启动调试器失败',
                };
            }
        } catch(e) {
            return {
                suc: false,
                err: (e instanceof Error) ? e.message : e!.toString(),
            };
        }
    });

    registerMethod('stopDebugger', async (client) => {
        try {
            await debug.stop();
            return {
                suc: true,
            };
        } catch(e) {
            return {
                suc: false,
                err: (e instanceof Error) ? e.message : e!.toString(),
            };
        }
    });

    registerMethod('hasDebugger', async (client) => {
        return debug.getSession() !== undefined;
    });

    interface CommandParams {
        command: string;
        args?: any[];
    }

    registerMethod('command', async (client, params: CommandParams) => {
        let res = await vscode.commands.executeCommand(params.command, ...(params.args || []));
        return res;
    });
}

export function init() {
    registerAllMethods();

    let port = randomInt(10000, 65535);

    server = new ConsoleServer(port);

    env.onDidChange(() => {
        setPort(port);
    });
    setPort(port);
}

export function getServer(): ConsoleServer {
    if (!server) {
        init();
    }
    return server!;
}
