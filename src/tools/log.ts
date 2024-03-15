import * as vscode from 'vscode';

let log = vscode.window.createOutputChannel("Y3开发助手", { log: true });
log.clear();

export { log };
