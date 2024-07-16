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

vscode.commands.registerCommand('y3-helper.testExcel', async () => {
    try {
    } catch (error) {
        vscode.window.showErrorMessage(String(error));
    }
});

export function init() {
    editorTable.init();
    language.init();
    treeView.init();
    languageFeature.init();
    excel.init();
    csv.init();
}
