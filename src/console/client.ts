import * as vscode from "vscode";
import * as tools from "../tools";

type Handler = (client: Client, params: { [key: string]: any }) => Promise<any>;
interface Request {
    method: string,
    id: number,
    params: { [key: string]: any },
};

interface Result {
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
        this.writeEmitter;
        this.console = vscode.window.createTerminal({
            name: 'Y3助手控制台',
            pty: {
                onDidWrite: this.writeEmitter.event,
                open: () => {},
                close: () => {}
            },
        });
        this.console.show();
    }

    private writeEmitter = new vscode.EventEmitter<string>();

    print(msg: string) {
        //把单独的 \n 替换为 \r\n，但要排除已有的 \r\n
        msg = msg.replace(/(?<!\r)\n/g, '\r\n');
        this.writeEmitter.fire(msg + '\r\n');
    };

    private console: vscode.Terminal;

    async recv(obj: Request) {
        let method = obj.method;
        let handler = methods.get(method);
        if (handler) {
            let id = obj.id;
            try {
                let result = await handler(this, obj.params);
                this.send({ id, result });
            } catch (e) {
                if (e instanceof Error) {
                    tools.log.error(e);
                    this.send({ id, error: e.message });
                }
            }
        } else {
            this.send({ id: obj.id, error: `未找到方法"${method}"` });
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

interface PrintParams {
    message: string;
}

registerMethod('print', async (client, params) => {
    let p = params as PrintParams;
    client.print(p.message);
});
