import * as fs from 'fs';
import * as path from 'path';
import { parseGmpJson } from './gmpJson';
import { decodeGmpValue, encodeGmpValue, equalGmpValue, GmpDict, utf8 } from './gmpValue';
import { compressZstd, decompressZstd } from './y3SaveGmp';

type ArchiveUpdate = { body: Buffer } | { omit: true; note: string } | { reason: string; unverified?: boolean };

function validatePlayerConfig(data: GmpDict): void {
    const slots = data.get('archive_slots');
    if (!(slots instanceof Map)) throw new Error('玩家存档配置缺少 archive_slots 字典');
    for (const [id, slot] of slots) {
        if (typeof id !== 'bigint' || id < 1n || !(slot instanceof Map) || slot.get('key') !== id) {
            throw new Error(`玩家存档槽位编号无效：${id}`);
        }
        const name = slot.get('name');
        if (typeof name !== 'string' || !name.length) throw new Error(`玩家存档槽位 ${id} 缺少名称`);
        const value = slot.get('value');
        const type = slot.get('type');
        const valid = type === 0n || type === 4n ? typeof value === 'string'
            : type === 1n ? typeof value === 'boolean' || value === 0n || value === 1n
                : (type === 2n || type === 3n) && typeof value === 'bigint';
        if (!valid) throw new Error(`玩家存档槽位 ${id} 的类型或默认值不受支持`);
    }
}

function validateGlobalConfig(data: GmpDict): void {
    for (const [name, slot] of data) {
        if (typeof name !== 'string' || !name.length || !(slot instanceof Map)) throw new Error('全局存档项无效');
        const type = slot.get('data_type');
        const value = slot.get('default_value');
        if ((type !== 0n || typeof value !== 'bigint') && (type !== 1n || typeof value !== 'string')) {
            throw new Error(`全局存档项 ${name} 的类型或默认值不受支持`);
        }
    }
}

/** The project's JSON is the editor input. The local game reads the resulting defaults from level GMP 95/110. */
export async function rebuildArchiveSection(project: string, global: boolean, original?: Buffer): Promise<ArchiveUpdate> {
    const file = path.join(project, 'archive', global ? 'mapscore.json' : 'archive.json');
    try {
        let source: Buffer;
        try {
            source = fs.readFileSync(file);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { reason: `缺少项目级配置，保留原包，不使用关卡副本：${file}` };
            }
            throw error;
        }
        // Player slots use integer keys; project MapScoreSection explicitly uses string keys.
        const data = parseGmpJson(utf8.decode(source), !global);
        if (!(data instanceof Map)) throw new Error('存档配置必须是字典');
        if (global) validateGlobalConfig(data);
        else validatePlayerConfig(data);

        if (!global && !original) {
            return { reason: `原包无玩家存档段，尚未验证此情况可新增：${file}`, unverified: true };
        }
        const old = original && decodeGmpValue(await decompressZstd(original));
        if (original && !(old instanceof Map)) throw new Error('基础 GMP 存档段不是字典');
        if (global && data.size === 0) {
            return original ? { omit: true, note: '全局存档显式清空，省略原段' } : { reason: '全局存档显式为空，无需写入段' };
        }
        if (old && equalGmpValue(old, data)) return { reason: '存档配置未变，复用原段字节' };
        return { body: await compressZstd(encodeGmpValue(data)) };
    } catch (error) {
        throw new Error(`${file}：${error instanceof Error ? error.message : String(error)}`);
    }
}
