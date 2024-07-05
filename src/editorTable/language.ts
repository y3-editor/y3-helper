import * as vscode from 'vscode';
import { env } from '../env';
import * as y3 from 'y3-helper';
import { hash } from '../utility';
import { throttle } from '../utility/decorators';

class Language extends vscode.Disposable {
    private disposeList: vscode.Disposable[] = [];
    public mapUri?: vscode.Uri;
    private _mapReady = true;

    constructor() {
        super(() => {
            this.disposeList.forEach(d => d.dispose());
        });
        if (env.mapUri) {
            this.mapUri = vscode.Uri.joinPath(env.mapUri, "zhlanguage.json");
            let watcher = vscode.workspace.createFileSystemWatcher(this.mapUri.fsPath);
            watcher.onDidChange(() => this.reload());
            watcher.onDidCreate(() => this.reload());
            watcher.onDidDelete(() => this.reload());
            this.disposeList.push(watcher);
            this.reload();
        }
    }

    private _mapLanguage: { [key: string]: string } = {};
    private _mapReverse?: { [key: string]: string } = {};
    async reload() {
        this._mapReady = false;
        try {
            if (!this.mapUri) {
                return;
            }
            let languageFile = await y3.fs.readFile(this.mapUri);
            if (!languageFile) {
                return;
            }
            try {
                this._mapLanguage = JSON.parse(languageFile.string);
                this._mapReverse = undefined;
            } catch(e) {
                y3.log.warn(`解析中文语言文件失败：${e}`);
            }
        } finally {
            this._mapReady = true;
        }
    }

    async ready() {
        if (this._mapReady) {
            return;
        }
        await new Promise<void>(resolve => {
            let interval = setInterval(() => {
                if (this._mapReady) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    get(key: string): string | undefined {
        return this._mapLanguage[key];
    }

    async set(key: string, value: string) {
        await this.ready();
        if (this.get(key) === value) {
            return;
        }
        this._mapLanguage[key] = value;
        if (this._mapReverse) {
            this._mapReverse[value] = key;
        }
        this.updateFile();
    }

    private makeReverse(object: { [key: string]: string }) {
        return Object.fromEntries(Object.entries(object).map(([k, v]) => [v, k]));
    }

    async keyOf(value: string): Promise<string> {
        await this.ready();
        this._mapReverse = this._mapReverse ?? this.makeReverse(this._mapLanguage);
        if (this._mapReverse[value]) {
            return this._mapReverse[value];
        }

        let key = this.makeKey(value);
        this.set(key.toString(), value);
        return key;
    }

    private makeKey(value: string): string {
        let key = hash(value);
        while (this.get(key.toString())) {
            key++;
        }
        return key.toString();
    }

    @throttle(500)
    private async updateFile() {
        await this.ready();
        let content = JSON.stringify(this._mapLanguage, null, 4);
        await y3.fs.writeFile(this.mapUri!, content);
    }
}

let language: Language;

export function init() {
    language = new Language();
    env.onDidChange(() => {
        language.dispose();
        language = new Language();
    });
}

export async function ready() {
    await language.ready();
}

/**
 * 根据key获取中文文本
 */
export function get(key: string | number): string | undefined {
    if (typeof key === 'number') {
        key = key.toString();
    }
    return language.get(key);
}

/**
 * 添加中文文本
 */
export async function set(key: string | number, value: string) {
    if (typeof key === 'number') {
        key = key.toString();
    }
    language.set(key, value);
}

/**
 * 获取中文文本对应的key，如果不存在会新建
 */
export async function keyOf(value: string | number, preferNumber?: boolean): Promise<string | number> {
    if (typeof value === 'number') {
        value = value.toString();
    }
    let key = await language.keyOf(value);
    if (preferNumber && Number.isSafeInteger(parseInt(key))) {
        return parseInt(key);
    }
    return key;
}
