import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as l10n from '@vscode/l10n';


export class 插件管理 extends TreeNode {
    constructor() {
        super(l10n.t('插件'), {
            iconPath: new vscode.ThemeIcon('extensions'),
            show: async () => {
                await y3.env.mapReady();
                return y3.env.scriptUri !== undefined;
            },
            update: async (node) => {
                node.childs = [
                    new TreeNode(l10n.t('初始化'), {
                        iconPath: new vscode.ThemeIcon('cloud-download'),
                        command: {
                            command: 'y3-helper.initPlugin',
                            title: l10n.t('初始化插件'),
                        },
                    }),
                    new TreeNode(l10n.t('更新定义文件'), {
                        iconPath: new vscode.ThemeIcon('sync'),
                        show: async () => {
                            if (!y3.env.pluginUri) {
                                return false;
                            }
                            return await y3.fs.isFile(y3.env.pluginUri, 'y3-helper.d.ts');
                        },
                        command: {
                            command: 'y3-helper.updatePlugin',
                            title: l10n.t('更新插件定义文件'),
                        },
                    }),
                ];
            },
        });
    }
}

export class 插件列表 extends TreeNode {
    constructor() {
        let event: vscode.Disposable | undefined;
        super(l10n.t('插件'), {
            iconPath: new vscode.ThemeIcon('extensions'),
            show: async () => {
                let pluginManager = y3.plugin.getManager();
                if (!pluginManager) {
                    return false;
                }
                let plugins = await pluginManager.getAll();
                return plugins.length > 0;
            },
            update: async (node) => {
                let pluginManager = y3.plugin.getManager();
                if (!pluginManager) {
                    return;
                }

                event?.dispose();
                event = pluginManager.onDidChange(() => {
                    node.refresh();
                    node.parent?.refresh();
                });

                let plugins = await pluginManager.getAll();
                if (plugins.length === 0) {
                    return;
                }

                node.childs = [];
                let autos = [];

                for (const plugin of plugins) {
                    let exports = await plugin.getExports();
                    for (const exp of Object.values(exports)) {
                        let child = new TreeNode(`${exp.name}`, {
                            iconPath: new vscode.ThemeIcon('run'),
                            description: `${plugin.name}`,
                            command: {
                                command: 'y3-helper.runPlugin',
                                title: exp.name,
                                arguments: [plugin.uri, exp.name],
                            },
                            contextValue: l10n.t('插件列表'),
                            data: {
                                uri: plugin.uri,
                                line: exp.line,
                            }
                        });
                        if (exp.name === 'onGame' || exp.name === 'onSave' || exp.name === 'onEditor') {
                            autos.push(child);
                        } else {
                            node.childs.push(child);
                        }
                    }
                }

                if (autos.length > 0) {
                    node.childs.push(new TreeNode(l10n.t('------- 以下会自动运行 -------')));
                    node.childs.push(...autos);
                }
            },
        });
    }
}

vscode.commands.registerCommand('y3-helper.openPlugin', async (node: TreeNode) => {
    y3.open(node.data.uri, node.data.line);
});
