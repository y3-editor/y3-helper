## Why

[#99017]

当前 MCP Server 在扩展激活时自动启动（`extension.ts` 行 528-531，静默模式），无论 Y3 仓库是否已初始化。对于未初始化过的仓库，MCP Server 启动后会尝试读取 `.y3maker/mcp_settings.json`，如果文件不存在则自动创建空配置目录和文件，导致后续的 `.codemaker → .y3maker` 自动迁移逻辑误判（认为 `.y3maker` 已存在但为空）。同时，MCP 连接失败时的错误提示使用了全屏模态弹窗（WebView `SHOW_MCP_ERROR` 通知），体验较差，应改为 VSCode 右下角的小悬浮窗通知。

## What Changes

- **MCP Server 启动守卫**：MCP TCP Server 和 McpHub 仅在 Y3 仓库已初始化后才自动启动。判断依据：`y3Uri/.git` 目录存在 或 `y3Uri/README.md` 存在（复用已有初始化检测逻辑）。
- **初始化时启动 MCP**：在 `y3-helper.initProject` 命令执行成功（git clone 完成并复制 `.y3maker`）后，顺带启动 MCP Server。
- **项目切换时缓存清理**：当用户切换项目时，自动清理上一个项目的 MCP 内存连接缓存（`McpHub.connections` 中的 tools、resources 等），然后根据新项目的配置重新初始化。同时保留手动清理命令以备其他场景。
- **错误提示改为 Toast 通知**：将 MCP 相关的错误提示从 WebView 全屏模态弹窗（`SHOW_MCP_ERROR`）改为 VSCode 右下角 `showErrorMessage` / `showWarningMessage` 小悬浮窗通知。

## Capabilities

### New Capabilities
- `mcp-init-guard`: MCP Server 启动守卫逻辑——检测仓库初始化状态后再决定是否启动 MCP，初始化完成时顺带启动，以及缓存清理能力。

### Modified Capabilities
- `mcp-connection-manager`: 错误提示方式从 WebView 模态弹窗改为 VSCode 原生 Toast 通知；连接管理器需支持缓存清理。

## Impact

- **受影响代码**：
  - `src/extension.ts`：自动启动逻辑（行 528-531）、初始化命令（行 72-210）
  - `src/codemaker/mcpHandlers/index.ts`：McpHub 错误通知回调（`SHOW_MCP_ERROR`）、连接缓存管理
  - `src/codemaker/webviewProvider.ts`：McpHub 初始化时机
  - WebView 前端：移除 MCP 错误弹窗组件
- **受影响 API**：`McpNotifyCallback` 中的 `SHOW_MCP_ERROR` 消息类型可能被废弃或简化
- **依赖**：无新增外部依赖
- **向后兼容**：对用户无 **BREAKING** 变更，仅改善 UX 行为
