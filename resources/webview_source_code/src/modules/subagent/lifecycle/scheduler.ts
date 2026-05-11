/**
 * SubagentScheduler —— 子代理并发调度器
 *
 * 职责：
 * - 限制同时运行的子代理数量（MAX_CONCURRENT_RUNNERS）
 * - 超限任务排队等待，按 FIFO 顺序执行
 * - 支持按会话批量取消排队任务
 * - 提供排队任务信息供 UI 展示
 *
 * 设计决策：
 * - Scheduler 只控制"是否允许启动"，不管理 Runner 生命周期
 * - 使用时间戳比较区分不同对话轮次，避免误取消新任务
 */

import {
  TOOL_TIMEOUT_MS,
  MAX_CONCURRENT_RUNNERS,
  MAX_QUEUE_SIZE,
} from '../constants';
import { useSubagentStore } from '../state/store';
import { debugLog, debugError } from '../../../utils/debugLog';

const MODULE = 'Scheduler';

// ============================================================
// 常量
// ============================================================

/** 过期会话清理间隔（5 分钟） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** 会话记录过期时间（24 小时） */
const SESSION_EXPIRE_MS = 24 * 60 * 60 * 1000;

/** 会话记录数量上限 */
const MAX_ABORTED_SESSIONS = 1000;

/** 触发队列压缩的阈值 */
const COMPACT_THRESHOLD = 100;

// ============================================================
// 类型定义
// ============================================================

/** 排队任务信息（供 UI 展示） */
export interface QueuedTaskInfo {
  toolCallId: string;
  agentName: string;
  description: string;
  queuedAt: number;
  queuePosition: number;
  parentSessionId: string;
}

interface QueueItem<T = any> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  taskInfo?: QueuedTaskInfo;
}

type QueueChangeCallback = (queuedTasks: QueuedTaskInfo[]) => void;

// ============================================================
// 调度器实现
// ============================================================

export class SubagentScheduler {
  /** 当前运行中的任务数 */
  private runningCount = 0;

  /** 任务队列 */
  private queue: QueueItem[] = [];

  /** 队列头指针（避免 shift 的 O(n) 开销） */
  private queueHead = 0;

  /** 是否已关闭 */
  private isShutdown = false;

  /** 队列变化回调 */
  private changeCallbacks: QueueChangeCallback[] = [];

  /** 已取消的会话及其取消时间 */
  private abortedSessions = new Map<string, number>();

  /** 清理定时器 */
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(
      () => this.cleanupExpiredSessions(),
      CLEANUP_INTERVAL_MS,
    );
    debugLog(MODULE, 'Initialized', { MAX_CONCURRENT_RUNNERS, MAX_QUEUE_SIZE });
  }

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 调度任务执行
   * - 并发未满：立即执行
   * - 并发已满：入队等待
   * - 队列已满：拒绝任务
   */
  schedule<T>(
    fn: () => Promise<T>,
    taskInfo?: Omit<QueuedTaskInfo, 'queuedAt' | 'queuePosition'>,
  ): Promise<T> {
    if (this.isShutdown) {
      return Promise.reject(new Error('[Subagent] Scheduler is shutdown'));
    }

    // 并发槽位可用，直接执行
    if (this.runningCount < MAX_CONCURRENT_RUNNERS) {
      return this.execute(fn);
    }

    // 队列已满，拒绝
    if (this.pendingCount >= MAX_QUEUE_SIZE) {
      debugError(MODULE, 'Queue full, rejecting task');
      return Promise.reject(
        new Error(`[Subagent] Queue full (max ${MAX_QUEUE_SIZE})`),
      );
    }

    // 入队等待
    return this.enqueue(fn, taskInfo);
  }

  /** 按会话取消所有排队任务 */
  cancelBySession(sessionId: string): number {
    const abortTime = Date.now();
    this.abortedSessions.set(sessionId, abortTime);

    let count = 0;
    for (let i = this.queueHead; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (this.shouldCancel(item, sessionId, abortTime)) {
        this.rejectItem(item, 'parent session abort');
        this.queue[i] = null as any;
        count++;
      }
    }

    if (count > 0) {
      this.compactNulls();
      this.notifyChange();
      debugLog(MODULE, `Cancelled ${count} tasks`, { sessionId });
    }

    return count;
  }

  /** 按 toolCallId 取消单个排队任务 */
  cancelByToolCallId(toolCallId: string): boolean {
    for (let i = this.queueHead; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item?.taskInfo?.toolCallId === toolCallId) {
        this.rejectItem(item, 'cancelled');
        this.queue[i] = null as any;
        this.compactNulls();
        this.notifyChange();
        return true;
      }
    }
    return false;
  }

  /** 清理会话的取消记录 */
  cleanupSession(sessionId: string): void {
    this.abortedSessions.delete(sessionId);
  }

  /** 关闭调度器 */
  shutdown(): void {
    this.isShutdown = true;
    clearInterval(this.cleanupTimer);

    // 拒绝所有排队任务
    for (let i = this.queueHead; i < this.queue.length; i++) {
      this.rejectItem(this.queue[i], 'shutdown');
    }

    this.queue = [];
    this.queueHead = 0;
    debugLog(MODULE, 'Shutdown complete');
  }

  /** 注册队列变化回调 */
  onQueueChange(callback: QueueChangeCallback): () => void {
    this.changeCallbacks.push(callback);
    return () => {
      const idx = this.changeCallbacks.indexOf(callback);
      if (idx !== -1) this.changeCallbacks.splice(idx, 1);
    };
  }

  // ============================================================
  // 状态查询
  // ============================================================

  get runningTasks(): number {
    return this.runningCount;
  }

  get pendingCount(): number {
    return this.queue.length - this.queueHead;
  }

  getQueuedTasks(): QueuedTaskInfo[] {
    return this.queue
      .slice(this.queueHead)
      .map((item, idx) =>
        item?.taskInfo ? { ...item.taskInfo, queuePosition: idx } : null,
      )
      .filter((info): info is QueuedTaskInfo => info !== null);
  }

  getMetrics() {
    const pending = this.pendingCount;
    const running = this.runningCount;

    // 平均排队时间
    const now = Date.now();
    const waitTimes = this.queue
      .slice(this.queueHead)
      .filter((item) => item?.taskInfo?.queuedAt)
      .map((item) => now - item.taskInfo!.queuedAt);
    const avgWaitTime =
      waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;

    return {
      running,
      pending,
      utilization: running / MAX_CONCURRENT_RUNNERS,
      queueUtilization: pending / MAX_QUEUE_SIZE,
      avgWaitTime,
      memory: {
        queueSize: this.queue.length,
        queueHead: this.queueHead,
        abortedSessions: this.abortedSessions.size,
      },
    };
  }

  // ============================================================
  // 内部方法
  // ============================================================

  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.runningCount++;
    try {
      return await fn();
    } finally {
      this.runningCount--;
      this.processNext();
    }
  }

  private enqueue<T>(
    fn: () => Promise<T>,
    taskInfo?: Omit<QueuedTaskInfo, 'queuedAt' | 'queuePosition'>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedAt = Date.now();

      const timeoutId = setTimeout(() => {
        const idx = this.queue.findIndex((item) => item.resolve === resolve);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.notifyChange();
        }
        reject(new Error(`[Subagent] Queue timeout (>${TOOL_TIMEOUT_MS}ms)`));
      }, TOOL_TIMEOUT_MS);

      const fullTaskInfo: QueuedTaskInfo | undefined = taskInfo
        ? { ...taskInfo, queuedAt, queuePosition: this.pendingCount }
        : undefined;

      this.queue.push({ fn, resolve, reject, timeoutId, taskInfo: fullTaskInfo });
      this.notifyChange();
    });
  }

  private processNext(): void {
    if (this.isShutdown || this.pendingCount === 0) return;
    if (this.runningCount >= MAX_CONCURRENT_RUNNERS) return;

    while (this.queueHead < this.queue.length) {
      const item = this.queue[this.queueHead];

      // 检查是否需要跳过（已取消的旧任务）
      if (this.isStaleTask(item)) {
        this.rejectItem(item, 'parent session abort');
        this.queueHead++;
        this.notifyChange();
        continue;
      }

      // 执行任务
      clearTimeout(item.timeoutId);
      this.execute(item.fn).then(item.resolve, item.reject);
      this.queueHead++;
      this.notifyChange();

      // 定期压缩
      if (this.queueHead > COMPACT_THRESHOLD) {
        this.compactQueue();
      }

      break;
    }
  }

  /** 检查任务是否属于已取消会话的旧任务 */
  private isStaleTask(item: QueueItem): boolean {
    const sessionId = item.taskInfo?.parentSessionId;
    if (!sessionId) return false;

    const abortTime = this.abortedSessions.get(sessionId);
    if (!abortTime) return false;

    // 只跳过取消之前入队的任务
    return item.taskInfo!.queuedAt < abortTime;
  }

  private shouldCancel(
    item: QueueItem,
    sessionId: string,
    abortTime: number,
  ): boolean {
    return (
      item?.taskInfo?.parentSessionId === sessionId &&
      item.taskInfo.queuedAt < abortTime
    );
  }

  private rejectItem(item: QueueItem, reason: string): void {
    if (!item) return;
    clearTimeout(item.timeoutId);
    item.reject(new Error(`[Subagent] Task ${reason}`));
  }

  private compactQueue(): void {
    if (this.queueHead === 0) return;
    this.queue = this.queue.slice(this.queueHead);
    this.queueHead = 0;
  }

  private compactNulls(): void {
    const valid = this.queue.slice(this.queueHead).filter((item) => item !== null);
    this.queue = this.queue.slice(0, this.queueHead).concat(valid);
  }

  private notifyChange(): void {
    const tasks = this.getQueuedTasks();
    this.changeCallbacks.forEach((cb) => cb(tasks));
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    // 清理过期记录
    for (const [sessionId, abortTime] of this.abortedSessions.entries()) {
      if (now - abortTime > SESSION_EXPIRE_MS) {
        this.abortedSessions.delete(sessionId);
        cleaned++;
      }
    }

    // 记录过多时，保留最新的一半
    if (this.abortedSessions.size > MAX_ABORTED_SESSIONS) {
      const oldSize = this.abortedSessions.size;
      const sorted = Array.from(this.abortedSessions.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, MAX_ABORTED_SESSIONS / 2);
      this.abortedSessions = new Map(sorted);
      cleaned += oldSize - sorted.length;
    }

    if (cleaned > 0) {
      debugLog(MODULE, `Cleaned ${cleaned} expired sessions`);
    }
  }

}

// ============================================================
// 单例导出
// ============================================================

export const subagentScheduler = new SubagentScheduler();

// 自动同步排队状态到 Store
subagentScheduler.onQueueChange((queuedTasks) => {
  useSubagentStore.getState().updateQueuedStatuses(queuedTasks);
});