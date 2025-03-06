import { define } from "../customDefine";
import { BaseBuilder } from "./baseBuilder";
import * as y3 from 'y3-helper';

const template = `
declare interface MapUnit {
%{UNIT_ATTRS}
}
`;

export class TS extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.updateAll();
    }

    protected initMap(map: y3.Map): void {
        define(map).单位属性.onDidChange(() => {
            this.updateMap(map);
        });
    }

    override async isValid(): Promise<boolean> {
        return await y3.plugin.hasInited();
    }

    async make(map: y3.Map): Promise<string | undefined> {
        let attrs = await define(map).单位属性.getAttrs();
        return template.replace('%{UNIT_ATTRS}', attrs.map(attr => {
            return `    ${JSON.stringify(attr.name)}: number,`;
        }).join('\r\n'));
    }
}
