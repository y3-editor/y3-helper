export type AgentSource =
  | 'codemaker-user'
  | 'codemaker-project'
  | 'claude-project'
  | 'claude-user';

export interface AgentSourceConfig {
  source: AgentSource;
  directory: string;
  isUserLevel?: boolean;
}

export interface AgentMetaData {
  name: string;
  description: string;
  model?: string;
  tools?: string;
  prompt: string;
  maxSteps?: number;
  mcpServers?: Record<string, McpServerConfig>;
}

export type McpServerConfig =
  | McpServerStdioConfig
  | McpServerSseConfig
  | McpServerStreamableHttpConfig;

export interface McpServerStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpServerSseConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface McpServerStreamableHttpConfig {
  type: 'streamableHttp';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface Agent {
  metaData: AgentMetaData;
  name: string;
  content: string;
  path: string;
  lastModified: number;
  source: AgentSource;
}

export interface AgentIndexItem {
  name: string;
  description: string;
  source: AgentSource;
  scope: AgentScope;
  path: string;
  model?: string;
  maxSteps?: number;
  tools?: string;
  prompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
}

export interface AgentLoadResult {
  agents: Agent[];
  errors: Array<{
    path: string;
    error: string;
  }>;
}

export interface AgentsHandlerOptions {
  enableWatcher?: boolean;
  agentsDirectory?: string;
}

export interface GetAgentResult {
  success: boolean;
  agent?: {
    name: string;
    content: string;
    path: string;
    source: AgentSource;
    scope: AgentScope;
    metaData: AgentMetaData;
  };
  error?: string;
}

export type AgentScope = 'project' | 'user';

/**
 * 将 AgentSource 转换为面向用户的 AgentScope
 */
export function agentSourceToScope(source: AgentSource): AgentScope {
  if (source === 'codemaker-user' || source === 'claude-user') {
    return 'user';
  }
  return 'project';
}

export type CreateAgentErrorCode =
  | 'INVALID_IDENTIFIER'
  | 'NO_WORKSPACE'
  | 'ALREADY_EXISTS'
  | 'WRITE_FAILED';

export interface CreateAgentParams {
  identifier: string;
  scope: AgentScope;
  markdown: string;
  overwrite?: boolean;
}

export interface CreateAgentResult {
  success: boolean;
  identifier: string;
  scope: AgentScope;
  path?: string;
  code?: CreateAgentErrorCode;
  message?: string;
}