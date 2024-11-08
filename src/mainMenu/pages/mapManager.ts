import { TreeNode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as globalScript from '../../globalScript';

export class 地图管理 extends TreeNode {
    constructor() {
        super('地图管理', {
            iconPath: new vscode.ThemeIcon('repo-clone'),

            update: async (node) => {
                await y3.env.mapReady();
                let entryMap = y3.env.project?.entryMap;
                let currentMap = y3.env.currentMap;
                node.childs = y3.env.project?.maps.map(map => {
                    return new TreeNode(map.name, {
                        iconPath: map === entryMap ? new vscode.ThemeIcon('star-full') : new vscode.ThemeIcon('star-empty'),
                        description: map === currentMap ? '当前地图' : undefined,
                        tooltip: `id: ${String(map.id)}\n\n点击切换至此地图`,
                        command: {
                            command: "y3-helper.changeMap",
                            title: "切换地图",
                            arguments: [map.name],
                        }
                    });
                }) ?? [];
                node.childs.push(new TreeNode('------------------', {
                    tooltip: '我只是一个分割线',
                }));
                if (y3.env.scriptUri) {
                    let openScriptFolder = new ViewInVSCode(y3.env.scriptUri, '打开脚本目录');
                    openScriptFolder.description = currentMap?.name;
                    openScriptFolder.tooltip = '会重启VSCode窗口';
                    node.childs.push(openScriptFolder);
                }
                node.childs.push(new TreeNode('启用全局脚本', {
                    iconPath: new vscode.ThemeIcon('remote-explorer'),
                    tooltip: '所有地图都可以使用全局脚本。地图内的脚本优先级高于全局脚本。',
                    command: {
                        command: 'y3-helper.enableGlobalScript',
                        title: '启用全局脚本',
                    },
                    show: async () => {
                        return !await globalScript.isEnabled();
                    }
                }));
                node.childs.push(new TreeNode('一并打开全局脚本', {
                    tooltip: "会以工作区的形式同时打开地图脚本与全局脚本",
                    checkboxState: y3.helper.globalState.get('openGlobalScript', true)
                        ? vscode.TreeItemCheckboxState.Checked
                        : vscode.TreeItemCheckboxState.Unchecked,
                    onDidChangeCheckboxState: async (state) => {
                        y3.helper.globalState.update('openGlobalScript', state === vscode.TreeItemCheckboxState.Checked);
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
    let result = await vscode.window.showWarningMessage('这会移动y3文件夹到全局脚本目录并重启所有扩展，是否继续？', '继续');
    if (result !== '继续') {
        lock = false;
        return;
    }
    await vscode.commands.executeCommand('git.close');
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "正在启用全局脚本",
        cancellable: false,
    }, async (progress) => {
        progress.report({ message: "正在启用全局脚本" });
        let suc = await globalScript.enable();
        if (suc) {
            vscode.window.showInformationMessage("已启用全局脚本");
            vscode.commands.executeCommand('workbench.action.restartExtensionHost');
        } else {
            vscode.window.showErrorMessage("启用全局脚本失败");
            y3.log.show();
        }
    });
    lock = false;
});
