import { create } from 'zustand';

// ============================================
// Hook 相关类型定义（与 language-server 中保持一致）
// ============================================

export type HookDecision = 'allow' | 'deny' | 'ask';

export interface HookResult {
  decision: HookDecision;
  reason?: string;
  modified?: Record<string, unknown>;
  context?: string;
}

export interface HookConfigItem {
  matcher?: {
    tool?: string | string[];
    path?: string | string[];
    command?: string;
  };
  hooks: unknown[];
}

// ============================================
// Hook Store 状态定义
// ============================================

interface HookStoreState {
  /** 按事件类型分组的 Hook 配置（从 IDE 同步来） */
  configs: Record<string, HookConfigItem[]>;

  /** 更新 Hook 配置 */
  setConfigs: (configs: Record<string, HookConfigItem[]>) => void;

  /** 检查某个事件是否有 Hook 配置 */
  hasHooksForEvent: (event: string) => boolean;

  /**
   * 异步触发 Hook（fire-and-forget）
   * 不等待结果，适用于 afterExecute 等非阻断事件
   */
  emit: (event: string, eventData: Record<string, unknown>) => void;

  /**
   * 阻断式触发 Hook，等待 IDE 执行结果
   * 返回 HookResult，decision 为 'deny' 时调用方应中止操作
   */
  emitBlockable: (event: string, eventData: Record<string, unknown>) => Promise<HookResult>;

  /** 解析挂起的 Hook（由 PostMessageProvider 在收到 HOOK_RESULT 时调用） */
  resolveHook: (hookId: string, result: HookResult) => void;
}

// ============================================
// 存储挂起的 Hook Promise（不放入 Zustand state，避免 Map 序列化问题）
// ============================================
const pendingHooks = new Map<string, {
  resolve: (result: HookResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}>();

/** 生成唯一 Hook ID */
function generateHookId(): string {
  return `hook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ============================================
// Hook Store
// ============================================

export const useHookStore = create<HookStoreState>()((set, get) => ({
  configs: {},

  setConfigs: (configs) => set({ configs }),

  hasHooksForEvent: (event) => {
    const { configs } = get();
    const eventConfigs = configs[event];
    return Array.isArray(eventConfigs) && eventConfigs.length > 0;
  },

  emit: (event, eventData) => {
    if (!get().hasHooksForEvent(event)) {
      return;
    }

    const hookId = generateHookId();
    window.parent.postMessage(
      {
        type: 'EXECUTE_HOOK',
        data: { hookId, event, eventData, async: true },
      },
      '*',
    );
  },

  emitBlockable: (event, eventData) => {
    if (!get().hasHooksForEvent(event)) {
      return Promise.resolve({ decision: 'allow' as const });
    }

    const hookId = generateHookId();

    return new Promise<HookResult>((resolve) => {
      const TIMEOUT_MS = 30_000;

      const timeoutId = setTimeout(() => {
        if (pendingHooks.has(hookId)) {
          pendingHooks.delete(hookId);
          resolve({ decision: 'allow', reason: `Hook timed out after ${TIMEOUT_MS / 1000}s` });
        }
      }, TIMEOUT_MS);

      pendingHooks.set(hookId, { resolve, timeoutId });

      window.parent.postMessage(
        {
          type: 'EXECUTE_HOOK',
          data: { hookId, event, eventData, async: false },
        },
        '*',
      );
    });
  },

  resolveHook: (hookId, result) => {
    const pending = pendingHooks.get(hookId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingHooks.delete(hookId);
      pending.resolve(result);
    }
  },
}));
