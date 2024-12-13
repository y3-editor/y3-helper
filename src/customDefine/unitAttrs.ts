import { RelativePattern } from "vscode";
import { env } from "../env";
import { BaseDefine } from "./baseDefine";
import * as vscode from 'vscode';
import * as y3 from 'y3-helper';
import * as tools from '../tools';

const filePath = 'attr.json';

type Attr = {
    name: string,
    key: string,
};

export class UnitAttrs extends BaseDefine {
    private cache;
    constructor() {
        super();

        this.cache = new tools.Cache(this.loadAttrs.bind(this));

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

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
            let context = await vscode.workspace.fs.readFile(y3.uri(env.projectUri, filePath));
            let json = JSON.parse(context.toString());
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
        } catch (e) {
            y3.log.warn(`${filePath} 解析失败： ${e}`);
        } finally {
            return attrs;
        }
    }

    public async getAttrs() {
        return await this.cache.get();
    }
}
