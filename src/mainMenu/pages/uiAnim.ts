import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

export class 时间轴动画 extends TreeNode {
    constructor() {
        super('时间轴动画', {
            iconPath: new vscode.ThemeIcon('history'),
            show: async () => {
                await env.mapReady();
                return env.mapUri !== undefined;
            },

            update: async (node) => {
                node.childs = (await define.时间轴动画.get()).map(anim => {
                    return new TreeNode(anim.name, {
                        data: anim.uid,
                        description: `${anim.uid}`,
                        contextValue: '时间轴动画',
                        tooltip: 
`名称: ${anim.name}
帧率: ${anim.frame}
帧数: ${anim.maxFrame}
模式: ${anim.playMode}`
                    });
                });
            },
        });

        define.时间轴动画.onDidChange(() => {
            this.refresh();
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
