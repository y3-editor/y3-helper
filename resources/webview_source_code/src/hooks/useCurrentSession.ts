import { useCallback } from 'react';
import { cloneDeep, merge } from 'lodash';
import { useChatStore, ChatSession } from '../store/chat';
import { getSessionData, updateSession } from '../services/chat';

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P]> }
    : T;

export const useCurrentSession = () => {
  return useChatStore((state) => {
    const currentSessionId = state.currentSessionId;
    return currentSessionId ? state.sessions.get(currentSessionId) : undefined;
  });
};

export const getSessionById = async (sessionId: string): Promise<ChatSession | undefined> => {
  const state = useChatStore.getState();
  const cachedSession = state.sessions.get(sessionId);

  if (cachedSession?.data) {
    return cachedSession;
  }

  try {
    const session = await getSessionData(sessionId);
    if (session) {
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, session);
      useChatStore.setState({ sessions: newSessions });
    }
    return session;
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return undefined;
  }
};

/**
 * 根据 session id 增量更新 session 并同步到后端
 * @param sessionId - session id
 * @param sessionData - 可选，用于增量更新的数据（会与现有 session 合并）
 */
export const syncSessionHistory = async (
  sessionId: string,
  sessionData?: DeepPartial<ChatSession>
) => {
  const state = useChatStore.getState();
  const existingSession = state.sessions.get(sessionId);

  if (!existingSession) {
    console.error('Session not found:', sessionId);
    return;
  }

  const mergedSession: ChatSession = sessionData
    ? merge(cloneDeep(existingSession), sessionData)
    : existingSession;

  // 更新 store
  const newSessions = new Map(state.sessions);
  newSessions.set(sessionId, mergedSession);
  useChatStore.setState({ sessions: newSessions });

  // 同步到服务端
  try {
    return updateSession(mergedSession);
  } catch (error) {
    console.error('Failed to sync session history:', error);
  }
};


export const updateCurrentSession = (updater: (session: ChatSession) => void) => {
  const state = useChatStore.getState();
  const currentSessionId = state.currentSessionId;

  if (!currentSessionId) {
    return;
  }

  const oldSession = state.sessions.get(currentSessionId);
  if (!oldSession) return;

  const newSession = { ...oldSession }
  updater(newSession);

  const newSessions = new Map(state.sessions);
  newSessions.set(currentSessionId, newSession);
  useChatStore.setState({ sessions: newSessions });
}


export const useUpdateCurrentSession = () => {
  return useCallback(updateCurrentSession, []);
};

