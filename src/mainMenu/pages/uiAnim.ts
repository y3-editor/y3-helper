import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";
import * as l10n from '@vscode/l10n';


export class 时间轴动画 extends TreeNode {
    constructor() {
        super(l10n.t('时间轴动画'), {
            iconPath: new vscode.ThemeIcon('history'),
            show: async () => {
                await env.mapReady();
                return env.currentMap !== undefined;
            },

            update: async (node) => {
                if (!env.currentMap) {
                    return;
                }
                node.childs = (await define(env.currentMap).时间轴动画.get()).map(anim => {
                    return new TreeNode(anim.name, {
                        data: anim.uid,
                        description: `${anim.uid}`,
                        contextValue: l10n.t('时间轴动画'),
                        tooltip: 
`${l10n.t('名称')}: ${anim.name}
${l10n.t('帧率')}: ${anim.frame}
${l10n.t('帧数')}: ${anim.maxFrame}
${l10n.t('模式')}: ${anim.playMode}`
                    });
                });
            },
        });

        env.onDidChange(() => {
            if (env.currentMap) {
                this.refresh();
                define(env.currentMap).时间轴动画.onDidChange(() => {
                    this.refresh();
                });
            }
        });
    }
};

vscode.commands.registerCommand('y3-helper.copyUIAnimName', (node: TreeNode) => {
    if (typeof node.label !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.label);
});

vscode.commands.registerCommand('y3-helper.copyUIAnimID', (node: TreeNode) => {
    vscode.env.clipboard.writeText(node.data.toString());
});
