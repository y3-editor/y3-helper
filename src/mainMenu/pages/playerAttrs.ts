import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";
import * as l10n from '@vscode/l10n';


export class 玩家属性 extends TreeNode {
    constructor() {
        super(l10n.t('玩家属性'), {
            iconPath: new vscode.ThemeIcon('organization'),
            show: async () => {
                await env.mapReady();
                return env.currentMap !== undefined;
            },

            update: async (node) => {
                node.childs = (await define(env.currentMap!).玩家属性.getAttrs()).map(attr => new TreeNode(attr.name, {
                    description: attr.key,
                    contextValue: l10n.t('玩家属性'),
                }));
            },
        });

        env.onDidChange(() => {
            if (env.currentMap) {
                this.refresh();
                define(env.currentMap).玩家属性.onDidChange(() => {
                    this.refresh();
                });
            }
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
