/**
 * MCP 类型定义
 * 移植自 CodeMaker 源码版 mcpHandlers/mcp.ts，移除了 Marketplace 相关类型
 */


export const DEFAULT_MCP_TIMEOUT_SECONDS = 60;
export const MIN_MCP_TIMEOUT_SECONDS = 1;

export type McpServer = {
    name: string;
    config: string;
    status: "connected" | "connecting" | "disconnected";
    error?: string;
    tools?: McpTool[];
    resources?: McpResource[];
    resourceTemplates?: McpResourceTemplate[];
    prompts?: McpPrompt[];
    disabled?: boolean;
    timeout?: number;
    autoApprove?: boolean;
};

export type McpTool = {
    name: string;
    description?: string;
    inputSchema?: object;
    autoApprove?: boolean;
};

export type McpResource = {
    uri: string;
    name: string;
    mimeType?: string;
    description?: string;
};

export type McpResourceTemplate = {
    uriTemplate: string;
    name: string;
    description?: string;
    mimeType?: string;
};

export type McpPrompt = {
    name: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
};

export type McpPromptResult = {
    description?: string;
    messages: Array<{
        role: "user" | "assistant";
        content: any;
    }>;
};

export type McpPromptMessage = McpPromptResult["messages"][number];

export type McpResourceResponse = {
    _meta?: Record<string, any>;
    contents: Array<{
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    }>;
};

export type McpToolCallResponse = {
    _meta?: Record<string, any>;
    content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
        | { type: "audio"; data: string; mimeType: string }
        | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string; blob?: string } }
    >;
    isError?: boolean;
};
