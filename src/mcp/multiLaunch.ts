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
