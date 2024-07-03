import { Table } from "../constants";
import { env } from "../env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';
import { throttle } from "../utility/decorators";

type ObjectShape = {
    "name": string | number,
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
    constructor(public key: number, public uri: vscode.Uri, private json: string) {
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

function getFileID(fileName: string): number|undefined {
    if (!fileName.toLowerCase().endsWith('.json')) {
        return;
    }
    let idStr = fileName.slice(0, -5).split('/').pop();
    if (!idStr) {
        return;
    }
    // 确保只有数字
    if (!/^\d+$/.test(idStr)) {
        return;
    }
    let id = parseInt(idStr);
    if (isNaN(id)) {
        return;
    }
    return id;
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

    public async get(id: number): Promise<EditorObject | null> {
        if (this._objectCache[id] === undefined) {
            this._objectCache[id] = await loadObject(this.nameCN, id);
        }
        return this._objectCache[id]!;
    }

    public fetch(id: number): EditorObject | null | undefined {
        return this._objectCache[id];
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
                let id = getFileID(name);
                if (id === undefined) {
                    continue;
                }
                this._listCache.push(id);
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

    private _listActions: ['create' | 'delete', number][] = [];
    private resortList() {
        if (this._listActions.length === 0) {
            return;
        }
        let map: { [key: number]: boolean } = {};
        let list: number[] = [];
        for (const id of this._listCache!) {
            map[id] = true;
        }
        for (const [action, id] of this._listActions) {
            if (action === 'create') {
                map[id] = true;
            } else {
                delete map[id];
            }
        }
        this._listActions.length = 0;
        for (const id in map) {
            list.push(Number(id));
        }
        list.sort();
        this._listCache = list;
    }

    @throttle(200)
    private callOnDidChange() {
        this._onDidChange.fire();
    }

    private _onDidChange: vscode.EventEmitter<void> = new vscode.EventEmitter();

    private initWatcher() {
        this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.uri, '*.json'));
        this.watcher.onDidChange((fileUri) => {
            let id = getFileID(fileUri.path);
            if (id === undefined) {
                return;
            }
            if (!this._objectCache[id]) {
                return;
            }
            this._objectCache[id] = undefined;
            this.callOnDidChange();
        });
        this.watcher.onDidCreate((fileUri) => {
            let id = getFileID(fileUri.path);
            if (id === undefined) {
                return;
            }
            if (!this._listCache) {
                return;
            }
            this._listActions.push(['create', id]);
            this.callOnDidChange();
        });
        this.watcher.onDidDelete((fileUri) => {
            let id = getFileID(fileUri.path);
            if (id === undefined) {
                return;
            }
            if (!this._listCache) {
                return;
            }
            this._objectCache[id] = undefined;
            this._listActions.push(['delete', id]);
            this.callOnDidChange();
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
