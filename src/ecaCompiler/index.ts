import { Formatter } from './formatter';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { fillStatic, fillMapDefined } from './fillConfig';
import { Process, Progress } from './process';
import { ExcelConfig } from './excelConfig';

const formatter = new Formatter();

class ProgressHandle implements Progress {
    msg = '';
    cur = 0;
    max = 0;
    lastPercent = 0;
    constructor(private token: vscode.CancellationToken, private report: (increment: number, message: string) => void) { }

    makeMessage() {
        const curStr = this.cur.toFixed().padStart(this.max.toString().length, '0');
        return `(${curStr}/${this.max})${this.msg}`;
    }

    message(message: string) {
        this.msg = message;
        this.report(0, this.makeMessage());
    }

    total(value: number = 1) {
        this.max += value;
        this.report(0, this.makeMessage());
    }

    async update(value = 1) {
        this.cur += value;
        if (this.max === 0) {
            return;
        }
        const percent = Math.floor(this.cur / this.max * 100);
        if (percent === this.lastPercent) {
            return;
        }
        const increment = percent - this.lastPercent;
        this.lastPercent = percent;
        this.report(increment, this.makeMessage());
        await new Promise(resolve => setImmediate(resolve));
    }

    isCanceled() {
        return this.token.isCancellationRequested;
    }
}

async function fillFromLocalExcel(formatter: Formatter) {
    let excelConfig = new ExcelConfig();
    let config = await excelConfig.loadConfig();
    if (!config) {
        return;
    }
    formatter.clearWeakRule();
    for (const key in config) {
        let value = config[key];
        formatter.setWeakRule(key, value);
    }
}

export function init() {
    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        await y3.env.mapReady();
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '编译中',
            cancellable: true,
        }, async (progress, token) => {
            if (!y3.env.currentTriggerMap || !y3.env.currentMap) {
                vscode.window.showErrorMessage('请先打开地图');
                return;
            }
            progress.report({ message: '加载地图配置...'});

            await fillStatic(formatter);
            await fillMapDefined(formatter);
            await fillFromLocalExcel(formatter);

            let process = new Process(y3.env.currentTriggerMap, y3.env.currentMap, formatter, new ProgressHandle(token, (increment, message) => {
                progress.report({ increment, message });
            }));

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
