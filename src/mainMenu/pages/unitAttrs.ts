import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";
import * as l10n from '@vscode/l10n';


export class 单位属性 extends TreeNode {
    constructor() {
        super(l10n.t('单位属性'), {
            iconPath: new vscode.ThemeIcon('account'),
            show: async () => {
                await env.mapReady();
                return env.currentMap !== undefined;
            },

            update: async (node) => {
                if (!env.currentMap) {
                    return;
                }
                node.childs = (await define(env.currentMap).单位属性.getAttrs()).map(attr => new TreeNode(attr.name, {
                    description: attr.key,
                    contextValue: l10n.t('单位属性'),
                }));
            },
        });

        env.onDidChange(() => {
            if (env.currentMap) {
                this.refresh();
                define(env.currentMap).单位属性.onDidChange(() => {
                    this.refresh();
                });
            }
        });
    }
};

vscode.commands.registerCommand('y3-helper.copyUnitAttrName', (node: TreeNode) => {
    if (typeof node.label !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.label);
});

vscode.commands.registerCommand('y3-helper.copyUnitAttrKey', (node: TreeNode) => {
    if (typeof node.description !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.description);
});
