import MiniSearch from 'minisearch';
import { SpanStatusCode } from '../telemetry/otel';
import { MCPServer, MCPTools, useMCPStore } from '../store/mcp';
import * as otel from '../telemetry/otel';

export const SEARCH_TOOL_NAME = 'search_tool';
const DEFAULT_MCP_TOOL_SEARCH_LIMIT = 4;
const MAX_MCP_TOOL_SEARCH_LIMIT = 10;
const DEFAULT_MCP_TOOL_SEARCH_THRESHOLD = 10;
const MIN_MCP_TOOL_SEARCH_SCORE = 3;
const MCP_TOOL_NAMES = new Set([
  'use_mcp_tool',
  'access_mcp_resource',
  SEARCH_TOOL_NAME,
]);
const EMPTY_SEARCH_MARKERS = ['未找到匹配工具', 'No matching MCP tools were found', '未提供有效的关键词', 'No valid query was provided'];

type McpFailureMessageLike = {
  role?: string;
  tool_calls?: Array<{ id?: string; function?: { name?: string } }>;
  tool_result?: Record<string, { isError?: boolean; content?: unknown } | undefined>;
};

type SearchToolLocale = 'zh' | 'en';

type SearchToolCopy = {
  description: string;
  queryDescription: string;
  limitDescription: string;
  emptyResultMessage: string;
  invalidQueryMessage: string;
  activatedSummary: (toolList: string, count: number) => string;
};

const SEARCH_TOOL_COPY: Record<SearchToolLocale, SearchToolCopy> = {
  zh: {
    description:
      '在当前会话中检索并激活 MCP 工具；匹配项的描述与调用参数见本条 tool 回执。',
    queryDescription:
      '所需能力或目标工具相关词；优先使用工具名或英文关键词。已知工具名、服务名或别名也可直接作为检索词。',
    limitDescription: `返回结果上限。默认 ${DEFAULT_MCP_TOOL_SEARCH_LIMIT}，最大 ${MAX_MCP_TOOL_SEARCH_LIMIT}。`,
    emptyResultMessage: '未找到匹配工具，请尝试不同的工具名或英文关键词重试。',
    invalidQueryMessage: '未提供有效的关键词，请传入 query 后重试。',
    activatedSummary: (toolList, count) =>
      `已激活 ${count} 个工具：${toolList}。本条回执中附带了这些工具的描述和调用参数。`,
  },
  en: {
    description:
      'Search and activate MCP tools for this session; the tool receipt lists matched tools with descriptions and parameters.',
    queryDescription:
      'Capability or target-tool terms; prefer exact tool names or English keywords. You may pass a known tool name, server name, or alias.',
    limitDescription: `Maximum number of matches to return. Defaults to ${DEFAULT_MCP_TOOL_SEARCH_LIMIT} and is capped at ${MAX_MCP_TOOL_SEARCH_LIMIT}.`,
    emptyResultMessage: 'No matching MCP tools were found. Try different tool names or English keywords.',
    invalidQueryMessage: 'No valid query was provided. Pass query and try again.',
    activatedSummary: (toolList, count) =>
      `Activated ${count} tool(s): ${toolList}. This receipt includes their descriptions and parameters.`,
  },
};

export function shouldKeepSearchAndUseMcpTogether(
  toolCalls: Array<{ function?: { name?: string } }>,
) {
  return (
    toolCalls.length >= 2 &&
    toolCalls.every((toolCall) =>
      [SEARCH_TOOL_NAME, 'use_mcp_tool'].includes(toolCall.function?.name || ''),
    ) &&
    toolCalls.some((toolCall) => toolCall.function?.name === SEARCH_TOOL_NAME) &&
    toolCalls.some((toolCall) => toolCall.function?.name === 'use_mcp_tool')
  );
}

export function isMcpFailureRetryExceeded(
  messages: McpFailureMessageLike[],
  maxConsecutiveFailures = 4,
) {
  let consecutiveFailureCount = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    // tool/system 消息夹在两个 assistant 消息之间，跳过而非 break，否则连续失败计数永远无法跨越这些分隔消息而达到上限
    if (message?.role === 'tool' || message?.role === 'system') {
      continue;
    }
    if (message?.role !== 'assistant') {
      break;
    }
    const mcpToolCalls = (message.tool_calls || []).filter((toolCall) =>
      MCP_TOOL_NAMES.has(toolCall.function?.name || ''),
    );
    if (!mcpToolCalls.length) {
      break;
    }
    const hasFailed = mcpToolCalls.some((toolCall) => {
      const result = toolCall.id ? message.tool_result?.[toolCall.id] : undefined;
      if (!result) return false;
      if (result.isError) return true;
      if (toolCall.function?.name !== SEARCH_TOOL_NAME) return false;
      const content = typeof result.content === 'string' ? result.content : '';
      return EMPTY_SEARCH_MARKERS.some((marker) => content.includes(marker));
    });
    if (!hasFailed) break;
    consecutiveFailureCount += 1;
  }
  return consecutiveFailureCount >= maxConsecutiveFailures;
}

type SearchToolDefinition = {
  name: typeof SEARCH_TOOL_NAME;
  description: string;
  parameters: {
    type: 'object';
    properties: {
      query: {
        type: 'string';
        description: string;
      };
      limit: {
        type: 'number';
        description: string;
      };
    };
    required: string[];
  };
};

type McpToolSearchResult = {
  toolName: string;
  serverName: string;
  description: string;
  inputSchema: MCPTools['inputSchema'] | null;
};

type McpToolSearchDocument = {
  id: string;
  toolName: string;
  serverName: string;
  serverAlias: string;
  description: string;
  parameterKeys: string;
  inputSchema: MCPTools['inputSchema'] | null;
};

type McpSearchTelemetrySession = {
  searchCount: number;
  activatedToolKeys: string[];
};

const mcpSearchTelemetryBySession = new Map<string, McpSearchTelemetrySession>();

export function clearMcpSearchTelemetry(sessionId: string) {
  mcpSearchTelemetryBySession.delete(sessionId);
}

function getMcpToolKey(serverName: string, toolName: string) {
  return `${serverName}::${toolName}`;
}

function parseMcpToolKey(key: string): [string, string] {
  const idx = key.indexOf('::');
  if (idx === -1) return [key, ''];
  return [key.slice(0, idx), key.slice(idx + 2)];
}

export function normalizeMcpServerName(value?: string) {
  return (value || '')
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .slice(-1)[0]
    .toLowerCase();
}

export function findMcpServerByName(name: string, servers: MCPServer[]): MCPServer | undefined {
  if (!name) return undefined;
  const normalized = normalizeMcpServerName(name);
  return servers.find(
    (s) => s.name === name || normalizeMcpServerName(s.name) === normalized,
  );
}

function isActivatedMcpToolMatch(
  activatedToolKey: string,
  requestedServerName?: string,
  requestedToolName?: string,
) {
  const [activatedServerName, activatedToolName] = parseMcpToolKey(activatedToolKey);
  if (
    !activatedToolName ||
    activatedToolName.toLowerCase() !== (requestedToolName || '').toLowerCase()
  ) {
    return false;
  }

  return (
    !requestedServerName ||
    activatedServerName === requestedServerName ||
    normalizeMcpServerName(activatedServerName) ===
      normalizeMcpServerName(requestedServerName)
  );
}

function matchesActivatedMcpToolRequest(
  activatedToolKeys: Iterable<string>,
  request: { requestedServerName?: string; requestedToolName?: string },
) {
  for (const key of activatedToolKeys) {
    if (
      isActivatedMcpToolMatch(
        key,
        request.requestedServerName,
        request.requestedToolName,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function resolveOnDemandUseMcpToolCall(options: {
  params: { server_name?: string; tool_name?: string };
  servers: MCPServer[];
  activatedToolKeys: Iterable<string>;
}): {
  ok: boolean;
  errorMessage?: string;
  rejectReason?: 'server_not_found' | 'not_activated';
  /** server_name 缺失时从激活集合唯一推断出的服务器名，调用方应将其写回 params */
  inferredServerName?: string;
} {
  const { servers } = options;
  const params = options.params || {};
  const requestedToolName = params.tool_name;
  const requestedServerName = params.server_name;

  // server_name 缺失时，尝试从激活集合里唯一推断
  if (!requestedServerName && requestedToolName) {
    const activatedKeys = [...options.activatedToolKeys];
    const matched = activatedKeys.filter((key) =>
      isActivatedMcpToolMatch(key, undefined, requestedToolName),
    );
    if (matched.length === 1) {
      const [inferredServerName] = parseMcpToolKey(matched[0]);
      // 验证推断出的 server 仍在当前连接列表中，避免用过期激活记录指向已断连的 server
      if (!findMcpServerByName(inferredServerName, servers)) {
        return {
          ok: false,
          rejectReason: 'server_not_found',
          errorMessage: `工具「${requestedToolName}」曾激活于服务器「${inferredServerName}」，但该服务器当前已断连。请确认 MCP Server 已重连后重试。`,
        };
      }
      return { ok: true, inferredServerName };
    }
    // 0 个：未激活；多个：服务器不唯一，均需明确拒绝
    const rejectMsg = matched.length === 0
      ? `工具「${requestedToolName}」尚未激活，请先调用 search_tool { "query": "${requestedToolName}" } 激活后再重试。`
      : `工具「${requestedToolName}」在多个服务器中存在，请明确指定 mcp tool name 和 server name 后重试。`;
    return { ok: false, rejectReason: 'not_activated', errorMessage: rejectMsg };
  }

  const resolvedServer =
    typeof requestedServerName === 'string'
      ? findMcpServerByName(requestedServerName, servers)
      : undefined;
  const matchedServerExists = !requestedServerName || !!resolvedServer;

  if (requestedToolName && matchedServerExists) {
    if (
      matchesActivatedMcpToolRequest(options.activatedToolKeys, {
        requestedServerName,
        requestedToolName,
      })
    ) {
      return { ok: true };
    }
  }

  const rejectReason = !matchedServerExists ? 'server_not_found' as const : 'not_activated' as const;
  const serverHint = requestedServerName
    ? `服务器「${requestedServerName}」`
    : '目标服务器';
  return {
    ok: false,
    rejectReason,
    errorMessage: rejectReason === 'server_not_found'
      ? `${serverHint} 未连接或不存在，无法调用工具「${requestedToolName || '未知'}」。请确认 MCP Server 已启动并连接后重试。`
      : `工具「${requestedToolName || '未知'}」尚未激活，无法调用。请先在同一条回复中调用 search_tool { "query": "${requestedToolName || ''}" } 激活后再重试。`,
  };
}

export function reportMcpToolRejected(
  sessionId: string | null | undefined,
  serverName: string | undefined,
  toolName: string | undefined,
  reason: string | undefined,
  round?: otel.ConversationRoundState,
) {
  const span = otel.startSpan('mcp.tool.rejected', undefined, round);
  span.setAttributes({
    'mcp.session_id': sessionId || '',
    'mcp.server_name': serverName || '',
    'mcp.tool_name': toolName || '',
    'mcp.reject_reason': reason || '',
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: reason || '' });
  span.end();
}

export function trackMcpSearchExecution(
  sessionId?: string | null,
  activatedToolKeys: string[] = [],
) {
  if (!sessionId) {
    return null;
  }

  const telemetrySession = mcpSearchTelemetryBySession.get(sessionId) || {
    searchCount: 0,
    activatedToolKeys: [],
  };

  telemetrySession.searchCount += 1;
  telemetrySession.activatedToolKeys = [...new Set([...telemetrySession.activatedToolKeys, ...activatedToolKeys])];
  mcpSearchTelemetryBySession.set(sessionId, telemetrySession);

  return {
    searchIndex: telemetrySession.searchCount,
    isRepeatSearch: telemetrySession.searchCount > 1,
  };
}

export function getMcpSearchFollowup(options: {
  sessionId?: string | null;
  serverName?: string;
  toolName?: string;
}) {
  const { sessionId, serverName, toolName } = options;
  const telemetrySession =
    sessionId && toolName ? mcpSearchTelemetryBySession.get(sessionId) : null;
  if (!telemetrySession?.activatedToolKeys?.length) {
    return null;
  }

  return telemetrySession.activatedToolKeys.some((activatedToolKey) =>
    isActivatedMcpToolMatch(activatedToolKey, serverName, toolName),
  )
    ? {
        searchIndex: telemetrySession.searchCount,
        isFromSearchActivation: true,
      }
    : null;
}

export function normalizeMcpToolSearchLimit(limit?: number | string) {
  const parsedLimit =
    typeof limit === 'string' ? Number.parseInt(limit, 10) : limit;

  if (!parsedLimit || Number.isNaN(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_MCP_TOOL_SEARCH_LIMIT;
  }

  return Math.min(parsedLimit, MAX_MCP_TOOL_SEARCH_LIMIT);
}

export function getSearchToolDefinition(
  locale: SearchToolLocale = 'zh',
): SearchToolDefinition {
  const copy = SEARCH_TOOL_COPY[locale];

  return {
    name: SEARCH_TOOL_NAME,
    description: copy.description,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: copy.queryDescription,
        },
        limit: {
          type: 'number',
          description: copy.limitDescription,
        },
      },
      required: ['query'],
    },
  };
}

export function getVisibleMCPToolCount(servers: MCPServer[]) {
  return servers.reduce((total, server) => total + (server.tools?.length || 0), 0);
}

export function shouldUseOnDemandMCPTools(options: {
  totalToolCount: number;
  threshold?: number;
}) {
  const {
    totalToolCount,
    threshold: enterThreshold = DEFAULT_MCP_TOOL_SEARCH_THRESHOLD,
  } = options;

  return totalToolCount >= enterThreshold;
}

export function buildPromptMCPServers(options: {
  servers: MCPServer[];
  threshold?: number;
}) {
  const {
    servers,
    threshold = DEFAULT_MCP_TOOL_SEARCH_THRESHOLD,
  } = options;
  const totalToolCount = getVisibleMCPToolCount(servers);
  const sortedServers = [...servers]
    .map((server) => ({
      ...server,
      tools: [...(server.tools || [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isOnDemandMode = shouldUseOnDemandMCPTools({
    totalToolCount,
    threshold,
  });

  if (!isOnDemandMode) {
    return {
      isOnDemandMode: false,
      promptMCPServers: sortedServers,
    };
  }

  return {
    isOnDemandMode: true,
    promptMCPServers: sortedServers.map((server) => ({
      ...server,
      tools: (server.tools || []).map(({ inputSchema, ...rest }) => rest),
    })),
  };
}

function getToolParameterKeys(tool: MCPTools) {
  const properties = tool.inputSchema?.properties;
  if (!properties || typeof properties !== 'object') {
    return [];
  }

  return Object.keys(properties);
}

function buildSearchableToolDocuments(
  servers: MCPServer[],
): McpToolSearchDocument[] {
  const getChineseNameByServerName =
    useMCPStore.getState().getChineseNameByServerName;

  return servers.flatMap((server) =>
    (server.tools || []).map((tool) => ({
      id: getMcpToolKey(server.name, tool.name),
      toolName: tool.name,
      serverName: server.name,
      serverAlias:
        server.config?.chinese_name || getChineseNameByServerName(server.name) || '',
      description: tool.description || '',
      parameterKeys: getToolParameterKeys(tool).join(' '),
      inputSchema: tool.inputSchema || null,
    })),
  );
}

function buildToolMiniSearch(documents: McpToolSearchDocument[]) {
  const miniSearch = new MiniSearch<McpToolSearchDocument>({
    fields: [
      'toolName',
      'serverName',
      'serverAlias',
      'description',
      'parameterKeys',
    ],
    storeFields: ['toolName', 'serverName', 'serverAlias', 'description', 'inputSchema'],
    searchOptions: {
      boost: {
        toolName: 3,
        serverName: 2,
        serverAlias: 2,
        description: 2,
        parameterKeys: 1,
      },
      prefix: true,
      // 短词收窄 fuzzy 容忍度，避免把不相关的工具误搜上来： ≤2 字符不做模糊（太短，误匹配率高）；≤4 字符最多容忍 20%；更长词最多 35%
      fuzzy: (term) => {
        if (term.length <= 2) return 0;
        if (term.length <= 4) return 0.2;
        return Math.min(0.35, 2 / term.length);
      },
    },
  });

  if (documents.length) {
    miniSearch.addAll(documents);
  }

  return miniSearch;
}

function searchMcpTools(options: {
  servers: MCPServer[];
  query: string;
  limit?: number | string;
}): McpToolSearchResult[] {
  const { servers, query, limit } = options;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const documents = buildSearchableToolDocuments(servers);
  if (!documents.length) {
    return [];
  }

  const miniSearch = buildToolMiniSearch(documents);
  const effectiveLimit = normalizeMcpToolSearchLimit(limit);
  const queryLower = trimmedQuery.toLowerCase();
  const results = miniSearch.search(trimmedQuery) as unknown as Array<
    McpToolSearchDocument & { score: number }
  >;
  const scoreThreshold = Math.max(
    (results[0]?.score || 0) * 0.3,
    MIN_MCP_TOOL_SEARCH_SCORE,
  );

  const ranked = results
    .map((result) => {
      const names = [
        result.toolName.toLowerCase(),
        result.serverName.toLowerCase(),
        (result.serverAlias || '').toLowerCase(),
      ];
      const exact = names.some((n) => n === queryLower);
      const contains = names.some((n) => n.length >= 4 && n.includes(queryLower));
      return { ...result, exact, contains };
    })
    .sort((a, b) => {
      if (a.exact !== b.exact) return Number(b.exact) - Number(a.exact);
      if (a.contains !== b.contains) return Number(b.contains) - Number(a.contains);
      return b.score - a.score;
    });

  const filtered = ranked.filter(
    (r) => r.score >= scoreThreshold || r.exact || r.contains,
  );

  // 兜底：评分过滤后为空，但原始结果非空时，返回评分最高的 top-N，避免"有工具但因评分阈值卡死搜不到"的假阴性
  const finalResults = filtered.length > 0 ? filtered : ranked;

  return finalResults
    .slice(0, effectiveLimit)
    .map((result) => ({
      toolName: result.toolName,
      serverName: result.serverName,
      description: result.description,
      inputSchema: result.inputSchema || null,
    }));
}

function formatSearchToolResultMessage(options: {
  results: McpToolSearchResult[];
  locale?: SearchToolLocale;
  hasQuery?: boolean;
}) {
  const { results, locale = 'zh', hasQuery = true } = options;
  const copy = SEARCH_TOOL_COPY[locale];

  if (!hasQuery) {
    return copy.invalidQueryMessage;
  }

  if (!results.length) {
    return copy.emptyResultMessage;
  }

  const toolList = results
    .map((item) => `${item.toolName} (${item.serverName})`)
    .join(', ');

  return copy.activatedSummary(toolList, results.length);
}

function formatSearchToolResultContent(options: {
  summary: string;
  activatedTools: McpToolSearchResult[];
}) {
  const { summary, activatedTools } = options;

  if (!activatedTools.length) {
    return summary;
  }

  return JSON.stringify({
    summary,
    activated_tools: activatedTools.map((tool) => ({
      server_name: tool.serverName,
      tool_name: tool.toolName,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  });
}

export function executeSearchTool(options: {
  servers: MCPServer[];
  query?: string;
  limit?: number | string;
  locale?: SearchToolLocale;
}): {
  activatedToolKeys: string[];
  content: string;
} {
  const {
    servers,
    query = '',
    limit,
    locale = 'zh',
  } = options;
  const trimmedQuery = query.trim();
  const results = trimmedQuery
    ? searchMcpTools({
        servers,
        query: trimmedQuery,
        limit,
      })
    : [];
  const activatedToolKeys = results.map((result) =>
    getMcpToolKey(result.serverName, result.toolName),
  );
  const summary = formatSearchToolResultMessage({
    results,
    locale,
    hasQuery: !!trimmedQuery,
  });

  return {
    activatedToolKeys,
    content: formatSearchToolResultContent({
      summary,
      activatedTools: results,
    }),
  };
}