import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

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
        this.update();
        define().跳字.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let datas = await define().跳字.get();
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
