import { define } from '../customDefine';
import { BaseBuilder } from './baseBuilder';
import * as y3 from 'y3-helper';
import * as vscode from 'vscode';

const l10n = vscode.l10n;

const eventName = '游戏-消息';

const template =
`---@class ECAHelper
%{FIELDS}

---@diagnostic disable: invisible

y3.eca = y3.eca or {}
y3.eca.register_custom_event_impl = y3.eca.register_custom_event_impl or function (name, impl) end
y3.eca.register_custom_event_resolve = y3.eca.register_custom_event_resolve or function (name, resolve) end

%{IMPLS}

y3.const.CustomEventName = y3.const.CustomEventName or {}

%{KV}

---@enum(key, partial) y3.Const.CustomEventName
local CustomEventName = {
%{TABLE_FIELDS}
}

%{RESOLVE}

%{ALIAS}

---@class Game
%{CLASS_FIELDS}
`;

function isBasicType(luaType: string) {
    return luaType === 'boolean' || luaType === 'number' || luaType === 'integer' || luaType === 'string' || luaType === 'table';
}

export class CustomEvents extends BaseBuilder {
    constructor(path: string) {
        super(path);
        this.update();
        define().自定义事件.onDidChange(() => {
            this.update();
        });
    }

    async make() {
        let events = await define().自定义事件.getEvents();
        if (events.length === 0) {
            return;
        }
        return template
            .replace('%{FIELDS}', events.map(event => {
                let args = event.args.map((arg, index) => {
                    return `, ${y3.lua.getValidName(arg.name)}: ${arg.luaType}`;
                });
                return `---@field call fun(name: '${event.name}'${args.join('')})`;
            }).join('\r\n'))
            .replace('%{IMPLS}', events.map(event => {
                let args = event.args.map((arg, index) => {
                    return `, ${y3.lua.getValidName(arg.name)}`;
                });
                return `y3.eca.register_custom_event_impl('${event.name}', function (_${args.join('')})
    y3.game.send_custom_event(${event.id}, {
${event.args.map((arg, index) => {
    if (isBasicType(arg.luaType)) {
        return `        [${y3.lua.encode(arg.name)}] = ${y3.lua.getValidName(arg.name)}`;
    } else {
        return `        [${y3.lua.encode(arg.name)}] = y3.py_converter.lua_to_py_by_lua_type('${arg.luaType}', ${y3.lua.getValidName(arg.name)})`;
    }
}).join(',\r\n')}
    })
end)`;
            }).join('\r\n\r\n'))
            .replace('%{KV}', events.map(event => {
                return `y3.const.CustomEventName['${event.name}'] = ${event.id}`;
            }).join('\r\n'))
            .replace('%{TABLE_FIELDS}', events.map(event => {
                return `    ['${event.name}'] = ${event.id},`;
            }).join('\r\n'))
            .replace('%{RESOLVE}', events.map(event => {
                return `y3.eca.register_custom_event_resolve(${y3.lua.encode(event.name)}, function (data)\r\n`
                    +  `    data.name = ${y3.lua.encode(event.name)}\r\n`
                    +  `    data.data = {\r\n`
                    +  event.args.map((arg) => {
                        if (isBasicType(arg.luaType)) {
                            return `        [${y3.lua.encode(arg.name)}] = data.c_param_dict[${y3.lua.encode(arg.name)}],`;
                        } else {
                            return `        [${y3.lua.encode(arg.name)}] = y3.py_converter.py_to_lua_by_lua_type('${arg.luaType}', data.c_param_dict[${y3.lua.encode(arg.name)}]),`;
                        }
                    }).join('\r\n')
                    +  `\r\n    }\r\n`
                    +  `    return data\r\n`
                    +  `end)`;
            }).join('\r\n'))
            .replace('%{ALIAS}', events.map(event => {
                return `---@alias EventParam.${eventName}.${y3.lua.getValidName(event.name)} { ${[
                    `c_param_1: ${event.id}`,
                    'c_param_dict: py.Dict',
                    `event: ${y3.lua.encode(event.name)}`,
                    `data: { ${event.args.map((arg) => {
                        return `[${y3.lua.encode(arg.name)}]: ${arg.luaType}`; 
                    }).join(', ')} }`
                ].join(', ')} }`;
            }).join('\r\n'))
            .replace('%{CLASS_FIELDS}', events.map(event => {
                return '---@diagnostic disable-next-line: duplicate-doc-field\r\n'
                    +  `---@field event fun(self: Game, event: "${eventName}", event_id: ${y3.lua.encode(event.name)}, callback: fun(trigger: Trigger, data: EventParam.${eventName}.${y3.lua.getValidName(event.name)}))`;
            }).join('\r\n'));
    }

}
