import { env } from "../env";
import * as vscode from 'vscode';
import * as tools from '../tools';

const filePath = 'attr.json';

type Attr = {
    name: string,
    key: string,
};

export class UnitAttrs {
    constructor() {
        env.onDidChange(() => {
            this.update();
        });
        this.update();
    }

    private readonly _onDidChange = new vscode.EventEmitter<void>();
    private _fileWatcher?: vscode.FileSystemWatcher;

    public onDidChange = this._onDidChange.event;

    private update() {
        this._attrsCache = undefined;
        this._fileWatcher?.dispose();
        if (env.mapUri) {
            this._fileWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(env.mapUri, filePath)
            );
            this._fileWatcher.onDidChange(() => {
                this.update();
            });
            this._fileWatcher.onDidCreate(() => {
                this.update();
            });
            this._fileWatcher.onDidDelete(() => {
                this.update();
            });
        }

        this._onDidChange.fire();
    }

    private _attrsCache: Attr[] | undefined;

    private async loadAttrs() : Promise<Attr[]> {
        let attrs: Attr[] = [];
        try {
            if (!env.mapUri) {
                return attrs;
            }
            let jsonFile = await tools.readFile(env.mapUri, filePath);
            if (!jsonFile) {
                return attrs;
            }
            let json = JSON.parse(jsonFile.string);
            if (typeof json !== 'object') {
                return attrs;
            }
            if (!Array.isArray(json.c)) {
                return attrs;
            }
            for (let item of json.c) {
                let name = decodeURI(item.items?.[1]?.desc);
                let key  = item.items?.[1]?.key;
                if (name && key) {
                    attrs.push({name, key});
                }
            }
        } finally {
            return attrs;
        }
    }

    public async getAttrs(): Promise<Attr[]> {
        if (!this._attrsCache) {
            this._attrsCache = await this.loadAttrs();
        }
        return this._attrsCache;
    }
}
