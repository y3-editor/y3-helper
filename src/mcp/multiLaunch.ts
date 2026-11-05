export const MULTI_LAUNCH_MIN_TIMEOUT_MS = 120000;
export const MULTI_LAUNCH_MAX_TIMEOUT_MS = 180000;

/**
 * 多开等待全部角色窗口连上的总超时。
 * 单开仍使用 110 秒；多开按人数增长，但最高不超过 180 秒。
 */
export function getMultiLaunchTimeoutMs(playerCount: number): number {
    return Math.min(
        MULTI_LAUNCH_MAX_TIMEOUT_MS,
        Math.max(MULTI_LAUNCH_MIN_TIMEOUT_MS, 60000 + 45000 * playerCount),
    );
}

/**
 * MCP 多开启动时传给游戏侧的 Lua 参数。
 * - lua_multi_mode 让 helper 上报 multiMode=true，并使用按角色区分的调试端口
 * - lua_multi_debug_players 是 debugger.lua 读取的必需参数
 * - MCP 不附加 VS Code 调试器，因此不设置 lua_multi_wait_debugger
 */
export function buildMultiLaunchLuaArgs(players: readonly number[]): Record<string, string> {
    const sorted = [...players].sort((a, b) => a - b);
    return {
        lua_multi_mode: 'true',
        lua_multi_debug_players: sorted.join('#'),
    };
}
