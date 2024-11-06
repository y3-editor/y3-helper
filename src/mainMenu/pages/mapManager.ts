import { TreeNode } from "../treeNode";
import * as vscode from 'vscode';
import { env } from "../../env";

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
                });
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
