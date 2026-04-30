/**
 * Subagent Event Store —— 结构化事件收集器
 *
 * 职责：
 * - 以环形缓冲收集子代理运行时事件（状态变更、工具调用、错误等）
 * - 为调试面板和 window.__SUBAGENT_DEBUG__ 提供数据源
 *
 * 设计决策：
 * - emitEvent 是普通函数（非 hook），可在 class 和 async 函数中调用
 * - 使用 Zustand + immer，与现有 store 模式一致
 * - 环形缓冲大小使用 constants.ts 中的 MAX_EVENTS
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { MAX_EVENTS } from '../constants';
import type { SubagentEvent, SubagentEventType } from '../types';

// ============================================================
// Zustand Store
// ============================================================

interface SubagentEventStore {
  /** 事件列表（环形缓冲） */
  events: SubagentEvent[];
  /** 添加事件 */
  addEvent: (event: SubagentEvent) => void;
  /** 清空所有事件 */
  clearEvents: () => void;
}

export const useSubagentEventStore = create<SubagentEventStore>()(
  immer((set) => ({
    events: [],

    addEvent: (event: SubagentEvent) => {
      set((state) => {
        state.events.push(event);
        // 环形缓冲：超出上限时移除最早的事件
        while (state.events.length > MAX_EVENTS) {
          state.events.shift();
        }
      });
    },

    clearEvents: () => {
      set((state) => {
        state.events = [];
      });
    },
  })),
);

// ============================================================
// 辅助函数（非 hook，可在任意上下文中调用）
// ============================================================

/**
 * 发射一个子代理事件到 EventStore。
 *
 * 这是一个普通函数而非 hook，可以在 class 方法、async 函数中安全调用。
 *
 * @param type - 事件类型
 * @param taskId - 关联的子代理任务 ID
 * @param payload - 可选的事件负载数据
 */
export function emitEvent(
  type: SubagentEventType,
  taskId: string,
  payload?: Record<string, any>,
): void {
  useSubagentEventStore.getState().addEvent({
    type,
    taskId,
    timestamp: Date.now(),
    payload,
  });
}