import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

const l10n = vscode.l10n;

export class 跳字 extends TreeNode {
    constructor() {
        super(l10n.t('跳字'), {
            iconPath: new vscode.ThemeIcon('text-size'),
            show: async () => {
                await env.mapReady();
                return env.mapUri !== undefined;
            },

            update: async (node) => {
                node.childs = (await define().跳字.get()).map(word => {
                    return new TreeNode(word.name, {
                        description: `${word.uid}`,
                    });
                });
            },
        });

        define().跳字.onDidChange(() => {
            this.refresh();
        });
    }
};
