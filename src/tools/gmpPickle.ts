import { checkKey, GmpDict, GmpTuple, GmpValue, utf8 } from './gmpValue';

const marker = Symbol('pickle MARK');

/** Interpret only the data opcodes emitted by editor Python 3 (protocol 2–5). */
export function readEditorPickle(raw: Buffer): GmpValue {
    const memo = new Map<number, GmpValue>();
    const stack: (GmpValue | typeof marker)[] = [];
    let cursor = 0;
    let frameEnd: number | undefined;
    function take(n: number): Buffer {
        if (n > (frameEnd ?? raw.length) - cursor) throw new Error('pickle 载荷或 frame 截断');
        const start = cursor;
        cursor += n;
        return raw.subarray(start, cursor);
    }
    function byte() { return take(1)[0]; }
    function bounded(n: bigint): number {
        if (n > BigInt(raw.length)) throw new Error('pickle 长度越界');
        return Number(n);
    }
    function value(v: GmpValue | typeof marker | undefined): GmpValue {
        if (v === marker || v === undefined) throw new Error('pickle 栈无有效值');
        return v;
    }
    function pop() { return value(stack.pop()); }
    function top() { return value(stack[stack.length - 1]); }
    const marks: number[] = [];
    function markedValues(): GmpValue[] {
        const mark = marks.pop();
        if (mark === undefined || stack[mark] !== marker) throw new Error('pickle 缺少 MARK');
        const entries = stack.splice(mark);
        entries.shift();
        return entries as GmpValue[];
    }
    function list(target: GmpValue): GmpValue[] {
        if (!Array.isArray(target)) throw new Error('pickle APPEND 目标不是列表');
        return target;
    }
    function setItems(target: GmpValue, entries: GmpValue[]) {
        if (!(target instanceof Map) || entries.length % 2) throw new Error('pickle 字典无效');
        for (let i = 0; i < entries.length; i += 2) target.set(checkKey(entries[i]), entries[i + 1]);
    }
    function long(bytes: Buffer): bigint {
        if (bytes.length > 9) throw new Error('pickle 整数超出 64 位范围');
        let n = bytes[bytes.length - 1] >= 128 ? -1n : 0n;
        for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
        if (n < -(1n << 63n) || n >= (1n << 64n)) throw new Error('pickle 整数超出 64 位范围');
        return n;
    }
    if (byte() !== 0x80) throw new Error('不支持无协议头的 pickle');
    const protocol = byte();
    if (protocol < 2 || protocol > 5) throw new Error(`不支持 pickle 协议 ${protocol}`);
    let operations = 4_000_000;
    while (cursor < raw.length) {
        if (--operations < 0) throw new Error('pickle 数据过大');
        if (cursor === frameEnd) frameEnd = undefined;
        const opcode = byte();
        switch (opcode) {
            case 0x95: { // FRAME
                if (frameEnd !== undefined) throw new Error('不支持嵌套 pickle frame');
                const size = bounded(take(8).readBigUInt64LE());
                if (size > raw.length - cursor) throw new Error('pickle frame 越界');
                frameEnd = cursor + size;
                break;
            }
            case 0x2e: // STOP
                if (cursor !== raw.length || stack.length !== 1 || marks.length !== 0) throw new Error('pickle 末尾无效');
                return pop();
            case 0x28: marks.push(stack.length); stack.push(marker); break;
            case 0x4e: stack.push(null); break;
            case 0x88: stack.push(true); break;
            case 0x89: stack.push(false); break;
            case 0x4b: stack.push(BigInt(byte())); break;
            case 0x4d: stack.push(BigInt(take(2).readUInt16LE())); break;
            case 0x4a: stack.push(BigInt(take(4).readInt32LE())); break;
            case 0x8a: stack.push(long(take(byte()))); break;
            case 0x8b: stack.push(long(take(take(4).readUInt32LE()))); break;
            case 0x47: stack.push(take(8).readDoubleBE()); break;
            case 0x8c: case 0x55: stack.push(utf8.decode(take(byte()))); break;
            case 0x58: case 0x54: stack.push(utf8.decode(take(take(4).readUInt32LE()))); break;
            case 0x8d: stack.push(utf8.decode(take(bounded(take(8).readBigUInt64LE())))); break;
            case 0x43: stack.push(take(byte())); break;
            case 0x42: stack.push(take(take(4).readUInt32LE())); break;
            case 0x8e: stack.push(take(bounded(take(8).readBigUInt64LE()))); break;
            case 0x5d: stack.push([]); break;
            case 0x6c: stack.push(markedValues()); break;
            case 0x61: { const v = pop(); list(top()).push(v); break; }
            case 0x65: { const items = markedValues(); const out = list(top()); for (const v of items) out.push(v); break; }
            case 0x7d: stack.push(new Map()); break;
            case 0x64: { const dict: GmpDict = new Map(); setItems(dict, markedValues()); stack.push(dict); break; }
            case 0x73: { const v = pop(); const k = pop(); setItems(top(), [k, v]); break; }
            case 0x75: { const items = markedValues(); setItems(top(), items); break; }
            case 0x29: stack.push(new GmpTuple([])); break;
            case 0x74: stack.push(new GmpTuple(markedValues())); break;
            case 0x85: stack.push(new GmpTuple([pop()])); break;
            case 0x86: { const b = pop(); stack.push(new GmpTuple([pop(), b])); break; }
            case 0x87: { const c = pop(); const b = pop(); stack.push(new GmpTuple([pop(), b, c])); break; }
            case 0x94: memo.set(memo.size, top()); break;
            case 0x71: memo.set(byte(), top()); break;
            case 0x72: memo.set(take(4).readUInt32LE(), top()); break;
            case 0x68: stack.push(value(memo.get(byte()))); break;
            case 0x6a: stack.push(value(memo.get(take(4).readUInt32LE()))); break;
            default: throw new Error(`不支持的 pickle 操作码 0x${opcode.toString(16)}（仅允许数据）`);
        }
    }
    throw new Error('pickle 缺少 STOP');
}
