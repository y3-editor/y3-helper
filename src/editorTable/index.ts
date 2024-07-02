import * as vscode from 'vscode';
export * from './editorTableUtility';
export * from './types';
export * from './editorTableProvider';
export * from './CSV/CSVimporter';
export * from './CSV/CSVeditor';
import { test } from './EXCEL/test';
import * as language from './language';
import * as treeView from './treeView';

vscode.commands.registerCommand('y3-helper.testExcel', () => {
    test();
});

export function init() {
    language.init();
    treeView.init();
}
