import { Compiler } from './compiler';
import { Formatter } from './formatter';
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import { fillStatic, fillMapDefined } from './testConfig';

const formatter = new Formatter();

interface Progress {
    message: (message: string) => void,
    update: (percent: number) => void,
    isCanceled: () => boolean,
}

async function fullCompile(inDir: vscode.Uri, outDir: vscode.Uri, progress?: Progress) {
    progress?.message('正在加载地图配置...');

    await fillStatic(formatter);
    await fillMapDefined(formatter);

    progress?.message('正在搜索触发器文件...');

    let compiler = new Compiler();
    y3.log.info(`【编译ECA】开始，触发器目录为${inDir}`);
    let scanResult = await y3.fs.scan(inDir, undefined, () => {
        if (progress?.isCanceled()) {
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
    let luaFiles = [];
    for (let i = 0; i < fileNames.length; i++) {
        if (progress?.isCanceled()) {
            throw new vscode.CancellationError();
        }
        progress?.message(`正在编译触发器文件(${i + 1}/${fileNames.length})...`);
        y3.log.info(`【编译ECA】正在编译触发器文件(${i + 1}/${fileNames.length})...`);

        let inUri = y3.uri(inDir, fileNames[i]);
        let outUri = y3.uri(outDir, fileNames[i].replace(/\.json$/, '.lua'));
        try {
            let eca = await compiler.compile(inUri);
            let content = eca.make(formatter);
            luaFiles.push(fileNames[i]);
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
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译${inUri.fsPath}失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译${inUri.fsPath}失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译${inUri.fsPath}失败：${e}`);
        }
    }

    y3.log.info('【编译ECA】正在生成索引文件...');
    writeTasks.push(y3.fs.writeFile(y3.uri(outDir, 'init.lua'), luaFiles.map(uri => {
        return `include ${y3.lua.encode(uri.replace(/\.json$/, '').replace(/\\/g, '.'))}`;
    }).join('\r\n') + '\r\n'));

    y3.log.info('【编译ECA】等待文件全部写入完成');
    await Promise.all(writeTasks);
}

export function init() {
    vscode.commands.registerCommand('y3-helper.compileECA', async () => {
        await y3.env.mapReady();
        if (!y3.env.scriptUri) {
            vscode.window.showErrorMessage('请先打开地图');
            return;
        }
        let inDir = y3.uri(y3.env.mapUri!, 'global_trigger/trigger');
        let outDir = y3.uri(y3.env.scriptUri, 'y3-trigger');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '编译中...',
            cancellable: true,
        }, async (progress, token) => {
            let value = 0;
            await fullCompile(inDir, outDir, {
                message: (message) => progress.report({ message }),
                update: (percent) => {
                    let delta = percent - value;
                    value = percent;
                    progress.report({ increment: delta });
                },
                isCanceled: () => token.isCancellationRequested,
            });
        });
        vscode.window.showInformationMessage('编译完成');
        y3.log.info(`【编译ECA】完成`);
    });
}
