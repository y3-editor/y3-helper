import * as vscode from 'vscode';

export * as excel from './editorTable/EXCEL';
export * as table from './editorTable/editorTable';
export * as language from './editorTable/language';
export * from './tools';
export * as const from './constants';
export { env } from './env';
export let helper: vscode.ExtensionContext;

export function joinPath(base: vscode.Uri, ...paths: string[]): vscode.Uri {
    return vscode.Uri.joinPath(base, ...paths);
}

export function extensionPath(...paths: string[]): vscode.Uri {
    return vscode.Uri.joinPath(helper.extensionUri, ...paths);
}

export function setContext(ctx: vscode.ExtensionContext) {
    helper = ctx;
}
