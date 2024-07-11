import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

export function runEditor(uri: vscode.Uri) {
    try {
        delete require.cache[uri.fsPath];
        require(uri.fsPath);
    } catch (error) {
        vscode.window.showErrorMessage(`运行物编脚本出错：${error}`);
    }
}

export function init() {
    vscode.commands.registerCommand('y3-helper.objectEditor', async () => {
        await y3.env.mapReady();
        if (!y3.env.scriptUri) {
            return;
        }
        const targetDir = y3.uri(y3.env.scriptUri, 'y3-helper/object');
        const templateDir = y3.extensionPath('template/object');
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
    });

    vscode.commands.registerCommand('y3-helper.runObjectEditor', async (uri?: vscode.Uri) => {
        if (!uri) {
            uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                return;
            }
        }
        runEditor(uri);
    });
}
