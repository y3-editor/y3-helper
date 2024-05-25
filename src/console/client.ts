import * as vscode from "vscode";
import * as tools from "../tools";
import * as iconv from "iconv-lite";

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
    constructor(private applyHandler: (data: string) => void) {
        this.onDidWrite = this.writeEmitter.event;
    }

    private writeEmitter = new vscode.EventEmitter<string>();

    onDidWrite: vscode.Event<string>;

    open() {
        this.newStart();
    };

    close() {};

    private historyStack: string[] = [];
    private historyIndex: number = 0;
    private inputedBeforeHitEnter: string = '';

    private saveHistory(data: string) {
        let last = this.historyStack[this.historyStack.length - 1];
        if (last === data) {
            return;
        }
        this.historyStack.push(data);
        if (this.historyStack.length > 100) {
            this.historyStack.shift();
        }
    }

    private lookLastHistory() {
        if (this.historyStack.length === 0) {
            return;
        }
        // 第一次按上箭头，要先临时保存当前的输入
        if (this.historyIndex === 0) {
            this.inputedBeforeHitEnter = this.inputedData;
        }
        if (this.historyIndex < this.historyStack.length) {
            this.historyIndex++;
            let data = this.historyStack[this.historyStack.length - this.historyIndex];
            this.refreshLineWithoutUndo(data, data.length);
        }
    }

    private lookNextHistory() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            let data = this.historyStack[this.historyStack.length - this.historyIndex];
            if (data) {
                this.refreshLineWithoutUndo(data, data.length);
            } else {
                // 最后一次按下箭头，要恢复到原来的输入
                this.refreshLineWithoutUndo(this.inputedBeforeHitEnter, this.inputedBeforeHitEnter.length);
            }
        }
    }

    private applyInput(data: string) {
        this.saveHistory(data);
        this.applyHandler(data);
    }

    private inputedData: string = '';
    private curOffset: number = 0;
    private headPos = [0, 0];

    private undoStack: [string, number][] = [];
    private undoIndex: number = 0;

    private saveUndoStack() {
        this.undoStack[this.undoIndex] = [this.inputedData, this.curOffset];
        this.undoIndex++;
        this.undoStack.splice(this.undoIndex);
        if (this.undoStack.length > 100) {
            this.undoStack.shift();
            this.undoIndex--;
        }
    }

    private refreshLine(data: string, offset: number) {
        this.refreshLineWithoutUndo(data, offset);
        this.saveUndoStack();
    }

    private refreshLineWithoutUndo(data: string, offset: number) {
        this.moveCursor(0);
        this.write(CSI.CLEAR_LINE);
        this.write(data);
        this.inputedData = data;
        this.curOffset = offset;
        this.moveCursor(offset);
    }
    
    private undo() {
        if (this.undoIndex > 1) {
            this.undoIndex--;
            let [data, offset] = this.undoStack[this.undoIndex - 1];
            this.refreshLineWithoutUndo(data, offset);
        }
    }

    private redo() {
        if (this.undoIndex < this.undoStack.length) {
            this.undoIndex++;
            let [data, offset] = this.undoStack[this.undoIndex - 1];
            this.refreshLineWithoutUndo(data, offset);
        }
    }

    handleInput(data: string): void {
        if (this.disableInputed) {
            return;
        }
        if (data === '\r') { // 回车键
            this.applyInput(this.inputedData);
            this.write('\r\n');
            this.newStart();
            return;
        } else if (data === '\x7F') { // 删除前一个文字
            if (this.curOffset > 0) {
                this.refreshLine(this.inputedData.slice(0, this.curOffset - 1) + this.inputedData.slice(this.curOffset), this.curOffset - 1);
            }
            return;
        } else if (data === '\x1B') { // ESC键
            this.refreshLine('', 0);
            return;
        } else if (data === '\x03') { // Ctrl+C
            vscode.env.clipboard.writeText(this.inputedData);
            return;
        } else if (data === '\x16') { // Ctrl+V
            vscode.env.clipboard.readText().then((text) => {
                this.handleCommonInput(text);
            });
            return;
            
        } else if (data === '\x18') { // Ctrl+X
            vscode.env.clipboard.writeText(this.inputedData);
            this.refreshLine('', 0);
            return;
        } else if (data === '\x1A') { // Ctrl+Z
            this.undo();
            return;
        } else if (data === '\x19') { // Ctrl+Y
            this.redo();
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
                    this.refreshLine(this.inputedData.slice(0, this.curOffset) + this.inputedData.slice(this.curOffset + 1), this.curOffset);
                }
                break;
            case 'A': // 上箭头
                this.lookLastHistory();
                break;
            case 'B': // 下箭头
                this.lookNextHistory();
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
            case 'F': // End 键
                this.curOffset = this.inputedData.length;
                this.moveCursor(this.curOffset);
                break;
            case 'H': // Home 键
                this.curOffset = 0;
                this.moveCursor(this.curOffset);
                break;
            case 'R': // 光标位置回应
                this.responseCursorPos(args[0], args[1]);
                break;
            default:
                break;
        }
    }

    private handleCommonInput(data: string) {
        // 如果是单个的不可见字符，直接忽略
        if (data.length === 1 && data.charCodeAt(0) < 32) {
            return;
        }
        data = data.replace(/[^\x20-\x7E\u4E00-\u9FA5]/g, ' ');
        let newData = this.inputedData.slice(0, this.curOffset) + data + this.inputedData.slice(this.curOffset);
        this.refreshLine(newData, this.curOffset + data.length);
        this.historyIndex = 0;
    }

    private moveCursor(offset: number) {
        let ansiOffset = iconv.encode(this.inputedData.slice(0, offset), 'gbk').length;
        let row = this.headPos[0];
        let col = this.headPos[1] + ansiOffset;
        this.write(`\x1B[${row};${col}H`);
    }

    private newStart() {
        this.write(`${CSI.GREEN}>${CSI.RESET_COLOR}`);
        this.undoStack.splice(0);
        this.undoIndex = 0;
        this.historyIndex = 0;
        this.inputedBeforeHitEnter = '';
        this.requestCursorPos((row, col) => {
            this.headPos = [row, col];
            this.refreshLine('', 0);
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

    private disableInputed: boolean = false;

    disableInput() {
        this.disableInputed = true;
        this.write(CSI.CURSOR_HIDE);
    }

    enableInput() {
        this.disableInputed = false;
        this.write(CSI.CURSOR_SHOW);
    }
}

export class Client extends vscode.Disposable {
    constructor() {
        super(() => {
            this.terminal.dispose();
        });
        this.pseudoterminal = new Pseudoterminal(async (data) => {
            this.terminalDisableInput();
            await this.request('command', { data: data });
            this.terminalEnableInput();
        });
        this.terminal = vscode.window.createTerminal({
           name: 'Y3助手控制台',
           pty: this.pseudoterminal,
        });
        this.terminal.show();
    }

    private pseudoterminal: Pseudoterminal;

    private terminal: vscode.Terminal;

    terminalWrite(data: string) {
        this.pseudoterminal.write(data);
    }

    terminalPrint(msg: string) {
        //把单独的 \n 或 \r 替换为 \r\n，但要排除已有的 \r\n
        msg = msg.replace(/(?<!\r)\n/g, '\r\n');
        this.terminalWrite(msg + '\r\n');
    }

    terminalDisableInput() {
        this.pseudoterminal.disableInput();
    }

    terminalEnableInput() {
        this.pseudoterminal.enableInput();
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

    private _sender: (obj: Response | Request) => void = (obj) => {};

    private send(obj: Response | Request) {
        this._sender(obj);
    }

    onSend(sender: (obj: Response | Request) => void) {
        this._sender = sender;
    }
}

interface PrintParams {
    message: string;
}

registerMethod('print', async (client, params: PrintParams) => {
    client.terminalPrint(params.message);
});

vscode.commands.registerCommand('y3-helper.testTerminal', async () => {
    let client = new Client();
    client.onSend((obj) => {
        tools.log.info(JSON.stringify(obj));
    });
});
