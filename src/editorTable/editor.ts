import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as vm from 'vm';

let scriptDir = 'y3-helper/object';

function makeSandbox() {
    return {
        require: (name: string) => {
            if (name === 'y3-helper') {
                return y3;
            }
        },
        module: {},
        exports: {},
        console: console,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,
    };
}

export async function runEditor(uri: vscode.Uri, funcName: string = 'main') {
    const file = await y3.fs.readFile(uri);
    let content = file!.string;
    content = content + `\n\nmodule.exports = ${funcName}`;
    let script = new vm.Script(content, {
        filename: uri.path,
    });
    let func = script.runInNewContext(vm.createContext(makeSandbox()));
    if (typeof func !== 'function') {
        throw new Error('没有找到要执行的函数');
    }
    await func();
    y3.log.info(`执行 "${uri.path.split('/').pop()}" 成功！`);
}

class RunButtonProvider implements vscode.CodeLensProvider {
    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | undefined {
        let codeLens: vscode.CodeLens[] = [];
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const name = line.text.match(/^async\s+function\s+([\w_]+)/)?.[1];
            if (name) {
                codeLens.push(new vscode.CodeLens(new vscode.Range(i, 0, i, 0), {
                    title: `$(debug-start)运行 ${name} 函数`,
                    command: 'y3-helper.runObjectEditor',
                    arguments: [document.uri, name],
                }));
            }
        }
        return codeLens;
    }
}

export function init() {
    vscode.commands.registerCommand('y3-helper.objectEditor', async () => {
        await y3.env.mapReady();
        if (!y3.env.scriptUri) {
            return;
        }
        const targetDir = y3.uri(y3.env.scriptUri, scriptDir);
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

    vscode.commands.registerCommand('y3-helper.runObjectEditor', async (uri?: vscode.Uri, funcName?: string) => {
        if (!uri) {
            uri = vscode.window.activeTextEditor?.document.uri;
            if (!uri) {
                return;
            }
        }
        y3.log.show();
        try {
            await runEditor(uri, funcName);
        } catch (error) {
            vscode.window.showErrorMessage(`运行物编脚本出错：${error}`);
        }
    });

    vscode.languages.registerCodeLensProvider({
        scheme: 'file',
        pattern: `**/*.js`,
    }, new RunButtonProvider());
}
