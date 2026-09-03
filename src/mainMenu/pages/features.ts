import { env } from "../../env";
import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { config } from "../../config";
import { TreeViewManager } from "../../console/treeView";
import { WebviewTerminal } from "../../console/webviewTerminal";
import * as globalScript from '../../globalScript';
import * as l10n from '@vscode/l10n';
import { getDefaultLocalArchiveNickname } from '../../multiPlayerArchives';

function 多开模式() {
    let loadedArchives = env.project?.multiPlayerArchives;

    const setPlayerNickname = (roleId: number, nickname: string) => {
        const oldNickname = config.multiPlayerNicknames[roleId];
        const swappedRole = Object.entries(config.multiPlayerNicknames)
            .find(([id, selected]) => Number(id) !== roleId && selected === nickname)?.[0];
        config.multiPlayerNicknames[roleId] = nickname;
        if (swappedRole !== undefined) {
            const swappedRoleId = Number(swappedRole);
            if (oldNickname) {
                config.multiPlayerNicknames[swappedRoleId] = oldNickname;
            } else {
                delete config.multiPlayerNicknames[swappedRoleId];
            }
        }
    };

    const getDefaultNickname = () => {
        return getDefaultLocalArchiveNickname(
            config.multiPlayers,
            config.multiPlayerNicknames,
            env.editorNickname,
        );
    };

    const selectPlayerNickname = async (roleId: number): Promise<boolean> => {
        const archives = env.project?.multiPlayerArchives;
        if (!archives || env.project?.multiPlayerArchivesError) {
            vscode.window.showErrorMessage(l10n.t('无法读取本地存档配置，请检查 archive/archive_storage.json。'));
            return false;
        }
        const current = config.multiPlayerNicknames[roleId];
        const nicknameOptions = [...new Set([
            ...Object.keys(archives),
            ...Object.values(config.multiPlayerNicknames),
        ])];
        const selected = await vscode.window.showQuickPick([
            ...nicknameOptions.map((nickname) => ({
                label: nickname,
                picked: nickname === current,
                nickname,
            })),
            {
                label: `$(add) ${l10n.t('新建本地玩家昵称...')}`,
                picked: false,
                nickname: undefined,
                alwaysShow: true,
            },
        ], {
            title: l10n.t('选择玩家{0}的本地存档', roleId),
            placeHolder: l10n.t('选择昵称后，游戏将读取该昵称对应的本地存档'),
        });
        if (!selected) {
            return false;
        }

        let nickname = selected.nickname;
        if (!nickname) {
            nickname = await vscode.window.showInputBox({
                title: l10n.t('新建本地玩家昵称'),
                value: getDefaultNickname(),
                validateInput(value) {
                    const trimmed = value.trim();
                    if (!trimmed) {
                        return l10n.t('玩家昵称不能为空');
                    }
                    if (nicknameOptions.includes(trimmed)) {
                        return l10n.t('该昵称已存在，请从列表中选择');
                    }
                    return undefined;
                },
            });
        }
        nickname = nickname?.trim();
        if (!nickname) {
            return false;
        }
        setPlayerNickname(roleId, nickname);
        return true;
    };

    const makePlayerNode = (id: number, roleName?: string) => {
        const defaultName = l10n.t('玩家{0}', id);
        const name = roleName ?? defaultName;
        const playerNode = new TreeNode(name, {
            description: name === defaultName ? undefined : defaultName,
            checkboxState: config.multiPlayers.includes(id)
                ? vscode.TreeItemCheckboxState.Checked
                : vscode.TreeItemCheckboxState.Unchecked,
            contextValue: 'multiPlayerRole',
            command: {
                title: l10n.t('选择本地玩家昵称'),
                command: 'y3-helper.multi.selectNickname',
                arguments: [id],
            },
            onDidChangeCheckboxState(state) {
                if (state === vscode.TreeItemCheckboxState.Checked) {
                    if (!config.multiPlayerNicknames[id]) {
                        setPlayerNickname(id, getDefaultNickname());
                    }
                    if (!config.multiPlayers.includes(id)) {
                        config.multiPlayers.push(id);
                    }
                } else {
                    const index = config.multiPlayers.indexOf(id);
                    if (index !== -1) {
                        config.multiPlayers.splice(index, 1);
                    }
                    const debugIndex = config.debugPlayers.indexOf(id);
                    if (debugIndex !== -1) {
                        config.debugPlayers.splice(debugIndex, 1);
                    }
                    delete config.multiPlayerNicknames[id];
                }
                playerNode.refresh();
            },
            update: async (node) => {
                const nickname = config.multiPlayers.includes(id)
                    ? config.multiPlayerNicknames[id]
                    : undefined;
                const description = nickname ?? (name === defaultName ? undefined : defaultName);
                node.description = config.debugPlayers.includes(id) && description
                    ? `${description} · ${l10n.t('启用调试器')}`
                    : config.debugPlayers.includes(id)
                        ? l10n.t('启用调试器')
                        : description;
                node.tooltip = nickname
                    ? l10n.t('玩家{0}使用本地存档：{1}', id, nickname)
                    : undefined;
            },
            data: { roleId: id },
        });
        return playerNode;
    };

    let node = new TreeNode(l10n.t('多开模式'), {
        tooltip: l10n.t('请手动启动编辑器登录（并选择30天免登录）再使用此功能'),
        checkboxState: config.multiMode ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked,
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
        onDidChangeCheckboxState(state) {
            config.multiMode = state === vscode.TreeItemCheckboxState.Checked;
            node.tree?.refresh.fire(undefined);
        },
        childs: [],
        update: async (node) => {
            await env.mapReady();
            const roles = env.project?.multiPlayerRoles ?? [];
            const validIds = new Set(roles.map((role) => role.id));
            config.multiPlayers = config.multiPlayers.filter((id) => validIds.has(id));
            config.debugPlayers = config.debugPlayers.filter((id) => validIds.has(id) && config.multiPlayers.includes(id));
            config.multiPlayerNicknames = Object.fromEntries(
                Object.entries(config.multiPlayerNicknames).filter(([id]) => validIds.has(Number(id))),
            );

            if (loadedArchives !== env.project?.multiPlayerArchives) {
                loadedArchives = env.project?.multiPlayerArchives;
                config.multiPlayerNicknames = Object.fromEntries(
                    (env.project?.getMultiPlayerArchiveAssignments() ?? [])
                        .filter((assignment) => validIds.has(assignment.roleId))
                        .map((assignment) => [assignment.roleId, assignment.nickname]),
                );
            }

            if (env.project?.multiPlayerRolesError) {
                node.childs = [new TreeNode(l10n.t('无法读取阵营角色配置'), {
                    iconPath: new vscode.ThemeIcon('warning'),
                })];
                return;
            }
            const playerNodes = roles.map((role) => {
                const roleName = role.name
                    ? env.project?.entryMap?.language.get(role.name)
                    : undefined;
                return makePlayerNode(role.id, roleName);
            });
            node.childs = env.project?.multiPlayerArchivesError
                ? [new TreeNode(l10n.t('无法读取本地存档配置'), {
                    iconPath: new vscode.ThemeIcon('warning'),
                }), ...playerNodes]
                : playerNodes;
        },
    });
    vscode.commands.registerCommand('y3-helper.multi.selectNickname', async (id: number) => {
        if (!config.multiPlayers.includes(id) || !await selectPlayerNickname(id)) {
            return;
        }
        node.childs?.find((child) => child.data?.roleId === id)?.refresh();
    });
    vscode.commands.registerCommand('y3-helper.debug.toggle', async (value: number | TreeNode) => {
        const id = typeof value === 'number' ? value : value.data?.roleId;
        if (typeof id !== 'number') {
            return;
        }
        if (!config.multiPlayers.includes(id)) {
            return;
        }
        const index = config.debugPlayers.indexOf(id);
        if (index === -1) {
            config.debugPlayers.push(id);
        } else {
            config.debugPlayers.splice(index, 1);
        }
        node.childs?.find((child) => child.data?.roleId === id)?.refresh();
    });
    return node;
}

function 启用Tracy() {
    let node = new TreeNode(l10n.t('启用Tracy'), {
        tooltip: l10n.t('对Lua进行性能分析，但是会大幅影响运行效率'),
        checkboxState: config.tracy ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked,
        onDidChangeCheckboxState(state) {
            config.tracy = state === vscode.TreeItemCheckboxState.Checked;
        },
    });
    return node;
}

function 切换自定义视图() {
    let node = new TreeNode(l10n.t('切换自定义视图'), {
        iconPath: new vscode.ThemeIcon('window'),
        show: () => {
            return TreeViewManager.allManagers.size >= 2;
        },
        update: async (node) => {
            node.childs = Array.from(TreeViewManager.allManagers.values(), manager => {
                let child = new TreeNode(manager.client.name, {
                    command: {
                        command: 'y3-helper.custom.show',
                        title: l10n.t('切换自定义视图'),
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
        super(l10n.t('功能'), {
            iconPath: new vscode.ThemeIcon('beaker'),
            show: async () => {
                await env.mapReady();
                return env.scriptUri !== undefined;
            },
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            childs: [
                new TreeNode(l10n.t('初始化Y3库'), {
                    command: {
                        command: 'y3-helper.initProject',
                        title: l10n.t('初始化Y3库'),
                    },
                    update: async (node) => {
                        node.iconPath = new vscode.ThemeIcon('cloud-download');
                        if (await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, '更新日志.md')) ||
                            await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, 'CHANGELOG.md'))) {
                            node.iconPath = new vscode.ThemeIcon('check');
                        }
                    },
                    show: async () => {
                        return !await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, '更新日志.md'))
                            && !await y3.fs.isExists(vscode.Uri.joinPath(env.y3Uri!, 'CHANGELOG.md'))
                            && !await globalScript.isEnabled();
                    }
                }),
                new TreeNode(l10n.t('编辑器需要更新！'), {
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
                            title: l10n.t('启动编辑器'),
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
                new TreeNode(l10n.t('启动游戏'), {
                    iconPath: new vscode.ThemeIcon('play'),
                    tooltip: 'Shift + F5',
                    command: {
                        command: 'y3-helper.launchGame',
                        title: l10n.t('启动游戏'),
                    },
                    update: async (node) => {
                        let map = env.project?.selectedMap;
                        let name = map?.name;
                        let description = map?.description;
                        if (name === description) {
                            node.description = `${name}`;
                        } else {
                            node.description = `${description}@${name}`;
                        }

                        function makeChilds(): TreeNode[] {
                            if (!env.project) {
                                return [];
                            }
                            let options: ['option' | 'map', string, y3.Map][] = [];
                            if (env.project.entryMap) {
                                options.push(['option', 'entry', env.project.entryMap]);
                            }
                            if (env.currentMap) {
                                options.push(['option', 'current', env.currentMap]);
                            }
                            for (const map of env.project.maps) {
                                options.push(['map', map.name, map]);
                            }
                
                            let target: (typeof options[0]) | undefined;
                            for (const option of options) {
                                if (config.launchMap[0] === option[0] && config.launchMap[1] === option[1]) {
                                    target = option;
                                    break;
                                }
                            }
                
                            return options.map((option) => {
                                const [type, name, map] = option;
                                if (type === 'map') {
                                    return new TreeNode(map.name, {
                                        tooltip: map.description,
                                        iconPath: option === target
                                                ? new vscode.ThemeIcon('arrow-circle-right')
                                                : new vscode.ThemeIcon('circle-outline'),
                                        command: {
                                            command: 'y3-helper.selectLaunchingMap',
                                            title: l10n.t('选择启动地图'),
                                            arguments: [type, name],
                                        },
                                    });
                                } else {
                                    let nodeName = name === 'entry'
                                                ? l10n.t('主地图')
                                                : l10n.t('当前地图');
                                    return new TreeNode(nodeName, {
                                        description: map.name,
                                        tooltip: map.description,
                                        iconPath: option === target
                                                ? new vscode.ThemeIcon('arrow-circle-right')
                                                : new vscode.ThemeIcon('circle-outline'),
                                        command: {
                                            command: 'y3-helper.selectLaunchingMap',
                                            title: l10n.t('选择启动地图'),
                                            arguments: [type, name],
                                        },
                                    });
                                }
                            });
                        }
                
                        node.childs = makeChilds();
                    },
                    init: (node) => {
                        env.onDidChange(async () => {
                            node.refresh();
                        });
                        vscode.commands.registerCommand('y3-helper.selectLaunchingMap', async (type: 'option' | 'map', name: string) => {
                            config.launchMap = [type, name];
                            node.refresh();
                        });
                    },
                }),
                new TreeNode(l10n.t('附加调试器'), {
                    command: {
                        command: 'y3-helper.attach',
                        title: l10n.t('附加调试器'),
                    },
                    iconPath: new vscode.ThemeIcon('run-all'),
                    childs: [
                        new TreeNode(l10n.t('启动游戏后立即附加'), {
                            checkboxState: config.attachWhenLaunch
                                        ? vscode.TreeItemCheckboxState.Checked
                                        : vscode.TreeItemCheckboxState.Unchecked,
                            onDidChangeCheckboxState(state) {
                                config.attachWhenLaunch = state === vscode.TreeItemCheckboxState.Checked;
                            },
                        }),
                        new TreeNode(l10n.t('启动后附加本地云脚本'), {
                            checkboxState: config.attachCloudScriptWhenLaunch && !config.multiMode
                                ? vscode.TreeItemCheckboxState.Checked
                                : vscode.TreeItemCheckboxState.Unchecked,
                            tooltip: config.multiMode
                                ? l10n.t('本地多开连接正式远程云脚本服，不能附加本地云脚本调试器。')
                                : l10n.t('自动附加本次启动创建的本地云脚本进程。'),
                            update(node) {
                                node.checkboxState = config.attachCloudScriptWhenLaunch && !config.multiMode
                                    ? vscode.TreeItemCheckboxState.Checked
                                    : vscode.TreeItemCheckboxState.Unchecked;
                                node.tooltip = config.multiMode
                                    ? l10n.t('本地多开连接正式远程云脚本服，不能附加本地云脚本调试器。')
                                    : l10n.t('自动附加本次启动创建的本地云脚本进程。');
                            },
                            onDidChangeCheckboxState(state, node) {
                                if (config.multiMode && state === vscode.TreeItemCheckboxState.Checked) {
                                    vscode.window.showInformationMessage(l10n.t(
                                        '本地多开连接正式远程云脚本服，不能附加本地云脚本调试器。',
                                    ));
                                    node.refresh();
                                    return;
                                }
                                config.attachCloudScriptWhenLaunch = state === vscode.TreeItemCheckboxState.Checked;
                            },
                        }),
                    ],
                }),
                new TreeNode(l10n.t('在编辑器中打开'), {
                    command: {
                        command: 'y3-helper.launchEditor',
                        title: l10n.t('在编辑器中打开'),
                    },
                    iconPath: new vscode.ThemeIcon('mortar-board'),
                }),
                new TreeNode(l10n.t('查看物编数据'), {
                    command: {
                        command: 'y3-helper.editorTableView.focus',
                        title: l10n.t('查看物编数据'),
                    },
                    iconPath: new vscode.ThemeIcon('symbol-function'),
                }),
                new TreeNode(l10n.t('查看日志'), {
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
                            title: l10n.t('查看日志'),
                            arguments: [vscode.Uri.joinPath(env.scriptUri!, '.log/lua_player01.log')]
                        };
                    },
                }),
                new TreeNode(l10n.t('重新打开控制台'), {
                    iconPath: new vscode.ThemeIcon('terminal'),
                    command: {
                        command: 'y3-helper.reopenConsole',
                        title: l10n.t('重新打开控制台'),
                    },
                    show: () => WebviewTerminal.hasDisposedPanel(),
                }),
                多开模式(),
                启用Tracy(),
                切换自定义视图(),
                new TreeNode('MCP Server', {
                    iconPath: new vscode.ThemeIcon('plug'),
                    tooltip: l10n.t('MCP Server 用于 Claude Code 连接'),
                    childs: [
                        new TreeNode(l10n.t('启动 MCP Server'), {
                            iconPath: new vscode.ThemeIcon('play'),
                            command: {
                                command: 'y3-helper.startMCPServer',
                                title: l10n.t('启动 MCP Server'),
                            },
                            tooltip: l10n.t('启动 MCP Server，允许 Claude Code 连接'),
                        }),
                        new TreeNode(l10n.t('停止 MCP Server'), {
                            iconPath: new vscode.ThemeIcon('debug-stop'),
                            command: {
                                command: 'y3-helper.stopMCPServer',
                                title: l10n.t('停止 MCP Server'),
                            },
                            tooltip: l10n.t('停止 MCP Server'),
                        }),
                    ],
                }),
            ]
        });

        TreeViewManager.onDidChange(() => {
            this.refresh();
        });
        WebviewTerminal.onDidChangePanelState.event(() => {
            this.refresh();
        });
    }
};
