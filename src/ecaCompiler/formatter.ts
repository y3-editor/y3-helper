import * as y3 from 'y3-helper';

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

type Rule = string | Record<number | string, string> | ((args?: string[]) => string);

class RuleHandler {
    constructor(public rule: Rule, public argNames?: string[]) {
        if (typeof rule !== 'string') {
            this._children = new Map();
        }
    }

    private _parts?: RulePart[];

    private _children?: Map<any, RuleHandler>;

    private compile(rule: string, args?: any[]) {
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
                    parts.push(OptionalStart);
                    continue;
                case '?>': 
                    parts.push(OptionalEnd);
                    continue;
                default: {
                    // 添加匹配项
                    const argName = match[0].slice(1, -1); // 去掉大括号
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

    private getRule(args?: any[]): RuleHandler {
        switch (typeof this.rule) {
            case 'string':
                return this;
            case 'function': {
                let newRule = this.rule(args);
                let children = this._children!.get(newRule);
                if (!children) {
                    children = new RuleHandler(newRule);
                    this._children!.set(newRule, children);
                }
                return children;
            }
            case 'object': {
                let rule = this.rule[args![0]];
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

    public format(args?: any[]) {
        let ruleHandler = this.getRule(args);
        return ruleHandler.make(args);
    }

    private make(args?: any[]) {
        if (!this._parts) {
            this.compile(this.rule as string, args);
        }
        return this._parts!.map((part) => {
            if (typeof part === 'number') {
                return args?.[part - 1] ?? 'nil';
            }
            if (part === OptionalStart || part === OptionalEnd) {
                return '';
            }
            return part;
        }).join('');
    }
}

let DefaultRuleHandler = new RuleHandler('{}');

export class Formatter {
    public rules = new Map<string | number, RuleHandler>();
    public setCallRule(name: string, rule: Rule, argNames?: string[]) {
        this.rules.set(name, new RuleHandler(rule, argNames));
    }

    public setValueRule(type: number, rule: Rule) {
        this.rules.set(type, new RuleHandler(rule));
    }

    public formatCall(name: string, args: string[]) {
        let rule = this.rules.get(name);
        if (!rule) {
            return name + '(' + args.join(', ') + ')';
        }
        return rule.format(args);
    }

    public formatValue(type: number, value: string | number | boolean | undefined) {
        let rule = this.rules.get(type);
        if (!rule) {
            return y3.lua.encode(value);
        }
        return rule.format([value]);
    }
}
