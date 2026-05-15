import { syncSessionHistory } from '../../hooks/useCurrentSession';
import { useChatStore } from '../../store/chat';

/**
 * 对齐 CC ContentReplacementState：
 * - seenIds: 已参与过预算决策的 tool_use_id，后续不可翻案
 * - replacements: 已裁剪的 tool_use_id → 替换文本（缓存，重放时零 I/O，字节一致）
 */
export type ContentReplacementState = {
  seenIds: Set<string>;
  replacements: Map<string, string>;
};

/**
 * 跨轮次内容替换状态，对齐 CC 的 ContentReplacementState。
 * 用 sessionId/taskId → state 记录已做出的裁剪决策。
 */
const contentReplacementStates = new Map<string, ContentReplacementState>();

/**
 * Dev-only：暴露内部 Map 给浏览器 console 排查冻结/重放状态。
 * 仅在 `compressionService.ts` 桶文件的 NODE_ENV === 'development' 分支调用。
 */
export function _devGetReplacementStates(): Map<string, ContentReplacementState> {
  return contentReplacementStates;
}

/**
 * 从 Zustand store 的 session.data.pruneState 恢复替换状态。
 */
function loadReplacementStateFromSession(sessionId: string): ContentReplacementState | null {
  const session = useChatStore.getState().sessions.get(sessionId);
  const serialized = session?.data?.pruneState;
  if (!serialized?.seenKeys?.length && !serialized?.replacements?.length) return null;
  return {
    seenIds: new Set(serialized.seenKeys),
    replacements: new Map(serialized.replacements as [string, string][]),
  };
}

/**
 * 将替换状态异步写回 session.data.pruneState（fire-and-forget）。
 */
export function persistReplacementState(
  sessionId: string,
  state: ContentReplacementState,
): void {
  syncSessionHistory(sessionId, {
    data: {
      pruneState: {
        seenKeys: [...state.seenIds],
        replacements: [...state.replacements.entries()],
      },
    },
  }).catch(() => {});
}

/**
 * 清除指定 session/task 的替换状态。
 * 在 session 删除、重置时调用。
 */
export function clearPruneState(stateKey: string): void {
  contentReplacementStates.delete(stateKey);
  if (!stateKey.startsWith('subagent:')) {
    syncSessionHistory(stateKey, {
      data: { pruneState: { seenKeys: [], replacements: [] } },
    }).catch(() => {});
  }
}

export function getOrCreateReplacementState(stateKey: string): ContentReplacementState {
  let state = contentReplacementStates.get(stateKey);
  if (!state) {
    if (!stateKey.startsWith('subagent:')) {
      state = loadReplacementStateFromSession(stateKey) ?? undefined;
    }
    if (!state) {
      state = { seenIds: new Set(), replacements: new Map() };
    }
    contentReplacementStates.set(stateKey, state);
  }
  return state;
}