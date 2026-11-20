import * as crypto from 'crypto';
import { decode } from '@msgpack/msgpack';
import { buildRuntimeTables } from './gmpTables';
import { decodeGmpValue, encodeGmpValue, equalGmpValue } from './gmpValue';
import { compressZstd, decompressZstd } from './y3SaveGmp';

// Key derivation and wire format of the editor's MAP_AES codec for old table_data (96).
// This fixed format key is not an account credential or a project-dependent secret.
const tableKey = crypto.createHash('sha1').update('909ed2d5dcf907c79fb9ab341a98febb65291c40').digest().subarray(0, 16);

function openTable(body: Buffer, encrypted: boolean): Buffer {
    if (!encrypted) return body;
    const bytes = Buffer.from(body.toString('ascii'), 'base64');
    if (!bytes.length || !Buffer.from(bytes.toString('base64')).equals(body)) throw new Error('表格密文不是编辑器的 Base64 格式');
    const cipher = crypto.createDecipheriv('aes-128-cbc', tableKey, tableKey);
    return Buffer.concat([cipher.update(bytes), cipher.final()]);
}

function sealTable(body: Buffer, encrypted: boolean): Buffer {
    if (!encrypted) return body;
    const cipher = crypto.createCipheriv('aes-128-cbc', tableKey, tableKey);
    return Buffer.from(Buffer.concat([cipher.update(body), cipher.final()]).toString('base64'));
}

async function tableEncryption(descBody?: Buffer): Promise<boolean> {
    if (!descBody) throw new Error('原包缺少 desc，无法确定 table_data 编码');
    const json = decode(await decompressZstd(descBody));
    if (typeof json !== 'string') throw new Error('GMP desc 编码不受支持');
    const desc = JSON.parse(json);
    if (!desc || typeof desc !== 'object' || Array.isArray(desc)) throw new Error('GMP desc 不是 JSON 对象');
    const sections: unknown = desc.encrypt_sections;
    if (sections === undefined) return false; // editor ObjSection default
    if (!Array.isArray(sections) || !sections.every(x => typeof x === 'string')) throw new Error('GMP desc.encrypt_sections 无效');
    return sections.includes('table_data');
}

export async function rebuildRuntimeTableSection(
    mapPath: string,
    projectPath: string,
    { original, originalDesc, generatedDesc, verifiedPresenceMode }: {
        original?: Buffer;
        originalDesc?: Buffer;
        generatedDesc?: Buffer;
        verifiedPresenceMode: boolean;
    },
): Promise<{ body: Buffer } | { omit: true; note: string } | { reason: string; unverified?: boolean }> {
    const tables = buildRuntimeTables(mapPath, projectPath);
    if (!original && tables.data.size === 0) return { reason: '原包和生效源均无运行时表格' };
    const unverified = {
        reason: `原包无表格段，仅验证过 2.0/2.5D、版本 73 且标记加密的 GMP 首次添加 JSON 表格（关卡表来源：${mapPath}）`,
        unverified: true,
    };
    if (!original && (!verifiedPresenceMode || !originalDesc)) return unverified;
    const encrypted = await tableEncryption(originalDesc);
    if (!original && !encrypted) return unverified;
    if (generatedDesc && (await tableEncryption(generatedDesc)) !== encrypted) {
        throw new Error('磁盘 desc.json 与基础 GMP 的 table_data 加密标记不一致');
    }
    if (original) {
        if (!tables.found) return { reason: '缺少可选表格源，保留原段' };
        const old = decodeGmpValue(await decompressZstd(openTable(original, encrypted)));
        if (!(old instanceof Map)) throw new Error('原表格段不是编辑器的表格字典');
        if (tables.data.size === 0) {
            if (verifiedPresenceMode && encrypted && tables.hasHeaderOnlyDataTable) {
                return { omit: true, note: '有效 JSON 表格只剩表头，同版本编辑器省略空的 table_data 段' };
            }
            if (old.size > 0) throw new Error('没有可导出表格，且缺少已验证的表头清空条件；保留原段');
        }
        if (equalGmpValue(old, tables.data)) return { reason: '运行时表格未变，复用原段字节' };
    }
    return { body: sealTable(await compressZstd(encodeGmpValue(tables.data)), encrypted) };
}
