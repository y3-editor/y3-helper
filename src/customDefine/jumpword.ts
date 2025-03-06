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
    constructor(private map: y3.Map) {
        super();

        this.cache = new tools.Cache(this.makeWords.bind(this), []);

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        return new RelativePattern(this.map.uri, fileName);
    }

    private async makeWords(): Promise<Word[]> {
        let file = await y3.fs.readFile(this.map.uri, fileName);
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
    }

    public async get(): Promise<Word[]> {
        return await this.cache.get();
    }
}
