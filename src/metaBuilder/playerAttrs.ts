import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@diagnostic disable-next-line: duplicate-doc-alias
---@enum(key) y3.Const.PlayerAttr
local PlayerAttr = {
%{ATTR_ENUMS}
}

y3.util.tableMerge(y3.const.PlayerAttr, PlayerAttr)
`;

export class PlayerAttrs extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.玩家属性.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let attrs = await define.玩家属性.getAttrs();
        if (attrs.length === 0) {
            return;
        }
        return template.replace('%{ATTR_ENUMS}', attrs.map(attr => {
            return `    ["${attr.name}"] = "${attr.key}",`;
        }).join('\r\n'));
    }

}
