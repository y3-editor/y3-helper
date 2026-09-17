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
            "../../../global_script",
            "../../../global_script/y3-helper"
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
            "../../../global_script",
            "../../../global_script/y3-helper"
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

/**
 * 把 isEnabled() 的读盘结果刷到 env.globalScriptEnabled。
 * 热路径（路径推导、meta 生成）不应该反复 stat 磁盘。
 */
export async function refreshEnabled() {
    let enabled = await isEnabled();
    if (enabled === y3.env.globalScriptEnabled) {
        return;
    }
    y3.env.globalScriptEnabled = enabled;
    if (enabled) {
        y3.log.info(l10n.t("已启用全局脚本"));
    }
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
    // 把Y3库复制到全局脚本目录（全局已有仓库时直接复用，可能是“初始化Y3库”直接装到了全局）
    let globalY3Uri = vscode.Uri.joinPath(y3.env.globalScriptUri, l10n.t('y3'));
    let y3Uri = vscode.Uri.joinPath(entryMap.uri, `script/${l10n.t('y3')}`);
    if (!await y3.fs.isExists(globalY3Uri)) {
        if (!await y3.fs.isExists(y3Uri)) {
            y3.log.error(l10n.t("请先初始化地图"));
            return false;
        }
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
    y3.env.globalScriptEnabled = true;
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

export async function init() {
    // 先确定状态，后面的产物（meta/插件等）依赖它决定落点
    await refreshEnabled();
    y3.env.onDidChange(() => {
        void refreshEnabled();
        updateRC();
    });
}
