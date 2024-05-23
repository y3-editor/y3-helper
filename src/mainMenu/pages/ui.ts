import { TreeNode } from "../../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

type Node = {
    name: string,
    uid: string,
    type: number,
    childs: Node[],
};

let icons: Map<number, vscode.ThemeIcon> = new Map();
icons.set(1, new vscode.ThemeIcon('inspect')); // Button
icons.set(3, new vscode.ThemeIcon('text-size')); // TextLabel
icons.set(4, new vscode.ThemeIcon('graph-line')); // Image
icons.set(5, new vscode.ThemeIcon('pulse')); // Progress
icons.set(7, new vscode.ThemeIcon('symbol-number')); // Layout
icons.set(10, new vscode.ThemeIcon('list-unordered')); // ScrollView
icons.set(18, new vscode.ThemeIcon('compass-active')); // Buff_List
icons.set(18, new vscode.ThemeIcon('compass')); // Buff_Item
icons.set(27, new vscode.ThemeIcon('settings-gear')); // Chat_Box
icons.set(38, new vscode.ThemeIcon('sparkle')); // Sequence_Animation

class UINode extends TreeNode {
    constructor(ui: Node, type: string) {
        super(ui.name, {
            iconPath: icons.get(ui.type),
            contextValue: type,
            update: async (node) => {
                node.tooltip = ui.uid;
                node.childs = ui.childs.length > 0
                    ? ui.childs.map(ui => new UINode(ui, type))
                    : undefined;
            }
        });
    }
}

export class 界面 extends TreeNode {
    constructor() {
        super('界面', {
            iconPath: new vscode.ThemeIcon('layout'),
            show: async () => {
                await env.mapReady();
                return env.mapUri !== undefined;
            },

            childs: [
                new TreeNode('画板', {
                    iconPath: new vscode.ThemeIcon('layout-statusbar'),

                    show: async () => {
                        return env.mapUri !== undefined;
                    },

                    update: async (node) => {
                        if (env.mapUri === undefined) {
                            return;
                        }

                        node.childs = (await define.界面.getUIPackage())
                            .画板
                            .map(ui => new UINode(ui, '画板'));
                    }
                }),
                new TreeNode('场景UI', {
                    iconPath: new vscode.ThemeIcon('smiley'),

                    show: async () => {
                        return env.mapUri !== undefined;
                    },

                    update: async (node) => {
                        if (env.mapUri === undefined) {
                            return;
                        }

                        node.childs = (await define.界面.getUIPackage())
                            .场景UI
                            .map(ui => new UINode(ui, '场景UI'));
                    }
                }),
                new TreeNode('元件', {
                    iconPath: new vscode.ThemeIcon('extensions'),

                    show: async () => {
                        return env.mapUri !== undefined;
                    },

                    update: async (node) => {
                        if (env.mapUri === undefined) {
                            return;
                        }

                        node.childs = (await define.界面.getUIPackage())
                            .元件
                            .map(ui => new UINode(ui, '元件'));
                    }
                }),
            ],
        });
    }
};

vscode.commands.registerCommand('y3-helper.copyUIName', (node: TreeNode) => {
    if (typeof node.label !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.label);
});

vscode.commands.registerCommand('y3-helper.copyUIPath', (node: TreeNode) => {
    let paths: string[] = [];
    // 递归父节点将所有的label拼接起来
    let curNode = node;
    while (curNode.contextValue === '画板') {
        paths.unshift(curNode.label as string);
        if (curNode.parent === undefined) {
            break;
        }
        curNode = curNode.parent;
    }
    vscode.env.clipboard.writeText(paths.join('.'));
});

vscode.commands.registerCommand('y3-helper.copyUIUID', (node: TreeNode) => {
    if (typeof node.tooltip !== 'string') {
        return;
    }
    vscode.env.clipboard.writeText(node.tooltip);
});
