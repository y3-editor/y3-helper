import { TreeNode } from "../treeNode";
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
icons.set(7, new vscode.ThemeIcon('symbol-number')); // Layout
icons.set(10, new vscode.ThemeIcon('list-unordered')); // ScrollView
icons.set(27, new vscode.ThemeIcon('settings-gear')); // Chat_Box

class UINode extends TreeNode {
    constructor(ui: Node) {
        super(ui.name, {
            update: async (node) => {
                node.iconPath = icons.get(ui.type);
                node.childs = ui.childs.length > 0
                    ? ui.childs.map(ui => new UINode(ui))
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
                new TreeNode('预设', {
                    iconPath: new vscode.ThemeIcon('layout-statusbar'),

                    show: async () => {
                        return env.mapUri !== undefined;
                    },

                    update: async (node) => {
                        if (env.mapUri === undefined) {
                            return;
                        }

                        node.childs = (await define.画板.getUI())
                            .预设
                            .map(ui => new UINode(ui));
                    }
                })
            ],
        });
    }
};
