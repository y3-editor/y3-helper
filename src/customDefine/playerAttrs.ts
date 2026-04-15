import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';
import * as tools from '../tools';
import { BaseDefine } from "./baseDefine";

const filePath = 'campinfo.json';

type Attr = {
    name: string,
    key: string,
};

export class PlayerAttrs extends BaseDefine {
    private cache;
    constructor(map: y3.Map) {
        super(map);

        this.cache = new tools.Cache(this.loadAttrs.bind(this), []);
        
        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        if (!y3.env.projectUri) {
            return;
        }
        return new RelativePattern(y3.env.projectUri, filePath);
    }

    private async loadAttrs() {
        let attrs: Attr[] = [];
        if (!y3.env.projectUri) {
            return attrs;
        }
        let jsonFile = await tools.fs.readFile(y3.env.projectUri, filePath);
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
        return attrs;
    }

    public async getAttrs() {
        return await this.cache.get();
    }
}
