import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as vm from 'vm';
import * as plugin from './plugin';

let scriptDir = 'y3-helper/plugin';

let pluginManager: plugin.PluginManager | undefined;

class RunButtonProvider implements vscode.CodeLensProvider {
    public async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[] | undefined> {
        let plugin = await pluginManager?.findPlugin(document.uri);
        if (!plugin) {
            return undefined;
        }
        let codeLens: vscode.CodeLens[] = [];
        let infos = await plugin.getExports();
        for (const name in infos) {
            const info = infos[name];
            const position = document.positionAt(info.offset);
            codeLens.push(new vscode.CodeLens(new vscode.Range(position, position), {
                title: `$(debug-start)运行 ${name} 函数`,
                command: 'y3-helper.runPlugin',
                arguments: [document.uri, name],
            }));
        }
        return codeLens;
    }
}

async function initPlugin() {
    await y3.env.mapReady();
    if (!y3.env.scriptUri) {
        return;
    }
    const targetDir = y3.uri(y3.env.scriptUri, scriptDir);
    const templateDir = y3.extensionPath('template/plugin');
    const listfile = await y3.fs.readFile(y3.uri(templateDir, 'listfile.json'));
    const nameMap: { [key: string]: string } = listfile ? JSON.parse(listfile.string) : {};
    for (const [name, fileType] of await y3.fs.dir(templateDir)) {
        if (fileType === vscode.FileType.Directory) {
            continue;
        }
        if (name === 'listfile.json') {
            continue;
        }
        const newName = nameMap[name] ?? name;
        let overwrite = name.endsWith('.d.ts');
        await y3.fs.copy(y3.uri(templateDir, name), y3.uri(targetDir, newName), { overwrite: overwrite });
    }
    if (listfile) {
        await vscode.commands.executeCommand('vscode.open', y3.uri(targetDir, nameMap['1.js']));
    }
}

function initPluginManager() {
    if (y3.env.scriptUri) {
        pluginManager = new plugin.PluginManager(y3.uri(y3.env.scriptUri, scriptDir));
    }
    y3.env.onDidChange(() => {
        pluginManager?.dispose();
        if (y3.env.scriptUri) {
            pluginManager = new plugin.PluginManager(y3.uri(y3.env.scriptUri, scriptDir));
        }
    });
}

export async function init() {
    await y3.env.mapReady();

    initPluginManager();

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
    }, new RunButtonProvider());
}
