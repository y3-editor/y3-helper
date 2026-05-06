import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import * as y3 from 'y3-helper';
import { COLOR } from './terminal';

type ExtToWebviewMsg =
    | { type: 'print'; data: string }
    | { type: 'setEnabled'; enabled: boolean }
    | { type: 'setHistory'; stack: string[] }
    | { type: 'setPrompt'; prompt: string };

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 基于 Webview + xterm.js 的终端实现。
 * 对外暴露与旧版 Terminal 完全一致的公共 API，可无缝替换。
 */
export class WebviewTerminal extends vscode.Disposable {
    private _panel!: vscode.WebviewPanel;
    private _panelDisposed = true;   // 初始为 true，_createPanel() 后置 false
    private _ready = false;
    private _messageQueue: ExtToWebviewMsg[] = [];
    private _onApply?: (data: string) => Promise<void>;
    private _historyStack: string[] = [];
    private _multiMode = false;
    private _selfDisposed = false;
    private _inputEnabled = false;
    private _outputBuffer: string[] = [];

    // ---- 静态追踪：所有实例 + 面板状态事件 ----
    private static readonly _instances = new Set<WebviewTerminal>();
    private static readonly _OUTPUT_BUFFER_MAX = 500;
    static readonly onDidChangePanelState = new vscode.EventEmitter<void>();

    static hasDisposedPanel(): boolean {
        for (const inst of WebviewTerminal._instances) {
            if (inst._panelDisposed && !inst._selfDisposed) {
                return true;
            }
        }
        return false;
    }

    static revealAllDisposed(): void {
        for (const inst of [...WebviewTerminal._instances]) {
            if (inst._panelDisposed && !inst._selfDisposed) {
                inst.revealPanel();
            }
        }
    }

    constructor(public name: string) {
        super(() => {
            this._selfDisposed = true;
            if (!this._panelDisposed) {
                this._panel.dispose();
            }
            WebviewTerminal._instances.delete(this);
        });
        WebviewTerminal._instances.add(this);
        this._createPanel();
    }

    // ---- 面板生命周期 ----

    private _createPanel(): void {
        const extensionUri = y3.extensionPath();
        const panel = vscode.window.createWebviewPanel(
            'y3-helper.console',
            `${l10n.t('Y3')}: ${this.name}`,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true,
            },
        );

        this._panel = panel;
        this._panelDisposed = false;
        WebviewTerminal.onDidChangePanelState.fire();
        this._ready = false;
        this._panel.webview.html = this._buildHtml();

        this._panel.webview.onDidReceiveMessage((msg: { type: string; data?: string }) => {
            switch (msg.type) {
                case 'ready': {
                    this._ready = true;
                    // 回放输出历史
                    for (const data of this._outputBuffer) {
                        this._panel.webview.postMessage({ type: 'print', data });
                    }
                    // 恢复命令历史和提示符
                    if (this._historyStack.length > 0) {
                        this._panel.webview.postMessage({ type: 'setHistory', stack: this._historyStack });
                    }
                    if (this._multiMode) {
                        this._panel.webview.postMessage({ type: 'setPrompt', prompt: this._promptStr() });
                    }
                    // 发送积压的控制消息
                    for (const m of this._messageQueue) {
                        this._panel.webview.postMessage(m);
                    }
                    this._messageQueue = [];
                    // 恢复输入启用状态
                    this._panel.webview.postMessage({ type: 'setEnabled', enabled: this._inputEnabled });
                    break;
                }
                case 'input': {
                    const applyData = msg.data ?? '';
                    const applyPromise = this._onApply?.(applyData) ?? Promise.resolve();
                    applyPromise.finally(() => {
                        this._send({ type: 'setEnabled', enabled: true });
                    });
                    break;
                }
            }
        });

        this._panel.onDidDispose(() => {
            this._panelDisposed = true;
            this._ready = false;
            WebviewTerminal.onDidChangePanelState.fire();
        });
    }

    private _ensurePanel(): void {
        if (this._panelDisposed && !this._selfDisposed) {
            this._createPanel();
        }
    }

    private _send(msg: ExtToWebviewMsg): void {
        if (msg.type === 'print') {
            // print 消息通过 _outputBuffer 在 ready 时回放，此处只在面板就绪时直接发送
            if (!this._panelDisposed && this._ready) {
                this._panel.webview.postMessage(msg);
            }
            return;
        }
        if (this._panelDisposed) {
            // 面板已关闭，静默入队；等 revealPanel() 重建面板后统一发送
            this._messageQueue.push(msg);
            return;
        }
        if (this._ready) {
            this._panel.webview.postMessage(msg);
        } else {
            this._messageQueue.push(msg);
        }
    }

    private _promptStr(): string {
        return this._multiMode
            ? `${COLOR.GREEN}${this.name}>${COLOR.RESET} `
            : `${COLOR.GREEN}>${COLOR.RESET} `;
    }

    private _buildHtml(): string {
        const webview = this._panel.webview;
        const scriptUri = webview.asWebviewUri(
            y3.extensionPath('dist', 'consoleWebview.js'),
        );
        const nonce = getNonce();
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   script-src 'nonce-${nonce}';
                   style-src 'unsafe-inline';
                   font-src data:;
                   img-src data:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; }
        #terminal { width: 100%; height: 100%; }
    </style>
</head>
<body>
    <div id="terminal"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    // ---- 公共 API（与旧版 Terminal 一致） ----

    setApplyHandler(handler: (data: string) => Promise<void>): void {
        this._onApply = handler;
    }

    get multiMode(): boolean {
        return this._multiMode;
    }

    set multiMode(val: boolean) {
        this._multiMode = val;
        this._send({ type: 'setPrompt', prompt: this._promptStr() });
    }

    async print(msg: string): Promise<void> {
        msg = msg.replace(/(?<!\r)\n/g, '\r\n');
        this._outputBuffer.push(msg);
        if (this._outputBuffer.length > WebviewTerminal._OUTPUT_BUFFER_MAX) {
            this._outputBuffer.shift();
        }
        this._send({ type: 'print', data: msg });
    }

    disableInput(): void {
        this._inputEnabled = false;
        this._send({ type: 'setEnabled', enabled: false });
    }

    async enableInput(): Promise<void> {
        this._inputEnabled = true;
        this._ensurePanel();
        // 面板可见但不抢焦点
        this._panel.reveal(undefined, true);
        this._send({ type: 'setEnabled', enabled: true });
    }

    /** 重新显示面板，不改变输入启用状态（用于重新打开控制台） */
    revealPanel(): void {
        this._ensurePanel();
        this._panel.reveal(undefined, true);
    }

    getHistoryStack(): string[] {
        return this._historyStack;
    }

    setHistoryStack(stack: string[]): void {
        this._historyStack = stack;
        this._send({ type: 'setHistory', stack });
    }
}
