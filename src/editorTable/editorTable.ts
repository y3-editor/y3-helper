import { Table } from "../constants";
import { env } from "../env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { queue, throttle } from "../utility/decorators";

const template_dir = 'template\\json_template';
const meta_dir = 'editor_meta';

type ActionType = 'create' | 'delete' | 'change';

type ItemShape = string | boolean | number | null | TupleShape | MapShape | ArrayShape;
type ArrayShape = ItemShape[];

type TupleShape = {
    "__tuple__": true,
    "items": ItemShape[],
};

type MapShape = {
    [key: string]: any,
};

type FieldMeta = {
    key:   string;
    type:  string;
    desc?: string;
    tips?: string;
};

type TableMeta = { [key: string]: FieldMeta };

let tableMeta: { [key: string]: TableMeta } = {};

export class FieldInfo {
    desc?: string;
    tips?: string;
    type?: string;

    constructor(public tableName: Table.NameCN, public field: string) {
        this.desc = tableMeta[tableName]?.[field]?.desc;
        this.tips = tableMeta[tableName]?.[field]?.tips;
        this.type = tableMeta[tableName]?.[field]?.type;
    }
}

async function ready(tableName: Table.NameCN) {
    await y3.language.ready();
    if (tableMeta[tableName] === undefined) {
        let nameEN = Table.name.fromCN[tableName];
        let metaUri = vscode.Uri.joinPath(y3.context.extensionUri, meta_dir, `${nameEN}.json`);
        let metaFile = await y3.fs.readFile(metaUri);
        if (metaFile) {
            tableMeta[tableName] = JSON.parse(metaFile.string);
        } else {
            tableMeta[tableName] = {};
        }
    }
}

export class EditorObject {
    private _json?: y3.json.Json;
    private _name?: string;
    public text?: string;
    public uri?: vscode.Uri;
    constructor(public tableName: Table.NameCN, public key: number) {}

    public get json(): y3.json.Json | undefined {
        if (this._json === undefined) {
            if (!this.text) {
                return undefined;
            }
            this._json = new y3.json.Json(this.text);
        }
        return this._json;
    }

    public get(key: string): any {
        if (key === 'name') {
            return this.name;
        }
        return this.rawGet(key);
    }

    public set(key: string, value: ItemShape): boolean {
        if (key === 'name') {
            if (typeof value === 'string') {
                this._name = value;
                value = y3.language.keyOf(value, true);
            } else {
                return false;
            }
        }
        return this.rawSet(key, value);
    }

    private rawGet(key: string): ItemShape | undefined {
        return this.json?.get(key);
    }

    private rawSet(key: string, value: ItemShape): boolean {
        if (!this.json) {
            return false;
        }
        let res = this.json.set(key, value);
        if (res) {
            this.updateFile();
        }
        return res;
    }

    public get name(): string {
        if (!this._name) {
            let name = this.text?.match(/"name"\s*:\s*(\-?\d*)/);
            if (name && name[1]) {
                let id = parseInt(name[1]);
                if (!isNaN(id)) {
                    this._name = y3.language.get(id);
                }
            } else {
                let name = this.json?.get('name');
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

    @throttle(100)
    private async updateFile(): Promise<boolean> {
        if (!this.uri || !this.json) {
            return false;
        }
        let content = this.json.text;
        let suc = await y3.fs.writeFile(this.uri, content);
        return suc;
    }

    public getFieldInfo(field: string) {
        let table = openTable(this.tableName);
        return table.getFieldInfo(field);
    }

    private _fieldList?: string[];
    public listFields(): string[] {
        this._fieldList ??= Object.keys(tableMeta[this.tableName]);
        return this._fieldList;
    }

    // private serialize(item: y3.json.Item): ItemShape {
    //     if (typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' || item === null) {
    //         return item;
    //     } else if (Array.isArray(item)) {
    //         return item.map((i) => this.serialize(i));
    //     } else if (typeof item === 'object') {
    //     }
    // }
}

async function loadObject(tableName: Table.NameCN, key: number) {
    let table = openTable(tableName);
    let uri = table.getUri(key);
    let file = await y3.fs.readFile(uri);
    if (!file) {
        return null;
    }
    await ready(tableName);
    try {
        let obj = new EditorObject(tableName, key);
        obj.uri = uri;
        obj.text = file.string;
        return obj;
    } catch {
        return null;
    }
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
            if (!obj || !obj.text) {
                return undefined;
            }
            templateJson = obj.text;
        } else {
            let templateUri = vscode.Uri.joinPath(y3.context.extensionUri, template_dir, `${this.nameEN}.json`);
            let template = await y3.fs.readFile(templateUri);
            if (!template) {
                return undefined;
            }
            templateJson = template.string;
        }

        let json = new y3.json.Json(templateJson);
        json.set('name', y3.language.keyOf(name, true));
        json.set('uid', key.toString());
        json.set('key', key);
        json.set('_ref_', key);

        let obj = new EditorObject(this.nameCN, key);
        obj.uri = this.getUri(key);
        obj.text = json.text;

        this._objectCache[key] = obj;

        let suc = await y3.fs.writeFile(obj.uri, obj.text);
        if (!suc) {
            this._objectCache[key] = undefined;
            return undefined;
        }

        return obj;
    }

    public getUri(key: number) {
        return vscode.Uri.joinPath(this.uri, `${key}.json`);
    }

    private _fieldInfoCache: { [field: string]: FieldInfo } = {};
    public getFieldInfo(field: string): FieldInfo | undefined {
        if (!this._fieldInfoCache[field]) {
            this._fieldInfoCache[field] = new FieldInfo(this.nameCN, field);
        }
        return this._fieldInfoCache[field];
    }

    public listFields(): string[] {
        return Object.keys(tableMeta[this.nameCN]);
    }

    private _listActions: [ActionType, number][] = [];
    private resortList() {
        if (this._listActions.length === 0) {
            return;
        }
        if (!this._listCache) {
            this._listActions.length = 0;
            return;
        }
        let mergedActions: { [key: number]: ActionType } = {};
        for (const [action, key] of this._listActions!) {
            const lastAction = mergedActions[key];
            if (action === 'create') {
                mergedActions[key] = action;
            } else if (action === 'change') {
                if (lastAction !== 'create') {
                    mergedActions[key] = action;
                }
            } else if (action === 'delete') {
                if (lastAction === 'create') {
                    delete mergedActions[key];
                } else {
                    mergedActions[key] = action;
                }
            }
        }
        this._listActions.length = 0;

        let sets = new Set<number>(this._listCache);
        for (const strKey in mergedActions) {
            const key = Number(strKey);
            if (mergedActions[key] === 'delete') {
                sets.delete(key);
                this._objectCache[key] = undefined;
            } else if (mergedActions[key] === 'create') {
                sets.add(key);
                this._listCache.push(key);
            } else {
                this._objectCache[key] = undefined;
            }
        }

        this._listCache = Array.from(sets);
        this._listCache.sort();
    }

    @throttle(200)
    private notifyChange() {
        this.resortList();
        this._onDidChange.fire();
    }

    private changeTable(action: ActionType, key: number) {
        this._listActions.push([action, key]);
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

export function openTable<N extends Table.NameCN>(tableName: N): EditorTable<N> {
    let table = editorTables[tableName]
            ?? (editorTables[tableName] = new EditorTable(tableName));
    return table;
}

export function getFileKey(fileName: string): number | undefined {
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

export async function getObject(uri: vscode.Uri): Promise<EditorObject | undefined> {
    const path = uri.path.match(/([^\/]+)\/[^\/]+\.json$/)?.[1];
    if (!path || !(path in Table.path.toCN)) {
        return;
    }
    const key = getFileKey(uri.path);
    if (!key) {
        return;
    }
    const nameCN = Table.path.toCN[path as Table.Path];
    await ready(nameCN);
    const file = await y3.fs.readFile(uri);
    if (!file) {
        return;
    }
    const obj = new EditorObject(nameCN, key);
    obj.uri = uri;
    obj.text = file.string;
    return obj;
}

class Manager {
    @queue()
    async getAllObjects() {
        let allObjects: EditorObject[] = [];
        let promises: Promise<any>[] = [];
        for (const tableName in Table.name.fromCN) {
            const table = openTable(tableName as Table.NameCN);
            table.getList().then((list) => {
                for (const key of list) {
                    let promise = table.get(key).then((obj) => obj && allObjects.push(obj));
                    promises.push(promise);
                }
            });
        }
        await Promise.allSettled(promises);
        allObjects.sort((a, b) => a.key - b.key);
        return allObjects;
    }
}

const ManagerInstance = new Manager();

export async function getAllObjects() {
    return await ManagerInstance.getAllObjects();
}

export function init() {
}
