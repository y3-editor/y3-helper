import { TreeNode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as globalScript from '../../globalScript';

const l10n = vscode.l10n;

export class 地图管理 extends TreeNode {
    constructor() {
        super(l10n.t('地图管理'), {
            iconPath: new vscode.ThemeIcon('repo-clone'),

            show: async () => {
                await y3.env.mapReady();
                return y3.env.scriptUri !== undefined;
            },

            update: async (node) => {
                await y3.env.mapReady();
                let entryMap = y3.env.project?.entryMap;
                let currentMap = y3.env.currentMap;
                node.childs = y3.env.project?.maps.map(map => {
                    return new TreeNode(`${map.description}`, {
                        iconPath: map === currentMap
                                ? new vscode.ThemeIcon('arrow-circle-right')
                                : new vscode.ThemeIcon('circle-outline'),
                        description: map === entryMap
                                ? `${map.name}${l10n.t('(主地图)')}`
                                : map.name,
                        tooltip: map === currentMap
                                ? l10n.t('id: {0}\n\n这是当前地图', String(map.id))
                                : l10n.t('id: {0}\n\n点击切换至此地图', String(map.id)),
                        command: {
                            command: "y3-helper.changeMap",
                            title: l10n.t("切换地图"),
                            arguments: [map.name],
                        }
                    });
                }) ?? [];
                node.childs.push(new TreeNode(l10n.t('------------------'), {
                    tooltip: l10n.t('我只是一个分割线'),
                }));
                if (y3.env.scriptUri) {
                    let openScriptFolder = new ViewInVSCode(y3.env.scriptUri, l10n.t('打开脚本目录'));
                    openScriptFolder.description = currentMap?.name;
                    openScriptFolder.tooltip = l10n.t('会重启VSCode窗口');
                    node.childs.push(openScriptFolder);
                }
                node.childs.push(new TreeNode(l10n.t('启用全局脚本'), {
                    iconPath: new vscode.ThemeIcon('remote-explorer'),
                    tooltip: l10n.t('所有地图都可以使用全局脚本。地图内的脚本优先级高于全局脚本。'),
                    command: {
                        command: 'y3-helper.enableGlobalScript',
                        title: l10n.t('启用全局脚本'),
                    },
                    show: async () => {
                        return !await globalScript.isEnabled();
                    }
                }));
                node.childs.push(new TreeNode(l10n.t('一并打开全局脚本'), {
                    tooltip: l10n.t("会以工作区的形式同时打开地图脚本与全局脚本"),
                    checkboxState: y3.helper.globalState.get('openGlobalScript', true)
                        ? vscode.TreeItemCheckboxState.Checked
                        : vscode.TreeItemCheckboxState.Unchecked,
                    onDidChangeCheckboxState: async (state) => {
                        await y3.helper.globalState.update('openGlobalScript', state === vscode.TreeItemCheckboxState.Checked);
                        await globalScript.openGlobalScript();
                    },
                }));
            },
        });

        y3.env.onDidChange(() => {
            this.refresh();
        });
    }
};

vscode.commands.registerCommand('y3-helper.changeMap', async (name: string) => {
    let map = y3.env.project?.maps.find(map => map.name === name);
    if (!map) {
        return;
    }
    y3.env.updateCurrentMap(map);
});

let lock = false;
vscode.commands.registerCommand('y3-helper.enableGlobalScript', async () => {
    if (lock) {
        return;
    }
    lock = true;
    let result = await vscode.window.showWarningMessage(l10n.t('这会移动y3文件夹到全局脚本目录并重启所有扩展，是否继续？'), l10n.t('继续'));
    if (result !== l10n.t('继续')) {
        lock = false;
        return;
    }
    await vscode.commands.executeCommand('git.close');
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: l10n.t("正在启用全局脚本"),
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: l10n.t("正在启用全局脚本") });
        let suc = await globalScript.enable();
        if (suc) {
            vscode.window.showInformationMessage(l10n.t("已启用全局脚本"));
            vscode.commands.executeCommand('workbench.action.restartExtensionHost');
        } else {
            vscode.window.showErrorMessage(l10n.t("启用全局脚本失败"));
            y3.log.show();
        }
    });
    lock = false;
});
