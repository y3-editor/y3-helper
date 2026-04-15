import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';
import * as y3 from 'y3-helper';

const template =
`y3.const.FloatTextJumpType = y3.const.FloatTextJumpType or {}

%{JUMPWORDS}

---@enum(key, partial) y3.Const.FloatTextJumpType
local FloatTextJumpType = {
%{META_JUMPWORDS}
}
`;


export class JumpWord extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
    }

    initMap(map: y3.Map) {
        define(map).跳字.onDidChange(() => {
            this.updateMap(map);
        });
    }

    async make(map: y3.Map) {
        let datas = await define(map).跳字.get();
        if (datas.length === 0) {
            return;
        }
        return template.replace('%{JUMPWORDS}', datas.map(data => {
            return `y3.const.FloatTextJumpType["${data.name}"] = ${data.uid}`;
        }).join('\r\n')).replace('%{META_JUMPWORDS}', datas.map(data => {
            return `    ["${data.name}"] = ${data.uid},`;
        }).join('\r\n'));
    }
}
