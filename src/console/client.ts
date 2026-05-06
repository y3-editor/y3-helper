import * as vscode from "vscode";
import * as tools from "../tools";
import { Terminal } from "./terminal";
import { WebviewTerminal } from "./webviewTerminal";
import { TreeViewManager } from "./treeView";
import * as y3 from "y3-helper";
import * as l10n from '@vscode/l10n';


type RequestHandler = (client: Client, params: any) => Promise<any>;
type ResponseHandler = (result: any) => void;

interface Request {
    method: string,
    id: number,
    params: any,
};

interface Notify {
    method: string,
    params: any,
}

interface Response {
    id: number,
    result?: any,
    error?: string,
};

let methods: Map<string, RequestHandler> = new Map();
let requests: Map<string, ResponseHandler> = new Map();

export function registerMethod(method: string, handler: RequestHandler) {
    methods.set(method, handler);
}

export function registerRequest(method: string, handler: ResponseHandler) {
    requests.set(method, handler);
}

class Buttons extends vscode.Disposable {
    private buttons: vscode.StatusBarItem[] = [];

    constructor() {
        super(() => {
            for (let button of this.buttons) {
                button.dispose();
            }
        });

        let rd = this.addButton(l10n.t('🍉重载Lua'));
        rd.tooltip = l10n.t('省的你输入 `.rd`');
        rd.command = 'y3-helper.reloadLua';
    }

    addButton(text: string) {
        let button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        button.text = text;
        button.show();
        this.buttons.push(button);
        return button;
    }
}

export class Client extends vscode.Disposable {
    static allClients: Client[] = [];

    static button?: Buttons;

    static updateButton() {
        if (this.allClients.length > 0) {
            this.button ??= new Buttons();
        } else {
            this.button?.dispose();
            this.button = undefined;
        }
    }

    static terminalHistory: { [name: string]: Terminal | WebviewTerminal} = {};

    /** terminalHistory 有增减时触发，用于刷新 mainMenu 的按钮显示状态 */
    static onDidChangeTerminalHistory = new vscode.EventEmitter<void>();

    constructor(private onSend: (obj: Response | Request | Notify) => void) {
        super(() => {
            this.closeAllRequests();
            if (this.terminal) {
                Client.terminalHistory[this.name]?.dispose();
                Client.terminalHistory[this.name] = this.terminal;
                this.terminal.disableInput();
                this.terminal.print(l10n.t('\n⛔ 客户端已断开。下次启动游戏会复用此控制台。 ⛔\n'));
                Client.onDidChangeTerminalHistory.fire();
            }
            this.treeViewManager.dispose();
            Client.allClients.splice(Client.allClients.indexOf(this), 1);
            Client.updateButton();
        });
        Client.allClients.push(this);
        Client.updateButton();

        this.createTerminal(l10n.t('Y3控制台'));
    }

    public name = '默认客户端';

    static createTerminalByConfig(name: string): Terminal | WebviewTerminal {
        const type = vscode.workspace
            .getConfiguration('Y3-Helper', vscode.workspace.workspaceFolders?.[0])
            .get<string>('ConsoleType', 'webview');
        return type === 'integrated' ? new Terminal(name) : new WebviewTerminal(name);
    }

    private createTerminal(name: string) {
        this.terminal?.dispose();
        this.terminal = Client.terminalHistory[name] ?? Client.createTerminalByConfig(name);
        delete Client.terminalHistory[name];
        Client.onDidChangeTerminalHistory.fire();
        this.terminal.setApplyHandler(async (data) => {
            // 如果提交的数据只有空格，就忽略掉
            if (data.trim() === '') {
                return;
            }
            this.notify('command', { data: data });
        });
        this.terminal.multiMode = this.multiMode;
        this.terminal.enableInput();
        this.applyPrintBuffer();
    }

    private terminal?: Terminal | WebviewTerminal;

    private printBuffer: string[] | undefined;
    print(msg: string) {
        if (this.printBuffer) {
            this.printBuffer.push(msg);
            return;
        }
        this.printBuffer = [];
        this.terminal?.print(msg).then(() => {
            this.applyPrintBuffer();
        });
    }
    private applyPrintBuffer() {
        if (this.printBuffer) {
            let buffer = this.printBuffer;
            this.printBuffer = undefined;
            if (buffer.length > 0) {
                let merged = buffer.join('\n');
                this.print(merged);
            }
        }
    }

    disableInput() {
        this.terminal?.disableInput();
    }

    enableInput() {
        this.terminal?.enableInput();
    }

    private didUpdateName = new vscode.EventEmitter<string>();
    readonly onDidUpdateName = this.didUpdateName.event;

    setName(name: string) {
        y3.log.info(l10n.t('客户端【{0}】名称更改为：{1}', this.name, name));
        this.name = name;
        this.createTerminal(name);
        this.didUpdateName.fire(name);
    }

    private multiMode = false;

    setMultiMode(res: boolean) {
        this.multiMode = res;
        if (this.terminal) {
            this.terminal.multiMode = this.multiMode;
        }
    }

    readonly treeViewManager = new TreeViewManager(this);

    async recv(obj: Request | Notify | Response) {
        if ('method' in obj) {
            let method = obj.method;
            let handler = methods.get(method);
            if (handler) {
                if ('id' in obj) {
                    // request
                    let id = obj.id;
                    try {
                        let result = await handler(this, obj.params);
                        this.send({ id, result });
                    } catch (e) {
                        if (e instanceof Error) {
                            tools.log.error(e);
                            this.send({ id, error: e.message });
                        } else {
                            this.send({ id, error: e!.toString() });
                        }
                    }
                } else {
                    // notify
                    try {
                        handler(this, obj.params);
                    } catch (e) {
                        if (e instanceof Error) {
                            tools.log.error(e);
                        }
                    }
                }
            } else {
                if ('id' in obj) {
                    this.send({ id: obj.id, error: `未找到方法"${method}"` });
                }
            }
        } else {
            if (obj.error) {
                tools.log.error(obj.error);
            }
            let id = obj.id;
            let handler = this.requestMap.get(id);
            if (handler) {
                this.requestMap.delete(id);
                handler(obj.result);
            }
        }
    }

    private requestID = 0;
    private requestMap: Map<number, ResponseHandler> = new Map();
    private closed = false;

    private closeAllRequests() {
        this.closed = true;
        for (let handler of this.requestMap.values()) {
            handler(undefined);
        }
    }
    
    async request(method: string, params: any) {
        if (this.closed) {
            return undefined;
        }
        let requestID = this.requestID;
        this.requestID++;
        this.send({
            method,
            id: requestID,
            params,
        });
        let result = await new Promise<any>((resolve) => {
            this.requestMap.set(requestID, (result) => {
                resolve(result);
            });
        });
        return result;
    }

    notify(method: string, params: any) {
        this.send({
            method,
            params,
        });
    }

    private send(obj: Response | Request | Notify) {
        this.onSend(obj);
    }
}

vscode.commands.registerCommand('y3-helper.testTerminal', async () => {
    let terminal = Client.createTerminalByConfig(l10n.t('测试客户端'));
    terminal.setApplyHandler(async (obj) => {
        // await new Promise((resolve) => {
        //    setTimeout(resolve, 2000);
        // });
        terminal.print('发送了：\n' + JSON.stringify(obj));
        terminal.print('发送了：\n' + JSON.stringify(obj));
    });
    terminal.enableInput();
});

vscode.commands.registerCommand('y3-helper.reloadLua', async () => {
    for (let client of Client.allClients) {
        client.notify('command', { data: '.rd' });
    }
});

vscode.commands.registerCommand('y3-helper.reopenConsole', () => {
    WebviewTerminal.revealAllDisposed();
});
