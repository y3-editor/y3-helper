import { create } from 'zustand';
import { McpPrompt } from '../services/mcp';

// Built-in server interface from API
export interface BuiltInServer {
  id: number;
  name: string;
  chinese_name?: string;
  logo: string;
  status: string;
  installed: boolean;
  parameters_schema?: any;
  server_config?: any; // 服务器配置对象
  tags?: string[]; // 服务器标签，如 ["brainmaker", "codemaker", "private-model-only"]
}

// Name mapping interface for MCP server name to Chinese name
export interface McpNameMapping {
  id: string;
  name: string;
  chinese_name?: string;
}

export interface MCPServer {
  name: string;
  status: string;
  error: string;
  disabled: boolean;
  type?: string; // 服务器类型，如 'stdio', 'sse', 'streamableHttp' 等
  command?: string;
  url?: string; // 用于sse和streamableHttp类型的服务器地址
  args?: string[];
  env?: {key: string, value: string}[];
  timeout?: number | null;
  tools?: MCPTools[];
  autoApprove?: boolean;
  resources?: McpResource[];
  prompts?: McpPrompt[];
  resourceTemplates?: McpResourceTemplate[];
  headers?: {[key: string]: any}; // 服务器配置的 headers 字段
  config?: { // 服务器配置对象
    type?: string;
    command?: string;
    url?: string;
    args?: string[];
    env?: {[key: string]: string} | {key: string, value: string}[];
    timeout?: number;
    autoApprove?: boolean;
    disabled?: boolean;
    headers?: {[key: string]: any};
    chinese_name?: string;
    disablePrivateModelOnly?: boolean;
  };
}

export type MCPTools = {
  name: string;
  description: string;
  autoApprove?: boolean;
  inputSchema: {
    properties: {
      [propName: string]: string;
    },
    type: "object"
  }
}

export type McpResource = {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  autoApprove?: boolean;
}

export type McpResourceTemplate = {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export type MCPStore = {
  MCPServers: MCPServer[];
  builtInServers: BuiltInServer[];
  PrivateModelOnlyServers: BuiltInServer[];
  nameMappingsByName: Record<string, McpNameMapping>; // 存储 MCP 服务器名称映射，以 name 为 key
  enabled: boolean;
  // 新增：存储哪些服务器的 Switch 应该被禁用（key 是服务器名称）
  disabledSwitches: Set<string>;
  showMcpError: boolean;
  setMCPServers: (servers: MCPServer[]) => void;
  setBuiltInServers: (servers: BuiltInServer[]) => void;
  getAvailableMCPServers: () => MCPServer[];
  // 新增方法：根据服务器名称获取服务器配置
  getMCPServerByName: (name: string) => MCPServer | undefined;
  // 新增方法：检查服务器是否已存在
  isMCPServerExists: (name: string) => boolean;
  // 新增方法：删除服务器
  removeMCPServer: (name: string) => void;
  // 新增方法：设置哪些服务器的 Switch 应该被禁用
  setDisabledSwitches: (serverNames: string[]) => void;
  // 新增方法：清除所有禁用的 Switch
  clearDisabledSwitches: () => void;
  setPrivateModelOnlyServers: (servers: BuiltInServer[]) => void;
  // 新增方法：设置名称映射
  setNameMappings: (mappings: McpNameMapping[]) => void;
  // 新增方法：根据 name 获取中文名称 (O(1) 复杂度)
  getChineseNameByServerName: (name: string) => string | undefined;
  // 显示错误弹窗
  setShowMcpError:(show: boolean) => void;
};

export const useMCPStore = create<MCPStore>((set, get) => ({
  MCPServers: [],
  builtInServers: [],
  PrivateModelOnlyServers: [],
  nameMappingsByName: {},
  enabled: true,
  disabledSwitches: new Set<string>(),
  showMcpError: false,
  setMCPServers: (servers) => {
    // 直接保存传入的服务器配置，保留所有字段（包括 disablePrivateModelOnly） servers.map is not a function
    const processedServers = servers?.map?.(server => {
      return {
        ...server,
        disabled: server.disabled !== undefined ? server.disabled : false,
        config: server.config ? {
          ...server.config,
          disabled: server.config.disabled !== undefined ? server.config.disabled : false,
        } : {
          disabled: false,
        }
      };
    });

    set(() => ({
      MCPServers: processedServers || [],
    }))
  },
  setBuiltInServers: (servers) => {
    set(() => ({
      builtInServers: servers,
    }))
  },
  setShowMcpError: (show) => {
    set(() => ({
      showMcpError: show,
    }))
  },
  getAvailableMCPServers: () => {
    return get().MCPServers.filter((server) => server.status === "connected" && !server.disabled);
  },
  getMCPServerByName: (name: string) => {
    return get().MCPServers.find(server => server.name === name);
  },
  isMCPServerExists: (name: string) => {
    return get().MCPServers.some(server => server.name === name);
  },
  removeMCPServer: (name: string) => {
    const currentServers = get().MCPServers;
    const filteredServers = currentServers.filter(server => server.name !== name);
    set(() => ({
      MCPServers: filteredServers,
    }));
  },
  setDisabledSwitches: (serverNames: string[]) => {
    set(() => ({
      disabledSwitches: new Set(serverNames),
    }));
  },
  clearDisabledSwitches: () => {
    set(() => ({
      disabledSwitches: new Set<string>(),
    }));
  },
  setPrivateModelOnlyServers: (servers) => {
    set(() => ({
      PrivateModelOnlyServers: servers,
    }))
  },
  setNameMappings: (mappings) => {
    // 创建以 name 为 key 的索引
    const mappingsByName = mappings.reduce((acc, mapping) => {
      acc[mapping.name] = mapping;
      return acc;
    }, {} as Record<string, McpNameMapping>);

    set(() => ({
      nameMappingsByName: mappingsByName,
    }))
  },
  getChineseNameByServerName: (name: string) => {
    // 直接通过 name 索引获取，O(1) 复杂度
    return get().nameMappingsByName[name]?.chinese_name;
  }
}));
