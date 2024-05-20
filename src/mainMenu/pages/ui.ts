import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";

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

                        node.childs = (await define.画板.getUI()).map(ui => new TreeNode(ui.name, {
                        }));
                    }
                })
            ],
        });
    }
};
