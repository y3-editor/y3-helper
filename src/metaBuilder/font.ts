import * as y3 from 'y3-helper';
import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`y3.const.FloatTextType = y3.const.FloatTextType or {}

%{FONTS}

---@enum(key, partial) y3.Const.FloatTextType
local FloatTextType = {
%{META_FONTS}
}
`;


export class Font extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
    }

    protected initMap(map: y3.Map): void {
        define(map).字体.onDidChange(() => {
            this.updateMap(map);
        });
    }

    async make(map: y3.Map) {
        let datas = await define(map).字体.get();
        if (datas.length === 0) {
            return;
        }
        return template.replace('%{FONTS}', datas.map(data => {
            return `y3.const.FloatTextType["${data.name}"] = "${data.uid}"`;
        }).join('\r\n')).replace('%{META_FONTS}', datas.map(data => {
            return `    ["${data.name}"] = "${data.uid}",`;
        }).join('\r\n'));
    }
}
