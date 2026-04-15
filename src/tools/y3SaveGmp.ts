/**
 * Y3 GMP 保存钩子 (y3_save_gmp)
 *
 * 当 AI 对以下目录/文件进行增删改时，在所有操作完成后调用一次 save() 函数：
 * - editor_table/    : 物编 JSON 文件
 * - ui/              : UI JSON 文件（面板、层、配置）
 * - uslanguage.json  : 英文语言文件
 * - zhlanguage.json  : 中文语言文件
 *
 * 核心原则：无论修改一个还是多个文件，只在最后调用一次 save()！
 *
 * 主要接口：
 * - save(mapPath)                              : 统一入口，同时更新物编、UI 和语言
 * - save(mapPath, { updateUI: false })         : 仅更新物编和语言
 * - save(mapPath, { updatePrefabs: false })    : 仅更新 UI 和语言
 * - save(mapPath, { updateUSLanguage: false }) : 不更新英文语言
 * - save(mapPath, { updateZHLanguage: false }) : 不更新中文语言
 *
 * 技术细节：
 * - 物编 Section:      新版 Section（ID > 200，MD5 哈希索引），序列化: dict -> JSON string -> msgpack -> zstd
 * - UI Section:        旧版 Section（ID = 10，固定索引），序列化: dict -> msgpack -> zstd
 * - USLanguage Section: 旧版 Section（ID = 49，固定索引），序列化: dict -> msgpack -> zstd
 * - ZHLanguage Section: 旧版 Section（ID = 50，固定索引），序列化: dict -> msgpack -> zstd
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as msgpack from '@msgpack/msgpack';

// zstd-codec 没有类型声明
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ZstdCodec } = require('zstd-codec') as {
    ZstdCodec: {
        run: (callback: (lib: { Simple: new () => { compress: (data: Uint8Array, level: number) => Uint8Array; decompress: (data: Uint8Array) => Uint8Array } }) => void) => void;
    };
};

// ============================================================
// 类型定义
// ============================================================

/** 需要提取的物编 Section 名称列表 */
const PREFAB_SECTIONS = [
    "editor_unit",
    "editor_decoration",
    "ability_all",
    "modifier_all",
    "projectile_all",
    "technology_all",
    "store_all",
    "editor_item",
    "editor_destructible",
    "sound_all",
    "state_all",
] as const;

type PrefabSectionName = typeof PREFAB_SECTIONS[number];

/** 新版 Section 的二进制表标志位 */
const BIT_CONTAINS_BINARY = 0x80000000;

/** 旧版 Section 的固定 ID 范围（1-200 视为旧版） */
const OLD_SECTION_ID_MAX = 200;

/** Section 名称到 editor_table 子目录的映射 */
const SECTION_TO_FOLDER: Record<PrefabSectionName, string> = {
    "editor_unit": "editorunit",
    "editor_decoration": "editordecoration",
    "ability_all": "abilityall",
    "modifier_all": "modifierall",
    "projectile_all": "projectileall",
    "technology_all": "technologyall",
    "store_all": "storeall",
    "editor_item": "editoritem",
    "editor_destructible": "editordestructible",
    "sound_all": "soundall",
    "state_all": "stateall",
};

/** zstd 压缩级别 */
const COMPRESS_LEVEL = 3;

// ============================================================
// Zstd 单例管理（避免重复初始化 WASM 导致 OOM）
// ============================================================

interface ZstdSimple {
    compress: (data: Uint8Array, level: number) => Uint8Array;
    decompress: (data: Uint8Array) => Uint8Array;
}

let zstdSimpleInstance: ZstdSimple | null = null;
let zstdInitPromise: Promise<ZstdSimple> | null = null;

/**
 * 获取 Zstd Simple 实例（单例模式，异步）
 * 复用同一个实例避免多次初始化 WASM 导致内存泄漏
 */
async function getZstdSimple(): Promise<ZstdSimple> {
    if (zstdSimpleInstance) {
        return zstdSimpleInstance;
    }
    
    if (zstdInitPromise) {
        return zstdInitPromise;
    }
    
    zstdInitPromise = new Promise<ZstdSimple>((resolve, reject) => {
        try {
            ZstdCodec.run((zstdLib: any) => {
                zstdSimpleInstance = new zstdLib.Simple();
                resolve(zstdSimpleInstance!);
            });
        } catch (e) {
            zstdInitPromise = null;
            reject(e);
        }
    });
    
    return zstdInitPromise;
}

/** UI Section 的固定 ID（旧版 Section） */
const UI_SECTION_ID = 10;

/** USLanguage Section 的固定 ID（旧版 Section） */
const US_LANGUAGE_SECTION_ID = 49;

/** ZHLanguage Section 的固定 ID（旧版 Section） */
const ZH_LANGUAGE_SECTION_ID = 50;

interface SectionHeader {
    index: number;
    packSize: number;
    rawPackSize: number;
    isOldSection: boolean;
    hasBinaryTable: boolean;
}

interface SectionData {
    header: SectionHeader;
    body: Buffer;
    isOldSection: boolean;
    binTable: Buffer | null;
}

interface GmpHeader {
    uuid: Buffer;
    version: number;
    packSize: number;
    createStamp?: string;
    editorPackStamp?: string;
}

interface SaveResult {
    success: boolean;
    message: string;
    sectionsReplaced?: string[];
    uiSectionSize?: number;
    outputSize?: number;
}

interface SaveOptions {
    updatePrefabs?: boolean;
    updateUI?: boolean;
    updateUSLanguage?: boolean;
    updateZHLanguage?: boolean;
    outputPath?: string;
}

// ============================================================
// 二进制读取辅助类
// ============================================================

class BufferReader {
    private buffer: Buffer;
    private offset: number = 0;

    constructor(buffer: Buffer) {
        this.buffer = buffer;
    }

    read(length: number): Buffer {
        const result = this.buffer.subarray(this.offset, this.offset + length);
        this.offset += length;
        return result;
    }

    readUInt16BE(): number {
        const value = this.buffer.readUInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    readUInt32BE(): number {
        const value = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return value;
    }

    getOffset(): number {
        return this.offset;
    }
}

// ============================================================
// 二进制解析工具类
// ============================================================

/**
 * GMP 格式地图数据解析器
 *
 * 基于 map_data.py 中的 unpack 函数逻辑实现。
 * 用于从二进制 GMP 文件中提取和保存 Section 数据。
 */
class GmpParser {
    header: Partial<GmpHeader> = {};
    sections: Map<number, SectionData> = new Map();
    prefabData: Map<string, Buffer> = new Map();
    otherData: Map<number, SectionData> = new Map();

    /**
     * 解析 GMP 文件
     */
    parse(filePath: string): boolean {
        if (!fs.existsSync(filePath)) {
            console.log(`[GmpParser] 文件不存在: ${filePath}`);
            return false;
        }

        const buffer = fs.readFileSync(filePath);
        return this.parseBuffer(buffer);
    }

    /**
     * 从 Buffer 解析 GMP 数据
     */
    private parseBuffer(buffer: Buffer): boolean {
        try {
            const reader = new BufferReader(buffer);

            // Step 1: 解析 header
            this.unpackHeader(reader);

            // Step 2: 读取 section 数量
            const secCnt = reader.readUInt16BE();
            console.log(`[GmpParser] Section 数量: ${secCnt}`);

            // Step 3: 读取所有 section header
            const sectionHeaders: SectionHeader[] = [];
            for (let i = 0; i < secCnt; i++) {
                const secIdx = reader.readUInt16BE();
                const rawPackSize = reader.readUInt32BE();

                // 判断是旧版还是新版 Section
                const isOldSection = secIdx < OLD_SECTION_ID_MAX;

                let packSize: number;
                let hasBinaryTable: boolean;

                if (isOldSection) {
                    packSize = rawPackSize;
                    hasBinaryTable = false;
                } else {
                    hasBinaryTable = (rawPackSize & BIT_CONTAINS_BINARY) !== 0;
                    packSize = rawPackSize & ~BIT_CONTAINS_BINARY;
                }

                sectionHeaders.push({
                    index: secIdx,
                    packSize,
                    rawPackSize,
                    isOldSection,
                    hasBinaryTable,
                });
            }

            // Step 4: 读取所有 section body
            for (const header of sectionHeaders) {
                const bodyData = reader.read(header.packSize);

                let binTableData: Buffer | null = null;
                if (header.hasBinaryTable) {
                    const binSize = reader.readUInt32BE();
                    binTableData = reader.read(binSize);
                    console.log(`[GmpParser] Section ${header.index} 包含二进制表: ${binSize} bytes`);
                }

                this.sections.set(header.index, {
                    header,
                    body: bodyData,
                    isOldSection: header.isOldSection,
                    binTable: binTableData,
                });
            }

            // 统计新旧版 Section 数量
            let oldCount = 0;
            let newCount = 0;
            this.sections.forEach((sec) => {
                if (sec.isOldSection) {
                    oldCount++;
                } else {
                    newCount++;
                }
            });
            console.log(`[GmpParser] 解析完成: ${oldCount} 个旧版 Section, ${newCount} 个新版 Section`);
            return true;

        } catch (e) {
            console.log(`[GmpParser] 解析失败: ${e}`);
            return false;
        }
    }

    /**
     * 解析 GMP header
     */
    private unpackHeader(reader: BufferReader): void {
        const uuidBytes = reader.read(16);
        const version = reader.readUInt16BE();
        const packSize = reader.readUInt32BE();

        this.header = {
            uuid: uuidBytes,
            version,
            packSize,
        };

        if (version >= 5) {
            const createStampBuf = reader.read(12);
            const editorPackStampBuf = reader.read(12);
            this.header.createStamp = createStampBuf.toString('utf-8').replace(/\x00/g, '');
            this.header.editorPackStamp = editorPackStampBuf.toString('utf-8').replace(/\x00/g, '');
        }

        console.log(`[GmpParser] Header: version=${version}, packSize=${packSize}`);
    }

    /**
     * 提取物编相关的 Section 数据
     */
    extractPrefabSections(sectionIndexMap: Map<string, number>): Map<string, Buffer> {
        for (const sectionName of PREFAB_SECTIONS) {
            const secIdx = sectionIndexMap.get(sectionName);
            if (secIdx !== undefined && this.sections.has(secIdx)) {
                const secData = this.sections.get(secIdx)!;
                this.prefabData.set(sectionName, secData.body);
                console.log(`[GmpParser] 提取 ${sectionName} (idx=${secIdx}), 大小: ${secData.body.length} bytes`);
            }
        }

        // 保存其他 Section 数据
        const prefabIndexes = new Set<number>();
        for (const name of PREFAB_SECTIONS) {
            const idx = sectionIndexMap.get(name);
            if (idx !== undefined) {
                prefabIndexes.add(idx);
            }
        }

        this.sections.forEach((secData, secIdx) => {
            if (!prefabIndexes.has(secIdx)) {
                this.otherData.set(secIdx, secData);
            }
        });

        console.log(`[GmpParser] 提取了 ${this.prefabData.size} 个物编 Section，${this.otherData.size} 个其他 Section`);
        return this.prefabData;
    }

    /**
     * 获取非物编的其他 Section 数据
     */
    getOtherSections(): Map<number, SectionData> {
        return this.otherData;
    }
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 在地图文件夹下查找 .gmp 文件
 */
function findGmpFile(mapPath: string): string | null {
    if (!fs.existsSync(mapPath)) {
        return null;
    }

    const files = fs.readdirSync(mapPath);
    for (const filename of files) {
        if (filename.endsWith('.gmp')) {
            const gmpPath = path.join(mapPath, filename);
            console.log(`[y3-save-gmp] 找到 GMP 文件: ${gmpPath}`);
            return gmpPath;
        }
    }

    return null;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 生成 Section 索引
 *
 * 基于 map_section_prop_new.py 中的 gen_section_idx 函数实现。
 */
function genSectionIdx(secName: string, currIndexes: Set<number>): number {
    const hash = crypto.createHash('md5').update(secName, 'utf-8').digest();

    // big_part: (b[-4] ^ b[-2]) & 0xFF
    let bigPart = (hash[hash.length - 4] ^ hash[hash.length - 2]) & 0xFF;
    if (bigPart === 0) {
        bigPart = hash[hash.length - 4] & 0xFF;
    }
    if (bigPart === 0) {
        bigPart = hash[hash.length - 2] & 0xFF;
    }
    if (bigPart === 0) {
        bigPart = 1;
    }

    // small_part: (b[-3] ^ b[-1]) & 0xFF
    const smallPart = (hash[hash.length - 3] ^ hash[hash.length - 1]) & 0xFF;

    // 组合索引
    let idx = (bigPart << 8) | smallPart;

    // 冲突处理
    while (currIndexes.has(idx)) {
        idx = (idx + 1) & 0xFFFF;
    }

    return idx;
}

/**
 * 获取 Section 名称到索引的映射
 */
function getSectionIndexMapInternal(): Map<string, number> {
    const ALL_SECTIONS = [
        "desc",
        "tech_data",
        "user_data",
        "camp_info",
        "tags_data",
        "editor_mode_info",
        "object_editor_template",
        "modifier_all",
        "sound_all",
        "technology_all",
        "ability_all",
        "projectile_all",
        "store_all",
        "state_all",
        "editor_unit",
        "editor_decoration",
        "editor_item",
        "editor_destructible",
        "physic_object",
        "physics_object_logic",
        "editor_language_us",
        "editor_language_zh",
        "editor_language_tw",
        "editor_language_fr",
        "editor_language_es",
        "editor_language_kr",
        "editor_language_jp",
    ];

    const indexes = new Map<string, number>();
    const usedIndexes = new Set<number>();

    for (const secName of ALL_SECTIONS) {
        const idx = genSectionIdx(secName, usedIndexes);
        indexes.set(secName, idx);
        usedIndexes.add(idx);
    }

    // 只返回物编相关的 Section
    const prefabIndexes = new Map<string, number>();
    for (const name of PREFAB_SECTIONS) {
        const idx = indexes.get(name);
        if (idx !== undefined) {
            prefabIndexes.set(name, idx);
        }
    }

    return prefabIndexes;
}

// 缓存索引映射
let _sectionIndexCache: Map<string, number> | null = null;

function getSectionIndexMap(): Map<string, number> {
    if (_sectionIndexCache === null) {
        _sectionIndexCache = getSectionIndexMapInternal();
        console.log(`[y3-save-gmp] Section 索引映射:`);
        _sectionIndexCache.forEach((idx, name) => {
            console.log(`  - ${name}: ${idx} (0x${idx.toString(16).toUpperCase().padStart(4, '0')})`);
        });
    }
    return _sectionIndexCache;
}

// ============================================================
// 数据打包/解包函数
// ============================================================

/**
 * 将字典数据打包为 Section 二进制格式（新版 Section / 物编用）
 * 打包流程：dict -> JSON string -> msgpack -> zstd
 * 使用 Zstd 单例避免重复初始化 WASM 导致 OOM
 * 
 * 注意：物编 Section 使用 SplitSection/DictSection，打包时先转 JSON 字符串再 msgpack
 * Python 版本的流程是 embed.packb(json_str) -> zstd.compress()
 * 参见 section_base.py 中 SplitSection._packs() 和 DictSection._packs()
 */
async function packSectionDataNewStyle(data: Record<string, any>): Promise<Buffer> {
    // 1. JSON 序列化
    const jsonStr = JSON.stringify(data);

    // 2. msgpack 编码 JSON 字符串
    const packed = msgpack.encode(jsonStr);

    // 3. zstd 压缩（使用单例）
    const simple = await getZstdSimple();
    const compressed = simple.compress(packed, COMPRESS_LEVEL);
    return Buffer.from(compressed);
}

/**
 * 将字典数据打包为 Section 二进制格式（旧版 Section / 语言用）
 * 打包流程：dict -> msgpack -> zstd
 * 使用 Zstd 单例避免重复初始化 WASM 导致 OOM
 * 
 * 注意：旧版 Section (如 LanguageSection) 使用 NormalUploadSection，直接 msgpack 编码字典
 * Python 版本的流程是 embed.packb(self.data) -> zstd.compress()
 * 参见 MapSection.py 中 NormalUploadSection.calc_pack_size()
 */
async function packSectionDataOldStyle(data: Record<string, any>): Promise<Buffer> {
    // 1. msgpack 编码（直接编码字典，不转 JSON 字符串）
    const packed = msgpack.encode(data);

    // 2. zstd 压缩（使用单例）
    const simple = await getZstdSimple();
    const compressed = simple.compress(packed, COMPRESS_LEVEL);
    return Buffer.from(compressed);
}

// ============================================================
// 从 editor_table 文件夹读取 JSON 并生成 Section 数据
// ============================================================

/**
 * 读取文件夹下所有 JSON 文件，合并为一个大字典
 */
function loadJsonFolderAsDict(folderPath: string): Record<number, any> {
    const result: Record<number, any> = {};

    if (!fs.existsSync(folderPath)) {
        console.log(`[y3-save-gmp] 文件夹不存在: ${folderPath}`);
        return result;
    }

    const files = fs.readdirSync(folderPath);
    for (const filename of files) {
        if (!filename.endsWith('.json')) {
            continue;
        }

        const filePath = path.join(folderPath, filename);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);

            // 从文件名或数据中获取 ID
            let objId: number;
            if ('uid' in data) {
                objId = parseInt(data.uid, 10);
            } else {
                objId = parseInt(filename.replace('.json', ''), 10);
            }

            result[objId] = data;

        } catch (e) {
            console.log(`[y3-save-gmp] 读取 ${filename} 失败: ${e}`);
        }
    }

    console.log(`[y3-save-gmp] 从 ${folderPath} 加载了 ${Object.keys(result).length} 个物编`);
    return result;
}

/**
 * 从 editor_table 文件夹构建所有物编 Section 的二进制数据
 * 即使文件夹为空，也会打包空字典，保持流程统一
 */
async function buildPrefabSectionsFromEditorTable(mapPath: string): Promise<Map<string, Buffer>> {
    const result = new Map<string, Buffer>();
    const editorTablePath = path.join(mapPath, 'editor_table');

    // 即使 editor_table 目录不存在，也为所有 Section 打包空字典
    const editorTableExists = fs.existsSync(editorTablePath);
    if (!editorTableExists) {
        console.log(`[y3-save-gmp] editor_table 目录不存在: ${editorTablePath}，将打包空字典`);
    }

    for (const [sectionName, folderName] of Object.entries(SECTION_TO_FOLDER)) {
        const folderPath = path.join(editorTablePath, folderName);

        // 读取文件夹下所有 JSON（如果文件夹不存在则返回空字典）
        let dataDict: Record<number, any> | null = {};
        
        if (editorTableExists && fs.existsSync(folderPath)) {
            dataDict = loadJsonFolderAsDict(folderPath);
        }
        
        const itemCount = Object.keys(dataDict).length;

        // 无论是否为空，都打包为二进制（物编使用 NewStyle：dict -> JSON string -> msgpack -> zstd）
        const compressed = await packSectionDataNewStyle(dataDict);
        result.set(sectionName, compressed);
        console.log(`[y3-save-gmp] 构建 ${sectionName}: ${itemCount} 个物编, ${compressed.length} bytes`);
        
        // 及时释放内存引用
        dataDict = null;
    }

    return result;
}

// ============================================================
// GMP 文件构建器
// ============================================================

interface BuilderSectionInfo {
    body: Buffer;
    isOld: boolean;
    binTable: Buffer | null;
}

/**
 * GMP 文件构建器
 * 将 Section 数据组装为 GMP 二进制文件。
 */
class GmpBuilder {
    private header: {
        uuid: Buffer;
        version: number;
        createStamp: string;
        editorPackStamp: string;
    } = {
        uuid: Buffer.alloc(16),
        version: 5,
        createStamp: '',
        editorPackStamp: '',
    };

    private sections: Map<number, BuilderSectionInfo> = new Map();

    /**
     * 设置 GMP header
     */
    setHeader(
        uuidBytes: Buffer,
        version: number,
        createStamp: string = '',
        editorPackStamp: string = ''
    ): void {
        this.header = {
            uuid: uuidBytes,
            version,
            createStamp,
            editorPackStamp,
        };
    }

    /**
     * 设置 Section 数据
     */
    setSection(
        secIdx: number,
        data: Buffer,
        isOldSection?: boolean,
        binTable: Buffer | null = null
    ): void {
        // 自动判断新旧版
        if (isOldSection === undefined) {
            isOldSection = secIdx < OLD_SECTION_ID_MAX;
        }

        this.sections.set(secIdx, {
            body: data,
            isOld: isOldSection,
            binTable,
        });
    }

    /**
     * 构建 GMP 二进制文件
     */
    build(): Buffer {
        // 准备 sections 列表（按索引排序）
        const sortedSections = Array.from(this.sections.entries()).sort((a, b) => a[0] - b[0]);

        // 计算总 pack_size
        let totalPackSize = 2; // sec_cnt
        for (const [, secInfo] of sortedSections) {
            const bodyLen = secInfo.body.length;
            const headerSize = 6; // 2 + 4

            let bodySize = bodyLen;
            if (!secInfo.isOld && secInfo.binTable) {
                bodySize += 4 + secInfo.binTable.length;
            }

            totalPackSize += headerSize + bodySize;
        }

        // 构建输出
        const buffers: (Uint8Array | Buffer)[] = [];

        // 1. 写入 header
        const { version, uuid } = this.header;
        buffers.push(uuid);

        const headerBuf = Buffer.alloc(6);
        headerBuf.writeUInt16BE(version, 0);
        headerBuf.writeUInt32BE(totalPackSize, 2);
        buffers.push(headerBuf);

        if (version >= 5) {
            const createStampBuf = Buffer.alloc(12);
            createStampBuf.write(this.header.createStamp.slice(0, 12), 0, 'utf-8');
            const editorPackStampBuf = Buffer.alloc(12);
            editorPackStampBuf.write(this.header.editorPackStamp.slice(0, 12), 0, 'utf-8');
            buffers.push(createStampBuf, editorPackStampBuf);
        }

        // 2. 写入 section 数量
        const secCntBuf = Buffer.alloc(2);
        secCntBuf.writeUInt16BE(sortedSections.length, 0);
        buffers.push(secCntBuf);

        // 3. 写入每个 section 的 header
        for (const [secIdx, secInfo] of sortedSections) {
            const bodyLen = secInfo.body.length;
            const secHeaderBuf = Buffer.alloc(6);
            secHeaderBuf.writeUInt16BE(secIdx, 0);

            if (secInfo.isOld) {
                secHeaderBuf.writeUInt32BE(bodyLen, 2);
            } else {
                if (secInfo.binTable) {
                    secHeaderBuf.writeUInt32BE((bodyLen | BIT_CONTAINS_BINARY) >>> 0, 2);
                } else {
                    secHeaderBuf.writeUInt32BE(bodyLen, 2);
                }
            }
            buffers.push(secHeaderBuf);
        }

        // 4. 写入每个 section 的 body
        for (const [, secInfo] of sortedSections) {
            buffers.push(secInfo.body);

            if (!secInfo.isOld && secInfo.binTable) {
                const binSizeBuf = Buffer.alloc(4);
                binSizeBuf.writeUInt32BE(secInfo.binTable.length, 0);
                buffers.push(binSizeBuf, secInfo.binTable);
            }
        }

        return Buffer.concat(buffers as Uint8Array[]);
    }

    /**
     * 保存 GMP 文件
     */
    save(filePath: string): void {
        const data = this.build();
        fs.writeFileSync(filePath, new Uint8Array(data));
        console.log(`[GmpBuilder] 保存 GMP 文件: ${filePath} (${data.length} bytes)`);
    }
}

// ============================================================
// UI 数据处理
// ============================================================

/**
 * 递归转换 JSON 中的 tuple 格式
 */
function convertTupleFormat(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
        // 检查是否是 tuple 格式
        if (obj.__tuple__ === true && 'items' in obj) {
            return (obj.items as any[]).map(item => convertTupleFormat(item));
        } else {
            const result: Record<string, any> = {};
            for (const [k, v] of Object.entries(obj)) {
                result[k] = convertTupleFormat(v);
            }
            return result;
        }
    } else if (Array.isArray(obj)) {
        return obj.map(item => convertTupleFormat(item));
    } else {
        return obj;
    }
}

interface UIScanResult {
    uiConfig: string | null;
    prefabFiles: string[];
    layerFiles: string[];
}

/**
 * 扫描 ui/ 目录下的所有 UI JSON 文件
 */
function scanUIFolder(mapPath: string): UIScanResult {
    const result: UIScanResult = {
        uiConfig: null,
        prefabFiles: [],
        layerFiles: [],
    };

    const uiPath = path.join(mapPath, 'ui');

    if (!fs.existsSync(uiPath)) {
        console.log(`[y3-save-gmp] UI 目录不存在: ${uiPath}`);
        return result;
    }

    const files = fs.readdirSync(uiPath);
    for (const filename of files) {
        const filePath = path.join(uiPath, filename);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (filename === 'prefab') {
                const prefabFiles = fs.readdirSync(filePath);
                for (const prefabFile of prefabFiles) {
                    if (prefabFile.endsWith('.json')) {
                        result.prefabFiles.push(path.join(filePath, prefabFile));
                    }
                }
            }
        } else if (filename.endsWith('.json')) {
            if (filename === 'ui_config.json') {
                result.uiConfig = filePath;
            } else {
                result.layerFiles.push(filePath);
            }
        }
    }

    console.log(`[y3-save-gmp] 扫描 UI 目录: ${result.prefabFiles.length} 个面板, ${result.layerFiles.length} 个层`);
    return result;
}

/**
 * 从 ui/ 目录构建 UI 数据结构
 * 即使 UI 目录为空，也返回空的 UI 数据结构，保持流程统一
 */
function buildUIData(mapPath: string): Record<string, any> {
    const scanResult = scanUIFolder(mapPath);

    // 初始化空的 UI 数据结构
    const uiData: Record<string, any> = {
        ui_data: [],
        prefab_data: {},
    };

    // 即使没有找到任何 UI 文件，也继续处理（返回空结构）
    if (!scanResult.uiConfig && scanResult.prefabFiles.length === 0 && scanResult.layerFiles.length === 0) {
        console.log(`[y3-save-gmp] 没有找到 UI 数据，将打包空字典`);
        return uiData;
    }

    // 1. 读取 ui_config.json 作为基础配置
    if (scanResult.uiConfig && fs.existsSync(scanResult.uiConfig)) {
        try {
            const content = fs.readFileSync(scanResult.uiConfig, 'utf-8');
            let configData = JSON.parse(content);
            configData = convertTupleFormat(configData);
            for (const [k, v] of Object.entries(configData)) {
                if (k !== 'ui_data' && k !== 'prefab_data') {
                    uiData[k] = v;
                }
            }
            console.log(`[y3-save-gmp] 读取 ui_config.json`);
        } catch (e) {
            console.log(`[y3-save-gmp] 读取 ui_config.json 失败: ${e}`);
        }
    }

    // 2. 读取 prefab/ 下的面板文件
    for (const prefabFile of scanResult.prefabFiles) {
        try {
            const content = fs.readFileSync(prefabFile, 'utf-8');
            let prefabJson = JSON.parse(content);
            prefabJson = convertTupleFormat(prefabJson);

            const key = prefabJson.key;
            if (key === undefined) {
                const filename = path.basename(prefabFile);
                throw new Error(`UI 面板 '${filename}' 缺少 'key' 字段`);
            }

            uiData.prefab_data[key] = prefabJson;
        } catch (e) {
            console.log(`[y3-save-gmp] 读取 ${prefabFile} 失败: ${e}`);
            // 继续处理其他文件，不中断流程
        }
    }

    // 3. 读取层 JSON 文件
    for (const layerFile of scanResult.layerFiles) {
        try {
            const content = fs.readFileSync(layerFile, 'utf-8');
            let layerJson = JSON.parse(content);
            layerJson = convertTupleFormat(layerJson);
            uiData.ui_data.push(layerJson);
        } catch (e) {
            console.log(`[y3-save-gmp] 读取 ${layerFile} 失败: ${e}`);
        }
    }

    console.log(`[y3-save-gmp] 构建 UI 数据: ${Object.keys(uiData.prefab_data).length} 个面板, ${uiData.ui_data.length} 个层`);
    return uiData;
}

/**
 * 从 ui/ 目录构建 UI Section 的二进制数据
 * 即使 UI 目录为空，也会打包空的 UI 数据结构
 * UI Section 继承自 NormalUploadSection，使用 OldStyle 打包
 */
async function buildUISection(mapPath: string): Promise<Buffer> {
    const uiData = buildUIData(mapPath);
    // UI Section 使用 OldStyle：dict -> msgpack -> zstd
    const compressed = await packSectionDataOldStyle(uiData);
    console.log(`[y3-save-gmp] 构建 UI Section: ${compressed.length} bytes`);
    return compressed;
}

// ============================================================
// 语言数据处理
// ============================================================

/**
 * 从指定的语言 JSON 文件构建 Language Section 的二进制数据
 * @param mapPath 地图根路径
 * @param languageFile 语言文件名（如 uslanguage.json 或 zhlanguage.json）
 * @returns 压缩后的二进制数据，如果文件不存在则返回 null
 */
async function buildLanguageSection(mapPath: string, languageFile: string): Promise<Buffer | null> {
    const languagePath = path.join(mapPath, languageFile);

    if (!fs.existsSync(languagePath)) {
        console.log(`[y3-save-gmp] 语言文件不存在: ${languagePath}`);
        return null;
    }

    try {
        const content = fs.readFileSync(languagePath, 'utf-8');
        const languageData = JSON.parse(content);
        // Language Section 继承自 NormalUploadSection，使用 OldStyle：dict -> msgpack -> zstd
        const compressed = await packSectionDataOldStyle(languageData);
        console.log(`[y3-save-gmp] 构建 ${languageFile} Section: ${compressed.length} bytes`);
        return compressed;
    } catch (e) {
        console.log(`[y3-save-gmp] 读取 ${languageFile} 失败: ${e}`);
        return null;
    }
}

/**
 * 构建 USLanguage Section 的二进制数据
 */
async function buildUSLanguageSection(mapPath: string): Promise<Buffer | null> {
    return buildLanguageSection(mapPath, 'uslanguage.json');
}

/**
 * 构建 ZHLanguage Section 的二进制数据
 */
async function buildZHLanguageSection(mapPath: string): Promise<Buffer | null> {
    return buildLanguageSection(mapPath, 'zhlanguage.json');
}

// ============================================================
// 统一 GMP 重建
// ============================================================

/**
 * 重建 GMP 文件（支持物编、UI 和语言）
 */
function rebuildGmpFull(
    originalParser: GmpParser,
    newPrefabSections: Map<string, Buffer> | null,
    newUISection: Buffer | null,
    newUSLanguageSection: Buffer | null = null,
    newZHLanguageSection: Buffer | null = null
): Buffer {
    const builder = new GmpBuilder();

    // 复制原始 header
    builder.setHeader(
        originalParser.header.uuid || Buffer.alloc(16),
        originalParser.header.version || 5,
        originalParser.header.createStamp || '',
        originalParser.header.editorPackStamp || ''
    );

    // 获取 Section 索引映射
    const sectionIndexMap = getSectionIndexMap();

    // 需要替换的 Section 索引集合
    const replaceIndexes = new Set<number>();

    // 物编 Section 索引
    if (newPrefabSections) {
        newPrefabSections.forEach((_, sectionName) => {
            const idx = sectionIndexMap.get(sectionName);
            if (idx !== undefined) {
                replaceIndexes.add(idx);
            }
        });
    }

    // UI Section 索引
    if (newUISection !== null) {
        replaceIndexes.add(UI_SECTION_ID);
    }

    // USLanguage Section 索引
    if (newUSLanguageSection !== null) {
        replaceIndexes.add(US_LANGUAGE_SECTION_ID);
    }

    // ZHLanguage Section 索引
    if (newZHLanguageSection !== null) {
        replaceIndexes.add(ZH_LANGUAGE_SECTION_ID);
    }

    // 添加原始的 Section（排除需要替换的）
    let oldSectionCount = 0;
    let newSectionCount = 0;

    originalParser.sections.forEach((secData, secIdx) => {
        if (!replaceIndexes.has(secIdx)) {
            const isOld = secData.isOldSection;
            builder.setSection(secIdx, secData.body, isOld, secData.binTable);

            if (isOld) {
                oldSectionCount++;
            } else {
                newSectionCount++;
            }
        }
    });

    console.log(`[rebuildGmpFull] 保留原始 Section: ${oldSectionCount} 个旧版, ${newSectionCount} 个新版`);

    // 添加新的物编 Section
    if (newPrefabSections) {
        newPrefabSections.forEach((data, sectionName) => {
            const secIdx = sectionIndexMap.get(sectionName);
            if (secIdx !== undefined) {
                builder.setSection(secIdx, data, false, null);
                console.log(`[rebuildGmpFull] 替换物编 ${sectionName} (idx=${secIdx})`);
            }
        });
    }

    // 添加新的 UI Section
    if (newUISection !== null) {
        builder.setSection(UI_SECTION_ID, newUISection, true, null);
        console.log(`[rebuildGmpFull] 替换 UI Section (idx=${UI_SECTION_ID})`);
    }

    // 添加新的 USLanguage Section
    if (newUSLanguageSection !== null) {
        builder.setSection(US_LANGUAGE_SECTION_ID, newUSLanguageSection, true, null);
        console.log(`[rebuildGmpFull] 替换 USLanguage Section (idx=${US_LANGUAGE_SECTION_ID})`);
    }

    // 添加新的 ZHLanguage Section
    if (newZHLanguageSection !== null) {
        builder.setSection(ZH_LANGUAGE_SECTION_ID, newZHLanguageSection, true, null);
        console.log(`[rebuildGmpFull] 替换 ZHLanguage Section (idx=${ZH_LANGUAGE_SECTION_ID})`);
    }

    return builder.build();
}

/**
 * 统一的 GMP 重建入口
 */
async function saveGmpWithNewData(
    mapPath: string,
    updatePrefabs: boolean = true,
    updateUI: boolean = true,
    updateUSLanguage: boolean = true,
    updateZHLanguage: boolean = true,
    outputPath?: string
): Promise<SaveResult> {
    // Step 1: 查找 .gmp 文件
    const gmpFile = findGmpFile(mapPath);

    if (!gmpFile) {
        return {
            success: false,
            message: `在 ${mapPath} 下未找到 .gmp 文件`,
        };
    }

    // Step 2: 解析原始 GMP
    const parser = new GmpParser();
    if (!parser.parse(gmpFile)) {
        return {
            success: false,
            message: '解析 GMP 文件失败',
        };
    }

    // Step 3: 构建新的 Section 数据（即使为空也打包空字典）
    let newPrefabSections: Map<string, Buffer> | null = null;
    let newUISection: Buffer | null = null;
    let newUSLanguageSection: Buffer | null = null;
    let newZHLanguageSection: Buffer | null = null;

    if (updatePrefabs) {
        newPrefabSections = await buildPrefabSectionsFromEditorTable(mapPath);
        console.log(`[y3-save-gmp] 物编 Section 数量: ${newPrefabSections.size}`);
    }

    if (updateUI) {
        newUISection = await buildUISection(mapPath);
        console.log(`[y3-save-gmp] UI Section 大小: ${newUISection.length} bytes`);
    }

    if (updateUSLanguage) {
        newUSLanguageSection = await buildUSLanguageSection(mapPath);
        if (newUSLanguageSection) {
            console.log(`[y3-save-gmp] USLanguage Section 大小: ${newUSLanguageSection.length} bytes`);
        }
    }

    if (updateZHLanguage) {
        newZHLanguageSection = await buildZHLanguageSection(mapPath);
        if (newZHLanguageSection) {
            console.log(`[y3-save-gmp] ZHLanguage Section 大小: ${newZHLanguageSection.length} bytes`);
        }
    }

    // 检查是否有数据需要更新
    if (!updatePrefabs && !updateUI && !updateUSLanguage && !updateZHLanguage) {
        return {
            success: false,
            message: '没有指定需要更新的数据类型（物编、UI 或语言）',
        };
    }

    // Step 4: 重建 GMP
    const newGmpData = rebuildGmpFull(parser, newPrefabSections, newUISection, newUSLanguageSection, newZHLanguageSection);

    // Step 5: 保存
    const outputFile = outputPath || gmpFile;

    // 备份原文件
    if (outputFile === gmpFile) {
        const backupFile = gmpFile + '.bak';
        fs.copyFileSync(gmpFile, backupFile);
        console.log(`[y3-save-gmp] 备份原文件: ${backupFile}`);
    }

    fs.writeFileSync(outputFile, new Uint8Array(newGmpData));

    // 构建返回结果
    const result: SaveResult = {
        success: true,
        message: `GMP 重建成功: ${outputFile}`,
        outputSize: newGmpData.length,
    };

    if (newPrefabSections) {
        result.sectionsReplaced = Array.from(newPrefabSections.keys());
    }

    if (newUISection) {
        result.uiSectionSize = newUISection.length;
    }

    return result;
}

// ============================================================
// 主入口函数（对外暴露的 API）
// ============================================================

/**
 * Y3 GMP 保存钩子 - 主入口函数
 *
 * 当 AI 对以下目录/文件进行增删改时，在所有操作完成后调用一次此函数：
 * - editor_table/    : 物编 JSON 文件
 * - ui/              : UI JSON 文件
 * - uslanguage.json  : 英文语言文件
 * - zhlanguage.json  : 中文语言文件
 *
 * 核心原则：无论修改一个还是多个文件，只在最后调用一次 save()！
 *
 * @param mapPath 地图根路径（如 "maps/EntryMap"）
 * @param options 选项
 * @returns 处理结果
 *
 * @example
 * // 修改物编后
 * const result = await save("maps/EntryMap", { updatePrefabs: true, updateUI: false, updateUSLanguage: false, updateZHLanguage: false });
 *
 * // 修改 UI 后
 * const result = await save("maps/EntryMap", { updatePrefabs: false, updateUI: true, updateUSLanguage: false, updateZHLanguage: false });
 *
 * // 修改语言文件后
 * const result = await save("maps/EntryMap", { updatePrefabs: false, updateUI: false });
 *
 * // 同时修改物编、UI 和语言后
 * const result = await save("maps/EntryMap");
 */
export async function save(mapPath: string, options: SaveOptions = {}): Promise<SaveResult> {
    const {
        updatePrefabs = true,
        updateUI = true,
        updateUSLanguage = true,
        updateZHLanguage = true,
        outputPath,
    } = options;

    return saveGmpWithNewData(mapPath, updatePrefabs, updateUI, updateUSLanguage, updateZHLanguage, outputPath);
}

// 导出其他可能有用的函数和类
export {
    GmpParser,
    GmpBuilder,
    findGmpFile,
    getSectionIndexMap,
    packSectionDataNewStyle,
    packSectionDataOldStyle,
    buildPrefabSectionsFromEditorTable,
    buildUISection,
    buildUSLanguageSection,
    buildZHLanguageSection,
    PREFAB_SECTIONS,
    SECTION_TO_FOLDER,
    UI_SECTION_ID,
    US_LANGUAGE_SECTION_ID,
    ZH_LANGUAGE_SECTION_ID,
};

export type {
    SaveResult,
    SaveOptions,
    SectionData,
    GmpHeader,
};
