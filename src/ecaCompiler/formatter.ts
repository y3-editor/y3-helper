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

class Rule {
    constructor(public rule: string, public argNames?: string[]) { }

    private _parts?: RulePart[];

    private compile() {
        const regex = /\{[^\{\}]*\}|\<\?|\?\>/g;
        let match;
        let lastIndex = 0;
        let curDefault = 1;
        let parts: RulePart[] = [];

        while ((match = regex.exec(this.rule)) !== null) {
            // 捕获匹配项的位置
            const matchStart = match.index;
            const matchEnd = regex.lastIndex;

            // 添加前面的静态部分
            if (matchStart > lastIndex) {
                parts.push(this.rule.slice(lastIndex, matchStart));
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
        if (lastIndex < this.rule.length) {
            parts.push(this.rule.slice(lastIndex));
        }

        this._parts = parts;
    }

    public format(args?: string[]) {
        if (!this._parts) {
            this.compile();
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

export class Formatter {
    public rules = new Map<string, Rule>();
    public setCallRule(name: string, rule: string, argNames?: string[]) {
        this.rules.set(name, new Rule(rule, argNames));
    }

    public setValueRule(type: number, rule: string) {
        let name = '$' + String(type);
        this.rules.set(name, new Rule(rule));
    }

    public formatCall(name: string, args: string[]) {
        let rule = this.rules.get(name);
        if (!rule) {
            return name + '(' + args.join(', ') + ')';
        }
        return rule.format(args);
    }

    public formatValue(type: number, value: string | number | boolean | undefined) {
        let name = '$' + String(type);
        let rule = this.rules.get(name);
        if (!rule) {
            return y3.lua.encode(value);
        }
        return rule.format([y3.lua.encode(value)]);
    }
}
