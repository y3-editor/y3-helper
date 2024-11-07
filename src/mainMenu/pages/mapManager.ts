import { TreeNode, ViewInVSCode } from "../treeNode";
import * as vscode from 'vscode';
import { env } from "../../env";
import * as y3 from 'y3-helper';

export async function isGlobalScriptEnabled() {
    if (!env.globalScriptUri) {
        return false;
    }
    let rcUri = vscode.Uri.joinPath(env.globalScriptUri, '.luarc.json');
    let y3Uri = vscode.Uri.joinPath(env.globalScriptUri, 'y3');
    return (await y3.fs.stat(rcUri))?.type === vscode.FileType.File
        && (await y3.fs.stat(y3Uri))?.type === vscode.FileType.Directory;
}

export async function enableGlobalScript() {
    if (!env.globalScriptUri) {
        y3.log.error("没有找到全局脚本目录");
        return false;
    }
    let entryMap = env.project?.entryMap;
    if (!entryMap) {
        y3.log.error("没有找到入口地图");
        return false;
    }
    let y3Uri = vscode.Uri.joinPath(entryMap.uri, 'script/y3');
    if (!await y3.fs.isExists(y3Uri)) {
        y3.log.error("请先初始化地图");
        return false;
    }
    // 把Y3库复制到全局脚本目录
    let globalY3Uri = vscode.Uri.joinPath(env.globalScriptUri, 'y3');
    if (!await y3.fs.isExists(globalY3Uri)) {
        await y3.fs.copy(y3Uri, globalY3Uri, {
            recursive: true,
        });
    }
    // 遍历所有地图，修改luarc文件
    for (const map of env.project!.maps) {
        let rcUri = vscode.Uri.joinPath(map.uri, '.luarc.json');
        await rcAddGlobalPath(rcUri);
    }
    // 生成全局的luarc文件
    let globalRcUri = vscode.Uri.joinPath(env.globalScriptUri, '.luarc.json');
    if (!await y3.fs.isExists(globalRcUri)) {
        await y3.fs.copy(vscode.Uri.joinPath(globalY3Uri, '演示/项目配置/.luarc.json'), globalRcUri);
    }
    // 修改全局里的luarc文件
    await rcRemoveGlobalPath(globalRcUri);
    // 遍历所有地图，删除他们的y3文件夹
    for (const map of env.project!.maps) {
        let y3Uri = vscode.Uri.joinPath(map.uri, 'script/y3');
        await y3.fs.removeFile(y3Uri, {
            recursive: true,
            useTrash: true,
        });
    }
    return true;
}

function mergeArray(a: any, b: any[]): any[] {
    if (!Array.isArray(a)) {
        return b;
    }
    let set = new Set(a);
    for (let value of b) {
        set.add(value);
    }
    return Array.from(set);
}

function subtractArray(a: any, b: any[]): any[] {
    if (!Array.isArray(a)) {
        return [];
    }
    let set = new Set(b);
    return a.filter(value => !set.has(value));
}

async function rcAddGlobalPath(rcUri: vscode.Uri) {
    let file = await y3.fs.readFile(rcUri);
    if (!file) {
        return;
    }
    let tree = new y3.json.Json(file.string);
    try {
        tree.set('runtime.path', mergeArray(tree.get('runtime.path'), [
            "../../../global_script/?.lua",
            "../../../global_script/?/init.lua"
        ]));
        tree.set('workspace.library', mergeArray(tree.get('workspace.library'), [
            "../../../global_script"
        ]));
        await y3.fs.writeFile(rcUri, tree.text);
    } catch (error) {
        y3.log.error(`修改${rcUri.fsPath}时发生错误: ${error}`);
        return;
    }
}

async function rcRemoveGlobalPath(rcUri: vscode.Uri) {
    let file = await y3.fs.readFile(rcUri);
    if (!file) {
        return;
    }
    let tree = new y3.json.Json(file.string);
    try {
        tree.set('runtime.path', subtractArray(tree.get('runtime.path'), [
            "../../../global_script/?.lua",
            "../../../global_script/?/init.lua"
        ]));
        tree.set('workspace.library', subtractArray(tree.get('workspace.library'), [
            "../../../global_script"
        ]));
        await y3.fs.writeFile(rcUri, tree.text);
    } catch (error) {
        y3.log.error(`修改${rcUri.fsPath}时发生错误: ${error}`);
        return;
    }
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
                if (env.scriptUri) {
                    let openScriptFolder = new ViewInVSCode(env.scriptUri, '打开脚本目录');
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
                        return !await isGlobalScriptEnabled();
                    }
                }));
                node.childs.push(new TreeNode('一并打开全局脚本', {

                }));
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
        let suc = await enableGlobalScript();
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
