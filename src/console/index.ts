import { env } from '../env';
import { randomInt } from '../utility';
import * as tools from '../tools';
import { ConsoleServer } from './server';
import { registerMethod } from './client';
import * as debug from '../debug';
import * as vscode from 'vscode';
import * as terminal from './terminal';
import * as treeView from './treeView';

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

    interface refreshTreeNodeParams extends treeView.TreeNodeInfo {
        id: number;
        complete?: boolean;
    }

    registerMethod('refreshTreeNode', async (client, params: refreshTreeNodeParams) => {
        if (params.complete) {
            client.treeViewManager.updateTreeNode(params.id, params);
        } else {
            client.treeViewManager.refreshTreeNode(params.id);
        }
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
        id?: number;
    }

    registerMethod('prepareForRestart', async (client, params: PrepareForRestartParams) => {
        debug.prepareForRestart(params.debugger, params.id);
    });

    interface ShowInputParams {
        id: number; // 唯一ID
        title?: string; // 标题
        value?: string; // 初始值
        valueSelection?: [number, number]; // 初始选中的文本范围(光标位置，第一个字符前为0)
        prompt?: string; // 提示
        placeHolder?: string; // 占位符
        password?: boolean; // 是否是密码框
        ignoreFocusOut?: boolean; // 是否在失去焦点时关闭
        hasValidateInput?: boolean; // 是否有 validateInput 回调
    }

    registerMethod('showInputBox', async (client, params: ShowInputParams) => {
        let result = await vscode.window.showInputBox({
            title: params.title,
            value: params.value,
            valueSelection: params.valueSelection,
            prompt: params.prompt,
            placeHolder: params.placeHolder,
            password: params.password,
            ignoreFocusOut: params.ignoreFocusOut,
            validateInput: params.hasValidateInput ? async (value) => {
                let err = await client.request('inputBoxValidate', {
                    id: params.id,
                    input: value,
                });
                return err;
            } : undefined,
        });
        return result;
    });

    interface UpdatePlayerParams {
        name: string;
        id: number;
        multiMode?: boolean;
    }

    registerMethod('updatePlayer', async (client, params: UpdatePlayerParams) => {
        client.setName(`${params.name}【${params.id}】`);
        if (params.multiMode) {
            client.setMultiMode(true);
        } else {
            client.setMultiMode(false);
        }
    });

    registerMethod('createTracy', async (client) => {
        await tools.tracy.launch();
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
