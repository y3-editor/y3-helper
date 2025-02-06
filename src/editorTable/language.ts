import * as vscode from 'vscode';
import { Map } from '../env';
import * as y3 from 'y3-helper';
import { hash, SpinLock } from '../utility';
import { throttle } from '../utility/decorators';

const l10n = vscode.l10n;

export class Language extends vscode.Disposable {
    private disposeList: vscode.Disposable[] = [];
    public uri: vscode.Uri;

    constructor(public map: Map) {
        super(() => {
            this.disposeList.forEach(d => d.dispose());
        });
        this.uri = vscode.Uri.joinPath(this.map.uri, "zhlanguage.json");
    }

    async start() {
        let watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.uri, "zhlanguage.json"));
        watcher.onDidChange(() => this.reload());
        watcher.onDidCreate(() => this.reload());
        watcher.onDidDelete(() => this.reload());
        this.disposeList.push(watcher);
        await this.reload();
    }

    private _mapLanguage?: y3.json.Json;
    private _mapReverse?: { [key: string]: string } = {};
    private _ioLock = new SpinLock();
    private _lastWriteTime = 0;

    private onDidChangeEmitter = new vscode.EventEmitter<void>();

    @throttle(500)
    async reload() {
        if (this._waitWrite || Date.now() - this._lastWriteTime < 1000) {
            this.reload();
            return;
        }
        try {
            await this._ioLock.acquire();
            y3.log.debug(l10n.t('开始读取语言文件'));
            let languageFile = await y3.fs.readFile(this.uri);
            y3.log.debug(l10n.t('语言文件读取完成'));
            this._ioLock.release();
            if (!languageFile) {
                return;
            }
            if (this._waitWrite || Date.now() - this._lastWriteTime < 1000) {
                this.reload();
                return;
            }
            try {
                this._mapLanguage = new y3.json.Json(languageFile.string);
                this._mapReverse = undefined;
            } catch(e) {
                y3.log.warn(l10n.t('解析中文语言文件失败：{0}', String(e)));
            }
        } finally {
            this.onDidChangeEmitter.fire();
        }
    }

    onDidChange = this.onDidChangeEmitter.event;

    get(key: string | number | bigint): string | undefined {
        if (typeof key === 'number' || typeof key === 'bigint') {
            key = key.toString();
        }
        let value = this._mapLanguage?.get(key);
        if (typeof value !== 'string') {
            return undefined;
        }
        return value;
    }

    private _waitWrite = false;
    async set(key: string | number | bigint, value: string) {
        if (typeof key === 'number' || typeof key === 'bigint') {
            key = key.toString();
        }
        if (this.get(key) === value) {
            return;
        }
        y3.log.debug(l10n.t('设置中文文本：{0} => {1}', key, value));
        this._mapLanguage?.set(key, value);
        if (this._mapReverse) {
            this._mapReverse[value] = key;
        }
        this._waitWrite = true;
        this._lastWriteTime = Date.now();
        this.updateFile();
    }

    private makeReverse(object: any): { [key: string]: string } {
        if (typeof object !== 'object' || object === null) {
            return {};
        }
        let result: { [key: string]: string} = {};
        for (let key in object) {
            const value = object[key];
            if (typeof value === 'string') {
                result[value] = key;
            }
        }
        return result;
    }

    keyOf(value: string | number | bigint): string | bigint {
        if (typeof value === 'number' || typeof value === 'bigint') {
            value = value.toString();
        }
        this._mapReverse = this._mapReverse ?? this.makeReverse(this._mapLanguage?.data);
        if (this._mapReverse[value]) {
            return this._mapReverse[value];
        }

        let key = this.makeKey(value);
        this.set(key.toString(), value);

        try {
            return BigInt(key);
        } catch {
            return key;
        }
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
        this._waitWrite = false;
        let content = this._mapLanguage?.text;
        if (!content) {
            return;
        }
        await this._ioLock.acquire();
        this._lastWriteTime = Date.now();
        y3.log.debug(l10n.t('开始写入语言文件'));
        await y3.fs.writeFile(this.uri!, content);
        y3.log.debug(l10n.t('语言文件写入完成'));
        this._ioLock.release();
        this._lastWriteTime = Date.now();
    }
}
