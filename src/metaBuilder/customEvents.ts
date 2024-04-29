import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';

const template =
`---@class ECAHelper
%{FIELDS}

%{IMPLS}
`;

export class CustomEvents extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define.自定义事件.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let events = await define.自定义事件.getEvents();
        if (events.length === 0) {
            return;
        }
        return template
            .replace('%{FIELDS}', events.map(event => {
                let args = event.args.map((arg, index) => {
                    return `, v${index + 1}: ${arg.luaType}`;
                });
                return `---@field call fun(name: '${event.name}'${args.join('')})`;
            }).join('\r\n'))
            .replace('%{IMPLS}', events.map(event => {
                let args = event.args.map((arg, index) => {
                    return `, v${index + 1}`;
                });
                return `---@diagnostic disable-next-line: invisible
y3.eca.register_custom_event_impl('${event.name}', function (_${args.join('')})
    y3.game.send_custom_event(${event.id}, {
${event.args.map((arg, index) => {
    if (
        arg.luaType === "boolean" ||
        arg.luaType === "number" ||
        arg.luaType === "integer" ||
        arg.luaType === "string" ||
        arg.luaType === "table"
    ) {
        return `        ['${arg.name}'] = v${index + 1}`;
    } else {
        return `        ['${arg.name}'] = y3.py_converter.lua_to_py_by_lua_type('${arg.luaType}', v${index + 1})`;
    }
}).join(',\r\n')}
    })
end)`;
            }).join('\r\n\r\n'));
    }

}
