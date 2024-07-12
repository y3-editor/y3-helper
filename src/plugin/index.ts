import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as plugin from './plugin';

let scriptDir = 'y3-helper/plugin';

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
    if (!y3.env.scriptUri) {
        return;
    }
    const templateDir = y3.extensionPath('template/plugin');
    const targetDir = y3.uri(y3.env.scriptUri, scriptDir);
    await y3.fs.copy(templateDir, targetDir, {
        overwrite: true,
        recursive: true,
        nameMap: 'listfile.json',
    });
    const needOpen = y3.uri(targetDir, '1-使用代码修改物编.js');
    if (!await y3.fs.isFile(needOpen)) {
        return;
    }
    await vscode.commands.executeCommand('vscode.open', needOpen);
}

function updatePluginManager() {
    pluginManager?.dispose();
    if (!y3.env.scriptUri) {
        return;
    }
    pluginManager = new plugin.PluginManager(y3.uri(y3.env.scriptUri, scriptDir));
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
    watcher.onDidCreate(() => {
        runAllPlugins('onSave');
    });
    watcher.onDidChange(() => {
        runAllPlugins('onSave');
    });
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

export async function init() {
    await y3.env.mapReady();

    updatePluginManager();
    updateMapSaveWatcher();
    y3.env.onDidChange(() => {
        updatePluginManager();
        updateMapSaveWatcher();
    });

    vscode.commands.registerCommand('y3-helper.initPlugin', initPlugin);

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
        } catch (error) {
            vscode.window.showErrorMessage(`运行物编脚本出错：${error}`);
        }
    });

    vscode.languages.registerCodeLensProvider({
        scheme: 'file',
        pattern: `**/*.js`,
    }, runButtonProvider);
}
