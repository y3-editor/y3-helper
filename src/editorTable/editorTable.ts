import { Table } from "../constants";
import { env } from "../env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { queue, throttle } from "../utility/decorators";
import { EditorData, valueOnGet, valueOnSet } from "./editorData";
export { EditorData } from "./editorData";

const template_dir = 'template\\json_template';
const meta_dir = 'src\\editor_meta';

type ActionType = 'create' | 'delete' | 'change';

type ItemShape = string | boolean | number | null | TupleShape | MapShape | ArrayShape;
type ArrayShape = ItemShape[];

type TupleShape = {
    __tuple__: true,
    items:     ItemShape[],
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

export async function ready() {
    await y3.language.ready();
    for (const tableName in Table.name.fromCN) {
        if (tableMeta[tableName] === undefined) {
            let nameEN = Table.name.fromCN[tableName as Table.NameCN];
            let metaUri = vscode.Uri.joinPath(y3.helper.extensionUri, meta_dir, `${nameEN}.json`);
            let metaFile = await y3.fs.readFile(metaUri);
            if (metaFile) {
                tableMeta[tableName] = JSON.parse(metaFile.string);
            } else {
                tableMeta[tableName] = {};
            }
        }
    }
}
export class EditorObject<N extends Table.NameCN> {
    private _json?: y3.json.Json;
    private _name?: string;
    public text?: string;
    public uri?: vscode.Uri;
    constructor(public tableName: N, public key: number) {}

    toString() {
        return `{物编对象|${this.name}|${this.tableName}-${this.key}}`;
    }

    /**
     * 获取对象的json数据语法树
     */
    public get json(): y3.json.Json | undefined {
        if (this._json === undefined) {
            if (!this.text) {
                return undefined;
            }
            this._json = new y3.json.Json(this.text);
        }
        return this._json;
    }

    /**
     * 获取对象的物编数据
     */
    private _data?: EditorData<N>;
    public get data(): EditorData<N> {
        if (this._data === undefined) {
            this._data = new Proxy({} as EditorData<N>, {
                get: (target, p, receiver) => {
                    if (typeof p === 'string') {
                        return this.get(p);
                    }
                },
                set: (target, p, value, receiver) => {
                    if (typeof p === 'string') {
                        return this.set(p, value);
                    }
                    return false;
                },
            });
        }
        return this._data;
    }

    private get(key: string): any {
        let fieldInfo = this.getFieldInfo(key);
        if (!fieldInfo) {
            return undefined;
        }
        if (key === 'name') {
            return this.name;
        }
        let raw = this.rawGet(key);
        if (raw === undefined) {
            return undefined;
        }
        let value = this.deserialize(raw);
        value = valueOnGet(fieldInfo, value);
        return value;
    }

    public set(key: string, value: ItemShape, convertType = false): boolean {
        let fieldInfo = this.getFieldInfo(key);
        if (!fieldInfo) {
            throw new Error(`未知字段:'${key}'`);
        }
        if (key === 'name' && typeof value === 'string') {
            this._name = value;
        }
        value = valueOnSet(fieldInfo, value, this.rawGet(key), convertType);
        let raw = this.serialize(value);
        return this.rawSet(key, raw);
    }

    private rawGet(key: string): ItemShape | undefined {
        return this.json?.get(key);
    }

    private rawSet(key: string, value: ItemShape | undefined): boolean {
        if (!this.json) {
            return false;
        }
        let res = this.json.set(key, value);
        if (res) {
            this.updateFile();
        }
        return res;
    }

    /**
     * 获取对象的名称
     */
    public get name(): string {
        if (this._name === undefined) {
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
        if (this._name === undefined) {
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

    private serialize(item: y3.json.Item, canBeTuple = true): ItemShape {
        if (typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' || item === null) {
            return item;
        } else if (Array.isArray(item)) {
            if (canBeTuple) {
                return {
                    __tuple__: true,
                    items: item.map((i) => this.serialize(i, false)),
                };
            } else {
                return item.map((i) => this.serialize(i, canBeTuple));
            }
        } else if (typeof item === 'object') {
            let map: MapShape = {};
            for (const key in item) {
                map[key] = this.serialize(item[key], canBeTuple);
            }
            return map;
        }
        throw new Error('不支持的数据类型:' + typeof item);
    }

    private deserialize(item: ItemShape): y3.json.Item {
        if (typeof item === 'string' || typeof item === 'boolean' || typeof item === 'number' || item === null) {
            return item;
        } else if (Array.isArray(item)) {
            return item.map((i) => this.deserialize(i));
        } else if (typeof item === 'object') {
            if (item.__tuple__) {
                return this.deserialize(item.items);
            } else {
                let map: MapShape = {};
                for (const key in item) {
                    map[key] = this.deserialize((item as MapShape)[key]);
                }
                return map;
            }
        }
        throw new Error('不支持的数据类型:' + typeof item);
    }
}

async function loadObject<N extends Table.NameCN>(tableName: N, key: number) {
    let table = openTable(tableName);
    let uri = table.getUri(key);
    let file = await y3.fs.readFile(uri);
    if (!file) {
        return null;
    }
    await ready();
    try {
        let obj = new EditorObject(tableName, key);
        obj.uri = uri;
        obj.text = file.string;
        return obj;
    } catch {
        return null;
    }
}

interface CreateOptions<N extends Table.NameCN> {
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
    copyFrom?: number | EditorObject<N>,
    /**
     * 如果目标key已存在，是否覆盖
     */
    overwrite?: boolean,
}

export class EditorTable<N extends Table.NameCN> extends vscode.Disposable {
    public uri;
    public nameEN;
    private _objectCache: { [key: number]: EditorObject<N> | null | undefined } = {};
    private watcher?: vscode.FileSystemWatcher;
    constructor(public name: N) {
        super(() => {
            this.watcher?.dispose();
        });
        if (!env.editorTableUri) {
            throw new Error('未选择地图路径');
        }
        this.nameEN = Table.name.fromCN[name];
        this.uri = vscode.Uri.joinPath(env.editorTableUri, Table.path.fromCN[name]);
    }

    toString() {
        return `<物编表|${this.name}>`;
    }

    /**
     * 获取具体的对象
     * @param key 对象的key（一串数字）
     * @returns 对象
     */
    public async get(key: number): Promise<EditorObject<N> | undefined> {
        if (this._objectCache[key] === undefined) {
            this._objectCache[key] = await loadObject<N>(this.name, key);
        }
        return this._objectCache[key] ?? undefined;
    }

    public fetch(key: number): EditorObject<N> | undefined {
        return this._objectCache[key] ?? undefined;
    }

    private _listCache?: number[];

    /**
     * 获取这个类型下的所有对象的key
     * @returns 这个类型下的所有对象的key
     */
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
            this._listCache.sort((a, b) => a - b);
        }
        this.resortList();
        return this._listCache;
    }

    public fetchList() {
        this.resortList();
        return this._listCache;
    }

    /**
     * 删除一个对象
     * @param key 对象的key
     */
    public async delete(key: number) {
        let uri = vscode.Uri.joinPath(this.uri, `${key}.json`);
        await y3.fs.removeFile(uri, {
            useTrash: true,
        }) ?? await y3.fs.removeFile(uri);
        this.changeTable('delete', key);
    }

    /**
     * 检查一个key是否可以使用
     * @param key 要检查的key
     * @param overwirte 是否允许覆盖已有的key，默认不允许
     * @returns 
     */
    public async canUseKey(key: number, overwirte?: boolean) {
        if (!Number.isSafeInteger(key) || key <= 0) {
            return false;
        }
        if (!overwirte && (await this.getList()).includes(key)) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * 生成一个可用的新key
     * @returns 
     */
    public async makeNewKey(copyKey?: number) {
        let list = await this.getList();
        if (copyKey) {
            let i = copyKey + 1;
            while (list.includes(i)) {
                i++;
            }
            return i;
        } else {
            let max = list[list.length - 1];
            return max ? max + 1 : 100001;
        }
    }

    /**
     * 创建一个对象
     * @param options 创建的参数
     * @returns 
     */
    public async create(options?: CreateOptions<N>): Promise<EditorObject<N> | undefined>{
        let name = options?.name ?? `新建${this.name}`;

        let key: number;
        if (options?.key) {
            key = options.key;
            if (!await this.canUseKey(key, options?.overwrite)) {
                return undefined;
            }
        } else {
            let copyKey = options?.copyFrom instanceof EditorObject
                        ? options.copyFrom.key
                        : options?.copyFrom;
            key = await this.makeNewKey(copyKey);
        }

        let templateJson: string;
        if (options?.copyFrom) {
            let obj = options.copyFrom instanceof EditorObject
                    ? options.copyFrom
                    : await this.get(options.copyFrom);
            if (!obj || !obj.text || obj.tableName !== this.name) {
                return undefined;
            }
            templateJson = obj.text;
        } else {
            let templateUri = vscode.Uri.joinPath(y3.helper.extensionUri, template_dir, `${this.nameEN}.json`);
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

        let obj = new EditorObject(this.name, key);
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

    /**
     * 获取对象在硬盘中的文件路径
     * @param key 对象的key
     * @returns 对象的路径
     */
    public getUri(key: number) {
        return vscode.Uri.joinPath(this.uri, `${key}.json`);
    }

    private _fieldInfoCache: { [field: string]: FieldInfo } = {};
    public getFieldInfo(field: string): FieldInfo | undefined {
        if (!this._fieldInfoCache[field]) {
            this._fieldInfoCache[field] = new FieldInfo(this.name, field);
        }
        return this._fieldInfoCache[field];
    }

    public listFields(): string[] {
        return Object.keys(tableMeta[this.name]);
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
        this._listCache.sort((a, b) => a - b);
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

/**
 * 打开物编表
 * @param tableName 哪种表
 * @returns 表对象
 */
export function openTable<N extends Table.NameCN>(tableName: N): EditorTable<N> {
    let table = editorTables[tableName]
            ?? (editorTables[tableName] = new EditorTable(tableName));
    return table;
}

/**
 * 根据文件名获取文件对应的key
 * @param fileName 文件名
 * @returns 文件名对应的key
 */
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

/**
 * 根据文件路径获取对象
 * @param uri 文件路径
 * @returns 对象
*/
export async function getObject(uri: vscode.Uri | string): Promise<EditorObject<Table.NameCN> | undefined> {
    if (typeof uri === 'string') {
        uri = vscode.Uri.file(uri);
    }
    const path = uri.path.match(/([^\/]+)\/[^\/]+\.json$/)?.[1];
    if (!path || !(path in Table.path.toCN)) {
        return;
    }
    const key = getFileKey(uri.path);
    if (!key) {
        return;
    }
    const nameCN = Table.path.toCN[path as Table.Path];
    await ready();
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
        let allObjects: EditorObject<Table.NameCN>[] = [];
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

/**
 * 获取所有的对象（速度比较慢）
 * @returns 所有对象
 */
export async function getAllObjects() {
    return await ManagerInstance.getAllObjects();
}

export function init() {
}
