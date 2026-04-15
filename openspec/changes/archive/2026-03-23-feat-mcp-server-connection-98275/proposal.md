## Why

Y3Helper 集成的 CodeMaker 已支持 MCP Server 的配置管理（增删改查 `.codemaker/mcp_settings.json`），但所有 server 状态永远显示为 `disconnected`，tools/resources/prompts 列表永远为空，AI 模型无法调用 `use_mcp_tool` 工具。需要实现 MCP Server 的**实际连接和工具调用**功能，使用户配置的 MCP Server 能真正建立连接、获取工具列表，并在 AI 对话中通过 `use_mcp_tool` 调用外部 MCP 工具。

关联 Issue: #98275

## What Changes

- **移植 McpHub 类**：从 CodeMaker 源码版（`H:\CodemakerOpenSource`）移植 `McpHub` 连接管理类，适配 Y3Helper 架构
- **升级 `@modelcontextprotocol/sdk`**：从 `0.5.0` 升级到 `^1.13.1`，获取完整的 Client/Transport API
- **新增依赖**：`zod`（Schema 校验）、`fast-deep-equal`（配置变更检测）
- **实现三种传输类型连接**：`stdio`（子进程命令行）、`sse`（Server-Sent Events）、`streamableHttp`（HTTP 流式）
- **实现 MCP 工具调用**：在 `TOOL_CALL` 处理器中添加 `use_mcp_tool` 和 `access_mcp_resource` 分支
- **实现连接生命周期管理**：自动连接、断线重连、配置热更新、资源清理
- **替换 messageHandlers.ts 中的 stub 函数**：现有的静态配置管理改为调用 McpHub 实例方法

## Capabilities

### New Capabilities
- `mcp-connection-manager`: MCP Server 连接管理器（McpHub 类），负责建立/维护/断开与外部 MCP Server 的连接，获取 tools/resources/prompts 列表
- `mcp-tool-execution`: MCP 工具调用能力，通过 TOOL_CALL 消息中的 `use_mcp_tool` 和 `access_mcp_resource` 调用外部 MCP Server 工具

### Modified Capabilities
- `webview-message-handlers`: 将现有的 MCP 静态 stub 函数替换为 McpHub 实例方法调用

## Impact

- **新增文件**：`src/codemaker/mcpHandlers/index.ts`（McpHub 类）、`src/codemaker/mcpHandlers/mcp.ts`（类型定义）、`src/codemaker/mcpHandlers/schema.ts`（Zod Schema）
- **修改文件**：`src/codemaker/messageHandlers.ts`（MCP 消息处理改为调用 McpHub）、`src/codemaker/webviewProvider.ts`（初始化 McpHub + TOOL_CALL 新增 `use_mcp_tool`）
- **依赖变更**：`package.json` 升级 `@modelcontextprotocol/sdk`，新增 `zod`、`fast-deep-equal`
