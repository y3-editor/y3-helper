import * as fs from 'fs/promises';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import type { GmpProjectContext } from './gmpGenerate';

export interface ProjectMapInfo {
    name: string;
    path: string;
    id: string;
    displayName: string;
}

export interface ProjectMapScan {
    maps: ProjectMapInfo[];
    ignoredDirectories: string[];
    errors: string[];
}

interface JsonDocument {
    text: string;
    tree: jsonc.Node;
}

async function readDocument(file: string, optional = false): Promise<JsonDocument | undefined> {
    let text: string;
    try {
        text = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    } catch (error) {
        if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            return undefined;
        }
        throw new Error(`无法读取 ${file}：${error instanceof Error ? error.message : String(error)}`);
    }
    const errors: jsonc.ParseError[] = [];
    const tree = jsonc.parseTree(text, errors, { allowTrailingComma: true });
    if (!tree || tree.type !== 'object' || errors.length > 0) {
        throw new Error(`配置文件解析失败：${file}`);
    }
    return { text, tree };
}

function readId(document: JsonDocument, location: string[], file: string): string {
    const node = jsonc.findNodeAtLocation(document.tree, location);
    const value = node?.type === 'string' ? node.value
        : node?.type === 'number' ? document.text.slice(node.offset, node.offset + node.length) : '';
    if (!/^\d+$/.test(value) || BigInt(value) <= 0n) {
        throw new Error(`关卡 ID 无效（${location.join('.')}）：${file}`);
    }
    return BigInt(value).toString();
}

/** Read metadata only; never create Map instances, log directories, or plugin watchers. */
export async function readProjectMap(mapPath: string): Promise<ProjectMapInfo | undefined> {
    const headerFile = path.join(mapPath, 'header.map');
    const header = await readDocument(headerFile, true);
    if (!header) {
        return undefined;
    }
    const name = path.basename(mapPath);
    const id = readId(header, ['id'], headerFile);
    let displayName = name;
    try {
        const desc = await readDocument(path.join(mapPath, 'desc.json'), true);
        const value = desc && jsonc.findNodeAtLocation(desc.tree, ['name'])?.value;
        if (typeof value === 'string' && value.trim()) {
            displayName = value;
        }
    } catch {
        // Description is optional; the generator reports invalid desc.json when rebuilding it.
    }
    return { name, path: mapPath, id, displayName };
}

export async function scanProjectMaps(projectPath: string): Promise<ProjectMapScan> {
    const result: ProjectMapScan = { maps: [], ignoredDirectories: [], errors: [] };
    const mapsPath = path.join(projectPath, 'maps');
    try {
        for (const entry of await fs.readdir(mapsPath, { withFileTypes: true })) {
            const mapPath = path.join(mapsPath, entry.name);
            if (!entry.isDirectory()) {
                if (!entry.isSymbolicLink() || !(await fs.stat(mapPath)).isDirectory()) {
                    continue;
                }
            }
            try {
                const info = await readProjectMap(mapPath);
                if (info) {
                    result.maps.push(info);
                } else {
                    result.ignoredDirectories.push(mapPath);
                }
            } catch (error) {
                result.errors.push(error instanceof Error ? error.message : String(error));
            }
        }
    } catch (error) {
        result.errors.push(`无法扫描关卡目录 ${mapsPath}：${error instanceof Error ? error.message : String(error)}`);
    }
    const byId = new Map<string, ProjectMapInfo[]>();
    for (const map of result.maps) {
        const matches = byId.get(map.id) ?? [];
        matches.push(map);
        byId.set(map.id, matches);
    }
    for (const [id, matches] of byId) {
        if (matches.length > 1) {
            result.errors.push(`关卡 ID ${id} 重复：${matches.map(map => map.path).join('、')}`);
        }
    }
    result.maps = result.maps.filter(map => byId.get(map.id)!.length === 1);
    return result;
}

export async function scanGmpProject(projectPath: string): Promise<ProjectMapScan & { context?: GmpProjectContext }> {
    const result: ProjectMapScan & { context?: GmpProjectContext } = await scanProjectMaps(projectPath);
    const projectFile = path.join(projectPath, 'header.project');
    try {
        const project = (await readDocument(projectFile))!;
        const entryId = readId(project, ['entry_map', 'id'], projectFile);
        const entryMap = result.maps.find(map => map.id === entryId);
        if (!entryMap) {
            result.errors.push(`找不到有效入口关卡（ID ${entryId}），请检查 ${projectFile} 和 maps/ 下的 header.map`);
        }
        const setting = await readDocument(path.join(projectPath, 'setting.json'), true);
        if (entryMap && result.errors.length === 0) {
            const majorVersion = jsonc.findNodeAtLocation(project.tree, ['major_version_number'])?.value;
            const physicsMode = jsonc.findNodeAtLocation(project.tree, ['phy_mode'])?.value;
            result.context = {
                projectPath,
                entryMapName: entryMap.name,
                ...(typeof majorVersion === 'string' && typeof physicsMode === 'string'
                    ? { projectFormat: { majorVersion, physicsMode } } : {}),
                maps: result.maps,
                useMainLevelTriggerAndObject: setting
                    ? jsonc.findNodeAtLocation(setting.tree, ['use_main_level_trigger_and_object'])?.value === true : false,
                useMainLevelUI: setting
                    ? jsonc.findNodeAtLocation(setting.tree, ['use_main_level_ui'])?.value === true : false,
            };
        }
    } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
    }
    return result;
}
