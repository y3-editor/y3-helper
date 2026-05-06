/**
 * 终端操作 Handler
 * - INSERT_TERMINAL
 * - STOP_ALL_TERMINAL
 * - STOP_TERMINAL_PROGRESS
 * - SHOW_TERMINAL_WINDOW
 */

import * as vscode from 'vscode';

export function handleInsertTerminal(data: any) {
    const { content, execute } = data;
    let terminal = vscode.window.activeTerminal;
    if (!terminal) {
        terminal = vscode.window.createTerminal();
    }
    terminal.show(true);
    terminal.sendText(content, execute);
}

export function handleStopAllTerminal() {
    vscode.window.terminals.forEach(t => t.dispose());
}

export function handleStopTerminalProgress(data: any) {
    const { terminalId } = data;
    const terminal = vscode.window.terminals.find(
        t => t.name === terminalId
    );
    if (terminal) { terminal.dispose(); }
}

export function handleShowTerminalWindow(data: any) {
    const { terminalId } = data;
    const terminal = vscode.window.terminals.find(
        t => t.name === terminalId
    );
    if (terminal) {
        terminal.show(true);
    } else {
        vscode.window.showErrorMessage('当前终端窗口已无法打开！');
    }
}
