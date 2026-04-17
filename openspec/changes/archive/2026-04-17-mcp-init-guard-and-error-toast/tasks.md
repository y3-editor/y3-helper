## 1. Y3 仓库初始化检测方法

- [x] 1.1 在 `src/extension.ts` 的 `Helper` 类中新增 `isY3Initialized(): Promise<boolean>` 方法，检查 `env.y3Uri` 是否存在以及 `y3Uri/.git` 目录是否存在且类型为 Directory，返回 boolean
- [x] 1.2 处理 `env.y3Uri` 为 `undefined` 的边界情况（`mapReady` 未完成时），此时直接返回 `false`

## 2. MCP Server 自动启动守卫

- [x] 2.1 修改 `src/extension.ts` 中 `Helper.start()` 的 `setTimeout` 回调（行 525-531），在 `startTCPServer(true)` 调用前增加 `await this.isY3Initialized()` 守卫检查，仅返回 `true` 时才启动
- [x] 2.2 确认手动启动命令 `y3-helper.startMCPServer`（`registerCommandOfMCP` 中）不受守卫影响，保持原有行为

## 3. 初始化完成时启动 MCP

- [x] 3.1 在 `src/extension.ts` 的 `registerCommandOfInitProject` 方法中，在 git clone 成功且配置复制完成后、`vscode.openFolder` 调用之前，插入 `await this.startTCPServer(true)` 调用

## 4. 项目切换时自动清理 MCP 缓存

- [x] 4.1 在 `src/extension.ts` 或 `src/codemaker/mcpHandlers/index.ts` 中注册 `vscode.workspace.onDidChangeWorkspaceFolders` 事件监听
- [x] 4.2 在事件回调中实现清理逻辑：调用 McpHub 断开所有 `connections` 中的连接、清空数组、通知 WebView 同步清空状态
- [x] 4.3 清理完成后，检查新项目是否已初始化（`isY3Initialized()`），如果是则重新读取新项目的 `.y3maker/mcp_settings.json` 并调用 `initializeMcpServers()` 重新初始化连接

## 5. 错误提示改为 Toast 通知

- [x] 5.1 在 `src/codemaker/mcpHandlers/index.ts` 中，找到所有 `notifyCallback({ type: "SHOW_MCP_ERROR" })` 调用点（约 3-4 处：配置更新异常、重启异常、单个 server 重启失败、配置管理操作失败），将其替换为 `vscode.window.showErrorMessage(friendlyMessage)`
- [x] 5.2 保留 WebView 前端的 `SHOW_MCP_ERROR` 处理代码不做修改
- [x] 5.3 确认 `SYNC_MCP_SERVERS` 和 `NOTIFY_MCP_SERVER_SUCCESS` 通知保持不变
