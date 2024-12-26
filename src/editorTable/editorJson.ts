import { Json } from '../tools/json';
import * as jsonc from 'jsonc-parser';

function stringify(value: any, fixed = false, tabLevel = 0): string {
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
                    result += tab + stringify(item, fixed, tabLevel + 1);
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
                    result += tab + stringify(key) + ': ' + stringify(item, fixed, tabLevel + 1);
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

export class EditorJson extends Json {
    constructor(text: string, fixed = false) {
        super(text, {
            stringify: (value) => stringify(value, fixed),
            patchJson: true,
            patchEdit: (edit: jsonc.Edit) => {
                edit.content = edit.content.replace(/,\n/g, ', \n');
                return edit;
            }
        });
    }
}
