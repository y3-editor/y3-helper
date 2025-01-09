import * as vscode from 'vscode';
export * from './types';
import * as excel from './excel';
import * as language from './language';
import * as languageFeature from './languageFeature';
import * as treeView from './treeView';

class Item implements vscode.QuickPickItem {
    constructor(public label: string) {}

    description = '这是描述';
    detail = '这是详细信息';
    alwaysShow = true;
}

vscode.commands.registerCommand('y3-helper.testExcel', async () => {
    let result = await vscode.window.showQuickPick<Item>([
        new Item('测试选项1'),
        new Item('测试选项2'),
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
