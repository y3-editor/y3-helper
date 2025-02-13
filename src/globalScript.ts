import * as y3 from 'y3-helper';
import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';


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
        y3.log.error(l10n.t('修改{0}时发生错误: {1}', rcUri.fsPath, String(error)));
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
        y3.log.error(l10n.t('修改{0}时发生错误: {1}', rcUri.fsPath, String(error)));
        return;
    }
}

export async function isEnabled() {
    if (!y3.env.globalScriptUri) {
        return false;
    }
    let rcUri = vscode.Uri.joinPath(y3.env.globalScriptUri, '.luarc.json');
    let y3Uri = vscode.Uri.joinPath(y3.env.globalScriptUri, l10n.t('y3'));
    return (await y3.fs.stat(rcUri))?.type === vscode.FileType.File
        && (await y3.fs.stat(y3Uri))?.type === vscode.FileType.Directory;
}

export async function enable() {
    if (!y3.env.globalScriptUri) {
        y3.log.error(l10n.t("没有找到全局脚本目录"));
        return false;
    }
    let entryMap = y3.env.project?.entryMap;
    if (!entryMap) {
        y3.log.error(l10n.t("没有找到入口地图"));
        return false;
    }
    let y3Uri = vscode.Uri.joinPath(entryMap.uri, `script/${l10n.t('y3')}`);
    if (!await y3.fs.isExists(y3Uri)) {
        y3.log.error(l10n.t("请先初始化地图"));
        return false;
    }
    // 把Y3库复制到全局脚本目录
    let globalY3Uri = vscode.Uri.joinPath(y3.env.globalScriptUri, l10n.t('y3'));
    if (!await y3.fs.isExists(globalY3Uri)) {
        await y3.fs.copy(y3Uri, globalY3Uri, {
            recursive: true,
        });
    }
    // 遍历所有地图，修改luarc文件
    for (const map of y3.env.project!.maps) {
        let rcUri = vscode.Uri.joinPath(map.uri, 'script/.luarc.json');
        if (!await y3.fs.isExists(rcUri)) {
            await y3.fs.copy(vscode.Uri.joinPath(globalY3Uri, '演示/项目配置/.luarc.json'), rcUri);
        }
        await rcAddGlobalPath(rcUri);
    }
    // 生成全局的luarc文件
    let globalRcUri = vscode.Uri.joinPath(y3.env.globalScriptUri, '.luarc.json');
    if (!await y3.fs.isExists(globalRcUri)) {
        await y3.fs.copy(vscode.Uri.joinPath(globalY3Uri, '演示/项目配置/.luarc.json'), globalRcUri);
    }
    // 修改全局里的luarc文件
    await rcRemoveGlobalPath(globalRcUri);
    // 遍历所有地图，删除他们的y3文件夹
    for (const map of y3.env.project!.maps) {
        let y3Uri = vscode.Uri.joinPath(map.uri, `script/${l10n.t('y3')}`);
        await y3.fs.removeFile(y3Uri, {
            recursive: true,
            useTrash: true,
        });
    }
    return true;
}

async function updateRC() {
    if (!await isEnabled()) {
        return;
    }
    if (!y3.env.scriptUri || !y3.env.globalScriptUri) {
        return;
    }
    let rcUri = vscode.Uri.joinPath(y3.env.scriptUri, '.luarc.json');
    if (!await y3.fs.isExists(rcUri)) {
        await y3.fs.copy(vscode.Uri.joinPath(y3.env.globalScriptUri, l10n.t('y3'), '演示/项目配置/.luarc.json'), rcUri);
    }
    await rcAddGlobalPath(rcUri);
}

function syncY3() {
    setInterval(async () => {
        if (!y3.env.globalScriptUri || !y3.env.scriptUri) {
            return;
        }
        let globalY3 = await y3.fs.readFile(y3.uri(y3.env.globalScriptUri, l10n.t('y3'), 'init.lua'));
        if (!globalY3) {
            return;
        }
        let myY3 = await y3.fs.readFile(y3.uri(y3.env.scriptUri, l10n.t('y3'), 'init.lua'));

        if (!myY3 || globalY3.string !== myY3.string) {
            await y3.fs.writeFile(y3.uri(y3.env.scriptUri, l10n.t('y3'), 'init.lua'), globalY3.string);
        }
    }, 1000);
}

export async function openGlobalScript() {
    if (!y3.env.globalScriptUri) {
        return;
    }
    if (!y3.env.scriptUri) {
        return;
    }
    if (!await isEnabled()) {
        return;
    }
    if (!y3.helper.globalState.get('openGlobalScript', true)) {
        return;
    }
    if (vscode.workspace.workspaceFolders?.length !== 1) {
        return;
    }
    if (vscode.workspace.workspaceFolders[0].toString() === y3.env.globalScriptUri?.toString()) {
        return;
    }
    vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders.length, {
        uri: y3.env.scriptUri,
        name: l10n.t('地图脚本({0})', String(y3.env.currentMap?.name)),
    }, {
        uri: y3.env.globalScriptUri,
        name: l10n.t('全局脚本'),
    });
}

export function init() {
    syncY3();
    y3.env.onDidChange(() => {
        openGlobalScript();
        updateRC();
    });
}
