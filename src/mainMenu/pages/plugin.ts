import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export class 插件 extends TreeNode {
    constructor() {
        super('插件', {
            iconPath: new vscode.ThemeIcon('extensions'),
            show: async () => {
                await y3.env.mapReady();
                return y3.env.scriptUri !== undefined;
            },
            childs: [
                new TreeNode('初始化', {
                    iconPath: new vscode.ThemeIcon('cloud-download'),
                    show: async () => {
                        if (!y3.env.pluginUri) {
                            return false;
                        }
                        return !await y3.fs.isFile(y3.env.pluginUri, 'y3-helper.d.ts');
                    },
                    command: {
                        command: 'y3-helper.initPlugin',
                        title: '初始化插件',
                    },
                }),
                new TreeNode('更新定义文件', {
                    iconPath: new vscode.ThemeIcon('sync'),
                    show: async () => {
                        if (!y3.env.pluginUri) {
                            return false;
                        }
                        return await y3.fs.isFile(y3.env.pluginUri, 'y3-helper.d.ts');
                    },
                    command: {
                        command: 'y3-helper.updatePlugin',
                        title: '更新插件定义文件',
                    },
                })
            ]
        });
    }
}
