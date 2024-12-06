import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

export class 字体 extends TreeNode {
    constructor() {
        super('字体', {
            iconPath: new vscode.ThemeIcon('whole-word'),
            show: async () => {
                await env.mapReady();
                return env.mapUri !== undefined;
            },

            update: async (node) => {
                node.childs = (await define().字体.get()).map(word => {
                    return new TreeNode(word.name, {
                        description: `${word.uid}`,
                    });
                });
            },
        });

        define().字体.onDidChange(() => {
            this.refresh();
        });
    }
};
