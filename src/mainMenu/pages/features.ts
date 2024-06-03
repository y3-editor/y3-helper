import { env } from "../../env";
import { TreeNode } from "../../treeNode";
import * as vscode from 'vscode';

export class 功能 extends TreeNode {
    constructor() {
        super('功能', {
            iconPath: new vscode.ThemeIcon('beaker'),
            show: async () => {
                await env.mapReady();
                return env.scriptUri !== undefined;
            },
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            childs: [
                new TreeNode('初始化Y3库', {
                    command: {
                        command: 'y3-helper.initProject',
                        title: '初始化Y3库',
                    },
                    update: async (node) => {
                        node.iconPath = new vscode.ThemeIcon('cloud-download');
                        try {
                            let stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(env.y3Uri!, '.git'));
                            if (stat.type === vscode.FileType.Directory) {
                                node.iconPath = new vscode.ThemeIcon('check');
                            }
                        } catch {}
                    },
                    show: async () => {
                        try {
                            await vscode.workspace.fs.stat(vscode.Uri.joinPath(env.y3Uri!, '.git'));
                            return false;
                        } catch {
                            return true;
                        }
                    }
                }),
                new TreeNode('启动游戏', {
                    command: {
                        command: 'y3-helper.launchGame',
                        title: '启动游戏',
                    },
                    iconPath: new vscode.ThemeIcon('play'),
                }),
                new TreeNode('启动游戏并附加调试器', {
                    command: {
                        command: 'y3-helper.launchGameAndAttach',
                        title: '启动游戏并附加调试器',
                    },
                    iconPath: new vscode.ThemeIcon('debug-alt'),
                    description: 'Shift + F5',
                }),
                new TreeNode('附加调试器', {
                    command: {
                        command: 'y3-helper.attach',
                        title: '附加调试器',
                    },
                    iconPath: new vscode.ThemeIcon('run-all'),
                }),
                new TreeNode('在编辑器中打开', {
                    command: {
                        command: 'y3-helper.launchEditor',
                        title: '在编辑器中打开',
                    },
                    iconPath: new vscode.ThemeIcon('mortar-board'),
                }),
                new TreeNode('查看物编数据', {
                    command: {
                        command: 'y3-helper.editorTableView.focus',
                        title: '查看物编数据',
                    },
                    iconPath: new vscode.ThemeIcon('symbol-function'),
                }),
                new TreeNode('查看日志', {
                    iconPath: new vscode.ThemeIcon('output'),
                    show: () => {
                        return env.scriptUri !== undefined;
                    },
                    update: async (node) => {
                        if (env.scriptUri === undefined) {
                            return;
                        }
                        node.command = {
                            command: 'vscode.open',
                            title: '查看日志',
                            arguments: [vscode.Uri.joinPath(env.scriptUri!, 'log/lua_player01.log')]
                        };
                    },
                }),
            ]
        });
    }
};
