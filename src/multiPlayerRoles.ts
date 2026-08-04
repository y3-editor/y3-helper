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
