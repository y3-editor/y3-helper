import { BaseDefine } from "./baseDefine";
import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';

const fileName = 'uianim.json';

const playMode = {
    0: '保持',
    1: '常规',
    2: '往复',
    3: '循环',
} as const;

type PlayMode = typeof playMode;

type Anim = {
    name: string,
    uid: string,
    group: string,
    // 帧率
    frame: number,
    maxFrame: number,
    playMode: PlayMode[keyof PlayMode],
};

export class UIAnim extends BaseDefine {
    private _cache?: Anim[];
    constructor() {
        super();

        this.onDidChange(() => {
            this._cache = undefined;
        });
    }

    get watchPattern() {
        if (!y3.env.mapUri) {
            return;
        }
        return new RelativePattern(y3.env.mapUri, fileName);
    }

    private async makeAnims(): Promise<Anim[]> {
        try {
            if (!y3.env.mapUri) {
                return [];
            }
            let file = await y3.fs.readFile(y3.env.mapUri, fileName);
            if (!file) {
                return [];
            }
            let json = JSON.parse(file.string);
            let anims: Anim[] = [];
            for (const uid in json) {
                let obj = json[uid];
                anims.push({
                    name: obj.anim_name,
                    uid: uid,
                    group: obj.group,
                    frame: obj.f_rt,
                    maxFrame: obj.max_frame,
                    playMode: (playMode as any)[obj.play_mode],
                });
            }
            return anims;
        } catch {
            return [];
        }
    }

    public async get(): Promise<Anim[]> {
        return this._cache ??= await this.makeAnims();
    }
}
