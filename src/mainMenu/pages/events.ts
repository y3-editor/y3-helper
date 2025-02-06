import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { define } from "../../customDefine";
import { env } from "../../env";
import * as Events from "../../customDefine/event";
import * as l10n from '@vscode/l10n';


export class 自定义事件 extends TreeNode {
    constructor() {
        let mode = 'list';
        super(l10n.t('自定义事件'), {
            iconPath: new vscode.ThemeIcon('group-by-ref-type'),

            command: {
                command: 'y3-helper.changeEventMode',
                title: l10n.t('切换显示模式'),
            },

            show: async () => {
                await env.mapReady();
                return env.projectUri !== undefined;
            },

            update: async (node) => {
                node.description = mode === 'list'
                                ? l10n.t('平铺模式（点击切换）')
                                : l10n.t('文件夹模式（点击切换）');
                if (mode === 'list') {
                    node.childs = (await define().自定义事件.getEvents()).map(event => {
                        let args = event.args.map(arg => arg.name);
                        return new TreeNode(event.name, {
                            iconPath: new vscode.ThemeIcon('symbol-event'),
                            description: `${event.id.toString()}(${args.join(',')})`,
                            contextValue: l10n.t('自定义事件'),
                            data: event.id,
                            childs: args.length > 0 ? event.args.map(arg => new TreeNode(arg.name, {
                                description: `${arg.desc}(${arg.luaType})`,
                            })) : undefined,
                        });
                    });
                }
                if (mode === 'tree') {
                    function makeChilds(folder: Events.Folder) {
                        return Object.entries(folder.childs).map(([name, event]) => {
                            if ('childs' in event) {
                                return new TreeNode(name, {
                                    iconPath: new vscode.ThemeIcon('folder'),
                                    update: async (node) => {
                                        node.childs = makeChilds(event);
                                    }
                                });
                            } else {
                                let args = event.args.map(arg => arg.name);
                                return new TreeNode(name, {
                                    iconPath: new vscode.ThemeIcon('symbol-event'),
                                    description: `${event.id.toString()}(${args.join(',')})`,
                                    contextValue: l10n.t('自定义事件'),
                                    data: event.id,
                                    childs: args.length > 0 ? event.args.map(arg => new TreeNode(arg.name, {
                                        description: `${arg.desc}(${arg.luaType})`,
                                    })) : undefined,
                                });
                            }
                        });
                    }

                    node.childs = makeChilds(await define().自定义事件.getEventsFolder());
                }
            },
        });

        define().自定义事件.onDidChange(() => {
            this.refresh();
        });

        vscode.commands.registerCommand('y3-helper.changeEventMode', () => {
            if (mode === 'list') {
                mode = 'tree';
            } else {
                mode = 'list';
            }
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
