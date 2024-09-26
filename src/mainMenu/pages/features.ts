import { env } from "../../env";
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { config } from "../../config";

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
                        if (await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, '更新日志.md'))) {
                            node.iconPath = new vscode.ThemeIcon('check');
                        }
                    },
                    show: async () => {
                        return !await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, '更新日志.md'));
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
                            arguments: [vscode.Uri.joinPath(env.scriptUri!, '.log/lua_player01.log')]
                        };
                    },
                }),
                new TreeNode('多开模式', {
                    tooltip: '需要再编辑器中登录后才可使用，否则会看到“错误码：54”',
                    checkboxState: vscode.TreeItemCheckboxState.Unchecked,
                    onDidChangeCheckboxState(state) {
                        config.multiMode = state === vscode.TreeItemCheckboxState.Checked;
                    },
                    childs: Array.from({ length: 8 }, (_, i) => {
                        const id = i + 1;
                        return new TreeNode(`玩家${id}`, {
                            checkboxState: config.multiPlayers.includes(id)
                                ? vscode.TreeItemCheckboxState.Checked
                                : vscode.TreeItemCheckboxState.Unchecked,
                            onDidChangeCheckboxState(state) {
                                if (state === vscode.TreeItemCheckboxState.Checked) {
                                    if (!config.multiPlayers.includes(id)) {
                                        config.multiPlayers.push(id);
                                    }
                                } else {
                                    const index = config.multiPlayers.indexOf(id);
                                    if (index !== -1) {
                                        config.multiPlayers.splice(index, 1);
                                    }
                                }
                            }
                        });
                    }),
                })
            ]
        });
    }
};
