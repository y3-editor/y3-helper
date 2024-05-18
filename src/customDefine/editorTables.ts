import { RelativePattern } from "vscode";
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";
import * as vscode from 'vscode';

type Attr = {
    name: string,
    key: string,
};

export class EditorTables extends BaseDefine {
    constructor(filePath: string) {
        super();
        this.filePath = filePath
        this.onDidChange(() => {
            this._attrsCache = undefined;
        });
    }

    public filePath: string
    private _attrsCache?: Attr[];

    get watchPattern() {
        if (!env.mapUri) {
            return;
        }
        return new RelativePattern(env.mapUri, this.filePath);
    }

    private async loadAttrs() {
        let attrs: Attr[] = [];
        try {
            if (!env.mapUri || !env.editorTableUri) {
                return attrs;
            }

            let files = await vscode.workspace.fs.readDirectory(vscode.Uri.joinPath(env.editorTableUri, this.filePath))
            for (const file of files) {
                if (file[1] === vscode.FileType.File) {
                    let jsonFile = await tools.readFile(env.editorTableUri, this.filePath + "/" + file[0]);
                    console.log(env.editorTableUri, file[0])
                    if (!jsonFile) {
                        break
                    }
                    let json = JSON.parse(jsonFile.string);
                    if (typeof json !== 'object') {
                        break
                    }
                    let name = env.languageJson[json.name]
                    let key = json.uid
                    if (name && key) {
                        name =
                            attrs.push({ name, key });
                    }
                }
            }

            return attrs

        } finally {
            return attrs;
        }
    }

    public async getAttrs() {
        if (!this._attrsCache) {
            this._attrsCache = await this.loadAttrs();
        }
        return this._attrsCache;
    }
}
