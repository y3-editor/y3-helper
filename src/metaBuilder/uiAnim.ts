import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`y3.const.UIAnimKey = y3.const.UIAnimKey or {}

%{UI_ANIM_KEYS}

---@enum(key, partial) y3.Const.UIAnimKey
local UIAnimKey = {
%{META_UI_ANIM_KEYS}
}
`;


export class UIAnim extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define().时间轴动画.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let anims = await define().时间轴动画.get();
        if (anims.length === 0) {
            return;
        }
        return template.replace('%{UI_ANIM_KEYS}', anims.map(anim => {
            return `y3.const.UIAnimKey["${anim.name}"] = "${anim.uid}"`;
        }).join('\r\n')).replace('%{META_UI_ANIM_KEYS}', anims.map(anim => {
            return `    ["${anim.name}"] = "${anim.uid}",`;
        }).join('\r\n'));
    }
}
