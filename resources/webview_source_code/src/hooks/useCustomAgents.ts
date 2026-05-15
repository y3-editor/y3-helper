import * as React from 'react';
import { useSubagentStore } from '../modules/subagent/state/store';
import type { Agent } from '../modules/subagent/types';
import { BroadcastActions, usePostMessage } from '../PostMessageProvider';

/**
 * 管理自定义 Agent 列表
 * - 从 subagentStore 获取 custom agents
 * - 提供刷新方法（向 IDE 请求最新数据）
 */
export function useCustomAgents() {
  const { postMessage } = usePostMessage();
  const agents = useSubagentStore((state) => state.agents);

  const customAgents: Agent[] = React.useMemo(
    () => agents.filter((a) => a.source === 'custom'),
    [agents],
  );

  const refresh = React.useCallback(() => {
    postMessage({ type: BroadcastActions.GET_AGENTS });
  }, [postMessage]);

  return { customAgents, refresh };
}