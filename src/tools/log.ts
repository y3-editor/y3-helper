import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';


let log = vscode.window.createOutputChannel(l10n.t("Y3开发助手"), { log: true });
log.clear();

export { log };
