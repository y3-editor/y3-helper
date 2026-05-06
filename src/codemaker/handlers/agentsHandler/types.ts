export type AgentSource = 'codemaker-user' | 'codemaker-project' | 'claude-project' | 'claude-user';

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
  model?: string;
  tools?: string;
  prompt?: string;
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
    metaData: AgentMetaData;
  };
  error?: string;

}
