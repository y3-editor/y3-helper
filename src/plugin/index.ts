import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as plugin from './plugin';
import * as mainMenu from '../mainMenu';
import * as l10n from '@vscode/l10n';
import { RunButtonProvider } from './codeLen';

export async function hasInited() {
    await y3.env.mapReady();
    if (!y3.env.pluginUri) {
        return false;
    }
    if (!await y3.fs.isDirectory(y3.env.pluginUri)) {
        return false;
    }
    return true;
}

async function initPlugin() {
    await y3.env.mapReady();
    if (!y3.env.pluginUri) {
        return;
    }
    const templateDir = y3.extensionPath('template/plugin');
    await y3.fs.copy(templateDir, y3.env.pluginUri, {
        overwrite: true,
        recursive: true,
        nameMap: 'listfile.json',
    });
    const needOpen = y3.uri(y3.env.pluginUri, l10n.t('1-使用代码修改物编.js'));
    if (!await y3.fs.isFile(needOpen)) {
        return;
    }
    await vscode.commands.executeCommand('vscode.open', needOpen);
    mainMenu.refresh(l10n.t('插件'));
}

async function updatePluginDTS(showme = false) {
    await y3.env.mapReady();
    if (!y3.env.project) {
        return;
    }
    if (!showme && !await hasInited()) {
        return;
    }
    const templateUri = y3.extensionPath('template/plugin', 'y3-helper.d.ts');
    if (!await y3.fs.isFile(templateUri)) {
        return;
    }
    for (const map of y3.env.project.maps) {
        const targetUri = y3.uri(map.pluginManager.uri, 'y3-helper.d.ts');
        let suc = await y3.fs.copy(templateUri, targetUri, {
            overwrite: true,
        });
        if (suc && showme && map === y3.env.currentMap) {
            vscode.window.showInformationMessage(l10n.t('插件定义文件更新成功'));
            y3.open(targetUri);
            mainMenu.refresh(l10n.t('插件'));
        }
    }
}

export async function runAllPlugins(map: y3.Map, funcName: string) {
    let count = await map.pluginManager.runAll(funcName);
    if (count > 0) {
        // 等待物编文件写入完成
        await y3.sleep(200);
    }
}

function getRunningPlugin() {
    for (const map of y3.env.project?.maps ?? []) {
        for (const name in map.pluginManager.plugins) {
            const plugin = map.pluginManager.plugins[name];
            if (plugin.running) {
                return plugin;
            }
        }
    }
    return undefined;
}

export function onceDidRun(callback: (data: { funcName: string, result: any }) => void | Promise<void>) {
    const plugin = getRunningPlugin();
    plugin?.onceDidRun(callback);
}

export async function findPlugin(uri: vscode.Uri): Promise<plugin.Plugin | undefined> {
    if (!y3.env.project) {
        return undefined;
    }
    for (const map of y3.env.project.maps) {
        const plugin = await map.pluginManager.findPlugin(uri);
        if (plugin) {
            return plugin;
        }
    }
}

export async function init() {
    await y3.env.mapReady();

    updatePluginDTS();
    y3.env.onDidChange(() => {
        updatePluginDTS();
    });

    vscode.commands.registerCommand('y3-helper.initPlugin', initPlugin);
    vscode.commands.registerCommand('y3-helper.updatePlugin', () => updatePluginDTS(true));

    vscode.commands.registerCommand('y3-helper.runPlugin', async (uri?: vscode.Uri, funcName?: string) => {
        if (!uri) {
            uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                return;
            }
        }
        y3.log.show();
        try {
            for (const map of y3.env.project?.maps ?? []) {
                let plugin = await map.pluginManager.findPlugin(uri);
                if (plugin) {
                    await map.pluginManager.run(uri, funcName ?? 'main');
                    return;
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(l10n.t('运行插件脚本出错：{0}', error));
            if (error.stack) {
                y3.log.error(error.stack);
                y3.log.show();
            }
        }
    });

    let runButtonProvider = new RunButtonProvider();

    vscode.languages.registerCodeLensProvider({
        scheme: 'file',
        pattern: `**/*.js`,
    }, runButtonProvider);
    plugin.onDidChange.event(() => {
        runButtonProvider.notifyChange();
    });
}
