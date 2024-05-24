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

const COLOR = {
    NONE: '\x1b[0m',
    BLACK: '\x1b[30m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    BG_BLACK: '\x1b[40m',
    BG_RED: '\x1b[41m',
    BG_GREEN: '\x1b[42m',
    BG_YELLOW: '\x1b[43m',
    BG_BLUE: '\x1b[44m',
    BG_MAGENTA: '\x1b[45m',
    BG_CYAN: '\x1b[46m',
    BG_WHITE: '\x1b[47m',
};

class Pseudoterminal implements vscode.Pseudoterminal {
    constructor() {
        this.onDidWrite = this.writeEmitter.event;
    }

    private writeEmitter = new vscode.EventEmitter<string>();

    onDidWrite: vscode.Event<string>;

    open() {
        this.write(`${COLOR.GREEN}>${COLOR.NONE}`);
    };

    close() {};

    private applyInput(data: string) {
    }

    private inputData: string = '';
    private cursorAt: number = 0;

    private refreshLine(fillNum: number) {
        this.write('\r');
        this.write(`${COLOR.GREEN}>${COLOR.NONE}`);
        this.write(this.inputData);
        for (let i = 0; i < fillNum * 3; i++) {
            this.write(' \b');
        }
    }

    handleInput(data: string) {
        switch (data) {
            case '\r': // 回车键
                this.write(`\r\n${COLOR.GREEN}>${COLOR.NONE}`);
                this.applyInput(this.inputData);
                this.inputData = '';
                break;
            case '\x7F': // 删除前一个文字
                if (this.cursorAt > 0) {
                    this.inputData = this.inputData.slice(0, this.cursorAt - 1) + this.inputData.slice(this.cursorAt);
                    this.cursorAt--;
                    this.refreshLine(1);
                }
                break;
            case '\x1B': // ESC键
                let length = this.inputData.length;
                this.inputData = '';
                this.cursorAt = 0;
                this.refreshLine(length);
                break;
            case '\x03': // Ctrl+C
                // 复制当前输入的所有内容
                vscode.env.clipboard.writeText(this.inputData);
                break;
            case '\x16': // Ctrl+V
                // 粘贴剪贴板内容
                vscode.env.clipboard.readText().then((text) => {
                    this.write(text);
                    this.inputData += text;
                    this.cursorAt += text.length;
                });
                break;
            case '\x1B[1~': // Home键
                break;
            case '\x1B[3~': // 删除键（删除后一个字符）
                break;
            case '\x1B[4~': // End键
                break;
            case '\x1B[A': // 上箭头
                break;
            case '\x1B[B': // 下箭头
                break;
            case '\x1B[C': // 右箭头
                break;
            case '\x1B[D': // 左箭头
                break;
            default:
                if (data.match(/^[\x20-\x7E\u4E00-\u9FA5]*$/)) {
                    // 只有输入全部为可见字符（包括unicode字符）时才显示
                    this.inputData += data;
                    this.write(data);
                };
        }
    }

    write(data: string) {
        this.writeEmitter.fire(data);
    };
}

export class Client extends vscode.Disposable {
    constructor() {
        super(() => {
            this.terminal.dispose();
        });
        this.pseudoterminal = new Pseudoterminal();
        this.terminal = vscode.window.createTerminal({
           name: 'Y3助手控制台',
           pty: this.pseudoterminal,
        });
        this.terminal.show();
    }

    private pseudoterminal: Pseudoterminal;

    private terminal: vscode.Terminal;

    write(data: string) {
        this.pseudoterminal.write(data);
    }

    print(msg: string) {
        //把单独的 \n 或 \r 替换为 \r\n，但要排除已有的 \r\n
        msg = msg.replace(/(?<!\r)\n/g, '\r\n');
        this.write(msg + '\r\n');
    }

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

vscode.commands.registerCommand('y3-helper.testTerminal', async () => {
    let client = new Client();
    client.onSend((obj) => {
        tools.log.info(JSON.stringify(obj));
    });
});
