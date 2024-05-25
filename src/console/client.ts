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

const CSI = {
    RESET_COLOR: '\x1b[0m',
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

    CURSOR_UP: '\x1b[A',
    CURSOR_DOWN: '\x1b[B',
    CURSOR_FORWARD: '\x1b[C',
    CURSOR_BACK: '\x1b[D',
    CURSOR_NEXT_LINE: '\x1b[E',
    CURSOR_PREV_LINE: '\x1b[F',
    CURSOR_HORIZONTAL_ABSOLUTE: '\x1b[G',
    CURSOR_HIDE: '\x1b[?25l',
    CURSOR_SHOW: '\x1b[?25h',
    CURSOR_REQUEST_POSITION: '\x1b[6n',

    CLEAR_LINE: '\x1b[K',
};

class Pseudoterminal implements vscode.Pseudoterminal {
    constructor() {
        this.onDidWrite = this.writeEmitter.event;
    }

    private writeEmitter = new vscode.EventEmitter<string>();

    onDidWrite: vscode.Event<string>;

    open() {
        this.newStart();
    };

    close() {};

    private applyInput(data: string) {
    }

    private inputedData: string = '';
    private curOffset: number = 0;
    private headPos = [0, 0];

    private refreshLine(data: string) {
        this.moveCursor(0);
        this.write(CSI.CLEAR_LINE);
        this.inputedData = data;
        this.write(data);
        this.moveCursor(this.curOffset);
    }

    handleInput(data: string): void {
        if (data === '\r') { // 回车键
            this.applyInput(this.inputedData);
            this.inputedData = '';
            this.curOffset = 0;
            this.write('\r\n');
            this.newStart();
            return;
        } else if (data === '\x7F') { // 删除前一个文字
            if (this.curOffset > 0) {
                this.refreshLine(this.inputedData.slice(0, this.curOffset - 1) + this.inputedData.slice(this.curOffset));
                this.curOffset -= 1;
                this.moveCursor(this.curOffset);
            }
            return;
        } else if (data === '\x1B') { // ESC键
            this.refreshLine('');
            this.curOffset = 0;
            this.moveCursor(this.curOffset);
            return;
        } else if (data === '\x03') { // Ctrl+C
            vscode.env.clipboard.writeText(this.inputedData);
            return;
        } else if (data === '\x16') { // Ctrl+V
            vscode.env.clipboard.readText().then((text) => {
                this.handleCommonInput(text);
            });
            return;
        }

        if (data.startsWith('\x1B[')) {
            this.handleControl(data);
            return;
        }

        this.handleCommonInput(data);
    }

    private handleControl(data: string) {
        let func = data.slice(-1);
        let args = data.slice(2, -1).split(';').map((arg) => parseInt(arg));

        switch (func) {
            case '~': // 一些特殊键
                if (args[0] === 3) { // 删除键
                    this.refreshLine(this.inputedData.slice(0, this.curOffset) + this.inputedData.slice(this.curOffset + 1));
                } else if (args[0] === 1) { // Home键
                    this.curOffset = 0;
                    this.moveCursor(this.curOffset);
                } else if (args[0] === 4) { // End键
                    this.curOffset = this.inputedData.length;
                    this.moveCursor(this.curOffset);
                }
                break;
            case 'A': // 上箭头
                break;
            case 'B': // 下箭头
                break;
            case 'C': // 右箭头
                if (this.curOffset < this.inputedData.length) {
                    this.curOffset += 1;
                    this.moveCursor(this.curOffset);
                }
                break;
            case 'D': // 左箭头
                if (this.curOffset > 0) {
                    this.curOffset -= 1;
                    this.moveCursor(this.curOffset);
                }
                break;
            case 'R': // 光标位置回应
                this.responseCursorPos(args[0], args[1]);
                break;
            default:
                break;
        }
    }

    private handleCommonInput(data: string) {
        data = data.replace(/[^\x20-\x7E\u4E00-\u9FA5]/g, ' ');
        this.curOffset += data.length;
        this.refreshLine(this.inputedData.slice(0, this.curOffset) + data + this.inputedData.slice(this.curOffset));
    }

    private moveCursor(offset: number) {
        let row = this.headPos[0];
        let col = this.headPos[1] + offset;
        this.write(`\x1B[${row};${col}H`);
    }

    private newStart() {
        this.write(`${CSI.GREEN}>${CSI.RESET_COLOR}`);
        this.requestCursorPos((row, col) => {
            this.headPos = [row, col];
        });
    }

    private cursorRequests: ((row: number, col: number) => void)[] = [];
    private requestCursorPos(callback: (row: number, col: number) => void) {
        this.cursorRequests.push(callback);
        this.write(CSI.CURSOR_REQUEST_POSITION);
    }
    private responseCursorPos(row: number, col: number) {
        let callback = this.cursorRequests.shift();
        callback?.(row, col);
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
