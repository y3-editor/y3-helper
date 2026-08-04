export interface DebugSessionLike {
    readonly configuration: object;
}

export interface MissingMultiDebugPlayersPlan {
    readonly missingPlayerIds: number[];
    readonly consumeWaitMarker: boolean;
}

export function debugAddressForPlayer(id?: number): string {
    return `127.0.0.1:${12399 - (id ?? 0)}`;
}

export function planMissingMultiDebugPlayers(
    configuredPlayerIds: readonly number[],
    sessions: readonly DebugSessionLike[],
): MissingMultiDebugPlayersPlan {
    const playerIds = [...new Set(configuredPlayerIds)];
    if (playerIds.length === 0) {
        return {
            missingPlayerIds: [],
            consumeWaitMarker: true,
        };
    }

    const activeAddresses = new Set(
        sessions
            .map((session) => (session.configuration as { readonly address?: unknown }).address)
            .filter((address): address is string => typeof address === 'string'),
    );
    const missingPlayerIds = playerIds.filter(
        (id) => !activeAddresses.has(debugAddressForPlayer(id)),
    );
    return {
        missingPlayerIds,
        consumeWaitMarker: missingPlayerIds.length > 0,
    };
}
