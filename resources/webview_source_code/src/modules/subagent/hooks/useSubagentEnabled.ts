/**
 * Subagent 功能启用状态检查 Hook
 *
 * 提供便利的方式来检查 Subagent 功能是否启用
 */

import { useExtensionStore } from '../../../store/extension';

/**
 * 检查 Subagent 功能是否启用的 Hook
 * @returns true 如果功能启用，false 如果功能禁用
 */
export function useSubagentEnabled(): boolean {
  return useExtensionStore((state) => state.subagentEnable);
}

/**
 * 获取 Subagent 功能状态的描述信息
 * @returns 包含启用状态和描述信息的对象
 */
export function useSubagentStatus(): {
  enabled: boolean;
  status: 'enabled' | 'disabled';
  message: string;
} {
  const enabled = useExtensionStore((state) => state.subagentEnable);

  return {
    enabled,
    status: enabled ? 'enabled' : 'disabled',
    message: enabled
      ? 'Subagent functionality is enabled'
      : 'Subagent functionality is disabled',
  };
}