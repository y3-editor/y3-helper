import { TreeNode, TreeProvider } from '../treeNode';
import * as vscode from 'vscode';

let mainNode = new TreeNode('客户端', {
    childs: [
        new TreeNode('测试一下')
    ]
});

export class Viewer extends vscode.Disposable {
    private view: vscode.TreeView<TreeNode>;
    private tree = new TreeProvider(mainNode);

    constructor() {
        super(() => {
            this.view.dispose();
        });

        this.view = vscode.window.createTreeView('y3-helper.client', {
            treeDataProvider: this.tree,
        });
    }
}
