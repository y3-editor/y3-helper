import { Formatter } from './formatter';
import { Compiler, ECA } from './compiler';
import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

export interface Progress {
    message: (message: string) => void,
    total: (total: number) => void,
    update: (value?: number) => void,
    isCanceled: () => boolean,
}

interface CompileResult {
    fileName: string,
    includeName: string,
    eca: ECA,
}

export class Process {
    compiler = new Compiler();
    includeFiles: string[] = [];
    inTriggerDir = 'global_trigger/trigger' as const;
    inFunctionDir = 'global_trigger/function' as const;
    inObjectDirs = ['ability', 'destructible', 'item', 'modifier', 'projectile', 'unit'] as const;
    scriptDir = 'script' as const;
    outBasseDir = 'y3-trigger' as const;
    outTriggerDir = 'trigger' as const;
    outFunctionDir = 'function' as const;
    outObjectDir = 'object' as const;
    inGlobalVariableFileName = 'globaltriggervariable.json' as const;

    constructor(private mapDir: vscode.Uri, private formatter: Formatter, private progress?: Progress) { }

    public async fullCompile() {
        let total = 0;
        this.progress?.message('搜索触发器文件...');
        y3.log.info('【编译ECA】搜索触发器文件...');
        let triggerNames = await this.scanTriggers(y3.uri(this.mapDir, this.inTriggerDir));
        total += triggerNames.length;
        
        this.progress?.message('搜索函数文件...');
        y3.log.info('【编译ECA】搜索函数文件...');
        let functionNames = await this.scanTriggers(y3.uri(this.mapDir, this.inFunctionDir));
        total += functionNames.length;

        this.progress?.message('搜索物编触发器文件...');
        y3.log.info('【编译ECA】搜索物编触发器文件...');
        let objectNames: Record<string, string[]> = {};
        for (let dir of this.inObjectDirs) {
            y3.log.info(`【编译ECA】搜索物编触发器文件(${dir})...`);
            objectNames[dir] = await this.scanTriggers(y3.uri(this.mapDir, dir));
            total += objectNames[dir].length;
        }

        this.progress?.total(total * 3 + 1);

        await this.compileGlobalVariables();

        let compileResults: CompileResult[] = [];

        for (let i = 0; i < triggerNames.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`触发器: ${triggerNames[i]}`);
            y3.log.info(`【编译ECA】正在解析触发器文件(${i + 1}/${triggerNames.length}): ${triggerNames[i]}`);
            this.progress?.update();
            let compileResult = await this.compileOneTrigger(triggerNames[i]);
            if (compileResult) {
                compileResults.push(compileResult);
            }
        }

        for (let i = 0; i < functionNames.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`函数: ${functionNames[i]}`);
            y3.log.info(`【编译ECA】正在解析函数文件(${i + 1}/${functionNames.length}): ${functionNames[i]}`);
            this.progress?.update();
            let compileResult = await this.compileOneFunction(functionNames[i]);
            if (compileResult) {
                compileResults.push(compileResult);

                let main = compileResult.eca.main;
                if ('id' in main) {
                    this.formatter.setFuncName(main.id, main.name);
                }
            }
        }

        for (let dir of this.inObjectDirs) {
            for (let i = 0; i < objectNames[dir].length; i++) {
                if (this.progress?.isCanceled()) {
                    throw new vscode.CancellationError();
                }
                this.progress?.message(`物编触发器: ${objectNames[dir][i]}`);
                y3.log.info(`【编译ECA】正在解析物编触发器文件(${i + 1}/${objectNames[dir].length}): ${objectNames[dir][i]}`);
                this.progress?.update();
                let compileResult = await this.compileOneObject(dir, objectNames[dir][i]);
                if (compileResult) {
                    compileResults.push(compileResult);
                }
            }
        }

        for (let i = 0; i < compileResults.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            let result = compileResults[i];
            this.progress?.message(`生成: ${result.fileName}`);
            y3.log.info(`【编译ECA】正在生成代码(${i + 1}/${compileResults.length}): ${result.fileName}`);
            this.progress?.update();
            try {
                let content = result.eca.make(this.formatter);
                this.includeFiles.push(result.includeName);
                this.write(result.includeName, content);
            } catch(e) {
                this.progress?.message(`编译[${result.fileName}]失败：${e}`);
                y3.log.error(`【编译ECA】编译[${result.fileName}]失败：${e}`);
            }
        }

        await this.makeInitFile();
        await this.waitFinish();
    }

    private async scanTriggers(inDir: vscode.Uri) {
        y3.log.info(`【编译ECA】搜索目录为${inDir}`);
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
        return fileNames;
    }

    public async compileOneTrigger(fileName: string): Promise<CompileResult | undefined> {
        let uri = y3.uri(this.mapDir, this.inTriggerDir, fileName);
        try {
            let eca = await this.compiler.compileECA(uri);

            let includeName = [this.outBasseDir, this.outTriggerDir, fileName.replace(/\.json$/, '').replace(/\./g, '_') + '.lua'].join('/');
            return { fileName, includeName, eca };
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${uri.fsPath}]失败：${e}`);
        }
    }

    public async compileOneFunction(fileName: string) {
        let uri = y3.uri(this.mapDir, this.inFunctionDir, fileName);
        try {
            let eca = await this.compiler.compileECA(uri);

            let includeName = [this.outBasseDir, this.outFunctionDir, fileName.replace(/\.json$/, '').replace(/\./g, '_') + '.lua'].join('/');
            return { fileName, includeName, eca };
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${uri.fsPath}]失败：${e}`);
        }
    }

    public async compileOneObject(dir: string, fileName: string): Promise<CompileResult | undefined> {
        let uri = y3.uri(this.mapDir, dir, fileName);
        try {
            let eca = await this.compiler.compileECA(uri);

            let includeName = [this.outBasseDir, this.outObjectDir, fileName.replace(/\.json$/, '').replace(/\./g, '_') + '.lua'].join('/');
            return { fileName, includeName, eca };
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

    private writeCache = new Map<string, string>();
    private write(includeName: string, content: string) {
        this.writeCache.set(includeName, content);
    }

    public async makeInitFile() {
        this.progress?.message('生成索引文件...');
        y3.log.info('【编译ECA】正在生成索引文件...');
        const headPart = 'GameAPI.disable_all_eca_triggers()\nFunc = {}';
        const includesPart = this.includeFiles.map(fileName => {
            return `include ${y3.lua.encode(fileName.replace(/\.lua$/, '').replace(/[\\/]/g, '.'))}`;
        }).join('\n');
        let content = this.formatter.asFileContent([headPart, includesPart].join('\n\n'));
        this.write(this.outBasseDir + '/init.lua', content);
    }

    public async waitFinish() {
        this.progress?.message('等待文件写入硬盘...');
        y3.log.info('【编译ECA】等待文件写入硬盘...');

        const baseDir = y3.uri(this.mapDir, this.scriptDir, this.outBasseDir);
        let scanResult = await y3.fs.scan(baseDir);
        for (let file of scanResult) {
            let fullName = `${this,this.outBasseDir}/${file[0]}`;
            if (file[1] === vscode.FileType.File && !this.writeCache.has(fullName)) {
                y3.log.debug(`【编译ECA】删除多余的文件：${fullName}`);
                y3.fs.removeFile(y3.uri(this.mapDir, this.scriptDir, fullName));
            }
        }

        for (let [includeName, content] of this.writeCache) {
            const uri = y3.uri(this.mapDir, this.scriptDir, includeName);
            let file = await y3.fs.readFile(uri);
            if (file?.string === content) {
                y3.log.debug(`【编译ECA】跳过相同的文件：${includeName}`);
                this.progress?.update();
                continue;
            }
            y3.log.debug(`【编译ECA】写入文件：${includeName}`);
            await y3.fs.writeFile(uri, content);
            this.progress?.update();
        }
    }
}
