import { TreeNode } from "../../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

export class 自定义事件 extends TreeNode {
    constructor() {
        super('自定义事件', {
            iconPath: new vscode.ThemeIcon('group-by-ref-type'),
            show: async () => {
                await env.mapReady();
                return env.projectUri !== undefined;
            },

            update: async (node) => {
                node.childs = (await define.自定义事件.getEvents()).map(event => {
                    let args = event.args.map(arg => arg.name);
                    return new TreeNode(event.name, {
                        iconPath: new vscode.ThemeIcon('symbol-event'),
                        description: `${event.id.toString()}(${args.join(',')})`,
                        contextValue: '自定义事件',
                        data: event.id,
                        childs: event.args.map(arg => new TreeNode(arg.name, {
                            description: `${arg.desc}(${arg.luaType})`,
                        })),
                    });
                });
            },
        });

        define.自定义事件.onDidChange(() => {
            this.refresh();
        });
    }
};

vscode.commands.registerCommand('y3-helper.copyEventName', (node: TreeNode) => {
    if (typeof node.label !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.label);
});

vscode.commands.registerCommand('y3-helper.copyEventID', (node: TreeNode) => {
    if (typeof node.data !== 'number') {
        return;
    }
    vscode.env.clipboard.writeText(node.data.toString());
});
