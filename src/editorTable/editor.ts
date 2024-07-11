import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

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
            await y3.fs.copy(y3.uri(templateDir, name), y3.uri(targetDir, newName), { overwrite: true });
        }
        if (listfile) {
            await vscode.commands.executeCommand('vscode.open', y3.uri(targetDir, nameMap['1.js']));
        }
    });
}
