/**
 * MCP工具信息处理逻辑
 */

import { useMemo, useCallback } from 'react';
import { ChatMessage } from '../../services';
import { useMCPStore } from '../../store/mcp';
import { usePostMessage, BroadcastActions } from '../../PostMessageProvider';
import { useChatStreamStore } from '../../store/chat';
import { MCPToolInfo } from './types';
import { normalizeMcpServerName, findMcpServerByName } from '../../utils/mcpToolSearch';

export function useMCPInfo(message: ChatMessage, hasMCPTool: boolean): MCPToolInfo | null {
  const MCPServers = useMCPStore((state) => state.MCPServers);
  const builtInServers = useMCPStore((state) => state.builtInServers);
  const getChineseNameByServerName = useMCPStore((state) => state.getChineseNameByServerName);
  const { postMessage } = usePostMessage();

  // 提取 MCP 服务器名称
  const mcpServerName = useMemo(() => {
    if (!hasMCPTool || !message.tool_calls) return null;
    const mcpTool = message.tool_calls.find(tool =>
      tool.function.name === 'use_mcp_tool' ||
      tool.function.name === 'access_mcp_resource'
    );
    if (!mcpTool) return null;
    try {
      const params = JSON.parse(mcpTool.function.arguments || '{}');
      return normalizeMcpServerName(params.server_name || '') || null;
    } catch {
      return null;
    }
  }, [hasMCPTool, message.tool_calls]);

  // 查找 MCP 服务器
  const mcpServer = useMemo(() => {
    if (!mcpServerName) return null;
    return findMcpServerByName(mcpServerName, MCPServers) ?? null;
  }, [mcpServerName, MCPServers]);

  // MCP 服务器显示名称
  const mcpServerDisplayName = useMemo(() => {
    if (!mcpServer) return mcpServerName || '';
    const builtInServer = builtInServers.find(bis => bis.name === mcpServer.name);
    return mcpServer.config?.chinese_name
      || getChineseNameByServerName(mcpServer.name)
      || builtInServer?.chinese_name
      || mcpServerName
      || '';
  }, [mcpServer, mcpServerName, builtInServers, getChineseNameByServerName]);

  // 记录 MCP autoApprove 的初始状态
  const initialMCPAutoApprove = useMemo(() => {
    return mcpServer?.config?.autoApprove || false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpServer?.name]); // 只依赖 mcpServer.name，这样初始值不会随 config 变化而变化

  // MCP switch 的 onChange 处理函数
  const handleMcpSwitchChange = useCallback((checked: boolean) => {

    const updateData = {
      name: mcpServer?.name || mcpServerName,  // Use full store name (the actual config key, not normalized short name)
      ...mcpServer?.config,
      autoApprove: checked,
    };


    // 先派发 TOOL_CALL（如果需要），再发 UPDATE_MCP_SERVERS
    // 原因：UPDATE_MCP_SERVERS 会触发 extension 重启 MCP 连接，
    // 若先发配置更新再发工具调用，连接重启期间 TOOL_CALL 会收到 "Connection closed"
    if (checked) {
      const mcpTool = message.tool_calls?.find(
        (tool) =>
          tool.function.name === 'use_mcp_tool' ||
          tool.function.name === 'access_mcp_resource',
      );
      if (mcpTool && !useChatStreamStore.getState().isMCPProcessing) {
        let toolCallParams: any = {};
        try {
          toolCallParams = JSON.parse(mcpTool.function.arguments || '{}');
        } catch {
          toolCallParams = {};
        }
        useChatStreamStore.getState().setIsMCPProcessing(true);
        window.parent.postMessage(
          {
            type: BroadcastActions.TOOL_CALL,
            data: {
              tool_name: mcpTool.function.name,
              tool_params: toolCallParams,
              tool_id: mcpTool.id,
            },
          },
          '*',
        );
      }
    }

    // 延迟 5 秒发送配置更新，避免 MCP 连接重启与当前 TOOL_CALL 冲突
    setTimeout(() => {
      postMessage({
        type: BroadcastActions.UPDATE_MCP_SERVERS,
        data: updateData,
      });
    }, 5000);
  }, [mcpServerName, mcpServer?.name, mcpServer?.config, message.tool_calls, postMessage]);

  // MCP 自动调用提示
  const mcpAutoApproveTip = useMemo(() => {
    return `开启后，智聊过程将自动调用 ${mcpServerDisplayName}，无需手动确认请求与参数`;
  }, [mcpServerDisplayName]);

  // 只有在有 MCP 工具且找到服务器时才返回信息
  if (!hasMCPTool || !mcpServer || !mcpServerName) {
    return null;
  }

  return {
    mcpServerName,
    mcpServer,
    mcpServerDisplayName,
    initialMCPAutoApprove,
    handleMcpSwitchChange,
    mcpAutoApproveTip,
  };
}