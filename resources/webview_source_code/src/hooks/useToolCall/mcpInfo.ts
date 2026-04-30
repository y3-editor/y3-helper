/**
 * MCP工具信息处理逻辑
 */

import { useMemo, useCallback } from 'react';
import { ChatMessage } from '../../services';
import { useMCPStore } from '../../store/mcp';
import { usePostMessage, BroadcastActions } from '../../PostMessageProvider';
import { MCPToolInfo } from './types';

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
      let name = params.server_name || '';
      name = name.replace('\\', '/');
      name = name.split('/').slice(-1)[0];
      return name;
    } catch {
      return null;
    }
  }, [hasMCPTool, message.tool_calls]);

  // 查找 MCP 服务器
  const mcpServer = useMemo(() => {
    if (!mcpServerName) return null;
    return MCPServers.find(s => {
      let serverName = s.name || '';
      serverName = serverName.replace('\\', '/');
      serverName = serverName.split('/').slice(-1)[0];
      return serverName === mcpServerName;
    });
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
    postMessage({
      type: BroadcastActions.UPDATE_MCP_SERVERS,
      data: {
        name: mcpServerName,
        ...mcpServer?.config,
        autoApprove: checked,
      },
    });
  }, [mcpServerName, mcpServer?.config, postMessage]);

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