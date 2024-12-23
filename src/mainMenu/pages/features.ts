import { env } from "../../env";
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { config } from "../../config";
import { TreeViewManager } from "../../console/treeView";
import * as globalScript from '../../globalScript';

function 多开模式() {
    let node = new TreeNode('多开模式', {
        tooltip: '请手动启动编辑器登录（并选择30天免登录）再使用此功能',
        checkboxState: config.multiMode ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked,
        onDidChangeCheckboxState(state) {
            config.multiMode = state === vscode.TreeItemCheckboxState.Checked;
        },
        childs: Array.from({ length: 8 }, (_, i) => {
            const id = i + 1;
            return new TreeNode(`玩家${id}`, {
                checkboxState: config.multiPlayers.includes(id)
                    ? vscode.TreeItemCheckboxState.Checked
                    : vscode.TreeItemCheckboxState.Unchecked,
                description: config.debugPlayers.includes(id)
                    ? '启用调试器'
                    : undefined,
                command: {
                    title: '切换调试',
                    command: 'y3-helper.debug.toggle',
                    arguments: [id],
                },
                tooltip: '点击此处可以切换是否附加调试此玩家。所有调试的玩家会共用断点，所以不应该附加太多调试器。',
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
                },
                update: async (node) => {
                    node.description = config.debugPlayers.includes(id)
                        ? '启用调试器'
                        : undefined;
                },
            });
        }),
    });
    vscode.commands.registerCommand('y3-helper.debug.toggle', async (id: number) => {
        const index = config.debugPlayers.indexOf(id);
        if (index === -1) {
            config.debugPlayers.push(id);
        } else {
            config.debugPlayers.splice(index, 1);
        }
        node.childs?.[id-1].refresh();
    });
    return node;
}

function 启用Tracy() {
    let node = new TreeNode('启用Tracy', {
        tooltip: '对Lua进行性能分析，但是会大幅影响运行效率',
        checkboxState: config.tracy ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked,
        onDidChangeCheckboxState(state) {
            config.tracy = state === vscode.TreeItemCheckboxState.Checked;
        },
    });
    return node;
}

function 切换自定义视图() {
    let node = new TreeNode('切换自定义视图', {
        iconPath: new vscode.ThemeIcon('window'),
        show: () => {
            return TreeViewManager.allManagers.size >= 2;
        },
        update: async (node) => {
            node.childs = Array.from(TreeViewManager.allManagers.values(), manager => {
                let child = new TreeNode(manager.client.name, {
                    command: {
                        command: 'y3-helper.custom.show',
                        title: '切换自定义视图',
                        arguments: [manager.id],
                    },
                });
                manager.client.onDidUpdateName(name => {
                    child.label = name;
                    child.refresh();
                });
                return child;
            });
        },
    });
    return node;
}

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
                        return !await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, '更新日志.md'))
                            && !await globalScript.isEnabled();
                    }
                }),
                new TreeNode('编辑器需要更新！', {
                    iconPath: new vscode.ThemeIcon('symbol-event'),
                    init: (node) => {
                        y3.version.onDidChange(async () => {
                            node.parent?.refresh();
                        });
                    },
                    update: async (node) => {
                        if (y3.env.editorUri === undefined) {
                            return;
                        }
                        let client = await y3.version.getClient();
                        let server = await y3.version.getServer();
                        node.description = `${client?.display} -> ${server?.display}`;
                        node.tooltip = `${client?.version} -> ${server?.version}`;
                        node.command = {
                            command: 'y3-helper.shell',
                            title: '启动编辑器',
                            arguments: [
                                'start',
                                y3.env.editorUri?.fsPath,
                            ]
                        };
                    },
                    show: async () => {
                        return y3.env.editorUri !== undefined
                            && await y3.version.needUpdate();
                    }
                }),
                new TreeNode('启动游戏', {
                    command: {
                        command: 'y3-helper.launchGame',
                        title: '启动游戏',
                    },
                    iconPath: new vscode.ThemeIcon('play'),
                    update: async (node) => {
                        node.description = `${env.project?.entryMap?.description}@${env.project?.entryMap?.name}`;
                    }
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
                多开模式(),
                启用Tracy(),
                切换自定义视图(),
            ]
        });

        TreeViewManager.onDidChange(() => {
            this.refresh();
        });
    }
};
