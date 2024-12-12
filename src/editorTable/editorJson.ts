import * as jsonc from 'jsonc-parser';
import * as y3 from 'y3-helper';
import { Json } from '../tools/json';

const jsonFormatOptions: y3.json.formatOptions = {
    stringify: (value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        if (typeof value === 'number' && isFinite(value)) {
            return value.toFixed(1);
        }
        if (typeof value === 'string') {
            // 将所有的 unicode 转为 \uXXXX 形式
            let result = JSON.stringify(value);
            result = result.replace(/[\u0080-\uffff]/g, (ch) => {
                return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
            });
            return result;
        }
    },
    patchEdit: (edit) => {
        let scanner = jsonc.createScanner(edit.content);
        let edits: jsonc.Edit[] = [];
        while (scanner.scan() !== jsonc.SyntaxKind.EOF) {
            if (scanner.getToken() === jsonc.SyntaxKind.StringLiteral) {
                let start = scanner.getTokenOffset();
                let length = scanner.getTokenLength();
                let value = edit.content.slice(start + 1, start + length - 1);
                let newValue = value.replace(/[\u0080-\uffff]/g, (ch) => {
                    return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
                });
                if (value !== newValue) {
                    edits.push({
                        offset: start + 1,
                        length: value.length,
                        content: newValue,
                    });
                }
            }
        }
        edit.content = jsonc.applyEdits(edit.content, edits);
        edit.content = edit.content.replace(/,([\r\n])/g, ', $1');
        return edit;
    },
};

export class EditorJson extends Json {
    constructor(text: string) {
        super(text, jsonFormatOptions);
    }
}
