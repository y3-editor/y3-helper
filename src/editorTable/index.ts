import * as vscode from 'vscode';
export * from './CSV/editorTableUtility';
export * from './types';
export * from './CSV/CSVimporter';
export * from './CSV/CSVeditor';
import { test } from './EXCEL/test';
import * as editorTable from './editorTable';
import * as language from './language';
import * as languageFeature from './languageFeature';
import * as treeView from './treeView';
import * as editor from './editor';

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
    editor.init();
}
