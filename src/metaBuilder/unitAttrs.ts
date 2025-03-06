import * as y3 from 'y3-helper';
import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`y3.const.UnitAttr = y3.const.UnitAttr or {}

%{ATTR_ENUMS}

---@enum(key, partial) y3.Const.UnitAttr
---@diagnostic disable-next-line: inject-field
y3.const.CustomUnitAttr = {
%{META_ATTR_ENUMS}
}
`;

export class UnitAttrs extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
    }

    protected initMap(map: y3.Map): void {
        define(map).单位属性.onDidChange(() => {
            this.updateMap(map);
        });
    }

    async make(map: y3.Map) {
        let attrs = await define(map).单位属性.getAttrs();
        if (attrs.length === 0) {
            return;
        }
        return template.replace('%{ATTR_ENUMS}', attrs.map(attr => {
            return `y3.const.UnitAttr["${attr.name}"] = "${attr.key}"`;
        }).join('\r\n')).replace('%{META_ATTR_ENUMS}', attrs.map(attr => {
            return `    ["${attr.name}"] = "${attr.key}",`;
        }).join('\r\n'));
    }
}
