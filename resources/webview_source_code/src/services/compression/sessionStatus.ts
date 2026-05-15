import { SessionStatus } from '../../types/contextCompression';
import { getSessionById, syncSessionHistory } from '../../hooks/useCurrentSession';

const COMPRESS_TIMEOUT_MS = 2 * 60 * 1000;
const FAILED_COOLDOWN_MS = 5 * 60 * 1000; // FAILED 状态冷却时间，过后自动重置为 INITIAL

const compressStatusListeners = new Set<(sessionId: string, status: SessionStatus) => void>();

export const getCompressSessionStatus = async (sessionId: string) => {
  const sessionData = await getSessionById(sessionId);
  const compression = sessionData?.data?.compression;
  const status = compression?.compressSessionStatus || SessionStatus.INITIAL;

  // 检测僵死状态：如果是 COMPRESSING 但超时了，自动重置为 FAILED
  if (status === SessionStatus.COMPRESSING && compression?.statusChangedTime) {
    const elapsed = Date.now() - compression.statusChangedTime;
    if (elapsed > COMPRESS_TIMEOUT_MS) {
      console.warn(`压缩状态超时 (${Math.round(elapsed / 1000)}s)，重置为 FAILED`);
      await setCompressSessionStatus(sessionId, SessionStatus.FAILED);
      return SessionStatus.FAILED;
    }
  }

  // FAILED 状态冷却后自动重置为 INITIAL，允许重试
  if (status === SessionStatus.FAILED && compression?.statusChangedTime) {
    const elapsed = Date.now() - compression.statusChangedTime;
    if (elapsed > FAILED_COOLDOWN_MS) {
      console.info(`FAILED 状态冷却结束 (${Math.round(elapsed / 1000)}s)，重置为 INITIAL`);
      await setCompressSessionStatus(sessionId, SessionStatus.INITIAL);
      return SessionStatus.INITIAL;
    }
  }

  return status;
};

export const getPrevCompressSessionStatus = async (sessionId: string) => {
  const sessionData = await getSessionById(sessionId);
  return sessionData?.data?.compression?.prevCompressSessionStatus || SessionStatus.INITIAL;
};

export const setCompressSessionStatus = async (sessionId: string, status: SessionStatus) => {
  const sessionData = await getSessionById(sessionId);
  const prevStatus = sessionData?.data?.compression?.compressSessionStatus || SessionStatus.INITIAL;

  const result = syncSessionHistory(sessionId, {
    data: {
      compression: {
        compressSessionStatus: status,
        prevCompressSessionStatus: prevStatus,
        statusChangedTime: Date.now(),
      },
    },
  });

  compressStatusListeners.forEach((listener) => listener(sessionId, status));

  return result;
};

export const subscribeCompressStatus = (
  listener: (sessionId: string, status: SessionStatus) => void,
): (() => void) => {
  compressStatusListeners.add(listener);
  return () => {
    compressStatusListeners.delete(listener);
  };
};