import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';
import { EditorTables } from "../customDefine/editorTables";

const template =
`---@enum(key, partial) y3.Const.%{NAME}
local %{NAME} = {
%{ATTR_ENUMS}
}

y3.util.tableMerge(y3.const.%{NAME}, %{NAME})
`;

export class EditorTablesBuilder extends BaseBuilder {
    constructor(path: string, name: string, define: EditorTables) {
        super(path);
        this.template = template.replaceAll('%{NAME}', name);
        this.define = define;
        this.update();
        this.define.onDidChange(() => {
            this.update();
        });
    }

    private template: string;
    private define: EditorTables;

    async make() {
        let attrs = await this.define.getAttrs();
        if (attrs.length === 0) {
            return;
        }
        return this.template.replace('%{ATTR_ENUMS}', attrs.map(attr => {
            return `    ["${attr.name}"] = "${attr.key}",`;
        }).join('\r\n'));
    }

}
