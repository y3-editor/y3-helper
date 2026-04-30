/**
 * Subagent Store —— 轻量 Zustand store
 *
 * 职责：
 * - 持有 UI 可观测的 subagent 状态（纯可序列化数据）
 * - 持有排队中的任务状态
 *
 * 设计决策：
 * - Store 只存 Immer 安全的可序列化数据
 * - Runner 生命周期管理完全委托给 runnerManager（不经过 Immer）
 * - Agent 注册表是纯静态模块，通过导入暴露
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { Agent, SubagentStatus, SubagentStatusInfo } from '../types';
import { BUILTIN_AGENTS } from '../agents';
import { useSubagentEventStore } from './events';
import type { QueuedTaskInfo } from '../lifecycle/scheduler';

// ============================================================
// 状态转换规则
// ============================================================

/**
 * 合法的状态转换表。
 * 终态（completed、failed、aborted）不允许再转换到任何状态。
 */
const VALID_TRANSITIONS: Record<SubagentStatus, SubagentStatus[]> = {
  pending: ['running', 'aborted'],
  running: ['waiting_tool', 'completed', 'failed', 'aborted'],
  waiting_tool: ['running', 'failed', 'aborted'],
  completed: [],
  // failed → running：允许用户 Retry，恢复子代理执行
  failed: ['running'],
  aborted: [],
};

// ============================================================
// Zustand Store
// ============================================================

interface SubagentStore {
  /** Agent 注册表（内置 + 用户自定义合并后的列表） */
  agents: Agent[];

  /**
   * 同步用户自定义 Agent 列表（由 IDE SYNC_AGENTS 事件触发）。
   * 同名 Agent 以用户配置覆盖内置配置；全新 Agent 追加到列表末尾。
   */
  setAgents: (customAgents: Agent[]) => void;

  /**
   * 各 subagent 的 UI 可观测状态。
   * key = toolCallId（主会话 tool_call 的 ID），UI 天然持有此值，无需二次查找。
   * 内部通过 statusInfo.taskId 关联后端子会话。
   */
  statuses: Record<string, SubagentStatusInfo>;

  /**
   * 排队中的任务状态。
   * key = toolCallId，与 statuses 使用相同的主键。
   */
  queuedStatuses: Record<string, QueuedTaskInfo>;

  /** 根据名称查找 Agent */
  getAgent: (name: string) => Agent | undefined;

  /**
   * 更新指定 subagent 的状态（由 runner 调用）。
   * @param toolCallId 主会话 tool_call ID（作为主键）
   * @param info 要更新的字段
   */
  updateStatus: (toolCallId: string, info: Partial<SubagentStatusInfo>) => void;

  /** 移除指定 subagent 的状态记录 */
  removeStatus: (toolCallId: string) => void;

  /**
   * 更新排队状态（由调度器回调调用）。
   * @param queuedTasks 当前排队中的任务列表
   */
  updateQueuedStatuses: (queuedTasks: QueuedTaskInfo[]) => void;

  /** 移除指定排队状态记录 */
  removeQueuedStatus: (toolCallId: string) => void;

  /**
   * 检查是否有活跃的 subagent（pending/running/waiting_tool）
   */
  hasActiveSubagents: () => boolean;

  /**
   * 获取活跃 subagent 数量
   */
  getActiveCount: () => number;

  /**
   * 获取排队中的任务数量
   */
  getQueuedCount: () => number;
}

export const useSubagentStore = create<SubagentStore>()(
  immer((set, get) => ({
    agents: BUILTIN_AGENTS,

    setAgents: (_agents: Agent[]) => {
      set((state) => {
        const builtinNames = new Set(BUILTIN_AGENTS.map((a) => a.name));
        // 先映射内置 agents：若用户有同名配置则覆盖
        const merged = BUILTIN_AGENTS.map((builtin) => {
          const custom = _agents.find((c) => c.name === builtin.name);
          return custom ? { ...builtin, ...custom, source: 'custom' as const } : builtin;
        });
        // 再追加全新的用户自定义 agents（名称不在内置列表中）
        const newAgents = _agents
          .filter((c) => !builtinNames.has(c.name))
          .map((c) => ({ ...c, source: 'custom' as const }));
        state.agents = [...merged, ...newAgents];
      });
    },

    statuses: {},

    queuedStatuses: {},

    getAgent: (name: string) => {
      return get().agents.find((a) => a.name === name);
    },

    updateStatus: (toolCallId: string, info: Partial<SubagentStatusInfo>) => {
      set((state) => {
        const existing = state.statuses[toolCallId];

        console.log('🔄 %cSubagent Status Update:', 'color: #7C2D12; font-weight: bold; background: #FEF3C7; padding: 2px 6px; border-radius: 4px;', {
          '🆔 Tool Call ID': toolCallId,
          '📊 Update Info': info,
          '🎯 Existing Status': existing ? {
            taskId: existing.taskId,
            agentName: existing.agentName,
            status: existing.status,
            step: existing.step,
            maxSteps: existing.maxSteps,
          } : null,
        });

        if (existing) {
          // 状态转换校验
          if (info.status) {
            const current = existing.status;
            const next = info.status;
            const allowed = VALID_TRANSITIONS[current];

            console.log('🔀 %cStatus Transition Check:', 'color: #0369A1; font-weight: bold;', {
              '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
              '🎭 Current Status': current,
              '🎯 Next Status': next,
              '✅ Allowed Transitions': allowed,
              '🔍 Is Valid': allowed.includes(next),
            });

            if (!allowed.includes(next)) {
              console.warn('❌ %cInvalid Status Transition Blocked:', 'color: #DC2626; font-weight: bold; background: #FEE2E2; padding: 2px 6px; border-radius: 4px;', {
                '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
                '🚫 Invalid Transition': `${current} → ${next}`,
                '✅ Allowed Transitions': allowed,
                '🔧 Action': 'Skipped status update, applied other fields only',
              });

              if (import.meta.env.DEV) {
                console.warn(
                  `[Subagent] Invalid status transition: ${current} → ${next} (toolCallId: ${toolCallId})`,
                );
              }
              // 非法转换：跳过 status 写入，但仍可更新其他字段
              const { ...rest } = info;
              Object.assign(existing, rest);
              return;
            } else {
              console.log('✅ %cStatus Transition Allowed:', 'color: #059669; font-weight: bold;', {
                '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
                '✅ Valid Transition': `${current} → ${next}`,
                '🎯 Agent': existing.agentName || 'Unknown',
              });
            }
          }
          Object.assign(existing, info);

          console.log('📝 %cStatus Updated:', 'color: #7C3AED; font-weight: bold;', {
            '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
            '📊 Final Status': state.statuses[toolCallId],
          });
        } else {
          // 首次设置状态，跳过转换校验，直接写入
          const newStatus: SubagentStatusInfo = {
            taskId: '',
            agentName: '',
            step: 0,
            maxSteps: 0,
            status: 'pending' as SubagentStatus,
            description: '',
            ...info,
          };
          state.statuses[toolCallId] = newStatus;

          console.log('🆕 %cNew Subagent Status Created:', 'color: #059669; font-weight: bold; background: #D1FAE5; padding: 2px 6px; border-radius: 4px;', {
            '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
            '📊 Initial Status': newStatus,
          });
        }

        // 任务开始执行时，从排队状态中移除
        if (info.status === 'pending' || info.status === 'running') {
          const wasQueued = state.queuedStatuses[toolCallId];
          if (wasQueued) {
            delete state.queuedStatuses[toolCallId];
            console.log('🚀 %cTask Started - Removed from Queue:', 'color: #DC2626; font-weight: bold;', {
              '📋 Tool Call ID': toolCallId.substring(0, 8) + '...',
              '🎯 Status': info.status,
              '🏷️ Agent': wasQueued.agentName,
            });
          }
        }
      });
    },

    removeStatus: (toolCallId: string) => {
      set((state) => {
        delete state.statuses[toolCallId];
      });
    },

    updateQueuedStatuses: (queuedTasks: QueuedTaskInfo[]) => {
      set((state) => {
        // 清空旧的排队状态，重新构建
        state.queuedStatuses = {};
        for (const task of queuedTasks) {
          state.queuedStatuses[task.toolCallId] = task;
        }
      });
    },

    removeQueuedStatus: (toolCallId: string) => {
      set((state) => {
        delete state.queuedStatuses[toolCallId];
      });
    },

    hasActiveSubagents: () => {
      const statuses = get().statuses;
      return Object.values(statuses).some(
        (info) =>
          info.status === 'pending' ||
          info.status === 'running' ||
          info.status === 'waiting_tool',
      );
    },

    getActiveCount: () => {
      const statuses = get().statuses;
      return Object.values(statuses).filter(
        (info) =>
          info.status === 'pending' ||
          info.status === 'running' ||
          info.status === 'waiting_tool',
      ).length;
    },

    getQueuedCount: () => {
      return Object.keys(get().queuedStatuses).length;
    },
  })),
);

// ============================================================
// 全局调试入口（仅开发模式）
// ============================================================

if (import.meta.env.DEV) {
  (window as any).__SUBAGENT_DEBUG__ = {
    get statuses() {
      return useSubagentStore.getState().statuses;
    },
    get activeTaskIds() {
      const statuses = useSubagentStore.getState().statuses;
      return Object.entries(statuses)
        .filter(
          ([, info]) =>
            info.status === 'running' ||
            info.status === 'pending' ||
            info.status === 'waiting_tool',
        )
        .map(([taskId]) => taskId);
    },
    get recentEvents() {
      return useSubagentEventStore.getState().events.slice(-50);
    },
  };
}