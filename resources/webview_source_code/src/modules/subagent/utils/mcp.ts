/**
 * Subagent MCP 工具函数
 *
 * 提供 Agent 专属 MCP server 的命名、格式转换和连接等待等功能。
 * 与主 agent 复用同一套 IDE MCP 生命周期机制（ADD_MCP_SERVERS / REMOVE_MCP_SERVERS）。
 */

import { useMCPStore } from '../../../store/mcp';
import type { AgentMCPServerConfig, Agent } from '../types';

/**
 * 生成 Agent 专属 MCP server 的隔离名称。
 *
 * 格式：`agent_{agentName}_{instanceId}_{serverName}`
 *
 * 设计原因：
 * - `agent_` 前缀：与用户全局 server 名称区分，避免命名冲突
 * - `instanceId`（nanoid(8)）：同一 Agent 并行执行多个实例时相互隔离，
 *   防止一个 task 结束时删除另一个 task 的专属 server
 */
export function buildAgentMCPServerName(
  agentName: string,
  instanceId: string,
  serverName: string,
): string {
  return `agent_${agentName}_${instanceId}_${serverName}`;
}

/**
 * 将 Agent 的 mcpServers 配置转换为 IDE ADD_MCP_SERVERS 消息所需的格式。
 *
 * 返回格式与 MCPServerModal 发送的 ADD_MCP_SERVERS 格式保持一致：
 * { name, command?, args?, env?, url?, type?, timeout?, headers? }（平铺结构）
 */
export function convertAgentMCPServers(
  agentName: string,
  instanceId: string,
  mcpServers: Agent['mcpServers'],
): Array<{ name: string } & AgentMCPServerConfig> {
  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return [];
  }

  return Object.entries(mcpServers).map(
    ([serverName, config]: [string, AgentMCPServerConfig]) => {
      const isolatedName = buildAgentMCPServerName(
        agentName,
        instanceId,
        serverName,
      );

      return {
        name: isolatedName,
        ...config,
      };
    },
  );
}

/**
 * 等待指定的 MCP servers 全部达到 `connected` 状态。
 *
 * 策略：
 * - 轮询间隔：500ms
 * - 超时时间：默认 30_000ms（30 秒）
 * - 超时后：console.warn 并 resolve（降级继续执行，不 throw）
 * - abortSignal 触发时：立即停止轮询
 */
export function waitForMCPServers(
  names: string[],
  signal: AbortSignal,
  timeout = 30_000,
): Promise<void> {
  if (names.length === 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const startTime = Date.now();
    let timerId: ReturnType<typeof setTimeout> | null = null;

    function cleanup() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    }

    function onAbort() {
      cleanup();
      // abortSignal 触发时直接 resolve（不 reject），让 finally 清理逻辑正常执行
      resolve();
    }

    // 注册监听器前再次检查 aborted 状态，消除竞态窗口。
    // 已中止的 AbortSignal 不会触发 abort 事件，若先 return 再 addEventListener
    // 会导致监听器永久残留内存。两次检查必须紧邻，中间不放任何异步操作。
    signal.addEventListener('abort', onAbort, { once: true });

    if (signal.aborted) {
      signal.removeEventListener('abort', onAbort);
      resolve();
      return;
    }

    function poll() {
      if (signal.aborted) {
        cleanup();
        signal.removeEventListener('abort', onAbort);
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeout) {
        cleanup();
        signal.removeEventListener('abort', onAbort);
        const servers = useMCPStore.getState().MCPServers;
        const notConnected = names.filter((name) => {
          const server = servers.find((s) => s.name === name);
          return !server || server.status !== 'connected';
        });
        console.warn(
          '[Subagent] waitForMCPServers timeout, continuing with degraded MCP support.',
          { notConnected, elapsed },
        );
        resolve();
        return;
      }

      const servers = useMCPStore.getState().MCPServers;
      const allConnected = names.every((name) => {
        const server = servers.find((s) => s.name === name);
        return server?.status === 'connected';
      });

      if (allConnected) {
        cleanup();
        signal.removeEventListener('abort', onAbort);
        resolve();
        return;
      }

      timerId = setTimeout(poll, 500);

      // 竞态防护：setTimeout 注册后立即检查 abort 状态。
      // 若 signal.abort() 恰好发生在 setTimeout 调用之后、onAbort 回调触发之前，
      // 此处能保证 timerId 被正确清理，避免僵尸计时器继续执行。
      if (signal.aborted) {
        cleanup();
        signal.removeEventListener('abort', onAbort);
        resolve();
      }
    }

    // 首次立即检查，避免 server 已经连接时多等 500ms
    poll();
  });
}