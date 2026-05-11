/**
 * PendingEventQueue - 事件持久化队列
 *
 * 用于存储非当前 session 的 SESSION_ALL_TASKS_COMPLETE 事件。
 * 当用户切换回对应 session 时，系统会自动处理队列中的待处理事件。
 *
 * @module subagent/events/pendingEventQueue
 */

import { debugLog } from '../../../utils/debugLog';
import type { SessionAllTasksCompleteEvent } from './taskEventBus';

const MODULE = 'Subagent/Event';

/**
 * 过期时间：1 小时
 */
export const PENDING_EVENT_EXPIRY_MS = 60 * 60 * 1000;

/**
 * 队列中的事件条目
 */
interface PendingEvent {
  event: SessionAllTasksCompleteEvent;
  timestamp: number;
}

/**
 * PendingEventQueue - 待处理事件队列
 *
 * 负责：
 * 1. 存储非当前 session 的完成事件
 * 2. 切回 session 时返回待处理事件
 * 3. 自动清理过期事件
 */
class PendingEventQueue {
  private queue: Map<string, PendingEvent> = new Map();

  /**
   * 将事件存入队列
   * @param sessionId 会话 ID
   * @param event 完成事件
   */
  enqueue(sessionId: string, event: SessionAllTasksCompleteEvent): void {
    this.queue.set(sessionId, {
      event,
      timestamp: Date.now(),
    });

    if (import.meta.env.DEV) {
      debugLog(MODULE, 'Event enqueued', { sessionId });
    }
  }

  /**
   * 获取并移除待处理事件
   * @param sessionId 会话 ID
   * @returns 待处理事件，如果没有或已过期则返回 null
   */
  dequeue(sessionId: string): SessionAllTasksCompleteEvent | null {
    const entry = this.queue.get(sessionId);
    if (entry) {
      this.queue.delete(sessionId);

      // 检查事件是否已过期
      if (Date.now() - entry.timestamp > PENDING_EVENT_EXPIRY_MS) {
        if (import.meta.env.DEV) {
          debugLog(MODULE, 'Event expired and discarded', { sessionId });
        }
        return null;
      }

      if (import.meta.env.DEV) {
        debugLog(MODULE, 'Event dequeued', { sessionId });
      }

      return entry.event;
    }
    return null;
  }

  /**
   * 检查指定 session 是否有待处理的有效事件
   * @param sessionId 会话 ID
   * @returns 是否存在未过期的待处理事件
   */
  has(sessionId: string): boolean {
    const entry = this.queue.get(sessionId);
    if (!entry) {
      return false;
    }

    // 检查事件是否已过期
    if (Date.now() - entry.timestamp > PENDING_EVENT_EXPIRY_MS) {
      // 清理过期事件
      this.queue.delete(sessionId);
      if (import.meta.env.DEV) {
        debugLog(MODULE, 'Expired event cleaned in has()', { sessionId });
      }
      return false;
    }

    return true;
  }

  /**
   * 清理过期事件
   * 超过 PENDING_EVENT_EXPIRY_MS 的事件会被自动移除
   */
  cleanup(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, entry] of this.queue.entries()) {
      if (now - entry.timestamp > PENDING_EVENT_EXPIRY_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.queue.delete(sessionId);

      if (import.meta.env.DEV) {
        debugLog(MODULE, 'Expired event cleaned', { sessionId });
      }
    }
  }

  /**
   * 获取队列大小
   */
  get size(): number {
    return this.queue.size;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue.clear();
  }
}

/**
 * 全局单例队列
 */
export const pendingEventQueue = new PendingEventQueue();