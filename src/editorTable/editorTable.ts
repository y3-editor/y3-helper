import { Table } from "src/constants";
import { env } from "src/env";
import * as vscode from "vscode";
import * as y3 from 'y3-helper';

class EditorObject {
    public raw: Object;
    constructor(public key: number, public uri: vscode.Uri, json: string) {
        this.raw = JSON.parse(json);
    }
}

async function openObject(tableName: Table.NameCN, key: number) {
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

class EditorTable<N extends Table.NameCN> {
    public tableUri;
    public nameEN;
    private _objectCache: { [key: number]: EditorObject | null } = {};
    constructor(public nameCN: N) {
        if (!env.editorTableUri) {
            throw new Error('未选择地图路径');
        }
        this.nameEN = Table.name.fromCN[nameCN];
        this.tableUri = vscode.Uri.joinPath(env.editorTableUri, Table.path.fromCN[nameCN]);
    }

    public async get(id: number): Promise<EditorObject | null> {
        if (this._objectCache[id] === undefined) {
            this._objectCache[id] = await openObject(this.nameCN, id);
        }
        return this._objectCache[id];
    }
}

export function open<N extends Table.NameCN>(tableName: N) {
    return new EditorTable<N>(tableName);
}
