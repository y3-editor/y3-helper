# MCP Tool Execution

## Requirements

### REQ-1: use_mcp_tool 工具调用
- 在 `_handleToolCall` 中新增 `use_mcp_tool` 分支
- 参数格式：`{ server_name: string, tool_name: string, arguments: string (JSON) }`
- 调用 `mcpHub.callTool(serverName, toolName, JSON.parse(arguments))`
- 返回 `TOOL_CALL_RESULT`，content 格式与其他工具一致
- 超时使用 server 配置的 `timeout` 值（默认 60s）

### REQ-2: access_mcp_resource 资源读取
- 在 `_handleToolCall` 中新增 `access_mcp_resource` 分支
- 参数格式：`{ server_name: string, uri: string }`
- 调用 `mcpHub.readResource(serverName, uri)`
- 返回资源内容（text 或 base64 编码的 blob）

### REQ-3: 错误处理
- MCP Server 未连接时返回明确的错误提示
- MCP Server 已禁用时返回提示
- 工具调用超时返回超时错误
- 工具不存在返回未找到错误
- 所有错误设置 `isError: true`

### REQ-4: GET_MCP_PROMPT 支持
- `GET_MCP_PROMPT` 消息调用 `mcpHub.getPrompt(serverName, promptName, promptArgs)`
- 成功返回 `GET_MCP_PROMPT_SUCCESS { requestId, prompt }`
- 失败返回 `GET_MCP_PROMPT_ERROR { requestId, error }`

## Acceptance Criteria

- AI 对话中能通过 `use_mcp_tool` 调用已连接的 MCP Server 工具
- 工具调用结果正确返回到前端并显示在对话中
- 未连接/已禁用/超时等异常情况有明确的错误信息
