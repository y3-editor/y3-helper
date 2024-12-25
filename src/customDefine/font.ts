import { BaseDefine } from "./baseDefine";
import { RelativePattern } from "vscode";
import * as tools from '../tools';
import * as y3 from 'y3-helper';

const fileName = 'font.json';

type Data = {
    uid: string,
    name: string,
};

export class Font extends BaseDefine {
    private cache;
    constructor() {
        super();

        this.cache = new tools.Cache(this.makeWords.bind(this), []);

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        if (!y3.env.projectUri) {
            return;
        }
        return new RelativePattern(y3.env.projectUri, fileName);
    }

    private async makeWords(): Promise<Data[]> {
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
    }

    public async get(): Promise<Data[]> {
        return await this.cache.get();
    }
}
