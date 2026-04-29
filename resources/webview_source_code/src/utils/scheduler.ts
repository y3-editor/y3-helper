/**
 * 基于 MessageChannel 的协作式调度器
 *
 * const id = scheduleWork((deadline) => {
 *   while (deadline.timeRemaining() > 0 && hasWork) {
 *     doWork();
 *   }
 *   if (hasWork) scheduleWork(callback);
 * });
 * cancelWork(id);
 *
 */

const SLICE_MS = 5;

export interface SchedulerDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

export type SchedulerCallback = (deadline: SchedulerDeadline) => void;

// --- 内部状态 ---
let nextTaskId = 1;
const taskQueue = new Map<number, SchedulerCallback>();
const pendingIds: number[] = []; // FIFO 顺序
let isMessageLoopRunning = false;

// 全局单 channel
const channel = new MessageChannel();

/** 如果队列中还有待处理任务，触发下一轮消息循环 */
function requestNextSlice(): void {
  if (pendingIds.length > 0 && !isMessageLoopRunning) {
    isMessageLoopRunning = true;
    channel.port2.postMessage(null);
  }
}

/** 跳过队首所有已取消的任务，返回第一个有效任务（如有） */
function dequeueNextTask(): SchedulerCallback | undefined {
  while (pendingIds.length > 0) {
    const id = pendingIds.shift()!;
    const cb = taskQueue.get(id);
    if (cb) {
      taskQueue.delete(id);
      return cb;
    }
  }
  return undefined;
}

channel.port1.onmessage = () => {
  isMessageLoopRunning = false;
  const startTime = performance.now();

  const deadline: SchedulerDeadline = {
    didTimeout: false,
    timeRemaining() {
      return Math.max(0, SLICE_MS - (performance.now() - startTime));
    },
  };

  // 取出队首有效任务执行（每轮只执行一个，让回调自行决定是否继续）
  if (deadline.timeRemaining() > 0) {
    const cb = dequeueNextTask();
    if (cb) {
      cb(deadline);
    }
  }

  requestNextSlice();
};

/**
 * 调度一个任务，在下一个宏任务时间片中执行
 *
 * @param callback 回调函数，接收 deadline 参数
 * @returns 任务 ID，可用于 cancelWork 取消
 */
export function scheduleWork(callback: SchedulerCallback): number {
  const id = nextTaskId++;
  taskQueue.set(id, callback);
  pendingIds.push(id);
  requestNextSlice();
  return id;
}

/**
 * 取消一个已调度但尚未执行的任务
 *
 * @param id scheduleWork 返回的任务 ID
 */
export function cancelWork(id: number): void {
  taskQueue.delete(id);
  // pendingIds 中的条目会在 dequeueNextTask 时自动跳过
}

if (process.env.NODE_ENV === 'development') {
  window.scheduleWork = scheduleWork;
}
