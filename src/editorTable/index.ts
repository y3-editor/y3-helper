import * as vscode from 'vscode';
export * from './CSV/editorTableUtility';
export * from './types';
export * from './CSV/CSVimporter';
export * from './CSV/CSVeditor';
import { test } from './excel2/test';
import * as csv from './CSV';
import * as excel from './excel2';
import * as editorTable from './editorTable';
import * as language from './language';
import * as languageFeature from './languageFeature';
import * as treeView from './treeView';

vscode.commands.registerCommand('y3-helper.testExcel', async () => {
    try {
        await test();
    } catch (error) {
        vscode.window.showErrorMessage(String(error));
    }
});

export function init() {
    editorTable.init();
    language.init();
    treeView.init();
    languageFeature.init();
    csv.init();
    excel.init();
}
