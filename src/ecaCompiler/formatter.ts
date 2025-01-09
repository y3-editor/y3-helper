import * as y3 from 'y3-helper';
import { Node, Trigger, Function, Value, Variable } from './compiler';

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
        const regex = /\{[^\{\}]*\}|\<\?|\?\>|%/g;
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
                case '%':
                    parts.push(rule.slice(lastIndex, lastIndex + 1));
                    lastIndex++;
                    regex.lastIndex = lastIndex;
                    continue;
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
                let value = node.args?.[part - 1];
                if (value) {
                    if (optionalGaurd) {
                        optionalGaurd.hasValue = true;
                    }
                    buf.push(value.make(formatter));
                } else if (node instanceof Value && part === 1) {
                    buf.push(y3.lua.encode(node.value));
                } else {
                    buf.push('nil');
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
        if (rule) {
            return rule.format(this, node);
        }
        let args = node.makeArgs(this)?.join(', ') ?? '';
        let funcName = this.getFuncName(name);
        if (funcName) {
            return `Func[${y3.lua.encode(funcName)}](${args})`;
        }
        return `${name}(${args})`;
    }

    public formatEvent(name: string, node: Node) {
        let rule = this.rules.get(name);
        let str = rule?.format(this, node) ?? name;
        return str;
    }

    public formatValue(type: number | string, node: Value) {
        let rule = this.rules.get(type);
        if (!rule) {
            return y3.lua.encode(node.value);
        }
        return rule.format(this, node);
    }

    private makeActionPart(trg: Trigger | Function): string {
        return trg.actions.map((action) => action.make(this)).join('\n');
    }

    public getVariableName(name: string, isGlobal = false) {
        return y3.lua.getValidName((isGlobal ? 'V_' : 'v_') + name);
    }

    public getVariableInitValue(variable: Variable): string {
        const value = this.formatValue(variable.type, variable.value);
        if (variable.isArray) {
            if (value === 'nil') {
                return `y3.eca_rt.array()`;
            } else if (value === '""') {
                return `y3.eca_rt.array("")`;
            } else if ((value === '0' || value === '-1') && variable.type !== 'INTEGER') {
                return `y3.eca_rt.array()`;
            } else if (variable.type === 'BOOLEAN' || variable.type === 'FLOAT' || variable.type === 'INTEGER') {
                return `y3.eca_rt.array(${value})`;
            } else {
                return `y3.eca_rt.array(${y3.lua.encode(value)})`;
            }
        } else {
            return `${value}`;
        }
    }

    private makeVariablePart(trg: Trigger | Function): string | undefined {
        let results = [];

        function getParam(name: string) {
            if (!(trg instanceof Function)) {
                return undefined;
            }
            let param = trg.params.find((param) => param.name === name);
            return param;
        }
        
        for (let variable of trg.variables) {
            let param = getParam(variable.name);
            if (param) {
                if (param.required) {
                    continue;
                } else {
                    results.push(`if ${this.getVariableName(variable.name)} == nil then ${this.getVariableName(variable.name)} = ${this.getVariableInitValue(variable)} end`);
                }
            } else {
                results.push(`local ${this.getVariableName(variable.name)} = ${this.getVariableInitValue(variable)}`);
            }
        }

        if (results.length === 0) {
            return undefined;
        }

        return results.join('\n') + '\n';
    }

    private makeConditionPart(trg: Trigger): string {
        return trg.conditions.map((condition) => `not ${condition.make(this)}`).join('\nor ');
    }
    private makeBody(trg: Trigger | Function): string {
        let result = '';
        if ('conditions' in trg && trg.conditions.length > 0) {
            result += `if ${this.makeConditionPart(trg)}`;
            result += ` then\n`;
            result += `    return\n`;
            result += `end\n`;
        }

        result += this.makeVariablePart(trg) ?? '';

        if (trg.actions.length > 0) {
            result += `${this.makeActionPart(trg)}`;
        }
        return result;
    }
    
    public formatTrigger(trg: Trigger) {
            if (!trg.enabled) {
                return `-- 触发器 ${trg.name} 已禁用`;
            }
            let group = trg.eca.group;
            let eventTarget = group
                ? `y3.object.${y3.consts.Table.runtime.fromCN[group.objectType]}[${trg.groupID}]`
                : 'y3.game';
            let result = '';
            if (trg.events.length === 1) {
                result += `${eventTarget}:event(${trg.events[0].make(this)}, function(_, params)\n`;
                result += this.increaseTab(this.makeBody(trg));
                result += `\nend)`;
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
                    result += `${eventTarget}:event(${event.make(this)}, action)\n`;
                }
            }
            return result;
    }

    public formatFunction(func: Function) {
        let result = '';
        if (!func.enabled) {
            result += `-- 函数 ${func.name} 已禁用\n`;
            result += `Func[${y3.lua.encode(func.name)}] = function (...) end`;
            return result;
        }
        const params = func.params.map((param) => this.getVariableName(param.name)).join(', ');
        result += `Func[${y3.lua.encode(func.name)}] = function (${params})\n`;
        result += this.increaseTab(this.makeBody(func));
        result += `\nend`;
        return result;
    }

    private funcNameRecord: Record<string, string> = {};

    public setFuncName(id: string, name: string) {
        this.funcNameRecord[id] = name;
    }

    public getFuncName(id: string) {
        return this.funcNameRecord[id];
    }

    public increaseTab(content: string, tab: string = '    '): string {
        return content.split('\n').map((line) => tab + line).join('\n');
    }

    private ensureEndWithNL(content: string): string {
        return content.endsWith('\n') ? content : content + '\n';
    }

    private ensureNLisCRLF(content: string): string {
        // 只替换单独的 \n，不替换 \r\n
        return content.replace(/\n/g, '\r\n');
    }

    public asFileContent(content: string): string {
        content = this.ensureEndWithNL(content);
        content = this.ensureNLisCRLF(content);
        return content;
    }
}
