import { define } from "../customDefine";
import { BaseBuilder } from "./baseBuilder";
import * as y3 from 'y3-helper';

const template = `// 自动生成的代码，请勿修改
declare interface MapUnit {
%{UNIT_ATTRS}
}
`;

export class TS extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define().单位属性.onDidChange(() => {
            this.update();
        });
    }

    override async isValid(): Promise<boolean> {
        return await y3.plugin.hasInited();
    }

    async make(): Promise<string | undefined> {
        let attrs = await define().单位属性.getAttrs();
        return template.replace('%{UNIT_ATTRS}', attrs.map(attr => {
            return `    ${JSON.stringify(attr.name)}: number,`;
        }).join('\r\n'));
    }
}
