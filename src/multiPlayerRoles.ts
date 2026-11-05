export const NEUTRAL_ROLE_IDS = new Set([31, 32]);

export interface MultiPlayerRole {
    id: number;
    name?: string;
}

interface TupleMarker {
    __tuple__: boolean;
    items: unknown[];
}

function asTuple(value: unknown): unknown[] | undefined {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const marker = value as Partial<TupleMarker>;
    if (marker.__tuple__ === true && Array.isArray(marker.items)) {
        return marker.items;
    }
    return undefined;
}

function parseRoleId(value: unknown): number | undefined {
    const id = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^\d+$/.test(value)
            ? Number(value)
            : NaN;
    return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function roleEntries(value: unknown, source: string): [unknown, unknown][] {
    if (Array.isArray(value)) {
        return value.map((entry) => {
            const tuple = asTuple(entry);
            if (!tuple || tuple.length !== 2) {
                throw new Error(`Invalid role entry in ${source}`);
            }
            return [tuple[0], tuple[1]];
        });
    }
    if (typeof value === 'object' && value !== null) {
        return Object.entries(value);
    }
    throw new Error(`Missing roles in ${source}`);
}

export function parseMultiPlayerRoles(content: string): MultiPlayerRole[] {
    const root: unknown = JSON.parse(content);
    if (typeof root !== 'object' || root === null) {
        throw new Error('Invalid campinfo.json root');
    }

    const roles: MultiPlayerRole[] = [];
    const seen = new Set<number>();
    for (const [rawId, rawRole] of roleEntries((root as {roles?: unknown}).roles, 'campinfo.json')) {
        const id = parseRoleId(rawId);
        if (id === undefined) {
            throw new Error('Invalid role id in campinfo.json');
        }
        if (seen.has(id)) {
            throw new Error(`Duplicate role id ${id} in campinfo.json`);
        }
        seen.add(id);

        if (NEUTRAL_ROLE_IDS.has(id)) {
            continue;
        }
        if (typeof rawRole !== 'object' || rawRole === null) {
            throw new Error(`Invalid role ${id} in campinfo.json`);
        }

        const role = rawRole as {id?: unknown; name?: unknown};
        const declaredId = role.id === undefined ? id : parseRoleId(role.id);
        if (declaredId !== id) {
            throw new Error(`Role id mismatch for ${id} in campinfo.json`);
        }
        roles.push({
            id,
            name: typeof role.name === 'string' ? role.name : undefined,
        });
    }
    return roles;
}

export function parseLegacyMultiPlayerRoles(content: string): MultiPlayerRole[] {
    const root: unknown = JSON.parse(content);
    if (typeof root !== 'object' || root === null) {
        throw new Error('Invalid legacy campinfo.json root');
    }

    const roles: MultiPlayerRole[] = [];
    const seen = new Set<number>();
    for (const [rawId, rawRole] of roleEntries((root as {role?: unknown}).role, 'legacy campinfo.json')) {
        const id = parseRoleId(rawId);
        if (id === undefined) {
            throw new Error('Invalid role id in legacy campinfo.json');
        }
        if (seen.has(id)) {
            throw new Error(`Duplicate role id ${id} in legacy campinfo.json`);
        }
        seen.add(id);

        if (NEUTRAL_ROLE_IDS.has(id)) {
            continue;
        }
        if (typeof rawRole !== 'object' || rawRole === null) {
            throw new Error(`Invalid role ${id} in legacy campinfo.json`);
        }

        const role = rawRole as {role_name?: unknown};
        roles.push({
            id,
            name: typeof role.role_name === 'string' ? role.role_name : undefined,
        });
    }
    return roles;
}

export function findInvalidMultiPlayerRoles(selected: readonly number[], available: readonly MultiPlayerRole[]): number[] {
    const availableIds = new Set(available.map((role) => role.id));
    return selected.filter((id, index) => selected.indexOf(id) === index && !availableIds.has(id));
}

export function findDuplicateMultiPlayerRoles(selected: readonly number[]): number[] {
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const id of selected) {
        if (seen.has(id)) {
            duplicates.add(id);
        } else {
            seen.add(id);
        }
    }
    return [...duplicates];
}

export interface AddMissingMultiPlayerRolesResult {
    content: string;
    addedRoleIds: number[];
}

const DEFAULT_ROLE_COLORS = [
    '#00FF00',
    '#00FFFF',
    '#FF00FF',
    '#8080FF',
    '#FF8080',
    '#80FF80',
    '#C080FF',
    '#FFC080',
];

/**
 * 在 campinfo.json 中补齐缺失的玩家角色和阵营 role_ids。
 *
 * 引擎的 role_ids 只接受 campinfo 中已存在的角色，不会凭空创建；
 * MCP 侧需要先补齐，才能支持 players 传入任意玩家槽位。
 */
export function addMissingMultiPlayerRoles(
    content: string,
    roleIds: readonly number[],
): AddMissingMultiPlayerRolesResult {
    const root: unknown = JSON.parse(content);
    if (typeof root !== 'object' || root === null || Array.isArray(root)) {
        throw new Error('Invalid campinfo.json root');
    }
    const data = root as {roles?: unknown; camps?: unknown};
    if (!Array.isArray(data.roles) || !Array.isArray(data.camps)) {
        throw new Error('Invalid campinfo.json structure');
    }

    const existing = new Set<number>();
    for (const entry of data.roles) {
        const tuple = asTuple(entry);
        if (!tuple || tuple.length !== 2) {
            throw new Error('Invalid role entry in campinfo.json');
        }
        const id = parseRoleId(tuple[0]);
        if (id === undefined) {
            throw new Error('Invalid role id in campinfo.json');
        }
        existing.add(id);
    }

    let targetCamp: Record<string, unknown> | undefined;
    for (const entry of data.camps) {
        const tuple = asTuple(entry);
        if (!tuple || tuple.length !== 2 || typeof tuple[1] !== 'object' || tuple[1] === null) {
            continue;
        }
        const camp = tuple[1] as Record<string, unknown>;
        if (tuple[0] === 1 || targetCamp === undefined) {
            targetCamp = camp;
            if (tuple[0] === 1) {
                break;
            }
        }
    }
    if (!targetCamp) {
        throw new Error('Missing camp in campinfo.json');
    }
    const camp = targetCamp;
    const campRoleIds = Array.isArray(camp.role_ids)
        ? camp.role_ids as unknown[]
        : (camp.role_ids = [] as number[], camp.role_ids as number[]);

    const addedRoleIds: number[] = [];
    for (const roleId of [...new Set(roleIds)].sort((a, b) => a - b)) {
        if (existing.has(roleId)) {
            continue;
        }
        const campId = typeof camp.id === 'number' ? camp.id : 1;
        data.roles.push({
            __tuple__: true,
            items: [
                roleId,
                {
                    camp_id: campId,
                    color: DEFAULT_ROLE_COLORS[roleId % DEFAULT_ROLE_COLORS.length],
                    id: roleId,
                    name: `$player ${roleId}`,
                    type: 1,
                },
            ],
        });
        campRoleIds.push(roleId);
        addedRoleIds.push(roleId);
        existing.add(roleId);
    }

    return {
        content: `${JSON.stringify(data, null, 4)}\n`,
        addedRoleIds,
    };
}
