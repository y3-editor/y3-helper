import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as plugin from './plugin';
import * as mainMenu from '../mainMenu';

let pluginManager: plugin.PluginManager | undefined;

class RunButtonProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
        let pluginInstance = await pluginManager?.findPlugin(document.uri);
        if (!pluginInstance) {
            return undefined;
        }
        let codeLens: vscode.CodeLens[] = [];
        let infos = await pluginInstance.getExports();
        for (const name in infos) {
            const info = infos[name];
            codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                title: `$(debug-start)运行 "${name}"`,
                command: 'y3-helper.runPlugin',
                arguments: [document.uri, name],
            }));
            if (name === 'onGame') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: `使用《Y3开发助手》启动游戏时自动运行`,
                    command: '',
                }));
            } else if (name === 'onEditor') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: `使用《Y3开发助手》的“在编辑器中打开”时自动运行`,
                    command: '',
                }));
            } else if (name === 'onSave') {
                codeLens.push(new vscode.CodeLens(new vscode.Range(info.line, 0, info.line, 0), {
                    title: `使用《Y3编辑器》保存地图后自动运行`,
                    command: '',
                }));
            }
        }
        return codeLens;
    }

    public notifyChange() {
        this._onDidChangeCodeLenses.fire();
    }
}

let runButtonProvider = new RunButtonProvider();

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
    const needOpen = y3.uri(y3.env.pluginUri, '1-使用代码修改物编.js');
    if (!await y3.fs.isFile(needOpen)) {
        return;
    }
    await vscode.commands.executeCommand('vscode.open', needOpen);
    mainMenu.refresh('插件');
}

async function updatePluginDTS(showme = false) {
    await y3.env.mapReady();
    if (!y3.env.pluginUri) {
        return;
    }
    const templateUri = y3.extensionPath('template/plugin', 'y3-helper.d.ts');
    const targetUri = y3.uri(y3.env.pluginUri, 'y3-helper.d.ts');
    let suc = await y3.fs.copy(templateUri, targetUri, {
        overwrite: true,
    });
    if (suc && showme) {
        vscode.window.showInformationMessage('插件定义文件更新成功');
        y3.open(targetUri);
        mainMenu.refresh('插件');
    }
}

function updatePluginManager() {
    pluginManager?.dispose();
    if (!y3.env.pluginUri) {
        return;
    }
    pluginManager = new plugin.PluginManager(y3.env.pluginUri);
    pluginManager.onDidChange(() => {
        runButtonProvider.notifyChange();
    });
}

let watcher: vscode.FileSystemWatcher | undefined;

function updateMapSaveWatcher() {
    watcher?.dispose();
    if (!y3.env.mapUri) {
        return;
    }
    watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(y3.env.mapUri, '*.gmp'));
    watcher.onDidCreate(onSave);
    watcher.onDidChange(onSave);

    let delay: NodeJS.Timeout | undefined;
    function onSave() {
        if (delay) {
            clearTimeout(delay);
        }
        delay = setTimeout(() => {
            delay = undefined;
            runAllPlugins('onSave');
        }, 1000);
    }
}

export async function runAllPlugins(funcName: string) {
    if (!pluginManager) {
        return;
    }
    let count = await pluginManager.runAll(funcName);
    if (count > 0) {
        // 等待物编文件写入完成
        await y3.sleep(200);
    }
}

function getRunningPlugin() {
    if (!pluginManager) {
        return undefined;
    }
    for (const name in pluginManager.plugins) {
        const plugin = pluginManager.plugins[name];
        if (plugin.running) {
            return plugin;
        }
    }
    return undefined;
}

export function onceDidRun(callback: (data: { funcName: string, result: any }) => void | Promise<void>) {
    const plugin = getRunningPlugin();
    plugin?.onceDidRun(callback);
}

export function getManager() {
    return pluginManager;
}

export async function init() {
    await y3.env.mapReady();

    updatePluginManager();
    updateMapSaveWatcher();
    updatePluginDTS();
    y3.env.onDidChange(() => {
        updatePluginManager();
        updateMapSaveWatcher();
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
        if (!pluginManager) {
            vscode.window.showErrorMessage(`未找到插件目录`);
            return;
        }
        y3.log.show();
        try {
            await pluginManager.run(uri, funcName ?? 'main');
        } catch (error: any) {
            vscode.window.showErrorMessage(`运行插件脚本出错：${error}`);
            if (error.stack) {
                y3.log.error(error.stack);
                y3.log.show();
            }
        }
    });

    vscode.languages.registerCodeLensProvider({
        scheme: 'file',
        pattern: `**/*.js`,
    }, runButtonProvider);
}
