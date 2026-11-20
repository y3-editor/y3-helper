import { TextDecoder } from 'util';
import { encode } from '@msgpack/msgpack';

export type GmpKey = string | bigint;
export type GmpValue = null | boolean | number | bigint | string | Buffer | GmpValue[] | GmpTuple | GmpDict;
export type GmpDict = Map<GmpKey, GmpValue>;
export class GmpTuple {
    constructor(readonly items: GmpValue[]) {}
}

export const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const tupleMarker = Buffer.from([0x11]);
const maxDepth = 100;
const maxValues = 4_000_000;

export function checkKey(key: GmpValue): GmpKey {
    if (typeof key !== 'string' && typeof key !== 'bigint') {
        throw new Error('不支持非字符串/整数的 GMP 字典键');
    }
    return key;
}

/** MessagePack as used by MapSection: keep integer keys and Python tuple markers. */
export function decodeGmpValue(raw: Buffer): GmpValue {
    let offset = 0;
    let remaining = maxValues;
    function take(n: number): Buffer {
        if (n > raw.length - offset) throw new Error('MessagePack 载荷截断');
        const start = offset;
        offset += n;
        return raw.subarray(start, offset);
    }
    function length(bytes: number): number { return take(bytes).readUIntBE(0, bytes); }
    function read(depth: number): GmpValue {
        if (depth > maxDepth || --remaining < 0) throw new Error('MessagePack 载荷过大或嵌套过深');
        function list(n: number): GmpValue {
            if (n > raw.length - offset) throw new Error('MessagePack 列表截断');
            const out: GmpValue[] = [];
            for (let i = 0; i < n; i++) out.push(read(depth + 1));
            const last = out[out.length - 1];
            if (Buffer.isBuffer(last) && last.equals(tupleMarker)) {
                out.pop();
                return new GmpTuple(out);
            }
            return out;
        }
        function dict(n: number): GmpValue {
            if (2 * n > raw.length - offset) throw new Error('MessagePack 字典截断');
            const out: GmpDict = new Map();
            for (let i = 0; i < n; i++) {
                const key = checkKey(read(depth + 1));
                if (out.has(key)) throw new Error('MessagePack 字典键重复');
                out.set(key, read(depth + 1));
            }
            return out;
        }
        const tag = length(1);
        if (tag < 0x80) return BigInt(tag);
        if (tag >= 0xe0) return BigInt(tag - 256);
        if (tag < 0x90) return dict(tag & 15);
        if (tag < 0xa0) return list(tag & 15);
        if (tag < 0xc0) return utf8.decode(take(tag & 31));
        switch (tag) {
            case 0xc0: return null;
            case 0xc2: return false;
            case 0xc3: return true;
            case 0xc4: case 0xc5: case 0xc6: return take(length(1 << (tag - 0xc4)));
            case 0xca: return take(4).readFloatBE();
            case 0xcb: return take(8).readDoubleBE();
            case 0xcc: case 0xcd: case 0xce: return BigInt(length(1 << (tag - 0xcc)));
            case 0xcf: return take(8).readBigUInt64BE();
            case 0xd0: case 0xd1: case 0xd2: {
                const bytes = 1 << (tag - 0xd0);
                return BigInt(take(bytes).readIntBE(0, bytes));
            }
            case 0xd3: return take(8).readBigInt64BE();
            case 0xd9: case 0xda: case 0xdb: return utf8.decode(take(length(1 << (tag - 0xd9))));
            case 0xdc: case 0xdd: return list(length(2 << (tag - 0xdc)));
            case 0xde: case 0xdf: return dict(length(2 << (tag - 0xde)));
            default: throw new Error(`不支持的 MessagePack 标记 0x${tag.toString(16)}`);
        }
    }
    const result = read(0);
    if (offset !== raw.length) throw new Error('MessagePack 载荷存在尾随数据');
    return result;
}

export function encodeGmpValue(data: GmpValue): Buffer {
    const chunks: Uint8Array[] = [];
    const active = new Set<object>();
    let remaining = maxValues;
    function header(n: number, list: boolean) {
        if (n < 16) {
            chunks.push(Buffer.from([(list ? 0x90 : 0x80) | n]));
        } else {
            const bytes = n < 0x10000 ? 2 : 4;
            const b = Buffer.allocUnsafe(bytes + 1);
            b[0] = (list ? 0xdc : 0xde) + (bytes === 4 ? 1 : 0);
            b.writeUIntBE(n, 1, bytes);
            chunks.push(b);
        }
    }
    function write(value: GmpValue, depth: number) {
        if (depth > maxDepth || --remaining < 0) throw new Error('数据过大或嵌套过深');
        if (value instanceof Map || value instanceof GmpTuple || Array.isArray(value)) {
            if (active.has(value)) throw new Error('不支持循环引用');
            active.add(value);
            if (value instanceof Map) {
                header(value.size, false);
                for (const [key, entry] of value) {
                    write(key, depth + 1);
                    write(entry, depth + 1);
                }
            } else {
                const tuple = value instanceof GmpTuple;
                const items = tuple ? value.items : value;
                const last = items[items.length - 1];
                if (!tuple && Buffer.isBuffer(last) && last.equals(tupleMarker)) {
                    throw new Error('列表末尾二进制值与 GMP 元组标记冲突');
                }
                header(items.length + Number(tuple), true);
                for (const item of items) write(item, depth + 1);
                if (tuple) chunks.push(Buffer.from([0xc4, 1, 0x11]));
            }
            active.delete(value);
        } else if (typeof value === 'bigint') {
            if (value >= -0x80000000n && value <= 0xffffffffn) chunks.push(encode(Number(value)));
            else if (value >= -(1n << 63n) && value < (1n << 64n)) chunks.push(encode(value, { useBigInt64: true }));
            else throw new Error('整数超出 GMP MessagePack 64 位范围');
        } else if (typeof value === 'number') {
            const b = Buffer.allocUnsafe(9);
            b[0] = 0xcb;
            b.writeDoubleBE(value, 1);
            chunks.push(b);
        } else {
            chunks.push(encode(value));
        }
    }
    write(data, 0);
    return Buffer.concat(chunks);
}

export function equalGmpValue(left: GmpValue, right: GmpValue): boolean {
    let remaining = maxValues;
    function equal(a: GmpValue, b: GmpValue, depth: number): boolean {
        if (depth > maxDepth || --remaining < 0) throw new Error('数据过大或存在循环引用');
        if (Object.is(a, b)) return true;
        if (a instanceof Map && b instanceof Map) {
            if (a.size !== b.size) return false;
            for (const [key, value] of a) {
                const other = b.get(key);
                if (other === undefined || !equal(value, other, depth + 1)) return false;
            }
            return true;
        }
        if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b);
        if (a instanceof GmpTuple && b instanceof GmpTuple) { a = a.items; b = b.items; }
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length
            && a.every((value, i) => equal(value, b[i], depth + 1));
    }
    return equal(left, right, 0);
}
