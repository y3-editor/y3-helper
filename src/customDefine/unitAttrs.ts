import { RelativePattern } from "vscode";
import { env } from "../env";
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";

const filePath = 'attr.json';

type Attr = {
    name: string,
    key: string,
};

export class UnitAttrs extends BaseDefine {
    constructor() {
        super();

        this.onDidChange(() => {
            this._attrsCache = undefined;
        });
    }

    private _attrsCache?: Attr[];

    get watchPattern() {
        if (!env.mapUri) {
            return;
        }
        return new RelativePattern(env.mapUri, filePath);
    }

    private async loadAttrs() {
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
            let mark: Set<string> = new Set();
            // 自定义单位属性
            if (Array.isArray(json.c)) {
                for (let item of json.c) {
                    let name = item.items?.[1]?.desc;
                    let key  = item.items?.[1]?.key;
                    if (name && key && !mark.has(key)) {
                        attrs.push({name, key});
                        mark.add(key);
                    }
                }
            }
            // 复合属性
            if (Array.isArray(json.p)) {
                for (let item of json.p) {
                    let name = item.items?.[1]?.d;
                    let key  = item.items?.[1]?.k;
                    if (name && key && !mark.has(key)) {
                        attrs.push({name, key});
                        mark.add(key);
                    }
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
