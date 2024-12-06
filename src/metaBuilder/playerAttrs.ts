import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`y3.const.PlayerAttr = y3.const.PlayerAttr or {}

%{ATTR_ENUMS}

---@enum(key, partial) y3.Const.PlayerAttr
local PlayerAttr = {
%{META_ATTR_ENUMS}
}
`;

export class PlayerAttrs extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define().玩家属性.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let attrs = await define().玩家属性.getAttrs();
        if (attrs.length === 0) {
            return;
        }
        return template.replace('%{ATTR_ENUMS}', attrs.map(attr => {
            return `y3.const.PlayerAttr["${attr.name}"] = "${attr.key}"`;
        }).join('\r\n')).replace('%{META_ATTR_ENUMS}', attrs.map(attr => {
            return `    ["${attr.name}"] = "${attr.key}",`;
        }).join('\r\n'));
    }

}
