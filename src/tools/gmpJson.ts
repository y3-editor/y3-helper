import { parseTree, ParseError } from 'jsonc-parser';
import type { Node } from 'jsonc-parser';
import { GmpDict, GmpTuple, GmpValue } from './gmpValue';

/** Parse without rounding editor int64 keys/values or conflating integer and float tokens. */
export function parseGmpJson(source: string, editorObjectHook = false): GmpValue {
    const text = source.replace(/^\uFEFF/, '');
    const errors: ParseError[] = [];
    const root = parseTree(text, errors, { disallowComments: true });
    if (!root || errors.length) throw new Error(`JSON 解析失败（偏移 ${errors[0]?.offset ?? 0}）`);
    function visit(node: Node, depth: number): GmpValue {
        if (depth > 100) throw new Error('JSON 嵌套过深');
        switch (node.type) {
            case 'number': {
                const token = text.slice(node.offset, node.offset + node.length);
                if (/^-?\d+$/.test(token)) return BigInt(token);
                if (!Number.isFinite(node.value)) throw new Error('JSON 浮点值超出范围');
                return node.value;
            }
            case 'array': return (node.children ?? []).map(child => visit(child, depth + 1));
            case 'object': {
                const data: GmpDict = new Map();
                for (const prop of node.children ?? []) {
                    const [name, value] = prop.children!;
                    const key: string = name.value;
                    const resolvedKey = editorObjectHook && /^[+-]?\d+$/.test(key.trim()) ? BigInt(key.trim()) : key;
                    data.set(resolvedKey, visit(value, depth + 1));
                }
                if (editorObjectHook && data.get('__tuple__') === true) {
                    const items = data.get('items');
                    if (!Array.isArray(items)) throw new Error('无效的 JSON 元组');
                    return new GmpTuple(items);
                }
                return data;
            }
            default: return node.value;
        }
    }
    return visit(root, 0);
}
