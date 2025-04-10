import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';
import * as y3 from 'y3-helper';

const template =
`y3.const.PlayerAttr = y3.const.PlayerAttr or {}

%{ATTR_ENUMS}

---@enum(key, partial) y3.Const.PlayerAttr
---@diagnostic disable-next-line: inject-field
y3.const.CustomPlayerAttr = {
%{META_ATTR_ENUMS}
}
`;

export class PlayerAttrs extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
    }

    initMap(map: y3.Map) {
        define(map).玩家属性.onDidChange(() => {
            this.updateMap(map);
        });
    }

    async make(map: y3.Map) {
        let attrs = await define(map).玩家属性.getAttrs();
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
