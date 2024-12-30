import * as jsonc from 'jsonc-parser';

/**
 * 编辑器使用的 JSON 格式，读写时会遵循编辑器的格式规范
 */
export class EditorJson {
    private _text: string;
    private _tree?: jsonc.Node;
    private _data?: Record<string, any>;
    private _needUpdateText = false;
    private _fixedFloat = false;
    constructor(text: string) {
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

    private makeData() {
        let data: Record<string, any> = jsonc.parse(this._text);
        data = this.dropTuple(data);
        return data;
    }

    private stringify() {
        const data = this.data;
        const tree = this.tree;
        const fixed = this._fixedFloat;

        function encode(value: any, tabLevel = 0) {
            if (value === 'null') {
                return 'null';
            }
            switch (typeof value) {
                case 'bigint': {
                    return value.toString();
                };
                case 'number': {
                    if (fixed && isFinite(value)) {
                        return value.toFixed(1);
                    } else {
                        return JSON.stringify(value);
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
                            result += tab + encode(item, tabLevel + 1);
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
                            result += tab + encode(key) + ': ' + encode(item, tabLevel + 1);
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

        let text = encode(data);

        return text;
    }

    get tree() {
        return this._tree ??= jsonc.parseTree(this._text);
    }

    get(key: string) {
        return this.data?.[key];
    }

    set(key: string, value: any) {
        this.data[key] = value;
    }

    get data() {
        return this._data ??= this.makeData();
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

    updateText(fixedFloat: boolean) {
        this._needUpdateText = true;
        this._fixedFloat = fixedFloat;
    }
}
