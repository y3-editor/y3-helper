import * as vscode from 'vscode';

const l10n = vscode.l10n;

let log = vscode.window.createOutputChannel(l10n.t("Y3开发助手"), { log: true });
log.clear();

export { log };
