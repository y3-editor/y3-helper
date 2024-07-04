import * as vscode from 'vscode';

export * as excel from './editorTable/EXCEL';
export * as table from './editorTable/editorTable';
export * as language from './editorTable/language';
export * from './tools';
export let context: vscode.ExtensionContext;

export function setContext(ctx: vscode.ExtensionContext) {
    context = ctx;
}
