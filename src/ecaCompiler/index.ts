import { Formatter } from './formatter';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { fillStatic, fillMapDefined } from './testConfig';
import { Process } from './process';

const formatter = new Formatter();

export function init() {
    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        await y3.env.mapReady();
        if (!y3.env.scriptUri) {
            vscode.window.showErrorMessage('请先打开地图');
            return;
        }
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '编译中',
            cancellable: true,
        }, async (progress, token) => {
            let value = 0;
            let msg = '';

            progress.report({ message: '加载地图配置...'});

            await fillStatic(formatter);
            await fillMapDefined(formatter);

            let process = new Process(y3.env.mapUri!, formatter, {
                message: (message) => {
                    msg = message;
                    progress.report({ message });
                },
                value: (percent) => {
                    let delta = percent - value;
                    value = percent;
                    progress.report({ increment: delta, message: msg });
                },
                isCanceled: () => token.isCancellationRequested,
            });

            await process.fullCompile();
        });
        vscode.window.showInformationMessage('编译完成');
        y3.log.info(`【编译ECA】完成`);
    });
}
