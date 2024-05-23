import * as vscode from "vscode";
import * as tools from "../tools";

type Handler = (obj: { [key: string]: any }) => Promise<any>;
type Request = {
    method: string,
    id: number,
    params: { [key: string]: any },
};

type Result = {
    id: number,
    result?: any,
    error?: string,
};

let methods: Map<string, Handler> = new Map();


export function registerMethod(method: string, handler: Handler) {
    methods.set(method, handler);
}

export class Client extends vscode.Disposable {
    constructor() {
        super(() => {
            this.console.dispose();
        });
        const writeEmitter = new vscode.EventEmitter<string>();
        this.console = vscode.window.createTerminal({
            name: 'Y3助手控制台',
            pty: {
                onDidWrite: writeEmitter.event,
                open: () => {
                    writeEmitter.fire('\x1b[31mHello world\x1b[0m');
                },
                close: () => {}
            },
        });
    }

    private console: vscode.Terminal;

    async recv(obj: Request) {
        let method = obj.method;
        let handler = methods.get(method);
        if (handler) {
            let id = obj.id;
            try {
                let result = await handler(obj);
                this.send({ id, result });
            } catch (e) {
                if (e instanceof Error) {
                    tools.log.error(e);
                    this.send({ id, error: e.message });
                }
            }
        }
    }

    private _sender: (obj: Result) => void = (obj) => {};

    private send(obj: Result) {
        this._sender(obj);
    }

    onSend(sender: (obj: Result) => void) {
        this._sender = sender;
    }
}
