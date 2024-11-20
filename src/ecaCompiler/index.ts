import * as compiler from './compiler';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';

async function fullCompileOne(inUri: vscode.Uri, outUri: vscode.Uri) {
    let c = new compiler.Compiler();
    let eca = await c.compile(inUri);
    let content = eca.make();
    await y3.fs.writeFile(outUri, content);
}

export function init() {
    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        if (!y3.env.scriptUri) {
            vscode.window.showErrorMessage('请先打开地图');
            return;
        }
        let outTriggerDir = y3.uri(y3.env.scriptUri, 'y3-trigger');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '编译中...',
            cancellable: true,
        }, async (progress, token) => {
            progress.report({
                message: '正在搜索触发器文件...',
            });
            let inTriggerDir = y3.uri(y3.env.mapUri!, 'global_trigger/trigger');
            let scanResult = await y3.fs.scan(inTriggerDir, undefined, () => {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
            });
            let fileNames = scanResult
                . filter((file) => file[1] === vscode.FileType.File && file[0].endsWith('.json'))
                . map((file) => file[0]);
                
            if (fileNames.length === 0) {
                return;
            }
            for (let i = 0; i < fileNames.length; i++) {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
                progress.report({
                    message: `正在编译触发器文件(${i}/${fileNames.length})...`,
                });
                await fullCompileOne(y3.uri(inTriggerDir, fileNames[i]), y3.uri(outTriggerDir, fileNames[i].replace('.json', '.lua')));
            }
        });
        vscode.window.showInformationMessage('编译完成');
    });
}
