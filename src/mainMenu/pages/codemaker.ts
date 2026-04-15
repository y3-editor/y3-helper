import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';

export class CodeMaker入口 extends TreeNode {
    constructor() {
        super('打开 Y3Maker', {
            iconPath: new vscode.ThemeIcon('hubot'),
            command: {
                command: 'y3-helper.codemaker.open',
                title: '打开 Y3Maker',
            },
            tooltip: '打开 Y3Maker AI 助手面板',
        });
    }
}
