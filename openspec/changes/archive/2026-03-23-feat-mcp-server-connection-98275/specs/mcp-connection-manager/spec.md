# MCP Connection Manager

## Requirements

### REQ-1: McpHub 单例管理
- `McpHub` 作为单例在 Extension 激活时创建，停用时 `dispose()` 清理所有连接
- 提供 `initMcpHub()` / `getMcpHub()` 全局访问入口
- 接受 `notifyCallback` 回调用于通知 WebView 状态变更

### REQ-2: 配置文件读取与校验
- 读取 `.codemaker/mcp_settings.json` 配置文件
- 使用 Zod Schema 校验配置格式，支持三种传输类型：
  - `stdio`：`command`（必填）, `args`, `cwd`, `env`
  - `sse`：`url`（必填）, `headers`
  - `streamableHttp`：`url`（必填）, `headers`
- 通用字段：`disabled`, `timeout`（默认 60s）, `autoApprove`, `autoApproveTools`
- 校验失败的配置跳过并记录错误日志

### REQ-3: 连接建立
- `connectToServer(name, config)` 方法根据传输类型创建对应 Transport：
  - `stdio`：`StdioClientTransport({ command, args, env, stderr: "pipe" })`
  - `sse`：`SSEClientTransport(url, { requestInit: { headers } })`
  - `streamableHttp`：`StreamableHTTPClientTransport(url, { requestInit: { headers } })`
- 连接成功后自动获取 tools/resources/resourceTemplates/prompts 列表
- 连接状态流转：`disconnected → connecting → connected`（或 `disconnected + error`）
- 每次状态变更通过 `notifyWebviewOfServerChanges()` 通知前端

### REQ-4: 配置热更新
- `watchMcpSettingsFile()` 监听配置文件保存事件（`vscode.workspace.onDidSaveTextDocument`）
- 文件保存后调用 `updateServerConnections()` 做差量更新：
  - 新增的 server → 建立新连接
  - 配置变更的 server → 断开旧连接 + 重新连接
  - 删除的 server → 断开并移除连接
  - 未变化的 server → 保持不变
- 使用 `fast-deep-equal` 做配置深度比较

### REQ-5: 断线重连与健壮性
- `pingMcpServers()` 检测未禁用但已断连的 server，自动尝试重连
- `restartConnection(name)` 单个 server 重启（重读配置后重连）
- `restartAllConnections()` 重启所有连接
- `executeWithRetry()` 自动重试机制：Session 过期时重连后重试一次
- 连接/重连过程中的异常捕获并设置 `server.error`

### REQ-6: WebView 状态同步
- `SYNC_MCP_SERVERS` 消息格式：
  ```json
  {
    "type": "SYNC_MCP_SERVERS",
    "data": {
      "servers": [{
        "name": "server-name",
        "status": "connected|connecting|disconnected",
        "error": "",
        "tools": [{ "name": "...", "description": "...", "inputSchema": {} }],
        "resources": [],
        "resourceTemplates": [],
        "prompts": [],
        "disabled": false,
        "autoApprove": false,
        "config": { /* 原始配置 */ }
      }]
    }
  }
  ```
- 配置变更（增删改）成功后发送 `NOTIFY_MCP_SERVER_SUCCESS`
- 操作失败时发送 `SHOW_MCP_ERROR`

### REQ-7: 配置管理 API
- `addMcpServer(data)` — 添加新 server 到配置文件并立即连接
- `upDataMcpConfig(data)` — 更新配置（支持重命名 via `originalName`）
- `removeMcpServer(name)` — 删除 server 并断开连接
- `openMCPSettingFile()` — 在 VSCode 编辑器中打开配置文件

### REQ-8: 资源清理
- `dispose()` 方法断开所有连接、注销所有事件监听
- Extension deactivate 时自动调用

## Acceptance Criteria

- 配置 stdio 类型 MCP Server 后，前端显示 `connected` 状态和工具列表
- 配置 sse/streamableHttp 类型后同样能正常连接
- 修改配置文件保存后，连接自动更新
- 删除 server 配置后，连接自动断开
- 无效配置不会导致扩展崩溃
