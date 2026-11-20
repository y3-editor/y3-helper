import * as fs from 'fs';
import * as path from 'path';
import { parseGmpJson } from './gmpJson';
import { GmpDict, GmpKey, GmpTuple, GmpValue, utf8 } from './gmpValue';

const archiveTableSuffix = '07bb5bc7-deab-429c-a64f-f3d340eb3bdc';
const minInt = -9223372036854775808n;
const maxInt = 9223372036854775807n;
type Cell = GmpValue;
interface GlobalTable {
    kind: 'global';
    rows: Cell[][];
    integerKeys: boolean;
}
interface DataTable {
    kind: 'data';
    rows: Cell[][];
    keys: number[];
}

function truthy(value: Cell): boolean {
    if (typeof value === 'bigint') return value !== 0n;
    if (Array.isArray(value) || Buffer.isBuffer(value)) return value.length !== 0;
    if (value instanceof Map) return value.size !== 0;
    if (value instanceof GmpTuple) return value.items.length !== 0;
    return Boolean(value);
}

function text(value: Cell): string {
    if (value === null) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'bigint' || typeof value === 'string') return String(value);
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (Object.is(value, -0)) return '-0.0';
        const abs = Math.abs(value);
        if (abs !== 0 && (abs < 1e-4 || abs >= 1e16)) return value.toExponential().replace(/e([+-])(\d)$/, 'e$10$2');
        return Number.isInteger(value) ? `${value}.0` : String(value);
    }
    throw new Error('表格单元格不是可转换的标量');
}

function integer(value: Cell): bigint | undefined {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'boolean') return value ? 1n : 0n;
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
    const str = typeof value === 'string' ? value.trim() : '';
    return /^[+-]?\d+$/.test(str) ? BigInt(str) : undefined;
}

function float(value: Cell): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint' || typeof value === 'boolean') return Number(value);
    const str = typeof value === 'string' ? value.trim() : '';
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(str)) return undefined;
    const n = Number(str);
    if (!Number.isFinite(n)) throw new Error('表格浮点值超出范围');
    return n;
}

function convert(type: string, value: Cell): GmpValue {
    if (type === 'int') {
        const int = integer(value);
        const floating = int === undefined ? float(value) : undefined;
        const n = int ?? (floating === undefined ? 0n : BigInt(Math.trunc(floating)));
        return n < minInt ? minInt : n > maxInt ? 9223370236754775807n : n; // editor int_convert overflow value
    }
    if (type === 'float' || type === 'angle') return float(value) ?? 0;
    if (type === 'bool') return value !== null && ['true', '1'].includes(text(value).toLowerCase());
    if (type === 'string') return value === null ? '' : text(value);
    if (type === 'vector3') {
        if (typeof value === 'string' && value.trim()) {
            const source = value.trim().replace(/（/g, '(').replace(/）/g, ')');
            const tuple = source.startsWith('(') && source.endsWith(')');
            const list = source.startsWith('[') && source.endsWith(']');
            const parts = (tuple || list ? source.slice(1, -1) : source).split(',').map(p => p.trim());
            if (parts[parts.length - 1] === '') parts.pop();
            if (parts.length === 3 && parts.every(p => float(p) !== undefined)) {
                const items = parts.map(p => integer(p) ?? float(p)!);
                return list ? items : new GmpTuple(items);
            }
            throw new Error('不支持的 vector3 表达式');
        }
        return new GmpTuple([0, 0, 0]);
    }
    return value; // Editor resource types (image, particle, etc.) carry the cell unchanged.
}

function readJsonTable(file: string): GlobalTable | DataTable | undefined {
    const doc = parseGmpJson(utf8.decode(fs.readFileSync(file)), true);
    if (!(doc instanceof Map)) throw new Error('JSON 表格应为对象');
    const type = doc.get('table_type');
    if (type === 999n) return undefined;
    if (type !== 0n && type !== 1n) throw new Error('未知的 JSON 表格类型');
    const table = doc.get('table_data');
    const data = table instanceof Map ? table.get('data') : undefined;
    if (!Array.isArray(data) || !data.every(Array.isArray) || !(table instanceof Map)) {
        throw new Error('缺少有效 table_data.data');
    }
    if (type === 1n) {
        return { kind: 'global', rows: data, integerKeys: String(table.get('kv_key_type')).toLowerCase() === 'int' };
    }
    const keys = table.get('key') ?? [];
    if (!Array.isArray(keys) || keys.length > 3 || new Set(keys).size !== keys.length || keys.some(
        key => typeof key !== 'bigint' || key < 0n || key >= (data[0]?.length ?? 0),
    )) throw new Error('无效的 JSON 复合主键列');
    return { kind: 'data', rows: data, keys: keys.map(Number) };
}

function cell(rows: Cell[][], r: number, c: number): Cell {
    const value = rows[r]?.[c] ?? null;
    return value === '' ? null : value;
}

function exportGlobal({ rows, integerKeys }: GlobalTable): GmpDict {
    const result: GmpDict = new Map();
    const header = rows[0] ?? [];
    const labels: string[] = [];
    for (const col of header) {
        if (!truthy(col)) break;
        labels.push(text(col).toLowerCase());
    }
    const k = labels.lastIndexOf('key'), t = labels.lastIndexOf('type'), v = labels.lastIndexOf('value');
    if (header.length < 4 || [k, t, v].includes(-1)) throw new Error('全局表缺少 Key / Type / Value 表头');
    for (let row = 1; row < rows.length; row++) {
        const key = cell(rows, row, k), type = cell(rows, row, t), value = cell(rows, row, v);
        if (!truthy(key) || !truthy(type)) continue;
        const field = text(type).toLowerCase();
        if (value === null && !['int', 'float', 'angle', 'bool', 'string', 'vector3'].includes(field)) continue;
        const name: GmpKey = (integerKeys ? integer(key) : undefined) ?? text(key);
        result.set(name, convert(field, value)); // last row with the same key wins in editor
    }
    return result;
}

function exportData({ rows, keys }: DataTable): GmpTuple | undefined {
    const firstRow = 2;
    if (rows.length < firstRow) throw new Error('数据表表头不完整');
    const columns: { index: number; name: string; type: string; key: string | null }[] = [];
    const names = new Set<string>();
    let keyCount = 0;
    for (let i = 0; i < rows[0].length; i++) {
        const name = cell(rows, 0, i);
        if (!truthy(name)) continue;
        const column = text(name);
        if (names.has(column)) throw new Error(`数据表字段重复：${column}`);
        names.add(column);
        const rawType = cell(rows, 1, i);
        if (!truthy(rawType)) throw new Error(`数据表字段缺少类型：${column}`);
        const type = text(rawType).toLowerCase();
        const keyIndex = keys.indexOf(i);
        const key = keyIndex >= 0 ? `key${keyIndex + 1}` : null;
        if (key !== null) {
            if (!['int', 'string'].includes(type)) throw new Error(`数据表主键定义不合法：${column}`);
            keyCount++;
        }
        columns.push({ index: i, name: column, type, key });
    }
    if (keyCount !== keys.length) throw new Error('数据表主键缺少字段名');
    if (columns.length === 0) throw new Error('数据表表头缺少有效字段');
    if (rows.length === firstRow) return undefined; // editor omits a valid header-only data table
    const virtual = keys.length === 0;
    const indices = columns.map(c => new GmpTuple([c.name, c.type, c.key]));
    if (virtual) indices.push(new GmpTuple(['__auto_gen_key', 'int', 'key1']));
    const data: GmpValue[][] = [];
    for (let row = firstRow; row < rows.length; row++) {
        const values = columns.map(c => cell(rows, row, c.index));
        if (columns.some((c, i) => truthy(c.key) && values[i] === null)) continue;
        const output = columns.map((c, i) => convert(c.type, values[i]));
        if (virtual) output.push(BigInt(row - firstRow + 1));
        data.push(output);
    }
    return new GmpTuple([indices, data]);
}

function findJsonTables(root: string): string[] {
    function read(dir: string, optional: boolean): fs.Dirent[] {
        try { return fs.readdirSync(dir, { withFileTypes: true }); }
        catch (error) {
            if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw new Error(`${dir}：${error instanceof Error ? error.message : String(error)}`);
        }
    }
    function walk(dir: string, optional: boolean): string[] {
        const files: string[] = [];
        const folders: string[] = [];
        for (const entry of read(dir, optional)) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) folders.push(file);
            else if (path.extname(entry.name).toLowerCase() === '.json') files.push(file);
        }
        for (const folder of folders) files.push(...walk(folder, false));
        return files;
    }
    return walk(root, true);
}

export function buildRuntimeTables(mapPath: string, projectPath: string): { data: GmpDict; found: boolean; hasHeaderOnlyDataTable: boolean } {
    const projectTables = path.join(projectPath, 'archive', 'init_tables');
    const inputs = [...findJsonTables(path.join(mapPath, 'tables')), ...findJsonTables(projectTables)];
    const data: GmpDict = new Map();
    let hasHeaderOnlyDataTable = false;
    for (const file of inputs) {
        try {
            const table = readJsonTable(file);
            if (!table) continue;
            const values = table.kind === 'global' ? exportGlobal(table) : exportData(table);
            if (values === undefined) {
                hasHeaderOnlyDataTable = true;
                continue;
            }
            const name = path.basename(file, path.extname(file));
            const effectiveName = path.dirname(file) === projectTables ? name + archiveTableSuffix : name;
            if (data.has(effectiveName)) throw new Error(`多份源导出同名表格：${effectiveName}`);
            data.set(effectiveName, [table.kind, values]);
        } catch (error) {
            throw new Error(`${file}：${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return { data, found: inputs.length > 0, hasHeaderOnlyDataTable };
}
