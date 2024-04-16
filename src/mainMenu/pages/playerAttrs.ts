import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";

export class 玩家属性 extends TreeNode {
    constructor() {
        super('玩家属性', {
            iconPath: new vscode.ThemeIcon('organization'),
            show: async () => {
                return (await define.玩家属性.getAttrs()).length > 0;
            },

            update: async (node) => {
                node.childs = (await define.玩家属性.getAttrs()).map(attr => new TreeNode(attr.name, {
                    description: attr.key,
                    contextValue: '玩家属性',
                }));
            },
        });

        define.玩家属性.onDidChange(() => {
            this.refresh();
        });
    }
};

vscode.commands.registerCommand('y3-helper.copyPlayerAttrName', (node: TreeNode) => {
    if (typeof node.label !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.label);
});

vscode.commands.registerCommand('y3-helper.copyPlayerAttrKey', (node: TreeNode) => {
    if (typeof node.description !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.description);
});
