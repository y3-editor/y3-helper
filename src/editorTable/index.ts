import * as vscode from 'vscode';
import * as excel from './excel';
import * as languageFeature from './languageFeature';
import * as treeView from './treeView';
import * as l10n from '@vscode/l10n';


class Item implements vscode.QuickPickItem {
    constructor(public label: string) {}

    description = l10n.t('这是描述');
    detail = l10n.t('这是详细信息');
    alwaysShow = true;
}

vscode.commands.registerCommand('y3-helper.testExcel', async () => {
    let uris = await vscode.window.showOpenDialog();
    let uri = uris?.[0];
    if (!uri) {
        return;
    }
    let result = await excel.loadFile(uri);
    let table = result?.makeTable('A2', 2);
    table;
});

export function init() {
    treeView.init();
    languageFeature.init();
    excel.init();
}
