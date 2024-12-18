import * as y3 from 'y3-helper';
import { Node, Trigger, Value } from './compiler';

/*
CreateUnit({1}, {2}, {3})
CreateUnit({}, {}, {}) -> CreateUnit({1}, {2}, {3})
CreateUnit({a}, {b}, {c}) + argNames:['a', 'b', 'c'] -> CreateUnit({1}, {2}, {3})
Damage {
    x = {1},
    <?y = {2},?> // 内部必须有值才生成；另外如果整行都变成了空行，那就删掉这行
    z = {3},
}
*/

const OptionalStart = Symbol('OptionalStart');
const OptionalEnd = Symbol('OptionalEnd');

type RulePart = string | number | typeof OptionalStart | typeof OptionalEnd;

type Rule = string | Record<number | string, string> | ((node: Node) => string) | null;

interface OptionalGaurd {
    start: number;
    hasValue: boolean;
}

class RuleHandler {
    constructor(public rule: Rule, public argNames?: string[]) {
        if (typeof rule !== 'string') {
            this._children = new Map();
        }
    }

    private _parts?: RulePart[];

    private _children?: Map<any, RuleHandler>;

    private compile(rule: string) {
        const regex = /\{[^\{\}]*\}|\<\?|\?\>/g;
        let match;
        let lastIndex = 0;
        let curDefault = 1;
        let parts: RulePart[] = [];

        while ((match = regex.exec(rule)) !== null) {
            // 捕获匹配项的位置
            const matchStart = match.index;
            const matchEnd = regex.lastIndex;

            // 添加前面的静态部分
            if (matchStart > lastIndex) {
                parts.push(rule.slice(lastIndex, matchStart));
            }

            lastIndex = matchEnd;

            switch (match[0]) {
                case '<?':
                    let last = parts[parts.length - 1];
                    if (typeof last === 'string' && last?.endsWith('  ')) {
                        parts.push('  ');
                    }
                    parts.push(OptionalStart);
                    continue;
                case '?>': 
                    parts.push(OptionalEnd);
                    continue;
                default: {
                    // 添加匹配项
                    let argName = match[0].slice(1, -1); // 去掉大括号
                    if (argName === '') {
                        parts.push(curDefault);
                        curDefault++;
                        continue;
                    }
                    const index = Number(match[0]);
                    if (!isNaN(index)) {
                        parts.push(index);
                        continue;
                    }
                    const argIndex = this.argNames?.indexOf(argName);
                    if (argIndex !== undefined && argIndex !== -1) {
                        parts.push(argIndex + 1); // 参数索引从1开始
                    } else {
                        parts.push(match[0]);
                    }
                }
            }

        }

        // 添加最后的静态部分
        if (lastIndex < rule.length) {
            parts.push(rule.slice(lastIndex));
        }

        this._parts = parts;
    }

    private getRule(formatter: Formatter, node: Node): RuleHandler {
        switch (typeof this.rule) {
            case 'string':
                return this;
            case 'function': {
                let newRule = this.rule(node);
                let children = this._children!.get(newRule);
                if (!children) {
                    children = new RuleHandler(newRule);
                    this._children!.set(newRule, children);
                }
                return children;
            }
            case 'object': {
                if (this.rule === null) {
                    return NilRuleHandler;
                }
                if (!('value' in node)) {
                    return DefaultRuleHandler;
                }
                let rule = this.rule[String(node.value)];
                if (!rule) {
                    return DefaultRuleHandler;
                }
                let children = this._children!.get(rule);
                if (!children) {
                    children = new RuleHandler(rule);
                    this._children!.set(rule, children);
                }
                return children;
            }
            default:
                throw new Error('Unknown rule type' + String(this.rule));
        }
    }

    public format(formatter: Formatter, node: Node) {
        let ruleHandler = this.getRule(formatter, node);
        return ruleHandler.make(formatter, node);
    }

    private make(formatter: Formatter, node: Node) {
        if (!this._parts) {
            this.compile(this.rule as string);
        }
        let i;
        let buf: string[] = [];
        let optionalGaurd: OptionalGaurd | undefined;
        for (i = 0;i < this._parts!.length;i++) {
            let part = this._parts![i];
            if (typeof part === 'number') {
                if ('args' in node) {
                    let value = node.args?.[part - 1];
                    if (value) {
                        if (optionalGaurd) {
                            optionalGaurd.hasValue = true;
                        }
                        buf.push(value.make(formatter));
                    } else {
                        buf.push('nil');
                    }
                }
            } else if (typeof part === 'string') {
                buf.push(part);
            } else if (part === OptionalStart) {
                optionalGaurd = {
                    start: buf.length,
                    hasValue: false,
                };
            } else if (part === OptionalEnd) {
                if (optionalGaurd && !optionalGaurd.hasValue) {
                    buf.splice(optionalGaurd.start, buf.length - optionalGaurd.start);
                    this.clearLastEmptyLine(buf);
                }
                optionalGaurd = undefined;
            }
        };
        return buf.join('');
    }

    private clearLastEmptyLine(buf: string[]) {
        for (let i = buf.length - 1; i >= 0; i--) {
            if (buf[i].match(/^[ ]*$/)) {
                buf.length = i;
                continue;
            }
            let newLine = buf[i].match(/[\r\n]+[ ]*$/);
            if (newLine) {
                if (newLine.index === 0) {
                    buf.length = i;
                    continue;
                }
                buf[i] = buf[i].slice(0, newLine.index);
            }
            break;
        }
    }
}

let DefaultRuleHandler = new RuleHandler('{}');
let NilRuleHandler = new RuleHandler('nil');

export class Formatter {
    public rules = new Map<string | number, RuleHandler>();
    public eventInfo: Record<string, { key: string, name: string }> = {};
    public setRule(name: string | number, rule: Rule, argNames?: string[]) {
        this.rules.set(name, new RuleHandler(rule, argNames));
        return this;
    }

    public formatCall(name: string, node: Node) {
        let rule = this.rules.get(name);
        if (!rule) {
            return name + '(' + (node.makeArgs(this)?.join(', ') ?? '') + ')';
        }
        return rule.format(this, node);
    }

    public formatEvent(name: string, node: Node) {
        let rule = this.rules.get(name);
        let str = rule?.format(this, node) ?? name;
        return str;
    }

    public formatValue(type: number, node: Value) {
        let rule = this.rules.get(type);
        if (!rule) {
            return y3.lua.encode(node.value);
        }
        return rule.format(this, node);
    }

    private makeActionPart(trg: Trigger): string {
        return trg.actions.map((action) => action.make(this)).join('\n');
    }

    private makeVariablePart(trg: Trigger): string {
        return trg.variables.map((variable) => {
            const name = variable.make(this);
            const value = y3.lua.encode(variable.value);
            if (variable.isArray) {
                return `local ${name} = y3.eca_rt.array(${value})`;
            } else {
                return `local ${name} = ${value}`;
            }
        }).join('\n');
    }

    private makeConditionPart(trg: Trigger): string {
        return trg.conditions.map((condition) => `not ${condition.make(this)}`).join('\nor ');
    }
    private makeBody(trg: Trigger): string {
        let result = '';
        if (trg.conditions.length > 0) {
            result += `if ${this.makeConditionPart(trg)}`;
            result += ` then\n`;
            result += `    return\n`;
            result += `end\n`;
        }
        if (trg.variables.length > 0) {
            result += `${this.makeVariablePart(trg)}\n`;
        }
        if (trg.actions.length > 0) {
            result += `${this.makeActionPart(trg)}`;
        }
        return result;
    }
    
    public formatTrigger(trg: Trigger) {
            if (!trg.enabled) {
                return `-- 子函数 ${trg.name} 已禁用`;
            }
            let result = '';
            if (trg.events.length === 1) {
                result += `y3.game:event(${trg.events[0].make(this)}, function(_, params)\n`;
                result += this.increaseTab(this.makeBody(trg));
                result += `end)`;
            } else {
                if (trg.events.length > 1) {
                    let types = [];
                    for (let event of trg.events) {
                        let cnName = this.eventInfo[event.name]?.name;
                        if (cnName) {
                            types.push(`EventParam.` + cnName);
                        }
                    }
                    result += `---@param params ${types.join('|')}\n`;
                }
                result += `local function action(_, params)\n`;
                result += this.increaseTab(this.makeBody(trg));
                result += `\nend\n\n`;
                for (let event of trg.events) {
                    result += `y3.game:event(${event.make(this)}, action)\n`;
                }
            }
            return result;
    }

    public increaseTab(content: string, tab: string = '    '): string {
        return content.split('\n').map((line) => tab + line).join('\n');
    }
}
