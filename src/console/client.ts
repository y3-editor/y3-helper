import * as vscode from "vscode";
import * as tools from "../tools";
import { Terminal } from "./terminal";
import { TreeViewManager } from "./treeView";

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
let clients: Client[] = [];

export function registerMethod(method: string, handler: RequestHandler) {
    methods.set(method, handler);
}

export function registerRequest(method: string, handler: ResponseHandler) {
    requests.set(method, handler);
}

export class Client extends vscode.Disposable {
    constructor(private onSend: (obj: Response | Request | Notify) => void) {
        super(() => {
            this.terminal.dispose();
            this.button.dispose();
            this.treeViewManager.dispose();
            clients.splice(clients.indexOf(this), 1);
        });
        this.terminal = new Terminal(async (data) => {
            // 如果提交的数据只有空格，就忽略掉
            if (data.trim() === '') {
                return;
            }
            this.notify('command', { data: data });
        });

        this.button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.button.text = '🍉重载Lua';
        this.button.tooltip = '省的你输入 `.rd`';
        this.button.command = 'y3-helper.reloadLua';
        this.button.show();
        clients.push(this);
    }

    readonly treeViewManager = new TreeViewManager(this);

    private terminal: Terminal;
    private button: vscode.StatusBarItem;

    print(msg: string) {
        this.terminal.print(msg);
    }

    disableInput() {
        this.terminal.disableInput();
    }

    enableInput() {
        this.terminal.enableInput();
    }

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
    async request(method: string, params: any) {
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
    let terminal = new Terminal(async (obj) => {
        // await new Promise((resolve) => {
        //    setTimeout(resolve, 2000);
        // });
        terminal.print('发送了：\n' + JSON.stringify(obj));
        terminal.print('发送了：\n' + JSON.stringify(obj));
    });
});

vscode.commands.registerCommand('y3-helper.reloadLua', async () => {
    for (let client of clients) {
        client.notify('command', { data: '.rd' });
    }
});
