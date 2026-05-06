/**
 * MCP 服务器管理 Handler
 * - GET_MCP_SERVERS / ADD_MCP_SERVERS / UPDATE_MCP_SERVERS / REMOVE_MCP_SERVERS
 * - OPEM_MCP_SETTING
 * - PING_MCP_SERVERS / RESTART_MCP_SERVERS
 * - GET_MCP_PROMPT
 */

import type { CodeMakerWebviewProvider } from '../webviewProvider';
import { getMcpHub } from '../mcpHandlers/index';

export function handleGetMcpServers() {
    const hub = getMcpHub();
    if (hub) {
        hub.sendLatestMcpServers();
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法获取 MCP servers');
    }
}

export async function handleAddMcpServers(data: any) {
    const hub = getMcpHub();
    if (hub) {
        await hub.addMcpServer(data);
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法添加 MCP server');
    }
}

export async function handleUpdateMcpServers(data: any) {
    const hub = getMcpHub();
    if (hub) {
        await hub.upDataMcpConfig(data);
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法更新 MCP server');
    }
}

export async function handleRemoveMcpServers(data: any) {
    const hub = getMcpHub();
    if (hub) {
        const name = data?.name;
        if (name) { await hub.removeMcpServer(name); }
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法删除 MCP server');
    }
}

export async function handleOpenMcpSetting() {
    const hub = getMcpHub();
    if (hub) {
        await hub.openMCPSettingFile();
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法打开 MCP 配置');
    }
}

export async function handlePingOrRestartMcpServers(data: any) {
    const hub = getMcpHub();
    if (hub) {
        const serverName = data?.name || data?.serverName;
        if (serverName) {
            await hub.restartConnection(serverName);
        } else {
            await hub.restartAllConnections();
        }
    } else {
        console.warn('[Y3Maker] McpHub 未初始化，无法重启 MCP servers');
    }
}

export async function handleGetMcpPrompt(data: any, provider: CodeMakerWebviewProvider) {
    const hub = getMcpHub();
    const { requestId, serverName, promptName, args } = data || {};
    if (hub) {
        try {
            const result = await hub.getPrompt(serverName, promptName, args);
            provider.sendMessage({
                type: 'GET_MCP_PROMPT_RESULT',
                data: { requestId, serverName, promptName, result },
            });
        } catch (err: any) {
            provider.sendMessage({
                type: 'GET_MCP_PROMPT_ERROR',
                data: { requestId, serverName, promptName, error: err.message },
            });
        }
    } else {
        provider.sendMessage({
            type: 'GET_MCP_PROMPT_ERROR',
            data: { requestId, serverName, promptName, error: 'MCP Hub 未初始化' },
        });
    }
}
