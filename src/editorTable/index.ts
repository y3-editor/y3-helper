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
    let result = await vscode.window.showQuickPick<Item>([
        new Item(l10n.t('测试选项1')),
        new Item(l10n.t('测试选项2')),
    ], {
        matchOnDescription: false,
        matchOnDetail: false,
    });
    result;
});

export function init() {
    treeView.init();
    languageFeature.init();
    excel.init();
}
