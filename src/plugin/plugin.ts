import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as vm from 'vm';
import { queue, throttle } from '../utility/decorators';

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
                lines[i] = line.replace(/export\s+(async\s+)function\s+([\w_]+)/, (_, async, name) => {
                    this.exports[name] = {
                        name,
                        async: async !== '',
                        line: i,
                    };
                    return `${async}function ${name}`;
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
            this.parseError = '读取文件失败';
            return;
        }
        this.setCode(code);
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
        if (!this.script) {
            if (!this.fixedCode) {
                this.parseError = '代码解析失败';
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
            throw new Error(`没有找到要执行的函数${funcName}`);
        }
        await exports[funcName]();
    }
}

export class PluginManager extends vscode.Disposable {
    private _ready = false;
    private _disposables: vscode.Disposable[] = [];
    private _onDidChange = new vscode.EventEmitter<void>();

    constructor(public dir: vscode.Uri) {
        super(() => {
            for (const disposable of this._disposables) {
                disposable.dispose();
            }
        });
        this.loadPlugins();
        let watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(dir, '**/*.js')
        );
        this._disposables.push(watcher);
        watcher.onDidCreate((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name] = new Plugin(e, name);
            this.notifyChange();
        });
        watcher.onDidDelete((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            delete this.plugins[name];
            this.notifyChange();
        });
        watcher.onDidChange((e) => {
            let name = this.getName(e);
            if (!name) {
                return;
            }
            this.plugins[name]?.reload();
            this.notifyChange();
        });
        this._disposables.push(vscode.workspace.onDidChangeTextDocument(async (e) => {
            let plugin = await this.findPlugin(e.document.uri);
            if (!plugin) {
                return;
            }
            plugin.setCode(e.document.getText());
            this.notifyChange();
        }));
    }

    @throttle(100)
    private notifyChange() {
        this._onDidChange.fire();
    }

    public onDidChange = this._onDidChange.event;

    private plugins: Record<string, Plugin> = {};
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
                return require(name);
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
        y3.log.info(`运行插件 "${plugin.name}/${funcName}" 成功`);
    }

    public async getAll() {
        await this.ready();
        return Object.values(this.plugins).sort((a, b) => a.name.localeCompare(b.name));
    }

    public async runAll(funcName: string) {
        let plugins = await this.getAll();
        let errors = [];
        for (const plugin of plugins) {
            const infos = await plugin.getExports();
            if (!infos[funcName]) {
                continue;
            }
            try {
                await plugin.run(funcName, this.makeSandbox());
            } catch (error) {
                let errorMessage = String(error).replace(/Error: /, '');
                errors.push(`"${plugin.name}/${funcName}":${errorMessage}`);
            }
        }
        if (errors.length > 0) {
            throw new Error(errors.join('\n'));
        }
    }
}
