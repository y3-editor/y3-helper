import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@enum(key, partial) y3.Const.FloatTextJumpType
local jumpWords = {
%{JUMPWORDS}
}

y3.util.tableMerge(y3.const.FloatTextJumpType or {}, jumpWords)
`;


export class JumpWord extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.跳字.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let datas = await define.跳字.get();
        if (datas.length === 0) {
            return;
        }
        return template.replace('%{JUMPWORDS}', datas.map(data => {
            return `    ["${data.name}"] = ${data.uid},`;
        }).join('\r\n'));
    }
}
