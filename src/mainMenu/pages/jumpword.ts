import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";
import * as l10n from '@vscode/l10n';


export class 跳字 extends TreeNode {
    constructor() {
        super(l10n.t('跳字'), {
            iconPath: new vscode.ThemeIcon('text-size'),
            show: async () => {
                await env.mapReady();
                return env.currentMap !== undefined;
            },

            update: async (node) => {
                if (!env.currentMap) {
                    return;
                }
                node.childs = (await define(env.currentMap).跳字.get()).map(word => {
                    return new TreeNode(word.name, {
                        description: `${word.uid}`,
                    });
                });
            },
        });

        env.onDidChange(() => {
            if (env.currentMap) {
                this.refresh();
                define(env.currentMap).跳字.onDidChange(() => {
                    this.refresh();
                });
            }
        });
    }
};
