/**
 * Subagent 工具确认状态管理
 * 用于在 WebView 中显示工具调用确认对话框
 */

import { create } from 'zustand';

export interface ToolConfirmationRequest {
  taskId: string;
  toolId: string;
  toolName: string;
  toolParams: Record<string, any>;
  isDangerous: boolean;
  timestamp: number;
}

interface ToolConfirmationStore {
  // 当前待确认的工具调用请求
  pendingConfirmation: ToolConfirmationRequest | null;

  // 确认结果的 Promise resolver
  resolver: ((confirmed: boolean) => void) | null;

  // 请求用户确认工具调用
  requestConfirmation: (
    request: ToolConfirmationRequest,
  ) => Promise<boolean>;

  // 用户确认
  confirm: () => void;

  // 用户拒绝
  reject: () => void;

  // 清除当前请求
  clear: () => void;
}

export const useToolConfirmationStore = create<ToolConfirmationStore>(
  (set, get) => ({
    pendingConfirmation: null,
    resolver: null,

    requestConfirmation: (request) => {
      // 如果有旧的待确认请求，先拒绝它，防止 Promise 悬挂
      const { resolver: oldResolver } = get();
      if (oldResolver) {
        oldResolver(false);
      }

      return new Promise<boolean>((resolve) => {
        // 创建包装的 resolver，确保只有当前请求的 resolver 能被调用
        const wrappedResolver = (result: boolean) => {
          // 验证当前 resolver 是否匹配，防止竞态条件
          if (get().resolver === wrappedResolver) {
            set({ pendingConfirmation: null, resolver: null });
            resolve(result);
          }
        };

        set({
          pendingConfirmation: request,
          resolver: wrappedResolver,
        });
      });
    },

    confirm: () => {
      const { resolver } = get();
      if (resolver) {
        resolver(true);
        // 注意：状态清理由 wrappedResolver 内部处理
      }
    },

    reject: () => {
      const { resolver } = get();
      if (resolver) {
        resolver(false);
        // 注意：状态清理由 wrappedResolver 内部处理
      }
    },

    clear: () => {
      const { resolver } = get();
      if (resolver) {
        resolver(false); // 默认拒绝
      }
      set({ pendingConfirmation: null, resolver: null });
    },
  }),
);