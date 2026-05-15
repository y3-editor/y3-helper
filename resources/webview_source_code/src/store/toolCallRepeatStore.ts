/**
 * Tool Call Repeat Guard Store
 *
 * 跨轮次的"重复 tool_call"检测。按 (sessionId, agentKey) 维度独立计数：
 * - 每次 observe 输入一个「轮 key」（由 computeRoundKey 生成）
 * - 若与上次相同则累加，否则重置为 1
 * - 根据 count 返回 action：
 *     count === 3  → 'warn'   （调用侧应跳过本轮执行、回灌警告 tool_result、在 UI 显示系统警告）
 *     count >= 4   → 'abort'  （调用侧应 abort stream、在 UI 显示系统中止）
 *     否则         → 'pass'   （放行）
 *
 * 注意：observe 内部会更新 count，所以多次调用同一个轮 key 会持续累加。调用方不应为同一轮 call 多次 observe。
 */

import { create } from 'zustand';

export type RepeatGuardAction = 'pass' | 'warn' | 'abort';
export type AgentKey = 'main' | string;

export const REPEAT_WARN_THRESHOLD = 3;
export const REPEAT_ABORT_THRESHOLD = 4;

interface Tracker {
  lastRoundKey: string;
  count: number;
}

type TrackerMapKey = string; // `${sessionId}::${agentKey}`

interface ToolCallRepeatState {
  trackers: Map<TrackerMapKey, Tracker>;
  observe(
    sessionId: string,
    agentKey: AgentKey,
    roundKey: string,
  ): { action: RepeatGuardAction; count: number };
  reset(sessionId: string, agentKey?: AgentKey): void;
  clearSession(sessionId: string): void;
  /** Test helper: 暴露当前计数（不改变状态） */
  peek(sessionId: string, agentKey: AgentKey): Tracker | undefined;
}

const buildKey = (sessionId: string, agentKey: AgentKey): TrackerMapKey =>
  `${sessionId}::${agentKey}`;

const classify = (count: number): RepeatGuardAction => {
  if (count >= REPEAT_ABORT_THRESHOLD) return 'abort';
  if (count === REPEAT_WARN_THRESHOLD) return 'warn';
  return 'pass';
};

export const useToolCallRepeatStore = create<ToolCallRepeatState>((set, get) => ({
  trackers: new Map(),

  observe(sessionId, agentKey, roundKey) {
    if (!sessionId || !roundKey) {
      return { action: 'pass', count: 0 };
    }
    const mapKey = buildKey(sessionId, agentKey);
    const prev = get().trackers.get(mapKey);
    const nextCount = prev && prev.lastRoundKey === roundKey ? prev.count + 1 : 1;
    const nextTracker: Tracker = { lastRoundKey: roundKey, count: nextCount };

    const newTrackers = new Map(get().trackers);
    newTrackers.set(mapKey, nextTracker);
    set({ trackers: newTrackers });

    return { action: classify(nextCount), count: nextCount };
  },

  reset(sessionId, agentKey) {
    if (!sessionId) return;
    const newTrackers = new Map(get().trackers);
    if (agentKey) {
      newTrackers.delete(buildKey(sessionId, agentKey));
    } else {
      const prefix = `${sessionId}::`;
      for (const key of Array.from(newTrackers.keys())) {
        if (key.startsWith(prefix)) newTrackers.delete(key);
      }
    }
    set({ trackers: newTrackers });
  },

  clearSession(sessionId) {
    get().reset(sessionId);
  },

  peek(sessionId, agentKey) {
    return get().trackers.get(buildKey(sessionId, agentKey));
  },
}));
