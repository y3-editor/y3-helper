## Architecture

### 整体架构

```
┌─ CodeMaker WebView (前端 iframe) ─────────────────────────────┐
│  用户配置 MCP Server (UI)                                       │
│  AI 对话中调用 use_mcp_tool / access_mcp_resource              │
│      ↓ postMessage                                              │
└─────────────────────────────────────────────────────────────────┘
      │
      ↓ vscode.postMessage
┌─ Extension (webviewProvider.ts) ──────────────────────────────┐
│  _handleMessage()                                              │
│    ├─ TOOL_CALL { use_mcp_tool } → mcpHub.callTool()          │
│    ├─ TOOL_CALL { access_mcp_resource } → mcpHub.readResource()│
│    └─ default → handleExtendedMessage()                        │
│         ├─ GET_MCP_SERVERS → mcpHub.sendLatestMcpServers()    │
│         ├─ ADD_MCP_SERVERS → mcpHub.addMcpServer()            │
│         ├─ UPDATE_MCP_SERVERS → mcpHub.upDataMcpConfig()      │
│         ├─ REMOVE_MCP_SERVERS → mcpHub.removeMcpServer()      │
│         ├─ OPEM_MCP_SETTING → mcpHub.openMCPSettingFile()     │
│         ├─ PING_MCP_SERVERS → mcpHub.pingMcpServers()         │
│         ├─ RESTART_MCP_SERVERS → mcpHub.restartAllConnections()│
│         └─ GET_MCP_PROMPT → mcpHub.getPrompt()                │
└────────────────────────────────────────────────────────────────┘
      │
      ↓ McpHub 单例
┌─ McpHub (src/codemaker/mcpHandlers/index.ts) ─────────────────┐
│  connections: McpConnection[]                                   │
│                                                                 │
│  初始化:                                                        │
│    constructor() → watchMcpSettingsFile() + initializeMcpServers()│
│                                                                 │
│  连接管理:                                                      │
│    connectToServer(name, config)                                │
│      ├─ stdio  → StdioClientTransport(command, args, env)      │
│      ├─ sse    → SSEClientTransport(url, headers)              │
│      └─ streamableHttp → StreamableHTTPClientTransport(url)    │
│      → client.connect(transport)                                │
│      → fetchToolsList() / fetchResourcesList() / fetchPromptsList()│
│                                                                 │
│  工具调用:                                                      │
│    callTool(serverName, toolName, arguments)                    │
│      → client.request({ method: "tools/call", ... })           │
│                                                                 │
│  资源读取:                                                      │
│    readResource(serverName, uri)                                │
│      → client.request({ method: "resources/read", ... })       │
│                                                                 │
│  生命周期:                                                      │
│    updateServerConnections() — 差量更新（新增/修改/删除）       │
│    restartConnection(name)   — 单个 server 重启                │
│    pingMcpServers()          — 断连自动重连                     │
│    dispose()                 — 清理所有连接                     │
└────────────────────────────────────────────────────────────────┘
      │
      ↓ @modelcontextprotocol/sdk
┌─ 外部 MCP Server ────────────────────────────────────────────┐
│  stdio: 子进程 (如 npx @anthropic/mcp-filesystem-server)      │
│  sse:   HTTP SSE 端点                                         │
│  streamableHttp: HTTP 流式端点                                 │
└────────────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/codemaker/
├── mcpHandlers/
│   ├── index.ts       # McpHub 类 (~1100 行，从源码版移植+适配)
│   ├── mcp.ts         # 类型定义 (McpServer, McpTool, McpConnection 等)
│   └── schema.ts      # Zod Schema (stdio/sse/streamableHttp 配置校验)
├── messageHandlers.ts # 修改: MCP stub 函数 → McpHub 方法调用
└── webviewProvider.ts # 修改: 初始化 McpHub + TOOL_CALL 新增分支
```

### 配置文件格式

```json
// .codemaker/mcp_settings.json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-filesystem-server", "/path"],
      "env": {},
      "disabled": false,
      "timeout": 60,
      "autoApprove": false
    },
    "remote-api": {
      "type": "sse",
      "url": "https://example.com/mcp/sse",
      "headers": { "Authorization": "Bearer xxx" },
      "disabled": false
    }
  }
}
```

## Key Decisions

| 决策 | 选择 | 原因 |
|------|------|------|
| 移植策略 | 方案 A：整体移植 McpHub 类 | 功能完整，热更新/自动重连/差量更新全部可用 |
| McpHub 生命周期 | 单例模式，扩展激活时初始化 | 与源码版一致，确保跨消息共享连接状态 |
| SDK 版本 | `^1.13.1` | 源码版使用版本，支持 StreamableHTTPClientTransport |
| 配置路径 | 复用已有 `.codemaker/mcp_settings.json` | 保持与上一个 change 的配置管理兼容 |
| 适配策略 | 替换 Codemaker 特有函数引用 | `getExtensionContext()` → 传入参数，`getWebviewProvider()` → 传入回调 |
| zod 依赖 | 新增 | 配置校验是 McpHub 的核心逻辑，不宜移除 |
| fast-deep-equal | 新增（或用 JSON.stringify 对比） | 配置变更检测需要深度比较 |
| delay 包 | 用 `setTimeout` + Promise 替代 | 避免新增无必要依赖 |
| stderr 编码 | 复用 iconv-lite（已有） | Windows 下 stdio 子进程 stderr 可能是 GBK 编码 |

## Dependencies

### 新增依赖
| 包名 | 版本 | 用途 |
|------|------|------|
| `@modelcontextprotocol/sdk` | `^1.13.1`（升级） | MCP 协议核心：Client, Transport, Schema |
| `zod` | `^3.x` | 配置文件 Schema 校验 |
| `fast-deep-equal` | `^3.x` | 配置变更检测（差量更新） |

### 已有依赖（可直接使用）
| 包名 | 用途 |
|------|------|
| `iconv-lite` | Windows stdio stderr GBK 编码转换 |
| `vscode` | VSCode Extension API |
| `fs` / `path` | Node.js 内置文件操作 |
