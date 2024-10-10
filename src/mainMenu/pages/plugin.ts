import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as path from 'path';

export class 插件 extends TreeNode {
    constructor() {
        let event: vscode.Disposable | undefined;
        super('插件', {
            iconPath: new vscode.ThemeIcon('extensions'),
            show: async () => {
                await y3.env.mapReady();
                return y3.env.scriptUri !== undefined;
            },
            update: async (node) => {
                node.childs = [
                    new TreeNode('初始化', {
                        iconPath: new vscode.ThemeIcon('cloud-download'),
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
                    }),
                ];

                let pluginManager = y3.plugin.getManager();
                if (!pluginManager) {
                    return;
                }

                event?.dispose();
                event = pluginManager.onDidChange(() => {
                    node.refresh();
                });

                let plugins = await pluginManager.getAll();
                if (plugins.length === 0) {
                    return;
                }

                node.childs.push(new TreeNode('插件列表', {
                    iconPath: new vscode.ThemeIcon('list-unordered'),
                    update: async (node) => {
                        node.childs = plugins.map(plugin => new TreeNode(plugin.name, {
                            iconPath: new vscode.ThemeIcon('bracket-dot'),
                            contextValue: '插件',
                            data: plugin.uri,
                            update: async (node) => {
                                let exports = await plugin.getExports();
                                node.childs = Object.values(exports).map(exp => new TreeNode(exp.name, {
                                    iconPath: new vscode.ThemeIcon('run'),
                                    description: '点击运行',
                                    command: {
                                        command: 'y3-helper.runPlugin',
                                        title: exp.name,
                                        arguments: [plugin.uri, exp.name],
                                    },
                                }));
                            },
                        }));
                    },
                }));
            },
        });
    }
}

vscode.commands.registerCommand('y3-helper.openPlugin', async (node: TreeNode) => {
    y3.open(node.data);
});
