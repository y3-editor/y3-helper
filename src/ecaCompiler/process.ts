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
    tasks: Promise<any>[] = [];
    includeFiles: string[] = [];
    inTriggerDir = 'global_trigger/trigger' as const;
    scriptDir = 'script' as const;
    outBasseDir = 'y3-trigger' as const;
    outTriggerDir = 'trigger' as const;
    inGlobalVariableFileName = 'globaltriggervariable.json' as const;

    constructor(private mapDir: vscode.Uri, private formatter: Formatter, private progress?: Progress) { }

    public async fullCompile() {
        await this.compileGlobalVariables();

        let fileNames = await this.scanTriggers();
        if (fileNames) {
            for (let i = 0; i < fileNames.length; i++) {
                if (this.progress?.isCanceled()) {
                    throw new vscode.CancellationError();
                }
                this.progress?.message(`触发器(${i + 1}/${fileNames.length}): ${fileNames[i]}`);
                y3.log.info(`【编译ECA】正在编译触发器文件(${i + 1}/${fileNames.length}): ${fileNames[i]}`);
                this.progress?.value((i + 1) / fileNames.length * 100);
                await this.compileOneTrigger(fileNames[i]);
            }
        }

        await this.makeInitFile();
        await this.waitFinish();
    }

    private async scanTriggers() {
        this.progress?.message('搜索触发器文件...');
        const inDir = y3.uri(this.mapDir, this.inTriggerDir);

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
        let uri = y3.uri(this.mapDir, this.inTriggerDir, fileName);
        try {
            let eca = await this.compiler.compileECA(uri);
            let content = eca.make(this.formatter);
            if (!content) {
                return;
            }

            let includeName = [this.outBasseDir, this.outTriggerDir, fileName.replace(/\.json$/, '').replace(/\./g, '_') + '.lua'].join('/');
            this.includeFiles.push(includeName);
            this.write(includeName, content);
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${uri.fsPath}]失败：${e}`);
        }
    }

    public async compileGlobalVariables() {
        this.progress?.message('编译全局变量...');
        const uri = y3.uri(this.mapDir, this.inGlobalVariableFileName);
        try {
            let globalVariables = await this.compiler.compileGlobalVariables(uri);
            let content = globalVariables.make(this.formatter);
            if (!content) {
                return;
            }

            const includeName = [this.outBasseDir, '全局变量.lua'].join('/');
            this.includeFiles.push(includeName);
            this.write(includeName, content);
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${uri.fsPath}]失败：${e}`);
        }
    }

    private write(includeName: string, content: string) {
        this.tasks.push(new Promise(async (resolve) => {
            const uri = y3.uri(this.mapDir, this.scriptDir, includeName);
            let file = await y3.fs.readFile(uri);
            if (file?.string === content) {
                resolve(false);
                return;
            }
            await y3.fs.writeFile(uri, content);
            resolve(true);
        }));
    }

    public async makeInitFile() {
        y3.log.info('【编译ECA】正在生成索引文件...');
        const content = this.includeFiles.map(fileName => {
            return `include ${y3.lua.encode(fileName.replace(/\.lua$/, '').replace(/[\\/]/g, '.'))}`;
        }).join('\r\n') + '\r\n';
        this.write(this.outBasseDir + '/init.lua', content);
    }

    public async waitFinish() {
    
        y3.log.info('【编译ECA】等待文件全部写入完成');
        await Promise.all(this.tasks);
    }
}
