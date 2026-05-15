/**
 * Subagent Store —— 轻量 Zustand store
 *
 * 职责：
 * - 持有 UI 可观测的 subagent 状态（纯可序列化数据）
 * - 持有排队中的任务状态
 *
 * ⚠️ 职责边界（重要）：
 * - ✅ 负责：UI 实时展示（进度、状态、工具调用历史）
 * - ❌ 不负责：任务完成判断（由 TaskCompletionTracker 负责）
 *
 * 设计决策：
 * - Store 只存 Immer 安全的可序列化数据
 * - Runner 生命周期管理完全委托给 runnerManager（不经过 Immer）
 * - Agent 注册表是纯静态模块，通过导入暴露
 *
 * @see TaskCompletionTracker - 任务完成判断的单一状态源
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';

import type {
  Agent,
  SubagentStatus,
  SubagentStatusInfo,
  SubagentSession,
  SubagentSessionMetadata,
} from '../types';
import { BUILTIN_AGENTS } from '../agents';
import { getSessionData } from '../../../services/chat';
import type { QueuedTaskInfo } from '../lifecycle/scheduler';
import { getIsolatedStorageKey } from '../../../utils';

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

/** 最大缓存会话数，采用 LRU 策略 */
const MAX_CACHED_SESSIONS = 20;

/**
 * 清理定时器跟踪表，用于避免定时器堆积导致的竞态条件。
 * key = toolCallId, value = 定时器 ID
 */
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface SubagentStore {
  /** Agent 注册表（内置 + 用户自定义合并后的列表，含加载错误的 agent） */
  agents: Agent[];

  /**
   * 可用 Agent 列表（派生字段，非持久化）。
   * 从 agents 中过滤掉 _status === "error" 的项，
   * 用于 system prompt 注入、TypeAhead 选择等"应用"场景。
   */
  validAgents: Agent[];

  /**
   * 同步用户自定义 Agent 列表（由 IDE SYNC_AGENTS 事件触发）。
   * 同名 Agent 以用户配置覆盖内置配置；全新 Agent 追加到列表末尾。
   */
  setAgents: (customAgents: Agent[]) => void;

  /**
   * 各 subagent 的 UI 可观测状态。
   * key = toolCallId（主会话 tool_call 的 ID），UI 天然持有此值，无需二次查找。
   * 内部通过 statusInfo.taskId 关联后端子会话。
   *
   * ⚠️ 职责说明：
   * - 用于 UI 实时展示（step、toolCalls、errorMessage 等详细信息）
   * - 不参与任务完成判断逻辑（由 TaskCompletionTracker 负责）
   */
  statuses: Record<string, SubagentStatusInfo>;

  /**
   * 排队中的任务状态。
   * key = toolCallId，与 statuses 使用相同的主键。
   */
  queuedStatuses: Record<string, QueuedTaskInfo>;

  /**
   * Subagent 会话缓存。
   * key = taskId（后端会话 _id），value = 完整会话数据（包含 messages）。
   * 内存中缓存所有加载过的子会话，localStorage 仅持久化元数据。
   */
  sessions: Map<string, SubagentSession>;

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
   * 获取活跃 subagent 数量
   * @param sessionId 可选的父会话 ID，用于过滤特定 session 的 subagent
   */
  getActiveCount: (sessionId?: string) => number;

  /**
   * 获取排队中的任务数量
   */
  getQueuedCount: () => number;

  /**
   * 清理指定 session 的所有 subagent 状态（用于 session 切换或结束时）
   * @param sessionId 父会话 ID
   */
  clearSessionStatuses: (sessionId: string) => void;

  // ============================================================
  // Session 管理 Actions
  // ============================================================

  /**
   * 更新指定 subagent 会话的状态。
   * 支持两种调用方式：
   * 1. 传入部分字段对象: updateSubagentSession(taskId, { status: 'completed' })
   * 2. 传入 immer 风格更新函数: updateSubagentSession(taskId, (draft) => { draft.messages.push(...) })
   *
   * @param taskId 子会话 ID
   * @param updater 更新对象或更新函数
   */
  updateSubagentSession: (
    taskId: string,
    updater: Partial<SubagentSession> | ((draft: SubagentSession) => void),
  ) => void;

  /**
   * 从后端加载完整会话数据并缓存到 Store。
   * 如果 Store 中已存在且 messages 不为空，则跳过加载。
   *
   * @param taskId 子会话 ID
   * @returns Promise<SubagentSession | null> 加载成功返回会话对象，失败返回 null
   */
  loadSubagentSession: (taskId: string) => Promise<SubagentSession | null>;

  /**
   * 从 Store 缓存中读取 subagent 会话。
   *
   * @param taskId 子会话 ID
   * @returns SubagentSession | undefined
   */
  getSubagentSession: (taskId: string) => SubagentSession | undefined;

  /**
   * 从 Store 和 localStorage 中移除指定会话。
   *
   * @param taskId 子会话 ID
   */
  removeSubagentSession: (taskId: string) => void;

  /**
   * 更新指定会话的压缩进行状态。
   *
   * @param taskId 子会话 ID
   * @param inProgress 压缩是否正在进行
   */
  updateCompressionStatus: (taskId: string, inProgress: boolean) => void;

  /**
   * 清空所有 subagent 会话缓存（用于测试或手动清理）。
   */
  clearAllSubagentSessions: () => void;
}

export const useSubagentStore = create<SubagentStore>()(
  persist(
    immer((set, get) => ({
      agents: BUILTIN_AGENTS,

      validAgents: BUILTIN_AGENTS,

      setAgents: (_agents: Agent[]) => {
        set((state) => {
          const builtinNames = new Set(BUILTIN_AGENTS.map((a) => a.name));
          // 先映射内置 agents：若用户有同名配置则覆盖
          const merged = BUILTIN_AGENTS.map((builtin) => {
            const custom = _agents.find((c) => c.name === builtin.name);
            return custom
              ? { ...builtin, ...custom, source: 'custom' as const }
              : builtin;
          });
          // 再追加全新的用户自定义 agents（名称不在内置列表中）
          const newAgents = _agents
            .filter((c) => !builtinNames.has(c.name))
            .map((c) => ({ ...c, source: 'custom' as const }));
          const allAgents = [...merged, ...newAgents];
          state.agents = allAgents;
          state.validAgents = allAgents.filter((a) => a._status !== 'error');
        });
      },

      statuses: {},

      queuedStatuses: {},

      sessions: new Map<string, SubagentSession>(),

      getAgent: (name: string) => {
        return get().agents.find((a) => a.name === name);
      },

      updateStatus: (toolCallId: string, info: Partial<SubagentStatusInfo>) => {
        set((state) => {
          const existing = state.statuses[toolCallId];
          if (existing) {
            // 状态转换校验
            if (info.status) {
              const current = existing.status;
              const next = info.status;
              const allowed = VALID_TRANSITIONS[current];

              if (!allowed.includes(next)) {
                if (import.meta.env.DEV) {
                  console.warn(
                    `[Subagent] Invalid status transition: ${current} → ${next} (toolCallId: ${toolCallId})`,
                  );
                }
                // 非法转换：跳过 status 写入，但仍可更新其他字段
                const { ...rest } = info;
                Object.assign(existing, rest);
                return;
              }
            }
            Object.assign(existing, info);
          } else {
            // 首次设置状态，跳过转换校验，直接写入
            const newStatus: SubagentStatusInfo = {
              taskId: '',
              parentSessionId: '',
              agentName: '',
              step: 0,
              maxSteps: 0,
              status: 'pending' as SubagentStatus,
              description: '',
              ...info,
            };
            state.statuses[toolCallId] = newStatus;
          }

          // 清理 queuedStatuses（任务开始执行或终止时）
          if (
            info.status === 'pending' ||
            info.status === 'running' ||
            info.status === 'completed' ||
            info.status === 'failed' ||
            info.status === 'aborted'
          ) {
            delete state.queuedStatuses[toolCallId];
          }

          // 状态变为非终态时，取消待执行的清理定时器（如 retry 场景）
          if (
            info.status === 'pending' ||
            info.status === 'running' ||
            info.status === 'waiting_tool'
          ) {
            const oldTimer = cleanupTimers.get(toolCallId);
            if (oldTimer) {
              clearTimeout(oldTimer);
              cleanupTimers.delete(toolCallId);
              if (import.meta.env.DEV) {
                console.log(
                  `[Subagent] Cancelled cleanup timer for ${toolCallId} (status: ${info.status})`,
                );
              }
            }
          }

          // 终态处理：同步时间信息到 session metadata，供 UI 显示
          // 注意：所有终态 (completed/failed/aborted) 都不再自动清理
          // 状态将保留在 statuses 中，直到会话切换或手动清理
          if (
            info.status === 'completed' ||
            info.status === 'failed' ||
            info.status === 'aborted'
          ) {
            // 取消旧的清理定时器（如果之前设置过）
            const oldTimer = cleanupTimers.get(toolCallId);
            if (oldTimer) {
              clearTimeout(oldTimer);
              cleanupTimers.delete(toolCallId);
              if (import.meta.env.DEV) {
                console.log(
                  `[Subagent] Cancelled cleanup timer for ${toolCallId} (status: ${info.status})`,
                );
              }
            }

            // 将时间信息同步到 session metadata，供 UI 显示
            if (info.taskId && info.startTime) {
              const session = get().sessions.get(info.taskId);
              if (session) {
                const startTimeISO = new Date(info.startTime).toISOString();
                const endTimeISO = new Date(info.endTime || Date.now()).toISOString();
                get().updateSubagentSession(info.taskId, {
                  metadata: {
                    create_time: startTimeISO,
                    update_time: endTimeISO,
                  },
                });
              }
            }
          }
        });
      },

      removeStatus: (toolCallId: string) => {
        set((state) => {
          delete state.statuses[toolCallId];
        });

        // 清理关联的定时器（如果有）
        const timer = cleanupTimers.get(toolCallId);
        if (timer) {
          clearTimeout(timer);
          cleanupTimers.delete(toolCallId);
        }
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

      getActiveCount: (sessionId?: string) => {
        const statuses = get().statuses;
        const statusList = Object.values(statuses);

        // 支持按 session 过滤
        const filtered = sessionId
          ? statusList.filter((info) => info.parentSessionId === sessionId)
          : statusList;

        return filtered.filter(
          (info) =>
            info.status === 'pending' ||
            info.status === 'running' ||
            info.status === 'waiting_tool',
        ).length;
      },

      getQueuedCount: () => {
        return Object.keys(get().queuedStatuses).length;
      },

      clearSessionStatuses: (sessionId: string) => {
        set((state) => {
          Object.keys(state.statuses).forEach((toolCallId) => {
            if (state.statuses[toolCallId].parentSessionId === sessionId) {
              delete state.statuses[toolCallId];

              // 清理关联的定时器
              const timer = cleanupTimers.get(toolCallId);
              if (timer) {
                clearTimeout(timer);
                cleanupTimers.delete(toolCallId);
              }
            }
          });
        });
      },

      // ============================================================
      // Session 管理 Actions 实现
      // ============================================================

      updateSubagentSession: (taskId, updater) => {
        set((state) => {
          let session = state.sessions.get(taskId);

          if (!session) {
            // 首次创建 session
            session = {
              _id: taskId,
              agentName: '',
              description: '',
              status: 'pending',
              messages: [],
            };
            state.sessions.set(taskId, session);

            // LRU 淘汰：如果超过最大缓存数，删除最旧的
            if (state.sessions.size > MAX_CACHED_SESSIONS) {
              const firstKey = state.sessions.keys().next().value;
              if (firstKey && firstKey !== taskId) {
                state.sessions.delete(firstKey);
                if (import.meta.env.DEV) {
                  console.log(
                    `[Subagent] LRU evicted session: ${firstKey} (cache size: ${state.sessions.size})`,
                  );
                }
              }
            }
          } else {
            // 更新已存在的 session，移到 Map 末尾（LRU 更新）
            state.sessions.delete(taskId);
            state.sessions.set(taskId, session);
          }

          if (typeof updater === 'function') {
            // immer 风格更新
            updater(session);
          } else {
            // 对象合并更新
            Object.assign(session, updater);

            // 同步更新 statuses (如果存在 toolCallId 映射且 status 有变化)
            if (updater.status) {
              const statusEntry = Object.entries(state.statuses).find(
                ([, info]) => info.taskId === taskId,
              );
              if (statusEntry) {
                const [toolCallId] = statusEntry;
                state.statuses[toolCallId].status = updater.status;
              }
            }
          }
        });
      },

      loadSubagentSession: async (taskId) => {
        const existingSession = get().sessions.get(taskId);

        // 如果已缓存且有 messages,跳过加载
        if (existingSession && existingSession.messages.length > 0) {
          return existingSession;
        }

        try {
          const sessionData = await getSessionData(taskId);

          if (!sessionData || !sessionData.data) {
            return null;
          }

          const session: SubagentSession = {
            _id: sessionData._id,
            agentName:
              sessionData.topic?.match(/\[Subagent\] (\w+):/)?.[1] || '',
            description: sessionData.topic?.split(': ')[1] || '',
            status: 'completed', // 历史会话默认为 completed
            messages: sessionData.data.messages || [],
            metadata: sessionData.metadata,
            consumedTokens: sessionData.data.consumedTokens,
            model: sessionData.data.model,
            compression: sessionData.data.compression,
            parentSessionId: (sessionData as any).parent_session_id,
          };

          // 写入 store 缓存
          set((state) => {
            // 删除旧记录（如果存在），以便重新添加到末尾（LRU 更新）
            if (state.sessions.has(taskId)) {
              state.sessions.delete(taskId);
            }

            state.sessions.set(taskId, session);

            // LRU 淘汰：如果超过最大缓存数，删除最旧的（Map 的第一个元素）
            if (state.sessions.size > MAX_CACHED_SESSIONS) {
              const firstKey = state.sessions.keys().next().value;
              if (firstKey) {
                state.sessions.delete(firstKey);
                if (import.meta.env.DEV) {
                  console.log(
                    `[Subagent] LRU evicted session: ${firstKey} (cache size: ${state.sessions.size})`,
                  );
                }
              }
            }
          });

          return session;
        } catch (error) {
          console.warn(`[Subagent] Failed to load session ${taskId}:`, error);
          return null;
        }
      },

      getSubagentSession: (taskId) => {
        return get().sessions.get(taskId);
      },

      removeSubagentSession: (taskId) => {
        set((state) => {
          state.sessions.delete(taskId);
        });
      },

      updateCompressionStatus: (taskId, inProgress) => {
        set((state) => {
          const session = state.sessions.get(taskId);
          if (session) {
            session.compressionInProgress = inProgress;
            if (import.meta.env.DEV) {
              console.log(
                `[Subagent] Updated compression status for ${taskId}: ${inProgress}`,
              );
            }
          }
        });
      },

      clearAllSubagentSessions: () => {
        set((state) => {
          state.sessions.clear();
        });
      },
    })),
    {
      name: getIsolatedStorageKey('subagent-store'),
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // 仅持久化静态配置和会话元数据
        // 不持久化运行时状态（statuses、queuedStatuses），避免幽灵任务和跨标签页污染
        const metadataMap = new Map<string, SubagentSessionMetadata>();

        state.sessions.forEach((session, taskId) => {
          metadataMap.set(taskId, {
            _id: session._id,
            agentName: session.agentName,
            description: session.description,
            status: session.status,
            metadata: session.metadata,
            parentSessionId: session.parentSessionId,
          });
        });

        return {
          agents: state.agents,
          // statuses: {},  // ❌ 不持久化运行时状态
          // queuedStatuses: {},  // ❌ 不持久化运行时状态
          sessions: metadataMap,
        };
      },
      merge: (persistedState: any, currentState) => {
        // 恢复持久化的元数据到 sessions Map
        const sessions = new Map<string, SubagentSession>();

        if (persistedState?.sessions) {
          // 处理持久化的元数据，转换为完整的 SubagentSession 结构（messages 为空）
          // 注意：JSON 反序列化后 Map 会变成普通对象，需兼容两种格式
          const metadataMap = persistedState.sessions;
          const entries: [string, SubagentSessionMetadata][] =
            metadataMap instanceof Map
              ? [...metadataMap.entries()]
              : Object.entries(metadataMap);

          entries.forEach(([taskId, metadata]) => {
            sessions.set(taskId, {
              ...metadata,
              messages: [], // 元数据不包含 messages，按需懒加载
            });
          });
        }

        return {
          ...currentState,
          ...persistedState,
          sessions,
        };
      },
    },
  ),
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
    get sessions() {
      return Array.from(useSubagentStore.getState().sessions.entries());
    },
    get queuedTasks() {
      return useSubagentStore.getState().queuedStatuses;
    },
    get cleanupTimers() {
      return {
        count: cleanupTimers.size,
        toolCallIds: Array.from(cleanupTimers.keys()),
      };
    },
  };
}