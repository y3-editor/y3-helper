import { Compiler } from './compiler';
import { Formatter } from './formatter';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { fillStatic, fillMapDefined } from './testConfig';

export function init() {
    const formatter = new Formatter();
    fillStatic(formatter);

    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        await y3.env.mapReady();
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
                message: '正在加载地图配置...',
            });
            await fillMapDefined(formatter);
            progress.report({
                message: '正在搜索触发器文件...',
            });
            let compiler = new Compiler();
            let inTriggerDir = y3.uri(y3.env.mapUri!, 'global_trigger/trigger');
            y3.log.info(`【编译ECA】开始，触发器目录为${inTriggerDir}`);
            let scanResult = await y3.fs.scan(inTriggerDir, undefined, () => {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
            });
            y3.log.info(`【编译ECA】搜索到${scanResult.length}个文件和目录`);
            let fileNames = scanResult
                . filter((file) => file[1] === vscode.FileType.File && file[0].endsWith('.json'))
                . map((file) => file[0]);

            y3.log.info(`【编译ECA】搜索到${fileNames.length}个json文件`);
            if (fileNames.length === 0) {
                return;
            }
            let writeTasks = [];
            for (let i = 0; i < fileNames.length; i++) {
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
                progress.report({
                    message: `正在编译触发器文件(${i + 1}/${fileNames.length})...`,
                });
                y3.log.info(`【编译ECA】正在编译触发器文件(${i + 1}/${fileNames.length})...`);

                let inUri = y3.uri(inTriggerDir, fileNames[i]);
                let outUri = y3.uri(outTriggerDir, fileNames[i].replace('.json', '.lua'));
                try {
                    let eca = await compiler.compile(inUri);
                    let content = eca.make(formatter);
                    writeTasks.push(new Promise(async (resolve) => {
                        let file = await y3.fs.readFile(outUri);
                        if (file?.string === content) {
                            resolve(false);
                            return;
                        }
                        await y3.fs.writeFile(outUri, content);
                        resolve(true);
                    }));
                } catch (e) {
                    y3.log.error(`【编译ECA】编译${inUri.fsPath}失败：${e}`);
                }
            }
            y3.log.info('【编译ECA】等待文件全部写入完成');
            await Promise.all(writeTasks);
        });
        vscode.window.showInformationMessage('编译完成');
        y3.log.info(`【编译ECA】完成`);
    });
}
