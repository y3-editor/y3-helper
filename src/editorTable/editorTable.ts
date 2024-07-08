import { Table } from "../constants";
import { env } from "../env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { queue, throttle } from "../utility/decorators";
import * as jsonc from 'jsonc-parser';

const template_dir = 'template\\json_template';
const meta_dir = 'editor_meta';

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

async function tableReady(tableName: Table.NameCN) {
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
    private _raw?: ObjectShape;
    private _tree?: jsonc.Node;
    private _name?: string;
    public json?: string;
    public uri?: vscode.Uri;
    constructor(public tableName: Table.NameCN, public key: number) {}

    public get raw(): ObjectShape | undefined {
        if (!this._raw) {
            if (!this.json) {
                return;
            }
            this._raw = JSON.parse(this.json);
        }
        return this._raw!;
    }

    public get name(): string {
        if (!this._name) {
            let name = this.json?.match(/"name"\s*:\s*(\-?\d*)/);
            if (name && name[1]) {
                let id = parseInt(name[1]);
                if (!isNaN(id)) {
                    this._name = y3.language.get(id);
                }
            } else {
                let name = this.raw?.name;
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

    public get tree(): jsonc.Node | undefined {
        if (!this.json) {
            return;
        }
        if (!this._tree) {
            let tree = jsonc.parseTree(this.json);
            if (tree && tree.type === 'object') {
                this._tree = tree;
            }
        }
        return this._tree;
    }

    public async rename(name: string): Promise<boolean> {
        if (!this.uri || !this.json) {
            return false;
        }
        let strKey = await y3.language.keyOf(name, true);
        let raw: ObjectShape = JSON.parse(this.json);
        raw.name = strKey;
        let newJson = JSON.stringify(raw, null, 4);
        let suc = await y3.fs.writeFile(this.uri, newJson);
        if (!suc) {
            return false;
        }
        this.json = newJson;
        this._name = name;
        this._raw  = raw;
        return true;
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
}

async function loadObject(tableName: Table.NameCN, key: number) {
    let uri = vscode.Uri.joinPath(env.editorTableUri!, Table.path.fromCN[tableName], `${key}.json`);
    let file = await y3.fs.readFile(uri);
    if (!file) {
        return null;
    }
    await tableReady(tableName);
    try {
        let obj = new EditorObject(tableName, key);
        obj.uri = uri;
        obj.json = file.string;
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
            if (!obj || !obj.json) {
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
        raw.name = await y3.language.keyOf(name, true);
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
    await tableReady(nameCN);
    const file = await y3.fs.readFile(uri);
    if (!file) {
        return;
    }
    const obj = new EditorObject(nameCN, key);
    obj.uri = uri;
    obj.json = file.string;
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
