import { TreeNode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';
import { env } from "../../env";

export async function isGlobalScriptEnabled() {
    if (!env.globalScriptUri) {
        return false;
    }
    let rcUri = vscode.Uri.joinPath(env.globalScriptUri, '.luarc.json');
}

export function enableGlobalScript() {
    
}

export class 地图管理 extends TreeNode {
    constructor() {
        super('地图管理', {
            iconPath: new vscode.ThemeIcon('repo-clone'),

            update: async (node) => {
                await env.mapReady();
                let entryMap = env.project?.entryMap;
                let currentMap = env.currentMap;
                node.childs = env.project?.maps.map(map => {
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
                // node.childs.push(new TreeNode('启用全局脚本', {
                //     command: {
                //         command: 'y3-helper.enableGlobalScript',
                //         title: '启用全局脚本',
                //     },
                // }));
                if (env.scriptUri) {
                    let openScriptFolder = new ViewInVSCode(env.scriptUri, '打开脚本目录');
                    openScriptFolder.description = currentMap?.name;
                    openScriptFolder.tooltip = '会重启VSCode窗口';
                    node.childs.push(openScriptFolder);
                }
            },
        });

        env.onDidChange(() => {
            this.refresh();
        });
    }
};

vscode.commands.registerCommand('y3-helper.changeMap', async (name: string) => {
    let map = env.project?.maps.find(map => map.name === name);
    if (!map) {
        return;
    }
    env.updateCurrentMap(map);
});
