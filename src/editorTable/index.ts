import * as vscode from 'vscode';
export * from './CSV/editorTableUtility';
export * from './types';
export * from './CSV/CSVimporter';
export * from './CSV/CSVeditor';
import * as csv from './CSV';
import * as excel from './excel';
import * as editorTable from './editorTable';
import * as language from './language';
import * as languageFeature from './languageFeature';
import * as treeView from './treeView';
import * as y3 from 'y3-helper';

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
    editorTable.init();
    language.init();
    treeView.init();
    languageFeature.init();
    excel.init();
    csv.init();
}
