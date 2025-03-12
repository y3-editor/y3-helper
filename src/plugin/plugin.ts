import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as vm from 'vm';
import * as path from 'path';
import { queue, throttle } from '../utility/decorators';

declare const __non_webpack_require__: NodeRequire | undefined;
const rawRequire = __non_webpack_require__ ?? require;
import * as l10n from '@vscode/l10n';
import { on } from 'events';


interface ExportInfo {
    name: string;
    async: boolean;
    line: number;
}

export class Plugin {
    private rawCode?: string | null;
    private fixedCode?: string;
    private script?: vm.Script;
    private parseError?: string;
    private exports: Record<string, ExportInfo> = {};
    constructor(public uri: vscode.Uri, public name: string) {
        this.parse();
    }

    public setCode(code: string) {
        this.rawCode = code;
        this.fixedCode = undefined;
        this.script = undefined;
        this.parseError = undefined;
        this.exports = {};
        let lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.startsWith('export ')) {
                lines[i] = line.replace(/export\s+(async\s+)?function\s+([\w_\u10000-\uFFFFFFFF]+)/, (_, async, name) => {
                    this.exports[name] = {
                        name,
                        async: async !== undefined,
                        line: i,
                    };
                    return `${async ?? ''}function ${name}`;
                });
            }
        }

        lines.push('module.exports = { ' + Object.keys(this.exports).join(', ') + ' };');
        this.fixedCode = lines.join('\n');
    }

    public async reload() {
        this.rawCode = undefined;
        this.fixedCode = undefined;
        this.script = undefined;
        this.parseError = undefined;
        this.exports = {};
        await this.parse();
    }

    @queue()
    private async parse() {
        if (this.rawCode !== undefined) {
            return;
        }
        let code = (await y3.fs.readFile(this.uri))?.string ?? null;
        if (!code) {
            this.parseError = l10n.t('读取文件失败');
            return;
        }
        this.setCode(code);
    }

    public async getExports() {
        await this.parse();
        return this.exports;
    }

    public running = false;

    public async run(funcName: string, sandbox: vm.Context) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t('正在执行 “{0}/{1}”', this.name, funcName),
        }, async () => {
            try {
                this.running = true;
                await this.parse();
                
                if (this.parseError) {
                    throw new Error(this.parseError);
                }
                if (!this.script) {
                    if (!this.fixedCode) {
                        this.parseError = l10n.t('代码解析失败');
                        throw new Error(this.parseError);
                    }
                    try {
                        this.script = new vm.Script(this.fixedCode, {
                            filename: this.uri.path,
                        });
                    } catch (error) {
                        this.parseError = String(error);
                        throw new Error(this.parseError);
                    }
                }
                let exports = this.script!.runInNewContext(sandbox);
                if (typeof exports[funcName] !== 'function') {
                    throw new Error(l10n.t('没有找到要执行的函数{0}', funcName));
                }
                let result = exports[funcName]();
                await this.fireDidRun(funcName, result);
                return result;
            } finally {
                this.running = false;
            }
        });
    }

    private _onceDidRun: ((data: { funcName: string, result: any }) => void | Promise<void>)[] = [];
    private async fireDidRun(funcName: string, result: any) {
        for (const callback of this._onceDidRun) {
            await callback({ funcName, result });
        }
        this._onceDidRun.length = 0;
    }

    public onceDidRun(callback: (data: { funcName: string, result: any }) => void | Promise<void>) {
        this._onceDidRun.push(callback);
    }
}

export let onDidChange = new vscode.EventEmitter<void>();

export class PluginManager extends vscode.Disposable {
    private _ready = false;
    private _disposables: vscode.Disposable[] = [];
    private _onDidChange = new vscode.EventEmitter<void>();
    public uri: vscode.Uri;

    constructor(public map: y3.Map) {
        super(() => {
            for (const disposable of this._disposables) {
                disposable.dispose();
            }
        });
        this.uri = y3.uri(this.map.helperUri, 'plugin');
        this.loadPlugins();
        this.createPluginFileWatcher();
        this.createMapSaveWatcher();
        this._disposables.push(vscode.workspace.onDidChangeTextDocument(async (e) => {
            let plugin = await this.findPlugin(e.document.uri);
            if (!plugin) {
                return;
            }
            plugin.setCode(e.document.getText());
            this.notifyChange();
            onDidChange.fire();
        }));
    }

    private createPluginFileWatcher() {
        let watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.uri, '**/*.js')
        );
        this._disposables.push(watcher);
        watcher.onDidCreate((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name] = new Plugin(e, name);
            this.notifyChange();
            onDidChange.fire();
        });
        watcher.onDidDelete((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            delete this.plugins[name];
            this.notifyChange();
            onDidChange.fire();
        });
        watcher.onDidChange((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name]?.reload();
            this.notifyChange();
            onDidChange.fire();
        });
    }

    private createMapSaveWatcher() {
        let watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.map.uri, '*.gmp'));
        this._disposables.push(watcher);
    
        let delay: NodeJS.Timeout | undefined;
        let onSave = () => {
            if (delay) {
                clearTimeout(delay);
            }
            delay = setTimeout(async () => {
                delay = undefined;
                await this.runAll('onSave');
            }, 1000);
        };

        watcher.onDidCreate(onSave);
        watcher.onDidChange(onSave);
    }

    @throttle(100)
    private notifyChange() {
        this._onDidChange.fire();
    }

    public onDidChange = this._onDidChange.event;

    public plugins: Record<string, Plugin> = {};
    private async loadPlugins() {
        this._ready = false;
        for (const [filename, fileType] of await y3.fs.scan(this.uri)) {
            if (fileType === vscode.FileType.File && filename.endsWith('.js')) {
                let name = filename.replace(/\.js$/, '');
                const plugin = new Plugin(y3.uri(this.uri, filename), name);
                this.plugins[name] = plugin;
            }
        }
        this._ready = true;
    }

    private async ready() {
        while (!this._ready) {
            await y3.sleep(100);
        }
    }

    private static requireCache: Record<string, any> = {
        'y3-helper': y3,
        'os': require('os'),
        'path': require('path'),
        'fs': require('fs'),
        'util': require('util'),
        'child_process': require('child_process'),
        'vscode': vscode,
    };

    private makeSandbox() {
        function getCallerFilePath() {
            const originalPrepareStackTrace = Error.prepareStackTrace;
            try {
                const err = new Error();
                Error.prepareStackTrace = (err, stack) => stack;
                const stack = err.stack as unknown as NodeJS.CallSite[];
                Error.prepareStackTrace = originalPrepareStackTrace;
        
                if (stack && stack.length > 2) {
                    const caller = stack[2];
                    let fileName = caller.getFileName();
                    if (!fileName) {
                        return null;
                    }
                    fileName = fileName.replace(/^\/(?=[a-zA-Z]:)/, '');
                    return fileName;
                }
            } catch (e) {
                // Handle error if needed
            } finally {
                Error.prepareStackTrace = originalPrepareStackTrace;
            }
            return null;
        }

        const sandBox = {
            require: (name: string) => {
                if (name.startsWith('./') || name.startsWith('../')) {
                    let filePath = getCallerFilePath();
                    let fileDir = path.dirname(filePath!);
                    const resolvedPath = rawRequire.resolve(name, { paths: [fileDir] });
                    return rawRequire(resolvedPath);
                }
                return PluginManager.requireCache[name] ?? rawRequire(name);
            },
            module: { exports: {} },
        };
        return vm.createContext(new Proxy(sandBox as any, {
            get(target, prop) {
                return target[prop] ?? (global as any)[prop];
            }
        }));
    }

    public getName(uri: vscode.Uri) {
        if (!uri.path.toLocaleLowerCase().startsWith(this.uri.path.toLocaleLowerCase())) {
            return undefined;
        }
        return uri.path.slice(this.uri.path.length + 1).replace(/\.js$/, '');
    }

    public async findPlugin(uri: vscode.Uri) {
        const name = this.getName(uri);
        if (!name) {
            return;
        }
        await this.ready();
        return this.plugins[name];
    }

    public async run(uri: vscode.Uri, funcName: string) {
        let plugin = await this.findPlugin(uri);
        if (!plugin) {
            throw new Error(l10n.t('没有找到插件'));
        }
        y3.log.info(l10n.t('开始运行插件 "{0}/{1}"', plugin.name, funcName));
        await plugin.run(funcName, this.makeSandbox());
        y3.log.info(l10n.t('运行插件 "{0}/{1}" 成功', plugin.name, funcName));
    }

    public async getAll() {
        await this.ready();
        return Object.values(this.plugins).sort((a, b) => a.name.localeCompare(b.name));
    }

    public async runAll(funcName: string): Promise<number> {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t('正在执行所有插件的"{0}"函数', funcName),
        }, async () => {
            y3.log.info(l10n.t('开始运行所有插件的"{0}"函数', funcName));
            let plugins = await this.getAll();
            let errors = [];
            let count = 0;
            for (const plugin of plugins) {
                const infos = await plugin.getExports();
                if (!infos[funcName]) {
                    continue;
                }
                try {
                    await plugin.run(funcName, this.makeSandbox());
                    count++;
                } catch (error) {
                    let errorMessage = String(error).replace(/Error: /, '');
                    errors.push(l10n.t('"{0}/{1}":{2}', plugin.name, funcName, errorMessage));
                }
            }
            if (errors.length > 0) {
                throw new Error(errors.join('\n'));
            }
            y3.log.info(l10n.t('所有插件的"{0}"函数运行完成', funcName));
            return count;
        });
    }
}
