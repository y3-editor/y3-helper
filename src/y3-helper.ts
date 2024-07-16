import * as vscode from 'vscode';
import { fs, log } from './tools';

export * as excel from './editorTable/excel';
export * as table from './editorTable/editorTable';
export * as language from './editorTable/language';
export * from './tools';
export * as const from './constants';
export { env } from './env';
export * as plugin from './plugin';
export let helper: vscode.ExtensionContext;

/**
 * 拼接路径为 Uri
 * @returns 
 */
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

/**
 * 获取《Y3开发助手》插件的相对路径
 * @returns 
 */
export function extensionPath(...paths: string[]): vscode.Uri {
    return vscode.Uri.joinPath(helper.extensionUri, ...paths);
}

export function setContext(ctx: vscode.ExtensionContext) {
    helper = ctx;
}

/**
 * 打印内容，也会打印到日志窗口中
 * @param args 要打印的内容
 */
export function print(...args: any[]) {
    vscode.window.showInformationMessage(args.join(' '));
    log.info(args.join(' '));
}

/**
 * 在VSCode中打开文件
 * @param uri 文件路径
 */
export function open(uri: vscode.Uri | string) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.parse(uri);
    }
    vscode.commands.executeCommand('vscode.open', uri);
}

/**
 * 在Windows中打开文件
 * @param uri 文件路径
 */
export function openInExplorer(uri: vscode.Uri | string) {
    if (typeof uri === 'string') {
        uri = vscode.Uri.parse(uri);
    }
    vscode.commands.executeCommand('revealFileInOS', uri);
}

export async function sleep(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
}

export function assert(exp: any, msg?: string) {
    if (exp !== false && exp !== null && exp !== undefined) {
        return;
    }
    throw new Error(msg ?? 'Assetion failed!');
}
