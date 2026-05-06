import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

declare function acquireVsCodeApi(): {
    postMessage(msg: unknown): void;
};

const vscode = acquireVsCodeApi();

// ---- Terminal setup ----
const term = new Terminal({
    cursorBlink: true,
    scrollback: 5000,
    fontFamily: 'Cascadia Code, Menlo, Consolas, "Courier New", monospace',
    fontSize: 14,
    allowProposedApi: false,
});

const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

const container = document.getElementById('terminal')!;
term.open(container);
fitAddon.fit();

// ---- Readline state ----
let inputLine = '';
let cursorOffset = 0;
let historyStack: string[] = [];
let historyIndex = 0;
let savedInput = '';
let inputEnabled = false;
let promptStr = '\x1b[32m>\x1b[0m ';

function writePrompt(): void {
    term.write(promptStr);
}

/** 计算字符串的终端显示宽度（CJK 全角字符占 2 列） */
function displayWidth(s: string): number {
    let w = 0;
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (
            (code >= 0x1100 && code <= 0x115f) ||
            code === 0x2329 || code === 0x232a ||
            (code >= 0x2e80 && code <= 0x303e) ||
            (code >= 0x3040 && code <= 0xa4cf) ||
            (code >= 0xac00 && code <= 0xd7a3) ||
            (code >= 0xf900 && code <= 0xfaff) ||
            (code >= 0xff00 && code <= 0xff60) ||
            (code >= 0xffe0 && code <= 0xffe6) ||
            (code >= 0x20000 && code <= 0x2fffd) ||
            (code >= 0x30000 && code <= 0x3fffd)
        ) {
            w += 2;
        } else {
            w += 1;
        }
    }
    return w;
}

/** 刷新当前输入行（原地擦除并重绘） */
function refreshLine(data: string, offset: number): void {
    inputLine = data;
    cursorOffset = offset;
    // 回到行首，清除到行尾
    term.write('\r\x1b[K');
    writePrompt();
    if (data) {
        term.write(data);
    }
    // 将光标移到正确位置
    const afterCursor = displayWidth(data.slice(offset));
    if (afterCursor > 0) {
        term.write(`\x1b[${afterCursor}D`);
    }
}

/** 提交当前输入行 */
function submitInput(): void {
    const data = inputLine;
    if (data && historyStack[historyStack.length - 1] !== data) {
        historyStack.push(data);
        if (historyStack.length > 100) {
            historyStack.shift();
        }
    }
    historyIndex = 0;
    savedInput = '';
    term.write('\r\n');
    inputLine = '';
    cursorOffset = 0;
    inputEnabled = false;
    vscode.postMessage({ type: 'input', data });
}

// ---- 按键处理 ----
term.onData((data) => {
    if (!inputEnabled) {
        return;
    }

    if (data === '\r') {
        submitInput();
    } else if (data === '\x7f') { // Backspace
        if (cursorOffset > 0) {
            const newLine = inputLine.slice(0, cursorOffset - 1) + inputLine.slice(cursorOffset);
            refreshLine(newLine, cursorOffset - 1);
        }
    } else if (data === '\x1b') { // ESC
        refreshLine('', 0);
    } else if (data === '\x03') { // Ctrl+C
        navigator.clipboard?.writeText(inputLine).catch(() => {});
    } else if (data === '\x16') { // Ctrl+V
        navigator.clipboard?.readText().then((text) => {
            const cleaned = text.replace(/[\r\n]+/g, ' ');
            const newLine = inputLine.slice(0, cursorOffset) + cleaned + inputLine.slice(cursorOffset);
            refreshLine(newLine, cursorOffset + cleaned.length);
        }).catch(() => {});
    } else if (data === '\x18') { // Ctrl+X
        navigator.clipboard?.writeText(inputLine).catch(() => {});
        refreshLine('', 0);
    } else if (data.startsWith('\x1b[') || data.startsWith('\x1bO')) {
        handleControl(data);
    } else if (data.charCodeAt(0) >= 32) {
        const newLine = inputLine.slice(0, cursorOffset) + data + inputLine.slice(cursorOffset);
        refreshLine(newLine, cursorOffset + data.length);
        historyIndex = 0;
    }
});

function handleControl(data: string): void {
    const func = data.slice(-1);
    const args = data.slice(2, -1).split(';').map(n => parseInt(n) || 0);

    switch (func) {
        case 'A': { // 上箭头 - 历史记录向前
            if (historyStack.length === 0) { break; }
            if (historyIndex === 0) { savedInput = inputLine; }
            if (historyIndex < historyStack.length) {
                historyIndex++;
                const h = historyStack[historyStack.length - historyIndex];
                refreshLine(h, h.length);
            }
            break;
        }
        case 'B': { // 下箭头 - 历史记录向后
            if (historyIndex > 0) {
                historyIndex--;
                if (historyIndex === 0) {
                    refreshLine(savedInput, savedInput.length);
                } else {
                    const h = historyStack[historyStack.length - historyIndex];
                    refreshLine(h, h.length);
                }
            }
            break;
        }
        case 'C': { // 右箭头
            if (cursorOffset < inputLine.length) {
                cursorOffset++;
                refreshLine(inputLine, cursorOffset);
            }
            break;
        }
        case 'D': { // 左箭头
            if (cursorOffset > 0) {
                cursorOffset--;
                refreshLine(inputLine, cursorOffset);
            }
            break;
        }
        case 'F': { // End 键
            refreshLine(inputLine, inputLine.length);
            break;
        }
        case 'H': { // Home 键
            refreshLine(inputLine, 0);
            break;
        }
        case '~': { // 特殊键
            if (args[0] === 3) { // Delete 键
                if (cursorOffset < inputLine.length) {
                    const newLine = inputLine.slice(0, cursorOffset) + inputLine.slice(cursorOffset + 1);
                    refreshLine(newLine, cursorOffset);
                }
            }
            break;
        }
        default:
            break;
    }
}

// ---- 接收扩展侧消息 ----
type ExtToWebviewMsg =
    | { type: 'print'; data: string }
    | { type: 'setEnabled'; enabled: boolean }
    | { type: 'setHistory'; stack: string[] }
    | { type: 'setPrompt'; prompt: string };

window.addEventListener('message', (event) => {
    const msg = event.data as ExtToWebviewMsg;

    switch (msg.type) {
        case 'print': {
            const text = msg.data;
            if (inputEnabled) {
                // 有提示符时：先擦除输入行，打印消息，再恢复提示符+输入
                term.write('\r\x1b[K');
                term.write(text);
                if (!text.endsWith('\r\n')) {
                    term.write('\r\n');
                }
                writePrompt();
                if (inputLine) {
                    term.write(inputLine);
                    const afterCursor = displayWidth(inputLine.slice(cursorOffset));
                    if (afterCursor > 0) {
                        term.write(`\x1b[${afterCursor}D`);
                    }
                }
            } else {
                // 无提示符时：直接追加
                term.write(text);
                if (!text.endsWith('\r\n')) {
                    term.write('\r\n');
                }
            }
            break;
        }
        case 'setEnabled': {
            if (msg.enabled && !inputEnabled) {
                inputEnabled = true;
                writePrompt();
            } else if (!msg.enabled) {
                inputEnabled = false;
            }
            break;
        }
        case 'setHistory': {
            historyStack = msg.stack;
            break;
        }
        case 'setPrompt': {
            promptStr = msg.prompt;
            break;
        }
    }
});

// ---- 自适应尺寸 ----
const ro = new ResizeObserver(() => {
    fitAddon.fit();
});
ro.observe(container);

// ---- 通知扩展 webview 已就绪 ----
vscode.postMessage({ type: 'ready' });
