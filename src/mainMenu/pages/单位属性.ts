import { env } from "../../env";
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";

export class 单位属性 extends TreeNode {
    constructor() {
        super('单位属性', {
            iconPath: new vscode.ThemeIcon('account'),
            show: async () => {
                return (await define.单位属性.getAttrs()).length > 0;
            },

            update: async (node) => {
                node.childs = (await define.单位属性.getAttrs()).map(attr => new TreeNode(attr.name, {
                    description: attr.key,
                }));
            },
        });

        define.单位属性.onDidChange(() => {
            this.refresh();
        });
    }
};
