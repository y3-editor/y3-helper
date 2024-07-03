import * as vscode from 'vscode';
import { env } from '../env';
import * as y3 from 'y3-helper';
import { hash } from '../utility';
import { throttle } from '../utility/decorators';

class Language extends vscode.Disposable {
    private disposeList: vscode.Disposable[] = [];
    public uri?: vscode.Uri;

    constructor() {
        super(() => {
            this.disposeList.forEach(d => d.dispose());
        });
        if (env.mapUri) {
            this.uri = vscode.Uri.joinPath(env.mapUri, "zhlanguage.json");
            let watcher = vscode.workspace.createFileSystemWatcher(this.uri.fsPath);
            watcher.onDidChange(() => this.reload());
            watcher.onDidCreate(() => this.reload());
            watcher.onDidDelete(() => this.reload());
            this.disposeList.push(watcher);
            this.reload();
        }
    }

    private _language: { [key: string]: string } = {};
    private _reverse?: { [key: string]: string } = {};
    async reload() {
        if (!this.uri) {
            return;
        }
        let languageFile = await y3.fs.readFile(this.uri);
        if (!languageFile) {
            return;
        }
        try {
            this._language = JSON.parse(languageFile.string);
            this._reverse = undefined;
        } catch(e) {
            y3.log.warn(`解析中文语言文件失败：${e}`);
        }
    }

    get(key: string): string | undefined {
        return this._language[key];
    }

    set(key: string, value: string) {
        this._language[key] = value;
        if (this._reverse) {
            this._reverse[value] = key;
        }
        this.updateFile();
    }

    keyOf(value: string): string | number {
        if (!this._reverse) {
            this._reverse = {};
            for (let key in this._language) {
                this._reverse[this._language[key]] = key;
            }
        }
        if (this._reverse[value]) {
            return parseInt(this._reverse[value]) ?? this._reverse[value];
        } else {
            let key = this.makeKey(value);
            this.set(key.toString(), value);
            return key;
        }
    }

    private makeKey(value: string): number {
        return hash(value);
    }

    @throttle(1000)
    private updateFile() {
        let content = JSON.stringify(this._language, null, 4);
        y3.fs.writeFile(this.uri!, content);
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
export function set(key: string | number, value: string) {
    if (typeof key === 'number') {
        key = key.toString();
    }
    language.set(key, value);
}

/**
 * 获取中文文本对应的key，如果不存在会新建
 */
export function keyOf(value: string | number): string | number {
    if (typeof value === 'number') {
        value = value.toString();
    }
    return language.keyOf(value);
}
