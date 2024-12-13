import { BaseDefine } from "./baseDefine";
import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';
import * as tools from '../tools';

const fileName = 'jumpword.json';

type Word = {
    uid: string,
    name: string,
};

export class JumpWord extends BaseDefine {
    private cache;
    constructor() {
        super();

        this.cache = new tools.Cache(this.makeWords.bind(this));

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        if (!y3.env.mapUri) {
            return;
        }
        return new RelativePattern(y3.env.mapUri, fileName);
    }

    private async makeWords(): Promise<Word[]> {
        try {
            if (!y3.env.mapUri) {
                return [];
            }
            let file = await y3.fs.readFile(y3.env.mapUri, fileName);
            if (!file) {
                return [];
            }
            let json = JSON.parse(file.string);
            let words: Word[] = [];
            for (const uid in json) {
                let obj = json[uid];
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

    public async get(): Promise<Word[]> {
        return await this.cache.get();
    }
}
