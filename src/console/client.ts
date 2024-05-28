import * as vscode from "vscode";
import * as tools from "../tools";
import { Terminal } from "./terminal";

type RequestHandler = (client: Client, params: any) => Promise<any>;
type ResponseHandler = (result: Response) => void;

interface Request {
    method: string,
    id: number,
    params: any,
};

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

export class Client extends vscode.Disposable {
    constructor(private onSend: (obj: Response | Request) => void) {
        super(() => {
            this.terminal.dispose();
        });
        this.terminal = new Terminal(async (data) => {
            await this.request('command', { data: data });
        });
    }

    private terminal: Terminal;

    print(msg: string) {
        this.terminal.print(msg);
    }

    disableInput() {
        this.terminal.disableInput();
    }

    enableInput() {
        this.terminal.enableInput();
    }

    async recv(obj: Request | Response) {
        if ('method' in obj) {
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
        } else {
            let id = obj.id;
            let handler = this.requestMap.get(id);
            if (handler) {
                this.requestMap.delete(id);
                handler(obj);
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
        let result = await new Promise<Response>((resolve) => {
            this.requestMap.set(requestID, (result) => {
                resolve(result);
            });
        });
        if (result.error) {
            tools.log.error(result.error);
            return;
        }
        return result.result;
    }

    private send(obj: Response | Request) {
        this.onSend(obj);
    }
}

interface PrintParams {
    message: string;
}

registerMethod('print', async (client, params: PrintParams) => {
    client.print(params.message);
});

vscode.commands.registerCommand('y3-helper.testTerminal', async () => {
    let terminal = new Terminal(async (obj) => {
        // await new Promise((resolve) => {
        //    setTimeout(resolve, 2000);
        // });
        terminal.print('发送了：\n' + JSON.stringify(obj));
        terminal.print('发送了：\n' + JSON.stringify(obj));
    });
});
