# Tasks

## 阶段 1: 依赖准备
- [x] 升级 `@modelcontextprotocol/sdk` 从 `0.5.0` 到 `^1.13.1`
- [x] 新增 `zod` 依赖
- [x] 新增 `fast-deep-equal` 依赖
- [x] 运行 `npm install` 确认依赖安装成功
- [x] 确认 webpack 配置能正确打包新增依赖

## 阶段 2: 类型定义与 Schema
- [x] 创建 `src/codemaker/mcpHandlers/mcp.ts` — 类型定义
  - McpServer, McpTool, McpResource, McpResourceTemplate, McpPrompt
  - McpConnection (server + client + transport)
  - McpToolCallResponse
- [x] 创建 `src/codemaker/mcpHandlers/schema.ts` — Zod Schema
  - StdioConfigSchema (command, args, cwd, env)
  - SseConfigSchema (url, headers)
  - StreamableHttpConfigSchema (url, headers)
  - McpSettingsSchema (mcpServers: Record<string, union>)
  - 通用字段: disabled, timeout, autoApprove, autoApproveTools

## 阶段 3: McpHub 核心类
- [x] 创建 `src/codemaker/mcpHandlers/index.ts` — McpHub 类
- [x] 实现构造函数: 接受 notifyCallback, 调用 watchMcpSettingsFile + initializeMcpServers
- [x] 实现 `getMcpSettingsFilePath()` — 获取配置文件路径
- [x] 实现 `initializeMcpServers()` — 读取配置并连接所有未禁用 server
- [x] 实现 `connectToServer(name, config)` — 核心连接方法
  - [x] stdio 传输: StdioClientTransport + stderr 编码处理 (iconv-lite)
  - [x] sse 传输: SSEClientTransport + 自定义 headers
  - [x] streamableHttp 传输: StreamableHTTPClientTransport + 断连重连
  - [x] 连接后获取 tools/resources/resourceTemplates/prompts 列表
  - [x] 状态变更通知 WebView
- [x] 实现 `fetchToolsList()` / `fetchResourcesList()` / `fetchPromptsList()`
- [x] 实现 `callTool(serverName, toolName, arguments)` — 工具调用
- [x] 实现 `readResource(serverName, uri)` — 资源读取
- [x] 实现 `getPrompt(serverName, promptName, promptArgs)` — Prompt 获取
- [x] 实现 `executeWithRetry()` — Session 过期自动重试
- [x] 实现 `watchMcpSettingsFile()` — 配置文件监听
- [x] 实现 `updateServerConnections()` — 差量更新
- [x] 实现 `restartConnection(name)` — 单个 server 重启
- [x] 实现 `restartAllConnections()` — 全部重启
- [x] 实现 `pingMcpServers()` — 断连自动重连
- [x] 实现 `notifyWebviewOfServerChanges()` — 状态通知 (即 `sendLatestMcpServers`)
- [x] 实现 `addMcpServer(data)` — 添加 server
- [x] 实现 `upDataMcpConfig(data)` — 更新配置（支持重命名）
- [x] 实现 `removeMcpServer(name)` — 删除 server
- [x] 实现 `openMCPSettingFile()` — 打开配置文件
- [x] 实现 `dispose()` — 清理所有连接

## 阶段 4: 集成到消息处理
- [x] 修改 `webviewProvider.ts` — 初始化 McpHub 单例
  - [x] 在构造函数中创建 McpHub，传入 notifyCallback
  - [x] 在 webviewView dispose 时调用 disposeMcpHub()
- [x] 修改 `webviewProvider.ts` — TOOL_CALL 新增分支
  - [x] `use_mcp_tool`: 调用 mcpHub.callTool()，结果封装为 TOOL_CALL_RESULT
  - [x] `access_mcp_resource`: 调用 mcpHub.readResource()
- [x] 修改 `messageHandlers.ts` — 替换 MCP stub 函数
  - [x] GET_MCP_SERVERS → mcpHub.sendLatestMcpServers()
  - [x] ADD_MCP_SERVERS → mcpHub.addMcpServer()
  - [x] UPDATE_MCP_SERVERS → mcpHub.upDataMcpConfig()
  - [x] REMOVE_MCP_SERVERS → mcpHub.removeMcpServer()
  - [x] OPEM_MCP_SETTING → mcpHub.openMCPSettingFile()
  - [x] PING_MCP_SERVERS → mcpHub.restartConnection() (单个) / restartAllConnections() (全部)
  - [x] RESTART_MCP_SERVERS → mcpHub.restartConnection() / restartAllConnections()
  - [x] GET_MCP_PROMPT → mcpHub.getPrompt()
- [x] 删除 `messageHandlers.ts` 中已被 McpHub 替代的 stub 函数（已删除，fallback 改为 console.warn）
- [x] 修复 Zod 类型兼容性问题 (McpPrompt/McpPromptResult 手写类型，ListPromptsResultSchema as any)
- [x] 编译通过 0 错误

## 阶段 5: 运行测试与验证
- [x] 编译通过无错误
- [ ] 测试 stdio 类型 MCP Server 连接（如 filesystem server）
- [x] 测试前端 UI 状态更新（connected/disconnected）— y3editor 显示 connected ✅
- [x] 测试 AI 对话中调用 use_mcp_tool — 成功调用 get_official_editor_model ✅
- [x] 修复 arguments 参数序列化问题（前端传来的 JSON 字符串需要解析）
- [ ] 测试配置文件热更新
- [ ] 测试 Extension 停用时资源清理
- [ ] 测试 stdio 类型 MCP Server 连接（如 filesystem server）
