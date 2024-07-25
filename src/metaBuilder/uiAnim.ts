import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@enum(key, partial) y3.Const.UIAnimKey
local UIAnimKey = {
%{UI_ANIM_KEYS}
}

y3.util.tableMerge(y3.const.UIAnimKey or {}, UIAnimKey)
`;


export class UIAnim extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.时间轴动画.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let anims = await define.时间轴动画.get();
        if (anims.length === 0) {
            return;
        }
        return template.replace('%{UI_ANIM_KEYS}', anims.map(anim => {
            return `    ["${anim.name}"] = "${anim.uid}",`;
        }).join('\r\n'));
    }
}
