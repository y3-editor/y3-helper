## MODIFIED Requirements

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
- 操作失败时系统 SHALL 通过 `vscode.window.showErrorMessage()` 显示 VSCode 原生 Toast 通知（右下角悬浮窗），不再通过 `notifyCallback` 发送 `SHOW_MCP_ERROR` 消息到 WebView
- WebView 前端的 MCP 错误弹窗组件代码 SHALL 保留不动，仅后端不再发送 `SHOW_MCP_ERROR` 消息

#### Scenario: MCP 连接错误使用 Toast 通知
- **WHEN** MCP Server 连接失败（如 fetch failed、ECONNREFUSED）
- **THEN** 系统 SHALL 调用 `vscode.window.showErrorMessage()` 显示友好的错误消息
- **AND** 系统 SHALL 不发送 `SHOW_MCP_ERROR` 消息到 WebView

#### Scenario: MCP servers 更新异常使用 Toast 通知
- **WHEN** `mcp_settings.json` 保存触发更新但发生异常
- **THEN** 系统 SHALL 调用 `vscode.window.showErrorMessage()` 显示错误消息
- **AND** 系统 SHALL 不发送 `SHOW_MCP_ERROR` 消息到 WebView

#### Scenario: MCP servers 重启异常使用 Toast 通知
- **WHEN** 执行 `restartAllConnections()` 或 `restartConnection()` 失败
- **THEN** 系统 SHALL 调用 `vscode.window.showErrorMessage()` 显示错误消息
- **AND** 系统 SHALL 不发送 `SHOW_MCP_ERROR` 消息到 WebView

#### Scenario: WebView 前端弹窗组件保留
- **WHEN** WebView 前端代码中存在 `SHOW_MCP_ERROR` 处理逻辑
- **THEN** 系统 SHALL 保留该前端代码不做修改，以备后续复用
