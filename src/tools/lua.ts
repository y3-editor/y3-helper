const encodeOptions = {
    newline: '\n',
    indent: '    ',
    depth: 0,
} as const;

class Encoder {
    private buffer: string[] = [];
    public newline = encodeOptions.newline;
    public indent = encodeOptions.indent;
    public depth = 0;
    
    constructor() {}

    public encode(jsObject: any) {
        this.buffer = [];

        this.encodeValue(jsObject);

        return this.buffer.join("");
    }

    private encodeValue(value: any) {
        switch (value) {
            case undefined:
                this.encodeUndefined();
                return;
            case null:
                this.encodeNull();
                return;
            case true:
                this.encodeTrue();
                return;
            case false:
                this.encodeFalse();
                return;
        }

        switch (typeof value) {
            case 'string':
                this.encodeString(value);
                return;
            case 'number':
                this.encodeNumber(value);
                return;
            case 'object':
                this.encodeObject(value);
                return;
        }

        this.encodeString(String(value));
    }

    private encodeUndefined() {
        this.buffer.push('nil');
    }

    private encodeNull() {
        this.buffer.push('nil');
    }

    private encodeTrue() {
        this.buffer.push('true');
    }

    private encodeFalse() {
        this.buffer.push('false');
    }

    private encodeString(value: string) {
        // 字符串中换行符的数量
        let nlNum = value.match('\n')?.length ?? 0;
        // 字符串中控制字符和不可见字符的数量，但不包括制表符、换行符
        let ccNum = value.match(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/)?.length ?? 0;
        if (ccNum <= nlNum && nlNum > 0) {
            this.encodeLongString(value);
        } else {
            this.encodeShortString(value);
        }
    }

    private encodeLongString(value: string) {
        let end = ']]';
        while (value.includes(end)) {
            end = end.slice(0, -2) + '=]';
        }
        let start = '[' + end.slice(1, -2) + '[';
        this.buffer.push(start, this.newline, value, end);
    }

    private encodeShortString(value: string) {
        let singleNum = value.match(/'/)?.length ?? 0;
        let doubleNum = value.match(/"/)?.length ?? 0;
        let delim = doubleNum > singleNum ? "'" : '"';

        let reg = new RegExp(`[${delim}\\\x00-\x08\x0B-\x1F\x7F-\x9F]`, 'g');
        value = value.replaceAll(reg, (match) => {
            if (match === delim || match === '\\') {
                return '\\' + delim;
            } else {
                return `\\x${match.charCodeAt(0).toString(16).padStart(2, '0')}`;
            }
        });
        this.buffer.push(delim, value, delim);
    }

    private encodeNumber(value: number) {
        if (Number.isInteger(value)) {
            this.buffer.push(value.toString());
        } else if (value === Infinity) {
            this.buffer.push('1/0');
        } else if (value === -Infinity) {
            this.buffer.push('-1/0');
        } else if (Number.isNaN(value)) {
            this.buffer.push('0/0');
        } else {
            let str = value.toString();
            if (!str.includes('.') && !str.includes('e')) {
                str += '.0';
            }
            this.buffer.push(str);
        }
    }

    private encodeArray(value: any[]) {
        if (value.length === 0) {
            this.buffer.push('{}');
        } else if (value.length <= 5) {
            this.buffer.push('{ ');
            for (let i = 0; i < value.length; i++) {
                if (i > 0) {
                    this.buffer.push(', ');
                }
                this.encodeValue(value[i]);
            }
            this.buffer.push(' }');
        } else {
            this.buffer.push('{', this.newline);
            this.depth++;
            for (let i = 0; i < value.length; i++) {
                this.buffer.push(this.indent.repeat(this.depth));
                this.encodeValue(value[i]);
                this.buffer.push(',', this.newline);
            }
            this.depth--;
            this.buffer.push(this.indent.repeat(this.depth));
            this.buffer.push('}');
        }
    }

    private encodeTable(value: { [key: string]: any }) {
        this.buffer.push('{', this.newline);
        this.depth++;
        for (const [k, v] of Object.entries(value)) {
            this.buffer.push(this.indent.repeat(this.depth));
            if (k.match(/^[_\p{L}][_\p{L}\p{N}]*$/u)) {
                this.buffer.push(k);
            } else {
                this.buffer.push('[');
                this.encodeString(k);
                this.buffer.push(']');
            }
            this.buffer.push(' = ');
            this.encodeValue(v);
            this.buffer.push(',', this.newline);
        }
        this.depth--;
        this.buffer.push(this.indent.repeat(this.depth));
        this.buffer.push('}');
    }

    private encodeObject(value: Object) {
        if (Array.isArray(value)) {
            this.encodeArray(value);
        } else {
            this.encodeTable(value);
        }
    }
}

export const keywords = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
    'until', 'while'
]);

let validNameCache: Record<string, string> = {};
let validNameBackCache: Record<string, string> = {};

export function getValidName(name: string): string {
    if (!validNameCache[name]) {
        let luaName = name;
        // 如果第一位是数字，前面加上下划线
        if (luaName[0] >= '0' && luaName[0] <= '9') {
            luaName = '_' + luaName;
        }
        // 把特殊符号替换成下划线
        luaName = luaName.replace(/[\x00-\x08\x0B-\x2F\x3A-\x40\x5B-\x60\x7B-\x9F]/g, '_');
        // 如果是关键字，后面加上下划线
        if (keywords.has(luaName)) {
          luaName = luaName + "_";
        }
        if (name === '') {
            luaName = '_';
        }
        // 如果发生了碰撞，寻找一个不重复的名字
        if (validNameBackCache[luaName]) {
            let i = 1;
            while (validNameBackCache[luaName + i]) {
                i++;
            }
            luaName += i;
        }
        validNameCache[name] = luaName;
        validNameBackCache[luaName] = name;
    }
    return validNameCache[name];
}

export function encode(jsObject: any, options?: Partial<typeof encodeOptions>) {
    let encoder = new Encoder();
    if (options) {
        Object.assign(encoder, options);
    }
    return encoder.encode(jsObject);
}
