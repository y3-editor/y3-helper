import * as jsonc from 'jsonc-parser';

/**
 * 编辑器使用的 JSON 格式，读写时会遵循编辑器的格式规范
 */
export class Y3Json {
    private _text: string;
    private _tree?: jsonc.Node | null;
    private _data1?: Record<string, any> | null;
    private _data2?: Record<string, any> | null;
    private _needUpdateText = false;
    constructor(text: string, public fixedFloat = false) {
        this._text = text;
    }

    private dropTuple(data: any) {
        if (typeof data === 'object' && data !== null) {
            if ('__tuple__' in data) {
                return data.items;
            } else {
                for (let key in data) {
                    data[key] = this.dropTuple(data[key]);
                }
            }
        }
        return data;
    }

    private makeData1() {
        let data: Record<string, any> = jsonc.parse(this._text);
        if (data === undefined) {
            return undefined;
        }
        data = this.dropTuple(data);
        return data;
    }

    private makeData2() {
        let tree = this.tree;
        if (!tree) {
            return undefined;
        }

        const text = this._text;

        function decode(value: jsonc.Node): any {
            switch (value.type) {
                case 'null': {
                    return null;
                }
                case 'boolean': {
                    return value.value;
                }
                case 'string': {
                    return value.value;
                }
                case 'number': {
                    let rawText = text.slice(value.offset, value.offset + value.length);
                    if (rawText.includes('.')) {
                        return value.value;
                    } else {
                        return BigInt(value.value);
                    }
                }
                case 'property': {
                    let k = decode(value.children![0]);
                    let v = decode(value.children![1]);
                    return { k, v };
                }
                case 'array': {
                    let items: any[] = [];
                    for (let child of value.children!) {
                        items.push(decode(child));
                    }
                    return items;
                }
                case 'object': {
                    let items: Record<string, any> = {};
                    for (let child of value.children!) {
                        let { k, v } = decode(child);
                        items[k] = v;
                    }
                    return items;
                }
            }
        }

        let data = decode(tree);

        return data;
    }

    private stringify() {
        const data = this.data;
        const fixed = this.fixedFloat;
        const data2 = fixed ? undefined : this.data2;

        function encode(value: any, currentData2?: any, tabLevel = 0) {
            if (value === 'null') {
                return 'null';
            }
            switch (typeof value) {
                case 'bigint': {
                    return value.toString();
                };
                case 'number': {
                    if (fixed) {
                        return value.toFixed(1);
                    } else {
                        if (typeof currentData2 === 'bigint') {
                            return value.toString();
                        } else {
                            return value.toFixed(1);
                        }
                    }
                };
                case 'string': {
                    return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (ch) => {
                        return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
                    });
                };
                case 'object': {
                    if (value === null) {
                        return 'null';
                    }
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            return '[]';
                        }
                        let result = '[\n';
                        const tab = '    '.repeat(tabLevel + 1);
                        for (let i = 0; i < value.length; i++) {
                            let item = value[i];
                            result += tab + encode(item, currentData2?.[0], tabLevel + 1);
                            if (i < value.length - 1) {
                                result += ', ';
                            }
                            result += '\n';
                        }
                        result += '    '.repeat(tabLevel) + ']';
                        return result;
                    } else {
                        let keys = Object.keys(value);
                        if (keys.length === 0) {
                            return '{}';
                        }
                        keys.sort();
                        let result = '{\n';
                        const tab = '    '.repeat(tabLevel + 1);
                        for (let i = 0; i < keys.length; i++) {
                            let key = keys[i];
                            let item = value[key];
                            result += tab + encode(key) + ': ' + encode(item, currentData2?.[key], tabLevel + 1);
                            if (i < keys.length - 1) {
                                result += ', ';
                            }
                            result += '\n';
                        }
                        result += '    '.repeat(tabLevel) + '}';
                        return result;
                    }
                };
                default: {
                    return JSON.stringify(value);
                };
            }
        }

        let text = encode(data, data2);

        return text;
    }

    get tree() {
        return this._tree ??= (jsonc.parseTree(this._text) ?? null);
    }

    get(key: string) {
        return this.data?.[key];
    }

    set(key: string, value: any) {
        if (!this.data) {
            return;
        }
        this.data[key] = value;
    }

    get data() {
        return this.fixedFloat ? this.data2 : this.data1;
    }

    get data1() {
        return this._data1 ??= (this.makeData1() ?? null);
    }

    get data2() {
        return this._data2 ??= (this.makeData2() ?? null);
    }

    get text() {
        if (!this._needUpdateText) {
            return this._text;
        }
        this._needUpdateText = false;
        this._text = this.stringify();
        this._tree = undefined;
        return this._text;
    }

    updateText() {
        this._needUpdateText = true;
    }
}
