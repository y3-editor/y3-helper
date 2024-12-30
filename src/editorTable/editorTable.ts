import { Table } from "../constants";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { queue, throttle } from "../utility/decorators";
import { EditorData, valueOnGet, valueOnSet } from "./editorData";
import { define } from "../customDefine";
export { EditorData } from "./editorData";
import { EditorJson } from "./editorJson";

const templateDir = 'template\\json_template';
const metaDir = 'src\\helper_meta\\editor';

type ActionType = 'create' | 'delete' | 'change';

type ItemShape = string | boolean | number | bigint | null | TupleShape | MapShape | ArrayShape;
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
let customTableMeta: { [key: string]: TableMeta };

export class FieldInfo {
    desc?: string;
    tips?: string;
    type?: string;

    constructor(public tableName: Table.NameCN, public field: string) {
        let meta = customTableMeta?.[tableName]?.[field]
                ?? tableMeta[tableName]?.[field];
        if (!meta) {
            return;
        }
        this.desc  = meta.desc;
        this.tips  = meta.tips;
        this.type  = meta.type;
        this.field = meta.key ?? field;
    }
}

async function updateCustomFields() {
    customTableMeta = {
        ["单位"]: {},
    };
    let attrs = await define().单位属性.getAttrs();
    for (let attr of attrs) {
        customTableMeta["单位"][attr.name] = {
            key: attr.key,
            type: 'number',
            desc: attr.name,
        };
        customTableMeta["单位"][attr.key] = {
            key: attr.key,
            type: 'number',
            desc: attr.name,
        };
    }
}

export async function ready() {
    await y3.language.ready();
    for (const tableName in Table.name.fromCN) {
        if (tableMeta[tableName] === undefined) {
            let nameEN = Table.name.fromCN[tableName as Table.NameCN];
            let metaUri = vscode.Uri.joinPath(y3.helper.extensionUri, metaDir, `${nameEN}.json`);
            let metaFile = await y3.fs.readFile(metaUri);
            if (metaFile) {
                tableMeta[tableName] = JSON.parse(metaFile.string);
            } else {
                tableMeta[tableName] = {};
            }
        }
    }
    await updateCustomFields();
    define().单位属性.onDidChange(async () => {
        await updateCustomFields();
    });
}

export class EditorObject<N extends Table.NameCN = Table.NameCN> {
    private _json?: EditorJson;
    private _name?: string;
    private _text?: string;
    public uri?: vscode.Uri;
    constructor(private manager: EditorManager, public tableName: N, public key: number) {}

    toString() {
        return `{物编对象|${this.name}|${this.tableName}-${this.key}}`;
    }

    /**
     * 获取对象的json数据语法树
     */
    public get json(): EditorJson | undefined {
        if (this._json === undefined) {
            if (!this._text) {
                return undefined;
            }
            this._json = new EditorJson(this._text);
            this._text = undefined;
        }
        return this._json;
    }

    public get text(): string | undefined {
        return this._json?.text;
    }

    public set text(text: string) {
        if (text === this._text) {
            return;
        }
        this._text = text;
        this._json = undefined;
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
                        return this.set(p, value, true);
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
        let value = this.rawGet(fieldInfo.field);
        if (value === undefined) {
            return undefined;
        }
        value = valueOnGet(fieldInfo, value, this.key);
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
        value = valueOnSet(fieldInfo, value, this.rawGet(fieldInfo.field), convertType, this.key);
        return this.rawSet(fieldInfo.field, value);
    }

    rawGet(key: string): ItemShape | undefined {
        this.updateFile();
        return this.json?.get(key);
    }

    rawSet(key: string, value: ItemShape | undefined): boolean {
        if (!this.json) {
            return false;
        }
        this.updateFile();
        this.json.set(key, value);
        return true;
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
        this.json.updateText(fixedFloat);
        let content = this.json.text;
        let suc = await y3.fs.writeFile(this.uri, content);
        return suc;
    }

    public getFieldInfo(field: string) {
        let table = this.manager.openTable(this.tableName);
        return table.getFieldInfo(field);
    }

    private _fieldList?: string[];
    public listFields(): string[] {
        this._fieldList ??= Object.keys(tableMeta[this.tableName]);
        return this._fieldList;
    }

    flushName() {
        this._name = undefined;
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

export class EditorTable<N extends Table.NameCN = Table.NameCN> extends vscode.Disposable {
    public uri;
    public nameEN;
    private _objectCache: { [key: number]: EditorObject<N> | null | undefined } = {};
    private watcher?: vscode.FileSystemWatcher;
    constructor(private manager: EditorManager, public name: N) {
        super(() => {
            this.watcher?.dispose();
        });
        if (!manager.rootUri) {
            throw new Error('未选择地图路径');
        }
        this.nameEN = Table.name.fromCN[name];
        this.uri = vscode.Uri.joinPath(manager.rootUri, Table.path.fromCN[name]);
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
            this._objectCache[key] = await this.manager.loadObject<N>(this.name, key);
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
            let templateUri = vscode.Uri.joinPath(y3.helper.extensionUri, templateDir, `${this.nameEN}.json`);
            let template = await y3.fs.readFile(templateUri);
            if (!template) {
                return undefined;
            }
            templateJson = template.string;
        }

        let obj = new EditorObject(this.manager, this.name, key);
        obj.uri = this.getUri(key);
        obj.text = templateJson;
        obj.rawSet('_ref_', BigInt(key));
        obj.rawSet('uid', key.toString());
        obj.rawSet('key', BigInt(key));
        obj.set('name', name);
        obj.set('description', "");

        this._objectCache[key] = obj;
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

    public getFieldInfo(field: string): FieldInfo {
        return new FieldInfo(this.name, field);
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

    @throttle(500)
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

/**
 * 根据文件名获取文件对应的key
 * @param fileName 文件名
 * @returns 文件名对应的key
 */
function getFileKey(fileName: string): number | undefined {
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
export async function getObject(uri: vscode.Uri | string): Promise<EditorObject | undefined> {
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
    let map = y3.env.project?.findMapByUri(uri);
    if (!map) {
        return;
    }
    const obj = await map.editorTable.loadObject(nameCN, key) ?? undefined;
    return obj;
}

export class EditorManager {
    constructor(public rootUri: vscode.Uri) {}

    editorTables: Map<Table.NameCN, EditorTable<Table.NameCN>> = new Map();

    async loadObject<N extends Table.NameCN>(tableName: N, key: number) {
        let table = this.openTable(tableName);
        let uri = table.getUri(key);
        let file = await y3.fs.readFile(uri);
        if (!file) {
            return null;
        }
        await ready();
        try {
            let obj = new EditorObject(this, tableName, key);
            obj.uri = uri;
            obj.text = file.string;
            return obj;
        } catch {
            return null;
        }
    }

    /**
     * 打开物编表
     * @param tableName 哪种表
     * @returns 表对象
     */
    openTable<N extends Table.NameCN>(tableName: N): EditorTable<N> {
        if (!this.editorTables.has(tableName)) {
            let table = new EditorTable(this, tableName);
            this.editorTables.set(tableName, table);
            table.onDidChange(() => {
                this.flushCache();
            });
        }
        return this.editorTables.get(tableName) as EditorTable<N>;
    }

    private _allObjects?: EditorObject[];
    private _allObjectsMap?: Record<number, EditorObject[]>;
    private _cacheVersion = 0;
    private flushCache() {
        this._cacheVersion++;
        this._allObjects = undefined;
        this._allObjectsMap = undefined;
    }

    @queue()
    async getAllObjects() {
        if (this._allObjects) {
            return this._allObjects;
        }
        let allObjects: EditorObject[];
        while (true) {
            let version = this._cacheVersion;
            allObjects = [];
            let promises1: Promise<any>[] = [];
            let promises2: Promise<any>[] = [];
            for (const tableName in Table.name.fromCN) {
                const table = this.openTable(tableName as Table.NameCN);
                promises1.push(table.getList().then((list) => {
                    for (const key of list) {
                        let promise = table.get(key).then((obj) => obj && allObjects.push(obj));
                        promises2.push(promise);
                    }
                }));
            }
            await Promise.allSettled(promises1);
            await Promise.allSettled(promises2);
            if (version === this._cacheVersion) {
                break;
            }
        }
        allObjects.sort((a, b) => a.key - b.key);
        this._allObjects = allObjects;
        return allObjects;
    }

    @queue()
    async getObjectsByKey(key: number): Promise<EditorObject[]> {
        if (!this._allObjectsMap) {
            let allObjects = await this.getAllObjects();
            let map: Record<number, EditorObject[]> = {};
            this._allObjectsMap = map;
            for (const obj of allObjects) {
                if (!map[obj.key]) {
                    map[obj.key] = [obj];
                } else {
                    map[obj.key].push(obj);
                }
            }
        }
        let result = this._allObjectsMap[key];
        return result ?? [];
    }

    flushName() {
        for (const table of this.editorTables.values()) {
            for (const key of table.fetchList() ?? []) {
                let obj = table.fetch(key);
                obj?.flushName();
            }
        }
    }
}

/**
 * 打开物编表
 * @param tableName 哪种表
 * @returns 表对象
 */
export function openTable<N extends Table.NameCN>(tableName: N): EditorTable<N> {
    let map = y3.env.currentMap!;
    return map.editorTable.openTable(tableName);
}

export async function getAllObjects() {
    let map = y3.env.currentMap;
    while (!map || !map.editorTable) {
        await y3.sleep(100);
        map = y3.env.currentMap;
    }
    return await map.editorTable.getAllObjects();
}

/**
 * 根据key获取对象
 */
export async function getObjectsByKey(key: number): Promise<EditorObject[]> {
    let map = y3.env.currentMap;
    while (!map || !map.editorTable) {
        await y3.sleep(100);
        map = y3.env.currentMap;
    }
    return await map.editorTable.getObjectsByKey(key);
}

/**
 * 是否强制浮点数保留一位小数。默认为false。
 * 启用后如果想表示整数，需要使用 `123n` 或 `BigInt(123)`。
 */
export let fixedFloat = false;
