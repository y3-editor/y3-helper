import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@enum(key, partial) y3.Const.FloatTextType
local fonts = {
%{FONTS}
}

y3.util.tableMerge(y3.const.FloatTextType or {}, fonts)
`;


export class Font extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.字体.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let datas = await define.字体.get();
        if (datas.length === 0) {
            return;
        }
        return template.replace('%{FONTS}', datas.map(data => {
            return `    ["${data.name}"] = "${data.uid}",`;
        }).join('\r\n'));
    }
}
