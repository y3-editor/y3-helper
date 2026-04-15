import { BaseDefine } from "./baseDefine";
import { RelativePattern } from "vscode";
import * as y3 from 'y3-helper';
import * as tools from '../tools';
import * as l10n from '@vscode/l10n';

const fileName = 'uianim.json';


const playMode = {
    0: l10n.t('保持'),
    1: l10n.t('常规'),
    2: l10n.t('往复'),
    3: l10n.t('循环'),
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
    private cache;
    constructor(map: y3.Map) {
        super(map);

        this.cache = new tools.Cache(this.makeAnims.bind(this), []);

        this.onDidChange(() => {
            this.cache.updateVersion();
        });
    }

    get watchPattern() {
        return new RelativePattern(this.map.triggerMapUri, fileName);
    }

    private async makeAnims(): Promise<Anim[]> {
        let file = await y3.fs.readFile(this.map.triggerMapUri, fileName);
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
    }

    public async get(): Promise<Anim[]> {
        return await this.cache.get();
    }
}
