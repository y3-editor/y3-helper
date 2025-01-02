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
            let msg = '';
            let cur = 0;
            let total = 1;

            progress.report({ message: '加载地图配置...'});

            await fillStatic(formatter);
            await fillMapDefined(formatter);

            function makeMessage() {
                const curStr = cur.toString().padStart(total.toString().length, '0');
                return `(${curStr}/${total})${msg}`;
            }

            let process = new Process(y3.env.mapUri!, formatter, {
                message: (message) => {
                    msg = message;
                    progress.report({ message: makeMessage() });
                },
                total: (total_) => {
                    total = total_;
                },
                update: (value_ = 1) => {
                    cur += value_;
                    progress.report({ increment: value_ / total * 100, message: makeMessage() });
                },
                isCanceled: () => token.isCancellationRequested,
            });

            try {
                await process.fullCompile();

                vscode.window.showInformationMessage('编译完成');
                y3.log.info(`【编译ECA】完成`);
            } catch (e) {
                if (e instanceof vscode.CancellationError) {
                    vscode.window.showInformationMessage('编译已取消');
                } else {
                    vscode.window.showErrorMessage('编译失败');
                    y3.log.error(`【编译ECA】失败: ${e}`);
                }
            }
        });
    });
}
