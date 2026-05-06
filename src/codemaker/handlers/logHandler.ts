/**
 * 日志/杂项 Handler
 * - CONSOLE_ERROR / CONSOLE_LOG / CONSOLE_WARN / PRINT_LOG
 * - REPORT_CONSOLE_ERROR / REPORT_CONSOLE_LOG / REPORT_CONSOLE_WARN
 * - WEBVIEW_ACK
 * - keyboardEvent
 * - UPLOAD_LOG
 * - OPEN_NEW_WINDOW
 * - OPEN_SOURCE_CONTROL
 * - Y3 不需要的功能 stub
 */

import * as vscode from 'vscode';
import type { CodeMakerWebviewProvider } from '../webviewProvider';

export function handleConsoleError(data: any) {
    if (Array.isArray(data)) {
        console.error('[Y3Maker WebView]', ...data);
    }
}

export function handleConsoleLog(data: any) {
    if (Array.isArray(data)) {
        console.log('[Y3Maker WebView]', ...data);
    } else if (typeof data === 'string') {
        console.log('[Y3Maker WebView]', data);
    }
}

export function handleConsoleWarn(data: any) {
    if (Array.isArray(data)) {
        console.warn('[Y3Maker WebView]', ...data);
    }
}

export function handleUploadLog(provider: CodeMakerWebviewProvider) {
    provider.sendMessage({
        type: 'UPLOAD_LOG_RESULT',
        data: { error: 'Not supported in Y3Helper integration' },
    });
}

export async function handleOpenNewWindow(data: any) {
    const { path: localPath } = data || {};
    if (localPath && typeof localPath === 'string') {
        await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(localPath),
            true
        );
    }
}

export function handleOpenSourceControl() {
    vscode.commands.executeCommand('workbench.view.scm');
}
