/**
 * SubagentScheduler —— 子代理并发调度器
 *
 * 职责：
 * - 限制同时运行的子代理数量（maxConcurrentRunners）
 * - 超限任务排队等待，按 FIFO 顺序执行
 * - 队列超时保护，防止任务永久排队
 * - 提供排队任务信息供 UI 展示
 *
 * 设计决策：
 * - 使用原生 class + 数组队列，与 RunnerManager 保持一致的单例模式
 * - Scheduler 不管理 Runner 生命周期，只控制"是否允许启动"
 * - schedule() 返回 Promise<T>，内部通过 resolve/reject 控制排队逻辑
 */

import {
  TOOL_TIMEOUT_MS,
  MAX_CONCURRENT_RUNNERS,
  MAX_QUEUE_SIZE,
} from '../constants';
import { useSubagentStore } from '../state/store';

// ============================================================
// 类型定义
// ============================================================

/** 排队任务的信息，供 UI 展示 */
export interface QueuedTaskInfo {
  /** 主会话 tool_call ID，作为 UI 状态主键 */
  toolCallId: string;
  /** Agent 名称 */
  agentName: string;
  /** 任务描述 */
  description: string;
  /** 入队时间戳 */
  queuedAt: number;
  /** 在队列中的位置（从 0 开始） */
  queuePosition: number;
  /** 父会话 ID（用于批量 abort） */
  parentSessionId: string;
}

interface QueueItem<T = any> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  /** 排队任务信息（用于 UI 展示） */
  taskInfo?: QueuedTaskInfo;
}

/** 排队状态变化回调 */
type QueueChangeCallback = (queuedTasks: QueuedTaskInfo[]) => void;

// ============================================================
// 调度器实现
// ============================================================

export class SubagentScheduler {
  private running = 0;
  private queue: QueueItem[] = [];
  private queueHead = 0; // 使用索引避免 shift 操作的性能问题
  private isShutdown = false;
  /** 排队状态变化回调列表 */
  private queueChangeCallbacks: QueueChangeCallback[] = [];
  /** 被 abort 的父会话 ID 集合，用于阻止排队任务继续执行 */
  private abortedSessions = new Set<string>();
  /** 会话清理定时器，防止内存泄漏 */
  private sessionCleanupTimer: NodeJS.Timeout;
  /** 记录会话被 abort 的时间，用于过期清理 */
  private sessionAbortTimestamps = new Map<string, number>();
  /** 调度器启动时间，用于性能统计 */
  private startTime = Date.now();

  constructor() {
    // 每5分钟清理一次过期的 aborted session 记录
    this.sessionCleanupTimer = setInterval(() => {
      this.cleanupExpiredAbortedSessions();
    }, 5 * 60 * 1000);

    console.log(`[Subagent][Scheduler] Initialized with MAX_CONCURRENT_RUNNERS=${MAX_CONCURRENT_RUNNERS}, automatic session cleanup (5min interval)`);
  }

  /**
   * 调度一个子代理任务执行。
   *
   * - 并发未满时直接执行
   * - 并发已满时入队等待
   * - 队列已满时立即 reject
   * - 队列中的任务超时 TOOL_TIMEOUT_MS 后自动 reject
   *
   * @param fn - 要执行的异步任务函数
   * @param taskInfo - 可选的排队任务信息（用于 UI 展示）
   * @returns 任务执行结果
   */
  schedule<T>(
    fn: () => Promise<T>,
    taskInfo?: Omit<QueuedTaskInfo, 'queuedAt' | 'queuePosition'>,
  ): Promise<T> {
    if (this.isShutdown) {
      return Promise.reject(
        new Error('[Subagent] Scheduler is shutdown, cannot accept new tasks'),
      );
    }

    if (this.running < MAX_CONCURRENT_RUNNERS) {
      return this.execute(fn);
    }

    if (this.getValidQueueSize() >= MAX_QUEUE_SIZE) {
      console.error(`[Subagent][Scheduler] Queue is full! Rejecting task.`);
      return Promise.reject(
        new Error(
          `[Subagent] Scheduler queue is full (max ${MAX_QUEUE_SIZE}), cannot accept new tasks`,
        ),
      );
    }

    // 入队等待
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // 队列超时：从队列中移除并 reject
        const index = this.queue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.notifyQueueChange();
        }
        reject(
          new Error(
            `[Subagent] Task queued for too long (>${TOOL_TIMEOUT_MS}ms), rejected`,
          ),
        );
      }, TOOL_TIMEOUT_MS);

      const queuedAt = Date.now();
      const queuePosition = this.getValidQueueSize();

      const fullTaskInfo: QueuedTaskInfo | undefined = taskInfo
        ? {
            ...taskInfo,
            queuedAt,
            queuePosition,
          }
        : undefined;

      this.queue.push({
        fn,
        resolve,
        reject,
        timeoutId,
        taskInfo: fullTaskInfo,
      });
      this.notifyQueueChange();
    });
  }

  /**
   * 执行任务，完成后自动从队列中取下一个执行。
   */
  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try {
      const result = await fn();
      return result;
    } catch (error) {
      console.error(`[Subagent][Scheduler] Task failed:`, error);
      throw error;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  /**
   * 从队列头部取出一个任务执行。
   * Runner 完成时自动调用。
   *
   * 性能优化：使用索引而非 shift 操作，避免 O(n) 复杂度
   */
  private processQueue(): void {
    if (this.isShutdown) {
      console.log(
        `[Subagent][Scheduler] Scheduler is shutdown, not processing queue`,
      );
      return;
    }

    if (this.getValidQueueSize() === 0 || this.running >= MAX_CONCURRENT_RUNNERS) {
      return;
    }

    // 性能优化：跳过被 abort 的会话的排队任务，使用索引避免频繁 shift
    while (this.queueHead < this.queue.length && this.running < MAX_CONCURRENT_RUNNERS) {
      const item = this.queue[this.queueHead];

      if (item.taskInfo?.parentSessionId && this.abortedSessions.has(item.taskInfo.parentSessionId)) {
        // 这个任务的父会话已被 abort，跳过并 reject
        clearTimeout(item.timeoutId);
        item.reject(new Error('[Subagent] Task skipped due to parent session abort'));
        console.log(`[Subagent][Scheduler] Skipped queued task for aborted session: ${item.taskInfo.parentSessionId}`);
        this.queueHead++;
        this.notifyQueueChange();
        continue;
      }

      // 找到有效任务，执行它
      clearTimeout(item.timeoutId);
      this.execute(item.fn).then(item.resolve, item.reject);
      this.queueHead++;
      this.notifyQueueChange();

      // 性能优化：定期压缩队列，回收内存
      if (this.queueHead > 100) {
        this.compactQueue();
      }

      break;
    }
  }

  /**
   * 压缩队列，清理已处理的任务，回收内存
   */
  private compactQueue(): void {
    if (this.queueHead === 0) return;

    const oldLength = this.queue.length;
    this.queue = this.queue.slice(this.queueHead);
    this.queueHead = 0;

    console.log(`[Subagent][Scheduler] Compacted queue: ${oldLength} -> ${this.queue.length} items`);
    this.notifyQueueChange();
  }

  /**
   * 获取有效的队列大小（排除已处理的项目）
   */
  private getValidQueueSize(): number {
    return this.queue.length - this.queueHead;
  }

  /**
   * 清理过期的 aborted session 记录，防止内存泄漏
   *
   * 清理策略：
   * 1. 超过24小时的记录自动清理
   * 2. 如果 abortedSessions 超过1000个，强制清理最旧的记录
   */
  private cleanupExpiredAbortedSessions(): void {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24小时
    let cleanedCount = 0;

    // 清理过期的记录
    for (const [sessionId, abortTime] of this.sessionAbortTimestamps.entries()) {
      if (now - abortTime > expireTime) {
        this.abortedSessions.delete(sessionId);
        this.sessionAbortTimestamps.delete(sessionId);
        cleanedCount++;
      }
    }

    // 如果记录过多，强制清理最旧的记录
    if (this.abortedSessions.size > 1000) {
      const sortedSessions = Array.from(this.sessionAbortTimestamps.entries())
        .sort(([, timeA], [, timeB]) => timeA - timeB)
        .slice(0, this.abortedSessions.size - 500); // 保留500个最新的

      for (const [sessionId] of sortedSessions) {
        this.abortedSessions.delete(sessionId);
        this.sessionAbortTimestamps.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[Subagent][Scheduler] Cleaned up ${cleanedCount} expired aborted sessions. ` +
        `Current count: ${this.abortedSessions.size}`
      );
    }
  }

  /**
   * 关闭调度器：reject 所有排队任务，标记 shutdown。
   * 已运行的任务不受影响，会自然完成。
   */
  shutdown(): void {
    this.isShutdown = true;

    // 清理定时器
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
    }

    // reject 所有排队中的任务（使用索引遍历）
    for (let i = this.queueHead; i < this.queue.length; i++) {
      const item = this.queue[i];
      clearTimeout(item.timeoutId);
      item.reject(new Error('[Subagent] Scheduler shutdown, task rejected'));
    }

    // 清空队列和索引
    this.queue = [];
    this.queueHead = 0;
  }

  /**
   * 获取当前运行中的任务数量。
   */
  getRunningCount(): number {
    return this.running;
  }

  /**
   * 获取当前排队中的任务数量。
   */
  getQueueSize(): number {
    return this.getValidQueueSize();
  }

  /**
   * 获取当前排队中的任务信息列表。
   * 返回的列表按入队顺序排列，queuePosition 会实时更新。
   */
  getQueuedTasks(): QueuedTaskInfo[] {
    const validQueue = this.queue.slice(this.queueHead);
    return validQueue
      .map((item, index) =>
        item.taskInfo ? { ...item.taskInfo, queuePosition: index } : null,
      )
      .filter((info): info is QueuedTaskInfo => info !== null);
  }

  /**
   * 注册排队状态变化回调。
   * @param callback 回调函数，接收当前排队任务列表
   * @returns 取消注册的函数
   */
  onQueueChange(callback: QueueChangeCallback): () => void {
    this.queueChangeCallbacks.push(callback);
    return () => {
      const index = this.queueChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.queueChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有注册的回调，排队状态已变化。
   */
  private notifyQueueChange(): void {
    const queuedTasks = this.getQueuedTasks();
    for (const callback of this.queueChangeCallbacks) {
      callback(queuedTasks);
    }
  }

  /**
   * 获取详细的性能统计信息
   */
  getPerformanceMetrics(): {
    runningTasks: number;
    queuedTasks: number;
    utilization: number; // 并发利用率 0-1
    queueUtilization: number; // 队列利用率 0-1
    avgQueueTime?: number; // 平均排队时间（毫秒）
    queueThroughput: number; // 队列吞吐量（任务/秒）
    memoryUsage: {
      queueSlots: number;
      queueHead: number;
      abortedSessions: number;
    };
  } {
    const queuedTasks = this.getValidQueueSize();
    const runningTasks = this.running;

    // 计算平均排队时间
    const now = Date.now();
    const queueTimes = this.queue
      .slice(this.queueHead)
      .filter(item => item?.taskInfo?.queuedAt)
      .map(item => now - item.taskInfo!.queuedAt);
    const avgQueueTime = queueTimes.length > 0
      ? queueTimes.reduce((a, b) => a + b, 0) / queueTimes.length
      : undefined;

    // 估算吞吐量（基于最近的处理情况）
    const queueThroughput = this.queueHead > 0 ? this.queueHead / (now - this.startTime) * 1000 : 0;

    return {
      runningTasks,
      queuedTasks,
      utilization: runningTasks / MAX_CONCURRENT_RUNNERS,
      queueUtilization: queuedTasks / MAX_QUEUE_SIZE,
      avgQueueTime,
      queueThroughput,
      memoryUsage: {
        queueSlots: this.queue.length,
        queueHead: this.queueHead,
        abortedSessions: this.abortedSessions.size,
      },
    };
  }

  /**
   * 清理已完成的会话记录，避免内存泄漏。
   * @param parentSessionId 父会话 ID
   */
  cleanupSession(parentSessionId: string): void {
    this.abortedSessions.delete(parentSessionId);
    this.sessionAbortTimestamps.delete(parentSessionId);
    console.log(`[Subagent][Scheduler] Cleaned up session: ${parentSessionId}`);
  }

  /**
   * 根据 toolCallId 从队列中移除任务（用于取消排队）。
   * @param toolCallId 主会话 tool_call ID
   * @returns 是否成功移除
   */
  removeFromQueue(toolCallId: string): boolean {
    for (let i = this.queueHead; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item?.taskInfo?.toolCallId === toolCallId) {
        clearTimeout(item.timeoutId);
        item.reject(new Error('[Subagent] Task removed from queue'));
        this.queue[i] = null as any;
        this.compactRemovedItems();
        this.notifyQueueChange();
        return true;
      }
    }
    return false;
  }

  /**
   * 按父会话 ID 从队列中移除所有相关的排队任务。
   * 用于主 agent 被 abort 时清理所有关联的排队子代理。
   *
   * @param parentSessionId 父会话 ID
   * @returns 成功移除的任务数量
   */
  removeQueuedBySession(parentSessionId: string): number {
    // 标记该会话为已 abort，防止后续排队任务执行
    this.abortedSessions.add(parentSessionId);
    this.sessionAbortTimestamps.set(parentSessionId, Date.now());

    let removedCount = 0;

    // 从队列中移除相关任务（注意：不能改变已处理任务的索引）
    for (let i = this.queueHead; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (item.taskInfo?.parentSessionId === parentSessionId) {
        clearTimeout(item.timeoutId);
        item.reject(new Error('[Subagent] Task removed from queue due to parent session abort'));
        // 将任务标记为已移除，而不是从数组中删除（避免索引混乱）
        this.queue[i] = null as any;
        removedCount++;
      }
    }

    // 清理被标记为 null 的项目
    if (removedCount > 0) {
      this.compactRemovedItems();
      this.notifyQueueChange();
      console.log(`[Subagent][Scheduler] Removed ${removedCount} queued tasks for parentSessionId: ${parentSessionId}`);
    }

    return removedCount;
  }

  /**
   * 清理队列中被标记为 null 的已移除项目
   */
  private compactRemovedItems(): void {
    const validItems = this.queue.slice(this.queueHead).filter(item => item !== null);
    this.queue = this.queue.slice(0, this.queueHead).concat(validItems);
  }
}

/** 全局单例 */
export const subagentScheduler = new SubagentScheduler();

// ============================================================
// 自动同步排队状态到 Store
// ============================================================

/**
 * 模块加载时自动订阅调度器的队列变化，同步到 Zustand store。
 * 无需在任何组件中手动调用同步 Hook。
 */
subagentScheduler.onQueueChange((queuedTasks) => {
  useSubagentStore.getState().updateQueuedStatuses(queuedTasks);
});