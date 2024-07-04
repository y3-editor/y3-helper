import { Table } from "../constants";
import { env } from "../env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { throttle } from "../utility/decorators";

const template_dir = 'template\\json_template';

type ObjectShape = {
    "name": string | number,
    "_ref_": number,
    "key": number,
    "uid": number,
    [key: string]: ItemShape,
};

type ItemShape = string | boolean | number | TupleShape | MapShape | ArrayShape;
type ArrayShape = ItemShape[];

type TupleShape = {
    "__tuple__": true,
    "items": ItemShape[],
};

type MapShape = {
    [key: string]: any,
};

export class EditorObject {
    private _raw?: ObjectShape;
    private _name?: string;
    private _json: string;
    constructor(public key: number, public uri: vscode.Uri, json: string) {
        this._json = json;
    }

    public get raw(): ObjectShape {
        if (!this._raw) {
            this._raw = JSON.parse(this.json);
        }
        return this._raw!;
    }

    public get name(): string {
        if (!this._name) {
            let name = this.json.match(/"name"\s*:\s*(\-?\d*)/);
            if (name && name[1]) {
                let id = parseInt(name[1]);
                if (!isNaN(id)) {
                    this._name = y3.language.get(id);
                }
            } else {
                let name = this.raw.name;
                if (typeof name === 'string') {
                    this._name = name;
                } else if (typeof name === 'number') {
                    this._name = y3.language.get(name);
                }
            }
        }
        if (!this._name) {
            this._name = '<未知名称>';
        }
        return this._name;
    }

    public get json(): string {
        return this._json;
    }

    public async rename(name: string): Promise<boolean> {
        let id = y3.language.keyOf(name);
        let raw: ObjectShape = JSON.parse(this.json);
        raw.name = id;
        let newJson = JSON.stringify(raw, null, 4);
        let suc = await y3.fs.writeFile(this.uri, newJson);
        if (!suc) {
            return false;
        }
        this._name = name;
        this._json = newJson;
        this._raw  = raw;
        return true;
    }
}

async function loadObject(tableName: Table.NameCN, key: number) {
    let uri = vscode.Uri.joinPath(env.editorTableUri!, Table.path.fromCN[tableName], `${key}.json`);
    let file = await y3.fs.readFile(uri);
    if (!file) {
        return null;
    }
    try {
        return new EditorObject(key, uri, file.string);
    } catch {
        return null;
    }
}

function getFileKey(fileName: string): number|undefined {
    if (!fileName.toLowerCase().endsWith('.json')) {
        return;
    }
    let keyStr = fileName.slice(0, -5).split('/').pop();
    if (!keyStr) {
        return;
    }
    // 确保只有数字
    if (!/^\d+$/.test(keyStr)) {
        return;
    }
    let key = parseInt(keyStr);
    if (isNaN(key)) {
        return;
    }
    return key;
}

interface CreateOptions {
    /**
     * 新对象的名称，如果不填则使用默认名称
     */
    name?: string,
    /**
     * 新对象的key，如果不填则自动生成
     */
    key?: number,
    /**
     * 从哪个对象复制，如果不填则从模板复制为空对象
     */
    copyFrom?: number,
}

export class EditorTable<N extends Table.NameCN> extends vscode.Disposable {
    public uri;
    public nameEN;
    private _objectCache: { [key: number]: EditorObject | null | undefined } = {};
    private watcher?: vscode.FileSystemWatcher;
    constructor(public nameCN: N) {
        super(() => {
            this.watcher?.dispose();
        });
        if (!env.editorTableUri) {
            throw new Error('未选择地图路径');
        }
        this.nameEN = Table.name.fromCN[nameCN];
        this.uri = vscode.Uri.joinPath(env.editorTableUri, Table.path.fromCN[nameCN]);
    }

    public async get(key: number): Promise<EditorObject | undefined> {
        if (this._objectCache[key] === undefined) {
            this._objectCache[key] = await loadObject(this.nameCN, key);
        }
        return this._objectCache[key] ?? undefined;
    }

    public fetch(key: number): EditorObject | undefined {
        return this._objectCache[key] ?? undefined;
    }

    private _listCache?: number[];
    public async getList() {
        if (!this._listCache) {
            this._listCache = [];
            let files = await y3.fs.dir(this.uri);
            this.initWatcher();
            if (!files) {
                return this._listCache;
            }
            for (const [name, type] of files) {
                if (type !== vscode.FileType.File) {
                    continue;
                }
                let key = getFileKey(name);
                if (key === undefined) {
                    continue;
                }
                this._listCache.push(key);
            }
            this._listCache.sort();
        }
        this.resortList();
        return this._listCache;
    }

    public fetchList() {
        this.resortList();
        return this._listCache;
    }

    public async delete(key: number) {
        let uri = vscode.Uri.joinPath(this.uri, `${key}.json`);
        await y3.fs.removeFile(uri, {
            useTrash: true,
        }) ?? await y3.fs.removeFile(uri);
        this.changeTable('delete', key);
    }

    public async canUseKey(key: number) {
        if (!Number.isSafeInteger(key) || key <= 0) {
            return false;
        }
        if ((await this.getList()).includes(key)) {
            return false;
        } else {
            return true;
        }
    }

    public async makeNewKey() {
        let list = await this.getList();
        let max = list[list.length - 1];
        return max ? max + 1 : 100001;
    }

    public async create(options?: CreateOptions) {
        let name = options?.name ?? `新建${this.nameCN}`;
        let key: number;
        if (options?.key) {
            key = options.key;
            if (!await this.canUseKey(key)) {
                return undefined;
            }
        } else {
            key = await this.makeNewKey();
        }

        let templateJson: string;
        if (options?.copyFrom) {
            let obj = await this.get(options.copyFrom);
            if (!obj) {
                return undefined;
            }
            templateJson = obj.json;
        } else {
            let templateUri = vscode.Uri.joinPath(y3.context.extensionUri, template_dir, `${this.nameEN}.json`);
            let template = await y3.fs.readFile(templateUri);
            if (!template) {
                return undefined;
            }
            templateJson = template.string;
        }

        let raw: ObjectShape = JSON.parse(templateJson);
        raw.name = y3.language.keyOf(name);
        raw.uid = key;
        raw.key = key;
        raw._ref_ = key;

        let json = JSON.stringify(raw, null, 4);
        let uri = vscode.Uri.joinPath(this.uri, `${key}.json`);
        let suc = await y3.fs.writeFile(uri, json);
        if (!suc) {
            return undefined;
        }

        return await this.get(key);
    }

    private _listActions: ['create' | 'delete', number][] = [];
    private resortList() {
        if (this._listActions.length === 0) {
            return;
        }
        let map: { [key: number]: boolean } = {};
        let list: number[] = [];
        for (const key of this._listCache!) {
            map[key] = true;
        }
        for (const [action, key] of this._listActions) {
            if (action === 'create') {
                map[key] = true;
            } else {
                delete map[key];
            }
        }
        this._listActions.length = 0;
        for (const key in map) {
            list.push(Number(key));
        }
        list.sort();
        this._listCache = list;
    }

    @throttle(200)
    private notifyChange() {
        this._onDidChange.fire();
    }

    private changeTable(action: 'create' | 'delete' | 'change', key: number) {
        switch (action) {
            case 'create': {
                if (!this._listCache) {
                    return;
                }
                this._listActions.push(['create', key]);
                break;
            }
            case 'delete': {
                if (!this._listCache) {
                    return;
                }
                this._objectCache[key] = undefined;
                this._listActions.push(['delete', key]);
                break;
            }
            case 'change': {
                if (!this._objectCache[key]) {
                    return;
                }
                this._objectCache[key] = undefined;
                break;
            }
        }
        this.notifyChange();
    }

    private _onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter();

    private initWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.uri, '*.json'));
        this.watcher.onDidChange((fileUri) => {
            let key = getFileKey(fileUri.path);
            if (key === undefined) {
                return;
            }
            this.changeTable('change', key);
        });
        this.watcher.onDidCreate((fileUri) => {
            let key = getFileKey(fileUri.path);
            if (key === undefined) {
                return;
            }
            this.changeTable('create', key);
        });
        this.watcher.onDidDelete((fileUri) => {
            let key = getFileKey(fileUri.path);
            if (key === undefined) {
                return;
            }
            this.changeTable('delete', key);
        });
    }

    public onDidChange(callback: () => void) {
        return this._onDidChange.event(callback);
    }
}

let editorTables: { [key: string]: any } = {};

export function open<N extends Table.NameCN>(tableName: N): EditorTable<N> {
    let table = editorTables[tableName]
            ?? (editorTables[tableName] = new EditorTable(tableName));
    return table;
}
