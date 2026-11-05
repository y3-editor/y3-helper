/**
 * 从重连后新出现的客户端中选择目标窗口的结果。
 * 多开时 .rr 可能让整组窗口一起重连，必须按 roleId 匹配，不能直接取第一个。
 */
export function selectReconnectedClient<T extends { roleId?: number }>(
    newClients: readonly T[],
    expectedRoleId?: number,
): T | undefined {
    if (newClients.length === 0) {
        return undefined;
    }
    if (expectedRoleId === undefined) {
        return newClients[0];
    }
    return newClients.find((client) => client.roleId === expectedRoleId);
}
