export interface LocalArchiveEntry {
    role_id?: number;
    archive?: unknown;
    [key: string]: unknown;
}

export type LocalArchiveData = Record<string, LocalArchiveEntry>;

export interface MultiPlayerArchiveAssignment {
    roleId: number;
    nickname: string;
}

export interface ResolvedMultiPlayerArchiveAssignments {
    assignments: MultiPlayerArchiveAssignment[];
    missingRoleIds: number[];
}

export function parseEditorNickname(content: string): string | undefined {
    const root: unknown = JSON.parse(content);
    if (typeof root !== 'object' || root === null || Array.isArray(root)) {
        return undefined;
    }
    const nickname = (root as Record<string, unknown>).nickname;
    if (typeof nickname !== 'string') {
        return undefined;
    }
    return nickname.trim() || undefined;
}

export function getDefaultLocalArchiveNickname(
    selectedRoleIds: readonly number[],
    selectedNicknames: Readonly<Record<number, string | undefined>>,
    editorNickname?: string,
): string {
    if (selectedRoleIds.length === 0) {
        return editorNickname?.trim() || 'test_account1';
    }

    const used = new Set(selectedRoleIds
        .map((roleId) => selectedNicknames[roleId])
        .filter((nickname): nickname is string => Boolean(nickname)));
    for (let index = 1; ; index += 1) {
        const nickname = `test_account${index}`;
        if (!used.has(nickname)) {
            return nickname;
        }
    }
}

export function emptyLocalArchiveData(): LocalArchiveData {
    return Object.create(null) as LocalArchiveData;
}

export function parseLocalArchiveData(content: string): LocalArchiveData {
    const root: unknown = JSON.parse(content);
    if (typeof root !== 'object' || root === null || Array.isArray(root)) {
        throw new Error('Invalid archive_storage.json root');
    }

    const result = emptyLocalArchiveData();
    for (const [nickname, rawEntry] of Object.entries(root)) {
        if (!nickname || typeof rawEntry !== 'object' || rawEntry === null || Array.isArray(rawEntry)) {
            throw new Error('Invalid local archive entry');
        }
        const entry = rawEntry as Record<string, unknown>;
        const roleId = entry.role_id;
        if (roleId !== undefined && !Number.isSafeInteger(roleId)) {
            throw new Error(`Invalid role id for local archive ${nickname}`);
        }
        result[nickname] = {...entry, role_id: roleId as number | undefined};
    }
    return result;
}

export function getLocalArchiveAssignments(data: LocalArchiveData): MultiPlayerArchiveAssignment[] {
    const byRole = new Map<number, MultiPlayerArchiveAssignment>();
    Object.entries(data)
        .filter((entry): entry is [string, LocalArchiveEntry & {role_id: number}] =>
            Number.isSafeInteger(entry[1].role_id) && entry[1].role_id! > 0)
        .forEach(([nickname, entry]) => {
            byRole.set(entry.role_id, {roleId: entry.role_id, nickname});
        });
    return [...byRole.values()];
}

export function resolveLocalArchiveAssignments(
    roleIds: readonly number[],
    selectedNicknames: Readonly<Record<number, string | undefined>> | undefined,
    data: LocalArchiveData,
): ResolvedMultiPlayerArchiveAssignments {
    const existing = new Map(
        getLocalArchiveAssignments(data).map((assignment) => [assignment.roleId, assignment.nickname]),
    );
    const assignments = roleIds.map((roleId) => ({
        roleId,
        nickname: selectedNicknames?.[roleId] ?? existing.get(roleId) ?? '',
    }));
    return {
        assignments,
        missingRoleIds: assignments
            .filter((assignment) => !assignment.nickname)
            .map((assignment) => assignment.roleId),
    };
}

export function applyLocalArchiveAssignments(
    data: LocalArchiveData,
    assignments: readonly MultiPlayerArchiveAssignment[],
): LocalArchiveData {
    const roleIds = new Set<number>();
    const nicknames = new Set<string>();
    for (const {roleId, nickname} of assignments) {
        if (!Number.isSafeInteger(roleId) || roleId <= 0) {
            throw new Error(`Invalid assigned role id ${roleId}`);
        }
        if (!nickname) {
            throw new Error(`Missing nickname for role ${roleId}`);
        }
        if (roleIds.has(roleId)) {
            throw new Error(`Duplicate assigned role id ${roleId}`);
        }
        if (nicknames.has(nickname)) {
            throw new Error(`Duplicate assigned nickname ${nickname}`);
        }
        roleIds.add(roleId);
        nicknames.add(nickname);
    }

    const result = emptyLocalArchiveData();
    let inactiveRoleId = -1;
    for (const [nickname, entry] of Object.entries(data)) {
        result[nickname] = {...entry, role_id: inactiveRoleId};
        inactiveRoleId -= 1;
    }
    for (const {roleId, nickname} of assignments) {
        const existing = result[nickname];
        result[nickname] = existing
            ? {...existing, role_id: roleId}
            : {role_id: roleId, archive: {}};
    }
    return result;
}

export function serializeLocalArchiveData(data: LocalArchiveData): string {
    const sorted = emptyLocalArchiveData();
    for (const nickname of Object.keys(data).sort()) {
        sorted[nickname] = data[nickname];
    }
    return `${JSON.stringify(sorted, null, 4)}\n`;
}
