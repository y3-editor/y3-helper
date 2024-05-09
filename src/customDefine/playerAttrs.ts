import { RelativePattern } from "vscode";
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";

const filePath = 'campinfo.json';

type Attr = {
    name: string,
    key: string,
};

export class PlayerAttrs extends BaseDefine {
    constructor() {
        super();

        this.onDidChange(() => {
            this._attrsCache = undefined;
        });
    }

    private _attrsCache?: Attr[];

    get watchPattern() {
        if (!env.projectUri) {
            return;
        }
        return new RelativePattern(env.projectUri, filePath);
    }

    private async loadAttrs() {
        let attrs: Attr[] = [];
        try {
            if (!env.projectUri) {
                return attrs;
            }
            let jsonFile = await tools.readFile(env.projectUri, filePath);
            if (!jsonFile) {
                return attrs;
            }
            let json = JSON.parse(jsonFile.string);
            if (typeof json !== 'object') {
                return attrs;
            }
            if (!Array.isArray(json.role_res_types)) {
                return attrs;
            }
            for (let item of json.role_res_types) {
                let name = item.items?.[1]?.name;
                let key  = item.items?.[1]?.key;
                if (name && key) {
                    attrs.push({name, key});
                }
            }
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
