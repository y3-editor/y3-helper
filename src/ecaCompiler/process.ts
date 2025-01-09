import { Formatter } from './formatter';
import { Compiler, ECA, ECAGroup } from './compiler';
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
    eca: ECA | ECAGroup,
}

interface SearchResult {
    fileName: string,
    uri: vscode.Uri,
    content: string,
    objectType?: y3.consts.Table.NameCN,
}

export class Process {
    compiler = new Compiler();
    includeFiles: string[] = [];
    inTriggerDir = 'global_trigger/trigger' as const;
    inFunctionDir = 'global_trigger/function' as const;
    scriptDir = 'script' as const;
    outBasseDir = 'y3-trigger' as const;
    outTriggerDir = 'trigger' as const;
    outFunctionDir = 'function' as const;
    outObjectDir = 'object' as const;
    inGlobalVariableFileName = 'globaltriggervariable.json' as const;

    constructor(private inMap: y3.Map, private outMap: y3.Map, private formatter: Formatter, private progress?: Progress) { }

    public async fullCompile() {
        let total = 0;
        this.progress?.message('搜索触发器文件...');
        y3.log.info('【编译ECA】搜索触发器文件...');
        let searchedTriggers = await this.scanTriggers(y3.uri(this.inMap.uri, this.inTriggerDir));
        total += searchedTriggers.length;
        
        this.progress?.message('搜索函数文件...');
        y3.log.info('【编译ECA】搜索函数文件...');
        let searchedFunctions = await this.scanTriggers(y3.uri(this.inMap.uri, this.inFunctionDir));
        total += searchedFunctions.length;

        this.progress?.message('搜索物编触发器文件...');
        y3.log.info('【编译ECA】搜索物编触发器文件...');
        let searchedObjects = await this.scanObjects(this.inMap.uri);
        total += searchedObjects.length;

        this.progress?.total(total * 3 + 1);

        await this.compileGlobalVariables();

        let compileResults: CompileResult[] = [];

        for (let i = 0; i < searchedTriggers.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`触发器: ${searchedTriggers[i].fileName}`);
            y3.log.info(`【编译ECA】正在解析触发器文件(${i + 1}/${searchedTriggers.length}): ${searchedTriggers[i].fileName}`);
            this.progress?.update();
            let compileResult = await this.compileOneTrigger(searchedTriggers[i]);
            if (compileResult) {
                compileResults.push(compileResult);
            }
        }

        for (let i = 0; i < searchedFunctions.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`函数: ${searchedFunctions[i].fileName}`);
            y3.log.info(`【编译ECA】正在解析函数文件(${i + 1}/${searchedFunctions.length}): ${searchedFunctions[i].fileName}`);
            this.progress?.update();
            let compileResult = await this.compileOneFunction(searchedFunctions[i]);
            if (compileResult) {
                compileResults.push(compileResult);

                let main = compileResult.eca.main;
                if ('id' in main) {
                    this.formatter.setFuncName(main.id, main.name);
                }
            }
        }

        for (let i = 0; i < searchedObjects.length; i++) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            this.progress?.message(`物编触发器: ${searchedObjects[i].fileName}`);
            y3.log.info(`【编译ECA】正在解析物编触发器文件(${i + 1}/${searchedObjects.length}): ${searchedObjects[i].fileName}`);
            this.progress?.update();
            let compileResult = await this.compileOneObject(searchedObjects[i]);
            if (compileResult) {
                compileResults.push(compileResult);
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

    private async scanTriggers(inDir: vscode.Uri): Promise<SearchResult[]> {
        y3.log.info(`【编译ECA】搜索目录为${inDir}`);
        let scanResult = await y3.fs.scan(inDir, undefined, () => {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
        });
        y3.log.info(`【编译ECA】搜索到${scanResult.length}个文件和目录`);

        let results: SearchResult[] = [];
        for (let fileInfo of scanResult) {
            if (this.progress?.isCanceled()) {
                throw new vscode.CancellationError();
            }
            if (fileInfo[1] !== vscode.FileType.File || !fileInfo[0].endsWith('.json')) {
                continue;
            }
            let uri = y3.uri(inDir, fileInfo[0]);
            let file = await y3.fs.readFile(uri);
            if (!file) {
                continue;
            }
            results.push({
                fileName: this.makeValidFileName(fileInfo[0]),
                content: file.string,
                uri,
            });
        }

        y3.log.info(`【编译ECA】读取${results.length}个json文件`);
        return results;
    }

    private validNameCache = new Map<string, string>();
    private validNameDualCache = new Map<string, string>();
    private makeValidFileName(name: string) {
        let trim = name.replace(/\.json$/, '');
        if (this.validNameCache.has(trim)) {
            return this.validNameCache.get(trim)!;
        }
        let validName = trim.replace(/[\.\\\/\:\*\?\"\<\>\|]/g, '_');
        if (this.validNameDualCache.has(validName)) {
            for (let i = 1; ; i++) {
                let newValidName = `${validName}_${i}`;
                if (!this.validNameDualCache.has(newValidName)) {
                    validName = newValidName;
                    break;
                }
            }
        }
        this.validNameCache.set(trim, validName);
        this.validNameDualCache.set(validName, trim);
        return validName;
    }

    private async scanObjects(inDir: vscode.Uri) {
        y3.log.info(`【编译ECA】搜索目录为${inDir}`);
        let results: SearchResult[] = [];
        for (const [nameEN, nameCN] of Object.entries(y3.consts.Table.name.toCN)) {
            const table = y3.table.openTable(nameCN);
            for (const key of await table.getList()) {
                let uri = y3.uri(inDir, nameEN, `${key}.json`);
                let file = await y3.fs.readFile(uri);
                if (!file) {
                    continue;
                }
                let object = await table.get(key);
                if (!object) {
                    continue;
                }
                results.push({
                    fileName: this.makeValidFileName(`${nameCN} - ${object.name}`),
                    content: file.string,
                    uri,
                    objectType: nameCN,
                });
            }
        }
        return results;
    }

    public async compileOneTrigger(searched: SearchResult): Promise<CompileResult | undefined> {
        try {
            let eca = this.compiler.compileECA(searched.content);

            let includeName = [this.outBasseDir, this.outTriggerDir, searched.fileName + '.lua'].join('/');
            return {
                fileName: searched.fileName,
                includeName,
                eca,
            };
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${searched.uri.fsPath}]失败：${e}`);
        }
    }

    public async compileOneFunction(searched: SearchResult) {
        try {
            let eca = this.compiler.compileECA(searched.content);

            let includeName = [this.outBasseDir, this.outFunctionDir, searched.fileName + '.lua'].join('/');
            return {
                fileName: searched.fileName,
                includeName,
                eca,
            };
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${searched.uri.fsPath}]失败：${e}`);
        }
    }

    public async compileOneObject(searched: SearchResult) {
        try {
            let eca = this.compiler.compileObject(searched.content, searched.objectType!);

            let includeName = [this.outBasseDir, this.outObjectDir, searched.fileName + '.lua'].join('/');
            return {
                fileName: searched.fileName,
                includeName,
                eca,
            };
        } catch (e) {
            if (e instanceof Error) {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}\n${e.stack}`);
            } else {
                y3.log.error(`【编译ECA】编译[${searched.uri.fsPath}]失败：${e}`);
            }
            vscode.window.showErrorMessage(`编译[${searched.uri.fsPath}]失败：${e}`);
        }
    }

    public async compileGlobalVariables() {
        this.progress?.message('编译全局变量...');
        const uri = y3.uri(this.inMap.uri, this.inGlobalVariableFileName);
        try {
            let globalVariables = this.compiler.compileGlobalVariables((await y3.fs.readFile(uri))!.string);
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
        this.writeCache.set(includeName, this.formatter.asFileContent(content));
    }

    public async makeInitFile() {
        this.progress?.message('生成索引文件...');
        y3.log.info('【编译ECA】正在生成索引文件...');
        const headPart = 'GameAPI.disable_all_eca_triggers()\nFunc = {}';
        const includesPart = this.includeFiles.map(fileName => {
            return `include ${y3.lua.encode(fileName.replace(/\.lua$/, '').replace(/[\\/]/g, '.'))}`;
        }).join('\n');
        let content = [headPart, includesPart].join('\n\n');
        this.write(this.outBasseDir + '/init.lua', content);
    }

    public async waitFinish() {
        this.progress?.message('等待文件写入硬盘...');
        y3.log.info('【编译ECA】等待文件写入硬盘...');

        const baseDir = y3.uri(this.outMap.uri, this.scriptDir, this.outBasseDir);
        let scanResult = await y3.fs.scan(baseDir);
        for (let file of scanResult) {
            let fullName = `${this,this.outBasseDir}/${file[0]}`;
            if (file[1] === vscode.FileType.File && !this.writeCache.has(fullName)) {
                y3.log.debug(`【编译ECA】删除多余的文件：${fullName}`);
                y3.fs.removeFile(y3.uri(this.outMap.uri, this.scriptDir, fullName));
            }
        }

        for (let [includeName, content] of this.writeCache) {
            const uri = y3.uri(this.outMap.uri, this.scriptDir, includeName);
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
