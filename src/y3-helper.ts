import * as vscode from 'vscode';
import { fs } from './tools';

export * as excel from './editorTable/EXCEL';
export * as table from './editorTable/editorTable';
export * as language from './editorTable/language';
export * from './tools';
export * as const from './constants';
export { env } from './env';
export let helper: vscode.ExtensionContext;

export function uri(base: vscode.Uri | string, ...paths: string[]): vscode.Uri {
    if (typeof base === 'string') {
        if (fs.isAbsolutePath(base)) {
            base = vscode.Uri.parse(base);
        } else {
            base = vscode.Uri.joinPath(helper.extensionUri, base);
        }
    }
    return vscode.Uri.joinPath(base, ...paths);
}

export function extensionPath(...paths: string[]): vscode.Uri {
    return vscode.Uri.joinPath(helper.extensionUri, ...paths);
}

export function setContext(ctx: vscode.ExtensionContext) {
    helper = ctx;
}

export function print(...args: any[]) {
    vscode.window.showInformationMessage(args.join(' '));
}
