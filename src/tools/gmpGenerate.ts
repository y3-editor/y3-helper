import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { writeGeneratedGmp } from './gmpWrite';
import { readEditorPickle } from './gmpPickle';
import { decodeGmpValue, encodeGmpValue, equalGmpValue, GmpValue, utf8 } from './gmpValue';
import { parseGmpJson } from './gmpJson';
import { rebuildRuntimeTableSection } from './gmpTableSection';
import { rebuildArchiveSection } from './gmpArchiveSection';

import {
    GmpBuilder,
    GmpParser,
    buildLanguageSection,
    buildPrefabSectionsFromEditorTable,
    buildUISection,
    compressZstd,
    decompressZstd,
    packSectionDataNewStyle,
    packSectionDataOldStyle,
} from './y3SaveGmp';

export interface GmpMapContext {
    name: string;
    displayName?: string;
    path: string;
    id?: string;
}

export interface GmpProjectContext {
    projectPath: string;
    entryMapName: string;
    maps: GmpMapContext[];
    useMainLevelTriggerAndObject: boolean;
    useMainLevelUI: boolean;
    projectFormat?: { majorVersion: string; physicsMode: string };
}

export interface GenerateGmpOptions {
    dryRun?: boolean;
    /** 仅供本地校验使用：把生成结果一并返回，不写入磁盘。 */
    captureOutput?: boolean;
}

export interface MapGmpResult {
    name: string;
    displayName?: string;
    gmpFile: string;
    changed: boolean;
    replacedSections: string[];
    addedSections?: string[];
    removedSections?: string[];
    preservedSections: string[];
    sectionNotes?: Record<string, string>;
    warnings?: string[];
    errors: string[];
    outputSize?: number;
    outputBase64?: string;
}

export interface GenerateGmpResult {
    success: boolean;
    projectPath?: string;
    dryRun: boolean;
    maps: MapGmpResult[];
    message?: string;
}

type SectionKind =
    | 'prefab'
    | 'ui'
    | 'language'
    | 'json-new'
    | 'json-old'
    | 'raw-zstd'
    | 'zlib-zstd'
    | 'texture'
    | 'scene'
    | 'tables'
    | 'archive'
    | 'raw'
    | 'lua'
    | 'preserve';

type SharedKind = 'none' | 'trigger' | 'ui';

export interface SectionDef {
    name: string;
    oldId?: number;
    kind: SectionKind;
    file?: string;
    shared?: SharedKind;
}

/**
 * 与 commons/map_res/map_data.py 中 SectionProp 的声明顺序保持一致。
 * 新版 section 的 index 由名称哈希生成，旧版 section 使用固定 ID。
 */
export const SECTION_DEFS: SectionDef[] = [
    { name: 'desc', kind: 'json-new', file: 'desc.json' },
    { name: 'tech_data', kind: 'json-new', file: 'tech.json' },
    // userdata.json 会落后于编辑器内存状态，直接重建可能覆盖编辑器设置。
    { name: 'user_data', kind: 'preserve' },
    { name: 'camp_info', kind: 'json-new', file: 'campinfo.json' },
    { name: 'tags_data', kind: 'json-new', file: 'tags.json' },
    { name: 'editor_mode_info', kind: 'json-new', file: 'editormodeinfo.json' },
    { name: 'object_editor_template', kind: 'json-new', file: 'objecteditortemplate.json' },

    { name: 'modifier_all', kind: 'prefab', shared: 'trigger' },
    { name: 'sound_all', kind: 'prefab', shared: 'trigger' },
    { name: 'technology_all', kind: 'prefab', shared: 'trigger' },
    { name: 'ability_all', kind: 'prefab', shared: 'trigger' },
    { name: 'projectile_all', kind: 'prefab', shared: 'trigger' },
    { name: 'store_all', kind: 'prefab', shared: 'trigger' },
    { name: 'state_all', kind: 'prefab', shared: 'trigger' },
    { name: 'editor_unit', kind: 'prefab', shared: 'trigger' },
    { name: 'editor_decoration', kind: 'prefab', shared: 'trigger' },
    { name: 'editor_item', kind: 'prefab', shared: 'trigger' },
    { name: 'editor_destructible', kind: 'prefab', shared: 'trigger' },
    { name: 'physic_object', kind: 'prefab', shared: 'trigger' },
    { name: 'physics_object_logic', kind: 'prefab', shared: 'trigger' },

    { name: 'editor_language_us', oldId: 49, kind: 'language', file: 'uslanguage.json', shared: 'trigger' },
    { name: 'editor_language_zh', oldId: 50, kind: 'language', file: 'zhlanguage.json', shared: 'trigger' },
    { name: 'editor_language_tw', oldId: 120, kind: 'language', file: 'twlanguage.json', shared: 'trigger' },
    { name: 'editor_language_fr', oldId: 121, kind: 'language', file: 'frlanguage.json', shared: 'trigger' },
    { name: 'editor_language_es', oldId: 122, kind: 'language', file: 'eslanguage.json', shared: 'trigger' },
    { name: 'editor_language_kr', oldId: 123, kind: 'language', file: 'krlanguage.json', shared: 'trigger' },
    { name: 'editor_language_jp', oldId: 124, kind: 'language', file: 'jplanguage.json', shared: 'trigger' },

    { name: 'terrain_data', oldId: 12, kind: 'raw-zstd', file: 'terrain.json' },
    { name: 'navimap', oldId: 3, kind: 'zlib-zstd', file: 'navimap.data' },
    { name: 'dec_data', oldId: 4, kind: 'scene', file: 'decorationdata.data' },
    { name: 'trigger_data', oldId: 6, kind: 'preserve', shared: 'trigger' },
    { name: 'resource_data', oldId: 8, kind: 'preserve' },
    { name: 'ai_data', oldId: 9, kind: 'json-old', file: 'ai.json' },
    { name: 'ui_data', oldId: 10, kind: 'ui', shared: 'ui' },
    { name: 'texture_data', oldId: 93, kind: 'texture', file: 'texture.json' },
    { name: 'texture_foliage_data', oldId: 105, kind: 'texture', file: 'texturefoliage.json' },
    { name: 'foliage_data', oldId: 87, kind: 'raw-zstd', file: 'foliage.json' },
    { name: 'foliage_using_data', oldId: 140, kind: 'json-old', file: 'foliageusing.json' },
    { name: 'ui_trigger', oldId: 113, kind: 'preserve' },
    { name: 'ability_trigger', oldId: 13, kind: 'preserve' },
    { name: 'unit_trigger', oldId: 20, kind: 'preserve' },
    { name: 'modifier_trigger', oldId: 14, kind: 'preserve' },
    { name: 'projectile_trigger', oldId: 15, kind: 'preserve' },
    { name: 'destructible_trigger', oldId: 84, kind: 'preserve' },
    { name: 'platform_trigger', oldId: 89, kind: 'preserve' },
    { name: 'physics_entity_trigger', oldId: 90, kind: 'preserve' },
    { name: 'state_trigger', oldId: 138, kind: 'preserve' },
    { name: 'item_trigger', oldId: 52, kind: 'preserve' },
    { name: 'unit_data', oldId: 19, kind: 'json-old', file: 'unit.json' },
    { name: 'rule_data', oldId: 21, kind: 'json-old', file: 'ruledata.json' },
    { name: 'decal_data', oldId: 22, kind: 'json-old', file: 'decal.json' },
    { name: 'ui_anim_data', oldId: 25, kind: 'json-old', file: 'uianim.json', shared: 'ui' },
    { name: 'cam_anim_data', oldId: 104, kind: 'json-old', file: 'cameraanim.json' },
    { name: 'curve_data', oldId: 118, kind: 'json-old', file: 'curve.json' },
    { name: 'tod_template_data', oldId: 134, kind: 'json-old', file: 'todtemplate.json' },
    { name: 'engine_effect_data', oldId: 26, kind: 'json-old', file: 'engineeffectdata.json' },
    { name: 'mini_map_image_data', oldId: 31, kind: 'raw', file: 'minimapimage.png' },
    // logicres.json 丢失了嵌套 tuple 的类型信息，当前无法无损重建。
    { name: 'logic_res', oldId: 56, kind: 'preserve' },
    {
        name: 'global_trigger_variable',
        oldId: 58,
        kind: 'json-old',
        file: 'globaltriggervariable.json',
        shared: 'trigger',
    },
    { name: 'attr_data', oldId: 67, kind: 'json-old', file: 'attr.json', shared: 'trigger' },
    { name: 'damage_data', oldId: 68, kind: 'json-old', file: 'damage.json' },
    { name: 'item_type_data', oldId: 69, kind: 'json-old', file: 'itemtype.json' },
    { name: 'collision_layer_data', oldId: 70, kind: 'json-old', file: 'collisionlayer.json' },
    { name: 'item_data', oldId: 71, kind: 'json-old', file: 'item.json' },
    { name: 'scene_projectile_data', oldId: 73, kind: 'json-old', file: 'projectile.json' },
    { name: 'destructible_data', oldId: 80, kind: 'json-old', file: 'destructible.json' },
    { name: 'grid_data', oldId: 83, kind: 'preserve' },
    { name: 'global_weather', oldId: 86, kind: 'json-old', file: 'globalweather.json' },
    { name: 'lua_file_data', oldId: 88, kind: 'lua', file: 'script' },
    { name: 'custom_resource', oldId: 91, kind: 'preserve' },
    { name: 'pinch', oldId: 92, kind: 'json-old', file: 'editorpinch.json' },
    { name: 'terrain_edit_data', oldId: 94, kind: 'json-old', file: 'terrainedit.json' },
    { name: 'user_language_data', oldId: 54, kind: 'json-old', file: 'userlanguage.json' },
    { name: 'user_resource_data', oldId: 119, kind: 'json-old', file: 'userresource.json' },
    { name: 'archive_data', oldId: 95, kind: 'archive' },
    { name: 'global_archive_data', oldId: 110, kind: 'archive' },
    { name: 'precondition_data', oldId: 97, kind: 'json-old', file: 'precondition.json' },
    { name: 'table_editor_data', oldId: 98, kind: 'preserve', shared: 'trigger' },
    { name: 'env_time_data', oldId: 99, kind: 'json-old', file: 'envtime.json' },
    { name: 'table_data', oldId: 96, kind: 'tables', shared: 'trigger' },
    { name: 'tid_index_info', oldId: 100, kind: 'json-old', file: 'tidindexinfo.json' },
    { name: 'custom_event', oldId: 101, kind: 'json-old', file: 'customevent.json', shared: 'trigger' },
    { name: 'game_world_id', oldId: 103, kind: 'json-old', file: 'gameworld.json' },
    { name: 'skill_indicator', oldId: 107, kind: 'json-old', file: 'skillindicator.json' },
    {
        name: 'skill_joystick_indicator',
        oldId: 139,
        kind: 'json-old',
        file: 'skilljoystickindicator.json',
    },
    { name: 'custom_cursor_map', oldId: 108, kind: 'json-old', file: 'customcursormap.json' },
    { name: 'game_shortcut_data', oldId: 109, kind: 'json-old', file: 'gameshortcut.json' },
    { name: 'move_effect', oldId: 111, kind: 'json-old', file: 'moveeffect.json' },
    { name: 'manual_res_dep_data', oldId: 117, kind: 'json-old', file: 'manualdependence.json' },
    { name: 'cloud_res_dep_data', oldId: 116, kind: 'preserve' },
    { name: 'hit_point_data', oldId: 115, kind: 'json-old', file: 'hitpointdata.json' },
    { name: 'resource_object_data', oldId: 114, kind: 'scene', file: 'resourceobjectdata.data' },
    {
        name: 'amp_trigger_dep_explorer_keys',
        oldId: 125,
        kind: 'json-old',
        file: 'amptriggerexplorerkeys.json',
    },
    { name: 'plugins', oldId: 126, kind: 'json-old', file: 'mapplugin.json' },
    { name: 'physics_object_data', oldId: 128, kind: 'json-old', file: 'physicsobjectdata.json' },
    { name: 'physics_entity_data', oldId: 130, kind: 'json-old', file: 'physicsentitydata.json' },
    {
        name: 'map_edit_setting_data',
        oldId: 135,
        kind: 'json-old',
        file: 'mapeditsettingdata.json',
    },
    { name: 'custom_eca', oldId: 131, kind: 'preserve' },
    { name: 'custom_api', oldId: 132, kind: 'preserve' },
    { name: 'billboard_data', oldId: 133, kind: 'json-old', file: 'billboard.json' },
    { name: 'map_create_info', oldId: 136, kind: 'json-old', file: 'mapcreateinfo.json' },
    { name: 'jump_word_data', oldId: 137, kind: 'json-old', file: 'jumpword.json' },
];

export const SECTION_INDEXES = buildSectionIndexes();

function genSectionIdx(secName: string, used: Set<number>): number {
    const hash = crypto.createHash('md5').update(secName, 'utf-8').digest();

    let bigPart = (hash[hash.length - 4] ^ hash[hash.length - 2]) & 0xff;
    if (bigPart === 0) {
        bigPart = hash[hash.length - 4] & 0xff;
    }
    if (bigPart === 0) {
        bigPart = hash[hash.length - 2] & 0xff;
    }
    if (bigPart === 0) {
        bigPart = 1;
    }

    const smallPart = (hash[hash.length - 3] ^ hash[hash.length - 1]) & 0xff;
    let idx = (bigPart << 8) | smallPart;
    while (used.has(idx)) {
        idx = (idx + 1) & 0xffff;
    }
    return idx;
}

function buildSectionIndexes(): Map<string, number> {
    const used = new Set<number>();
    const indexes = new Map<string, number>();
    for (const def of SECTION_DEFS) {
        const idx = def.oldId ?? genSectionIdx(def.name, used);
        used.add(idx);
        indexes.set(def.name, idx);
    }
    return indexes;
}

function sectionIndex(def: SectionDef): number {
    return SECTION_INDEXES.get(def.name) ?? 0;
}

function readJsonFile(file: string): any | undefined {
    if (!fs.existsSync(file)) {
        return undefined;
    }
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    if (!text.trim()) {
        return undefined;
    }
    return JSON.parse(text);
}

function convertTuplesForMsgpack(value: any): any {
    if (Array.isArray(value)) {
        return value.map(convertTuplesForMsgpack);
    }
    if (value && typeof value === 'object') {
        if (value.__tuple__ === true && Array.isArray(value.items)) {
            return [...value.items.map(convertTuplesForMsgpack), Buffer.from([0x11])];
        }
        const result: Record<string, any> = {};
        for (const [key, child] of Object.entries(value)) {
            result[key] = convertTuplesForMsgpack(child);
        }
        return result;
    }
    return value;
}

function restoreSectionTuples(sectionName: string, data: any): any {
    const items = (value: any): any => value?.__tuple__ === true ? value.items : value;
    const tuple = (value: any): any => Array.isArray(value)
        ? { __tuple__: true, items: value } : value;

    if (sectionName === 'attr_data') {
        // PrimaryAttr.serialize() returns dict.items() pairs. hint_tuples()
        // does not preserve tuple hints below the outer attribute pair.
        for (const primary of data.p ?? []) {
            const attribute = items(primary)?.[1];
            if (Array.isArray(attribute?.m)) {
                attribute.m = attribute.m.map(tuple);
            }
        }
    }

    if (['unit_data', 'item_data', 'scene_projectile_data', 'destructible_data',
        'physics_object_data', 'physics_entity_data'].includes(sectionName)) {
        // BaseMovementMember.serialize_position() returns a tuple of three
        // Fix32.value tuples, even when JSON represents those values as lists.
        for (const group of Object.values(data)) {
            if (!group || typeof group !== 'object') {
                continue;
            }
            for (const entity of Object.values(group)) {
                const movement = entity?.components?.movement;
                const coordinates = items(movement?.position);
                if (Array.isArray(coordinates) && coordinates.length === 3
                    && coordinates.every((coordinate: any) => Array.isArray(items(coordinate))
                        && items(coordinate).length === 2)) {
                    movement.position = tuple(coordinates.map(tuple));
                }
            }
        }
    }
    return data;
}

function walkFiles(dir: string, result: string[] = []): string[] {
    if (!fs.existsSync(dir)) {
        return result;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            walkFiles(fullPath, result);
        } else if (entry.isFile()) {
            result.push(fullPath);
        }
    }
    return result;
}

function aesEncryptBase64(data: Buffer, keyText: string): Buffer {
    const key = crypto.createHash('sha1').update(keyText, 'utf8').digest().subarray(0, 16);
    const cipher = crypto.createCipheriv('aes-128-cbc', key, key);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.from(encrypted.toString('base64'), 'utf8');
}

async function buildLuaSection(scriptPath: string): Promise<Buffer | undefined> {
    if (!fs.existsSync(scriptPath)) {
        return undefined;
    }

    const files = walkFiles(scriptPath)
        .map((file) => ({
            file,
            relative: path.relative(scriptPath, file),
        }))
        .sort((a, b) => a.relative.localeCompare(b.relative));

    const parts: Buffer[] = [];
    parts.push(Buffer.from('SCLDVER:', 'ascii'));
    const version = Buffer.alloc(2);
    version.writeUInt16BE(2, 0);
    parts.push(version);
    const meta = Buffer.alloc(4);
    meta.writeUInt32BE(0x10, 0);
    parts.push(meta);

    for (const { file, relative } of files) {
        const relativeBuffer = Buffer.from(relative, 'utf8');
        let raw = fs.readFileSync(file);
        if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
            raw = raw.subarray(3);
        }
        const encrypted = aesEncryptBase64(raw, 'XzFJ9dA92CaPSYOIuhbCqdh');
        const compressed = await compressZstd(encrypted);

        const pathLength = Buffer.alloc(2);
        pathLength.writeUInt16BE(relativeBuffer.length, 0);
        const dataLength = Buffer.alloc(4);
        dataLength.writeUInt32BE(compressed.length, 0);
        parts.push(pathLength, relativeBuffer, dataLength, compressed);
    }

    return Buffer.concat(parts);
}

interface SourceCache {
    prefabs: Map<string, Buffer>;
    ui: Buffer;
}

const sourceCaches = new Map<string, Promise<SourceCache>>();

function getSourceCache(mapPath: string): Promise<SourceCache> {
    let cache = sourceCaches.get(mapPath);
    if (!cache) {
        cache = (async () => {
            const [prefabs, ui] = await Promise.all([
                buildPrefabSectionsFromEditorTable(mapPath),
                buildUISection(mapPath),
            ]);
            return { prefabs, ui };
        })();
        sourceCaches.set(mapPath, cache);
    }
    return cache;
}

function readOptional(file: string): Buffer | undefined {
    try {
        return fs.readFileSync(file);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

function inflateEditorSource(bytes: Buffer): Buffer {
    const result = zlib.inflateSync(bytes, { maxOutputLength: 64 * 1024 * 1024, info: true }) as unknown as {
        buffer: Buffer; engine: { bytesWritten: number };
    };
    if (result.engine.bytesWritten !== bytes.length) throw new Error('zlib 流存在尾随数据');
    return result.buffer;
}

function validateTexture(name: string, raw: Buffer): void {
    if (raw.length === 0) return;
    if (name === 'texture_data') {
        const textures = readEditorPickle(raw);
        if (!Array.isArray(textures) || !textures.every(id => typeof id === 'bigint')) {
            throw new Error('地表纹理载荷应为纹理 ID 列表');
        }
    } else {
        // BinaryChunkStream: one LE length-prefixed chunk per terrain texture.
        // Each chunk contains a sequence of (density length, foliage ID, opaque density bytes).
        let cursor = 0;
        while (cursor < raw.length) {
            if (raw.length - cursor < 4) throw new Error('纹理植被块头截断');
            const size = raw.readInt32LE(cursor);
            cursor += 4;
            if (size < 0 || size > raw.length - cursor) throw new Error('纹理植被块长度无效');
            const end = cursor + size;
            while (cursor < end) {
                if (end - cursor < 8) throw new Error('纹理植被密度头截断');
                const density = raw.readInt32LE(cursor);
                cursor += 8;
                if (density < 0 || density > end - cursor) throw new Error('纹理植被密度长度无效');
                cursor += density;
            }
        }
    }
}

type SectionUpdate = { body: Buffer } | { omit: true; note: string } | { reason: string; unverified?: boolean };

async function rebuildSceneSection(def: SectionDef, sourcePath: string, original?: Buffer): Promise<SectionUpdate> {
    let file = path.join(sourcePath, def.file!);
    try {
        let bytes = readOptional(file);
        if (def.kind === 'scene' && bytes === undefined) {
            file = file.replace(/\.data$/, '.json');
            bytes = readOptional(file);
        }
        if (bytes === undefined) return { reason: `缺少可选源，保留原包：${file}` };
        let raw: Buffer | undefined;
        let scene: GmpValue | undefined;
        if (def.kind === 'texture') {
            raw = inflateEditorSource(bytes);
            validateTexture(def.name, raw);
        } else {
            scene = file.endsWith('.data') ? readEditorPickle(inflateEditorSource(bytes)) : parseGmpJson(utf8.decode(bytes), true);
            if (!(scene instanceof Map)) throw new Error('场景载荷应为字典');
        }
        if (!original) return { reason: `原包无此段，尚未验证可新增：${file}`, unverified: true };
        const old = await decompressZstd(original);
        if (raw !== undefined ? old.equals(raw) : equalGmpValue(decodeGmpValue(old), scene!)) {
            return { reason: '载荷未变，复用原段字节' };
        }
        if (raw?.length === 0 || (scene instanceof Map && scene.size === 0)) {
            throw new Error('尚未验证空载荷的段省略规则');
        }
        return { body: await compressZstd(raw ?? encodeGmpValue(scene!)) };
    } catch (error) {
        throw new Error(`${file}：${error instanceof Error ? error.message : String(error)}`);
    }
}
async function buildSectionBody(
    def: SectionDef,
    sourcePath: string,
): Promise<Buffer | undefined> {
    if (def.kind === 'preserve') {
        return undefined;
    }

    const file = def.file ? path.join(sourcePath, def.file) : undefined;
    switch (def.kind) {
        case 'prefab': {
            const cache = await getSourceCache(sourcePath);
            return cache.prefabs.get(def.name);
        }
        case 'ui': {
            const cache = await getSourceCache(sourcePath);
            return cache.ui;
        }
        case 'language': {
            if (!def.file) {
                return undefined;
            }
            return (await buildLanguageSection(sourcePath, def.file)) ?? undefined;
        }
        case 'json-new': {
            const data = file ? readJsonFile(file) : undefined;
            if (data === undefined) {
                return undefined;
            }
            return packSectionDataNewStyle(data);
        }
        case 'json-old': {
            const data = file ? readJsonFile(file) : undefined;
            if (data === undefined) {
                return undefined;
            }
            return packSectionDataOldStyle(convertTuplesForMsgpack(restoreSectionTuples(def.name, data)));
        }
        case 'raw-zstd': {
            if (!file || !fs.existsSync(file)) {
                return undefined;
            }
            return compressZstd(fs.readFileSync(file));
        }
        case 'zlib-zstd': {
            if (!file || !fs.existsSync(file)) {
                return undefined;
            }
            return compressZstd(zlib.inflateSync(fs.readFileSync(file)));
        }
        case 'raw': {
            if (!file || !fs.existsSync(file)) {
                return undefined;
            }
            return fs.readFileSync(file);
        }
        case 'lua': {
            return file ? buildLuaSection(file) : undefined;
        }
        default:
            return undefined;
    }
}

function resolveGmpFile(map: GmpMapContext): string | undefined {
    if (!map.id || !/^[1-9]\d*$/.test(map.id)) {
        return undefined;
    }
    const byId = path.join(map.path, `${map.id}.gmp`);
    return fs.existsSync(byId) && fs.statSync(byId).isFile() ? byId : undefined;
}

function resolveSourceMap(
    context: GmpProjectContext,
    map: GmpMapContext,
    entryMap: GmpMapContext | undefined,
    def: SectionDef,
): GmpMapContext {
    if (def.shared === 'trigger' && context.useMainLevelTriggerAndObject && entryMap) {
        return entryMap;
    }
    if (def.shared === 'ui' && context.useMainLevelUI && entryMap) {
        return entryMap;
    }
    return map;
}

async function generateOneMap(
    context: GmpProjectContext,
    map: GmpMapContext,
    entryMap: GmpMapContext | undefined,
    options: GenerateGmpOptions,
): Promise<MapGmpResult> {
    const gmpFile = resolveGmpFile(map);
    if (!gmpFile) {
        return {
            name: map.name,
            displayName: map.displayName,
            gmpFile: map.id ? path.join(map.path, `${map.id}.gmp`) : '',
            changed: false,
            replacedSections: [],
            preservedSections: [],
            errors: [map.id && /^[1-9]\d*$/.test(map.id)
                ? `未找到对应 ID 的 GMP：${path.join(map.path, `${map.id}.gmp`)}；当前离线生成需要保留原包的 trigger_data，请先在编辑器中保存该关卡`
                : `缺少有效关卡 ID，请检查 ${path.join(map.path, 'header.map')}`],
        };
    }

    const parser = new GmpParser();
    if (!parser.parse(gmpFile)) {
        return {
            name: map.name,
            displayName: map.displayName,
            gmpFile,
            changed: false,
            replacedSections: [],
            preservedSections: [],
            errors: ['解析 gmp 失败'],
        };
    }

    const builder = new GmpBuilder();
    builder.preserveInsertionOrder = true;
    builder.setHeader(
        parser.header.uuid ?? Buffer.alloc(16),
        parser.header.version ?? 5,
        parser.header.createStamp ?? '',
        parser.header.editorPackStamp ?? '',
    );

    const rebuiltSections = new Map<number, Buffer>();
    const addedSections: string[] = [];
    const removed = new Set<number>();
    const removedSections: string[] = [];
    const replacedSections: string[] = [];
    const preservedSections: string[] = [];
    const sectionNotes: Record<string, string> = {};
    const warnings: string[] = [];
    const errors: string[] = [];
    let generatedDesc: Buffer | undefined;
    // 1120test 编辑器样本验证的项目模式与包版本。
    const verifiedMode73 = parser.header.version === 73 && context.projectFormat?.majorVersion === '2.0'
        && context.projectFormat.physicsMode === '2.5d';

    for (const def of SECTION_DEFS) {
        if (def.kind === 'preserve') {
            preservedSections.push(def.name);
            continue;
        }

        const index = sectionIndex(def);
        const originalSection = parser.sections.get(index);
        const rebuildScene = def.kind === 'texture' || def.kind === 'scene';
        if (def.kind === 'archive' && !verifiedMode73) {
            if (originalSection) preservedSections.push(def.name);
            sectionNotes[def.name] = '存档仅验证过 2.0/2.5D、版本 73 的关卡包，保留原包';
            continue;
        }
        if (!originalSection && !rebuildScene && def.kind !== 'tables' && def.kind !== 'archive') {
            continue;
        }

        // 带 binary table 的 section 需要同时重建二进制表；v1 先保留，避免写出
        // 与新数据不匹配的旧表。
        if (originalSection?.binTable) {
            preservedSections.push(def.name);
            continue;
        }

        const sourceMap = resolveSourceMap(context, map, entryMap, def);
        let body: Buffer | undefined;
        try {
            if (rebuildScene || def.kind === 'tables' || def.kind === 'archive') {
                let update: SectionUpdate;
                if (def.kind === 'tables') {
                    update = await rebuildRuntimeTableSection(sourceMap.path, context.projectPath, {
                        original: originalSection?.body,
                        originalDesc: parser.sections.get(SECTION_INDEXES.get('desc')!)?.body,
                        generatedDesc,
                        verifiedPresenceMode: verifiedMode73,
                    });
                } else if (def.kind === 'archive') {
                    update = await rebuildArchiveSection(context.projectPath, def.name === 'global_archive_data', originalSection?.body);
                } else {
                    update = await rebuildSceneSection(def, sourceMap.path, originalSection?.body);
                }
                if ('omit' in update) {
                    removed.add(index);
                    removedSections.push(def.name);
                    sectionNotes[def.name] = update.note;
                    continue;
                }
                if ('reason' in update) {
                    if (originalSection) preservedSections.push(def.name);
                    sectionNotes[def.name] = update.reason;
                    if (update.unverified) warnings.push(`${def.name}: ${update.reason}`);
                    continue;
                }
                body = update.body;
            } else {
                body = await buildSectionBody(def, sourceMap.path);
            }
        } catch (error) {
            errors.push(
                `${def.name}: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
        }

        if (!body) {
            if (parser.sections.has(index)) {
                preservedSections.push(def.name);
            }
            continue;
        }

        if (def.name === 'desc') generatedDesc = body;
        rebuiltSections.set(index, body);
        if (originalSection) replacedSections.push(def.name);
        else addedSections.push(def.name);
    }

    if (errors.length > 0) {
        return {
            name: map.name, displayName: map.displayName, gmpFile, changed: false,
            replacedSections: [], preservedSections, sectionNotes, warnings, errors,
        };
    }

    // 新增段也按 SectionProp 的声明顺序写入，未知段维持原相对顺序。
    const knownIndexes = new Set<number>();
    for (const def of SECTION_DEFS) {
        const index = sectionIndex(def);
        knownIndexes.add(index);
        if (removed.has(index)) continue;
        const rebuilt = rebuiltSections.get(index);
        const originalSection = parser.sections.get(index);
        if (rebuilt !== undefined) builder.setSection(index, rebuilt, def.oldId !== undefined);
        else if (originalSection) builder.setSection(index, originalSection.body, originalSection.isOldSection, originalSection.binTable);
    }
    for (const [index, section] of parser.sections) {
        if (!knownIndexes.has(index)) builder.setSection(index, section.body, section.isOldSection, section.binTable);
    }
    const output = builder.build();
    const original = fs.readFileSync(gmpFile);
    const changed = !output.equals(original);

    if (!options.dryRun && changed) {
        try {
            const backupFile = gmpFile + '.bak';
            if (!fs.existsSync(backupFile)) {
                fs.copyFileSync(gmpFile, backupFile);
            }
            writeGeneratedGmp(gmpFile, output);
        } catch (error) {
            errors.push(
                `写入失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    return {
        name: map.name,
        displayName: map.displayName,
        gmpFile,
        changed,
        replacedSections,
        ...(addedSections.length > 0 ? { addedSections } : {}),
        ...(removedSections.length > 0 ? { removedSections } : {}),
        preservedSections,
        ...(Object.keys(sectionNotes).length > 0 ? { sectionNotes } : {}),
        ...(warnings.length > 0 ? { warnings } : {}),
        errors,
        outputSize: output.length,
        ...(options.captureOutput ? { outputBase64: output.toString('base64') } : {}),
    };
}

/**
 * 离线生成工程内所有关卡的 gmp。
 *
 * 当前策略：
 * - 物编 / UI / 多语言 / 表格等共享数据按项目设置从入口关卡读取。
 * - 地形、Lua、关卡专属 JSON 等从各自关卡目录读取。
 * - trigger_data 及暂未离线复刻的 section 保留原 gmp 内容。
 */
export async function generateProjectGmp(
    context: GmpProjectContext,
    options: GenerateGmpOptions = {},
): Promise<GenerateGmpResult> {
    const entryMap = context.maps.find((map) => map.name === context.entryMapName);

    if (!entryMap) {
        return {
            success: false,
            dryRun: options.dryRun === true,
            projectPath: context.projectPath,
            maps: [],
            message: `找不到有效入口关卡：${context.entryMapName}（工程：${context.projectPath}）`,
        };
    }

    sourceCaches.clear();
    const results: MapGmpResult[] = [];
    for (const map of context.maps) {
        try {
            results.push(await generateOneMap(context, map, entryMap, options));
        } catch (error) {
            results.push({
                name: map.name,
                displayName: map.displayName,
                gmpFile: '',
                changed: false,
                replacedSections: [],
                preservedSections: [],
                errors: [error instanceof Error ? error.message : String(error)],
            });
        }
    }

    const success = results.every((result) => result.errors.length === 0);
    return {
        success,
        dryRun: options.dryRun === true,
        projectPath: context.projectPath,
        maps: results,
        message: success
            ? `已处理 ${results.length} 个关卡`
            : `有 ${results.filter((result) => result.errors.length > 0).length} 个关卡处理失败`,
    };
}
