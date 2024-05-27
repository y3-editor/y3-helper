import * as vscode from 'vscode';
import * as iconv from "iconv-lite";

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
    constructor(private applyHandler: (data: string) => Promise<void>) {
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

    private async lookLastHistory() {
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
            await this.refreshLineWithoutUndo(data, data.length);
        }
    }

    private async lookNextHistory() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            let data = this.historyStack[this.historyStack.length - this.historyIndex];
            if (data) {
                await this.refreshLineWithoutUndo(data, data.length);
            } else {
                // 最后一次按下箭头，要恢复到原来的输入
                await this.refreshLineWithoutUndo(this.inputedBeforeHitEnter, this.inputedBeforeHitEnter.length);
            }
        }
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

    private async refreshLine(data: string, offset: number) {
        this.saveUndoStack();
        await this.refreshLineWithoutUndo(data, offset);
    }

    private async refreshLineWithoutUndo(data: string, offset: number) {
        await this.queue(async () => {
            this.moveCursor(0);
            this.write(CSI.CLEAR_LINE);
            this.write(data);
            this.inputedData = data;
            this.curOffset = offset;
            this.moveCursor(offset);
        });
    }
    
    private async undo() {
        if (this.undoIndex > 1) {
            this.undoIndex--;
            let [data, offset] = this.undoStack[this.undoIndex - 1];
            await this.refreshLineWithoutUndo(data, offset);
        }
    }

    private async redo() {
        if (this.undoIndex < this.undoStack.length) {
            this.undoIndex++;
            let [data, offset] = this.undoStack[this.undoIndex - 1];
            await this.refreshLineWithoutUndo(data, offset);
        }
    }

    handleInput(data: string) {
        if (data.startsWith('\x1B[') && data.endsWith('R')) {
            this.handleCursorResponse(data);
            return;
        }

        if (this.disableInputed) {
            return;
        }
        this.handleUserInput(data);
    }

    private handleUserInput(data: string) {
        if (data === '\r') { // 回车键
            this.applyInput(this.inputedData);
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

    private async applyInput(data: string) {
        this.saveHistory(data);
        this.write('\r\n');
        await this.applyHandler(data);
        await this.newStart();
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
            default:
                break;
        }
    }

    private handleCursorResponse(data: string) {
        let args = data.slice(2, -1).split(';').map((arg) => parseInt(arg));
        this.responseCursorPos(args[0], args[1]);
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

    private async newStart() {
        this.write(`${CSI.GREEN}>${CSI.RESET_COLOR}`);
        this.undoStack.splice(0);
        this.undoIndex = 0;
        this.historyIndex = 0;
        this.inputedBeforeHitEnter = '';
        let [row, col] = await this.requestCursorPos();
        this.headPos = [row, col];
        await this.refreshLine('', 0);
    }

    private cursorRequests: ((row: number, col: number) => void)[] = [];
    private async requestCursorPos(): Promise<[number, number]> {
        return new Promise((resolve) => {
            this.write(CSI.CURSOR_REQUEST_POSITION);
            this.cursorRequests.push((row, col) => {
                resolve([row, col]);
            });
        });
    }
    private responseCursorPos(row: number, col: number) {
        let callback = this.cursorRequests.shift();
        callback?.(row, col);
    }

    write(data: string) {
        this.writeEmitter.fire(data);
    };

    private resolveQueue: (() => void)[] = [];

    private async queue<T>(callback: () => Promise<T>): Promise<T> {
        await new Promise<void>(async (resolve) => {
            this.resolveQueue.push(resolve);
            if (this.resolveQueue.length === 1) {
                resolve();
            }
        });

        try {
            let result = await callback();

            return result;
        } catch (e) {
            throw e;
        } finally {
            this.resolveQueue.shift();
            let next = this.resolveQueue[0];
            next?.();
        }
    }

    async print(msg: string) {
        await this.queue(async () => {
            await this.rawPrint(msg);
        });
    }

    private async rawPrint(msg: string) {
        // 清除当前行
        let row = this.headPos[0];
        let col = 0;
        this.write(`\x1B[${row};${col}H`);
        this.write(CSI.CLEAR_LINE);
        // 把单独的 \n 或 \r 替换为 \r\n，但要排除已有的 \r\n
        msg = msg.replace(/(?<!\r)\n/g, '\r\n') + '\r\n';
        // 把输入打印到终端
        this.write(msg);
        // 恢复用户的输入
        let [newRow, newCol] = await this.requestCursorPos();
        this.headPos[0] = newRow;
        this.write(`${CSI.GREEN}>${CSI.RESET_COLOR}`);
        this.refreshLineWithoutUndo(this.inputedData, this.curOffset);
    }

    private disableInputed: boolean = false;

    disableInput() {
        this.disableInputed = true;

        this.write(CSI.CURSOR_HIDE);
    }

    async enableInput() {
        this.disableInputed = false;
        this.write(CSI.CURSOR_SHOW);

        await this.refreshLineWithoutUndo(this.inputedData, this.curOffset);
    }
}

export class Terminal extends vscode.Disposable {
    private pseudoterminal: Pseudoterminal;
    private terminal: vscode.Terminal;
    constructor(onApply: (data: string) => Promise<void>) {
        super(() => {
            this.terminal.dispose();
        });
        this.pseudoterminal = new Pseudoterminal(async (data) => {
            this.disableInput();
            await onApply(data);
            this.enableInput();
        });
        this.terminal = vscode.window.createTerminal({
           name: 'Y3助手控制台',
           pty: this.pseudoterminal,
        });
        this.terminal.show();
    }

    async print(msg: string) {
        await this.pseudoterminal.print(msg);
    }

    disableInput() {
        this.pseudoterminal.disableInput();
    }

    enableInput() {
        this.pseudoterminal.enableInput();
    }
}
