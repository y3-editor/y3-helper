export const CONFIG_VERSION = 1;

export type LaunchMapTarget = ['option' | 'map', string];

export interface ConfigState {
    multiMode: boolean;
    multiPlayers: number[];
    debugPlayers: number[];
    tracy: boolean;
    attachWhenLaunch: boolean;
    attachCloudScriptWhenLaunch: boolean;
    launchMap: LaunchMapTarget;
}

export interface ConfigSnapshot extends ConfigState {
    version: number;
}

export function createDefaultConfigSnapshot(): ConfigSnapshot {
    return {
        version: CONFIG_VERSION,
        multiMode: false,
        multiPlayers: [],
        debugPlayers: [],
        tracy: false,
        attachWhenLaunch: true,
        attachCloudScriptWhenLaunch: false,
        launchMap: ['option', 'entry'],
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function readPositiveIntegerArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const result: number[] = [];
    for (const item of value) {
        if (typeof item !== 'number' || !Number.isSafeInteger(item) || item <= 0) {
            continue;
        }
        if (!result.includes(item)) {
            result.push(item);
        }
    }
    return result;
}

function readLaunchMap(value: unknown): LaunchMapTarget {
    if (!Array.isArray(value) || value.length !== 2) {
        return ['option', 'entry'];
    }
    const [type, name] = value;
    if (typeof name === 'string' && name.length > 0) {
        if (type === 'map' || (type === 'option' && (name === 'entry' || name === 'current'))) {
            return [type, name];
        }
    }
    return ['option', 'entry'];
}

export function parseConfigSnapshot(value: unknown): ConfigSnapshot {
    const defaults = createDefaultConfigSnapshot();
    if (!isRecord(value)) {
        return defaults;
    }

    const multiPlayers = readPositiveIntegerArray(value.multiPlayers);
    const debugPlayers = readPositiveIntegerArray(value.debugPlayers)
        .filter((id) => multiPlayers.includes(id));
    return {
        version: typeof value.version === 'number' && Number.isSafeInteger(value.version)
            ? value.version
            : CONFIG_VERSION,
        multiMode: readBoolean(value.multiMode, defaults.multiMode),
        multiPlayers,
        debugPlayers,
        tracy: readBoolean(value.tracy, defaults.tracy),
        attachWhenLaunch: readBoolean(value.attachWhenLaunch, defaults.attachWhenLaunch),
        attachCloudScriptWhenLaunch: readBoolean(
            value.attachCloudScriptWhenLaunch,
            defaults.attachCloudScriptWhenLaunch,
        ),
        launchMap: readLaunchMap(value.launchMap),
    };
}

export function snapshotConfig(config: ConfigState): ConfigSnapshot {
    return {
        version: CONFIG_VERSION,
        multiMode: config.multiMode,
        multiPlayers: [...config.multiPlayers],
        debugPlayers: [...config.debugPlayers],
        tracy: config.tracy,
        attachWhenLaunch: config.attachWhenLaunch,
        attachCloudScriptWhenLaunch: config.attachCloudScriptWhenLaunch,
        launchMap: [config.launchMap[0], config.launchMap[1]],
    };
}

export function sanitizeConfigForPlatform(
    snapshot: ConfigSnapshot,
    platform: string = process.platform,
): ConfigSnapshot {
    if (platform !== 'win32' && snapshot.attachCloudScriptWhenLaunch) {
        return { ...snapshot, attachCloudScriptWhenLaunch: false };
    }
    return snapshot;
}

export function normalizeLaunchMap(
    target: LaunchMapTarget,
    options: { hasCurrent: boolean; mapNames: readonly string[] },
): LaunchMapTarget {
    const [type, name] = target;
    if (type === 'map') {
        return options.mapNames.includes(name) ? target : ['option', 'entry'];
    }
    if (name === 'entry') {
        return target;
    }
    if (name === 'current' && options.hasCurrent) {
        return target;
    }
    return ['option', 'entry'];
}

export function filterPlayerSelection(
    selected: readonly number[],
    debug: readonly number[],
    validIds: readonly number[],
): { multiPlayers: number[]; debugPlayers: number[] } {
    const valid = new Set(validIds);
    const multiPlayers: number[] = [];
    for (const id of selected) {
        if (valid.has(id) && !multiPlayers.includes(id)) {
            multiPlayers.push(id);
        }
    }
    const debugPlayers = debug.filter((id) => valid.has(id) && multiPlayers.includes(id));
    return { multiPlayers, debugPlayers };
}
