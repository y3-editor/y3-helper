import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as vm from 'vm';
import { queue } from '../utility/decorators';

interface ExportInfo {
    name: string;
    async: string;
    offset: number;
}

class Plugin {
    private rawCode?: string | null;
    private fixedCode?: string;
    private script?: vm.Script;
    private parseError?: string;
    private exports: Record<string, ExportInfo> = {};
    constructor(public uri: vscode.Uri, public name: string) {
        this.parse();
    }

    @queue()
    private async parse() {
        if (this.rawCode !== undefined) {
            return;
        }
        this.rawCode = (await y3.fs.readFile(this.uri))?.string ?? null;
        if (!this.rawCode) {
            this.parseError = '读取文件失败';
            return;
        }

        const pattern = /export\s+(async\s+)function\s+([\w_]+)/g;
        this.fixedCode = this.rawCode.replaceAll(pattern, (_, async, name) => {
            return `${async}function ${name}`;
        });

        let match;
        while (match = pattern.exec(this.rawCode)) {
            const [_, async, name] = match;
            this.exports[name] = {
                name,
                async,
                offset: match.index,
            };
        }

        this.fixedCode += '\nmodule.exports = { ' + Object.keys(this.exports).join(', ') + ' };\n';

        try {
            this.script = new vm.Script(this.fixedCode, {
                filename: this.uri.path,
            });
        } catch (error) {
            this.parseError = String(error);
        }
    }

    public async getExports() {
        await this.parse();
        return this.exports;
    }

    public async run(funcName: string, sandbox: vm.Context) {
        await this.parse();
        if (this.parseError) {
            throw new Error(this.parseError);
        }
        let exports = this.script!.runInNewContext(sandbox);
        if (typeof exports[funcName] !== 'function') {
            throw new Error(`没有找到要执行的函数${funcName}`);
        }
        await exports[funcName]();
    }
}

export class PluginManager extends vscode.Disposable {
    private _ready = false;
    private _watcher: vscode.FileSystemWatcher;

    constructor(public dir: vscode.Uri) {
        super(() => {
            this._watcher.dispose();
        });
        this.loadPlugins();
        this._watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(dir, '**/*.js')
        );
        this._watcher.onDidCreate((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name] = new Plugin(e, name);
        });
        this._watcher.onDidDelete((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            delete this.plugins[name];
        });
        this._watcher.onDidChange((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name] = new Plugin(e, name);
        });
    }

    public plugins: Record<string, Plugin> = {};
    private async loadPlugins() {
        this._ready = false;
        for (const [filename, fileType] of await y3.fs.scan(this.dir)) {
            if (fileType === vscode.FileType.File && filename.endsWith('.js')) {
                let name = filename.replace(/\.js$/, '');
                const plugin = new Plugin(y3.uri(this.dir, filename), name);
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

    private makeSandbox() {
        const sandBox = {
            require: (name: string) => {
                if (name === 'y3-helper') {
                    return y3;
                }
            },
            module: {},
            exports: {},
        };
        return vm.createContext(new Proxy(sandBox as any, {
            get(target, prop) {
                return target[prop] ?? (global as any)[prop];
            }
        }));
    }

    public getName(uri: vscode.Uri) {
        if (!uri.path.startsWith(this.dir.path)) {
            return undefined;
        }
        return uri.path.slice(this.dir.path.length + 1).replace(/\.js$/, '');
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
            throw new Error('没有找到插件');
        }
        await plugin.run(funcName, this.makeSandbox());
    }
}
