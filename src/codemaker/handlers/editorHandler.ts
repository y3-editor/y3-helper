/**
 * 编辑器操作 Handler
 * - INSERT_TO_EDITOR
 * - INSERT_WITH_DIFF
 * - GET_EDITOR_FILE_STATE
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { CodeMakerWebviewProvider } from '../webviewProvider';

export function generateConflictText(original: string, incoming: string): string {
    return `<<<<<<< Current\n${original}\n=======\n${incoming}\n>>>>>>> Incoming`;
}

export function syncEditFileState(provider: CodeMakerWebviewProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        provider.sendMessage({
            type: 'EDITOR_FILE_STATE',
            data: { current_file: null },
        });
        return;
    }
    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = doc.getText(selection);
    const relativePath = vscode.workspace.asRelativePath(doc.uri, false);

    provider.sendMessage({
        type: 'EDITOR_FILE_STATE',
        data: {
            current_file: {
                content: doc.getText(),
                path: relativePath,
                file_name: path.basename(doc.fileName),
                language: doc.languageId,
            },
            selection: selectedText || '',
            cursor_position: {
                line: selection.active.line,
                character: selection.active.character,
            },
        },
    });
}

export async function handleInsertToEditor(data: string, webview: vscode.Webview) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        webview.postMessage({
            type: 'actionInfo',
            data: { tab: 'chat', content: '请先打开一个文件' },
        });
        return;
    }
    const selection = new vscode.Selection(
        editor.selection.start.line, 0,
        editor.selection.end.line,
        editor.document.lineAt(editor.selection.end.line).text.length
    );
    await editor.edit((editBuilder) => {
        editBuilder.replace(
            new vscode.Range(selection.start, selection.end),
            data
        );
    });
}

export async function handleInsertWithDiff(data: string, webview: vscode.Webview) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        webview.postMessage({
            type: 'actionInfo',
            data: { tab: 'chat', content: '请先打开一个文件' },
        });
        return;
    }
    const selection = new vscode.Selection(
        editor.selection.start.line, 0,
        editor.selection.end.line,
        editor.document.lineAt(editor.selection.end.line).text.length
    );
    const selectText = editor.document.getText(selection);
    if (selectText && selectText.trim().length > 0) {
        await editor.edit((editBuilder) => {
            editBuilder.replace(
                new vscode.Range(selection.start, selection.end),
                generateConflictText(selectText, data)
            );
        });
    } else {
        await editor.edit((editBuilder) => {
            editBuilder.replace(
                new vscode.Range(selection.start, selection.end),
                data
            );
        });
    }
}
