import { BaseDefine } from "./baseDefine";
import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';

const fileName = 'font.json';

type Data = {
    uid: string,
    name: string,
};

export class Font extends BaseDefine {
    private _cache?: Data[];
    constructor() {
        super();

        this.onDidChange(() => {
            this._cache = undefined;
        });
    }

    get watchPattern() {
        if (!y3.env.projectUri) {
            return;
        }
        return new RelativePattern(y3.env.projectUri, fileName);
    }

    private async makeWords(): Promise<Data[]> {
        try {
            if (!y3.env.projectUri) {
                return [];
            }
            let file = await y3.fs.readFile(y3.env.projectUri, fileName);
            if (!file) {
                return [];
            }
            let json = JSON.parse(file.string);
            let words: Data[] = [];
            for (const uid in json) {
                let obj = json[uid];
                if (!obj.name || obj.is_official) {
                    continue;
                }
                words.push({
                    uid: uid,
                    name: obj.name,
                });
            }
            return words;
        } catch {
            return [];
        }
    }

    public async get(): Promise<Data[]> {
        return this._cache ??= await this.makeWords();
    }
}
