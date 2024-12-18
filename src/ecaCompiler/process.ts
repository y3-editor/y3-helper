import { Formatter } from './formatter';
import { Compiler } from './compiler';
import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

export interface Progress {
    message: (message: string) => void,
    value: (percent: number) => void,
    isCanceled: () => boolean,
}

export class Process {
    compiler = new Compiler();
    writeTasks: Promise<any>[] = [];
    luaFiles: string[] = [];
    constructor(private inDir: vscode.Uri, private outDir: vscode.Uri, private formatter: Formatter, private progress?: Progress) { }

    public async fullCompile() {
        let fileNames = await this.scanTriggers(this.inDir);
        if (fileNames === undefined) {
            return;
        }

        for (let i = 0; i < fileNames.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`触发器(${i + 1}/${fileNames.length}): ${fileNames[i]}`);
            y3.log.info(`【编译ECA】正在编译触发器文件(${i + 1}/${fileNames.length}): ${fileNames[i]}`);
            this.progress?.value((i + 1) / fileNames.length * 100);
            await this.compileOneTrigger(fileNames[i]);
        }

        await this.waitFinish();
    }

    private async scanTriggers(inDir: vscode.Uri) {
        this.progress?.message('搜索触发器文件...');

        y3.log.info(`【编译ECA】开始，触发器目录为${inDir}`);
        let scanResult = await y3.fs.scan(inDir, undefined, () => {
            if (this.progress?.isCanceled()) {
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
        return fileNames;
    }

    public async compileOneTrigger(fileName: string) {
        let uri = y3.uri(this.inDir, fileName);
        try {
            let eca = await this.compiler.compile(uri);
            let content = eca.make(this.formatter);
            if (!content) {
                return;
            }

            let outUri = y3.uri(this.outDir, fileName.replace(/\.json$/, '.lua'));
            this.luaFiles.push(fileName);
            this.writeTasks.push(new Promise(async (resolve) => {
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
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${uri.fsPath}]失败：${e}`);
        }
    }

    public async waitFinish() {
        y3.log.info('【编译ECA】正在生成索引文件...');
        this.writeTasks.push(y3.fs.writeFile(y3.uri(this.outDir, 'init.lua'), this.luaFiles.map(uri => {
            return `include ${y3.lua.encode(uri.replace(/\.json$/, '').replace(/\\/g, '.'))}`;
        }).join('\r\n') + '\r\n'));
    
        y3.log.info('【编译ECA】等待文件全部写入完成');
        await Promise.all(this.writeTasks);
    }
}
