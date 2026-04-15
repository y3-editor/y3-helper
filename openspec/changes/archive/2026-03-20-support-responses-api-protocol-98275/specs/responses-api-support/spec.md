## ADDED Requirements

### Requirement: Responses API 请求构建
系统 SHALL 在 `wireApi` 配置为 `responses` 时，将前端发来的 Chat Completions 格式请求体转换为 Responses API 格式请求体，并发送到正确的端点。

#### Scenario: messages 转换为 input
- **WHEN** 前端发送请求体包含 `messages` 数组
- **THEN** API Server SHALL 将 `messages` 映射为 Responses API 的 `input` 字段，保持 `{role, content}` 结构不变

#### Scenario: 端点 URL 构建（baseUrl 以 /v1 结尾）
- **WHEN** 用户配置 `baseUrl` 为 `https://right.codes/codex/v1`，`wireApi` 为 `responses`
- **THEN** 请求 URL SHALL 为 `https://right.codes/codex/v1/responses`

#### Scenario: 端点 URL 构建（baseUrl 不以 /v1 结尾）
- **WHEN** 用户配置 `baseUrl` 为 `https://api.example.com`，`wireApi` 为 `responses`
- **THEN** 请求 URL SHALL 为 `https://api.example.com/v1/responses`

#### Scenario: 请求头与认证
- **WHEN** 发送 Responses API 请求
- **THEN** SHALL 使用 `Authorization: Bearer <apiKey>` 和 `Content-Type: application/json`，与 Chat Completions 一致

### Requirement: Responses API 流式响应解析与转换
系统 SHALL 接收 Responses API 的流式 SSE 响应，解析后转换为 Chat Completions SSE 格式，再转发给前端。前端无需感知协议差异。

#### Scenario: 文本增量转换
- **WHEN** API 返回 `event: response.output_text.delta` + `data: {"delta":"Hello"}`
- **THEN** SHALL 转换为 `data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}`

#### Scenario: 响应完成转换
- **WHEN** API 返回 `event: response.completed`
- **THEN** SHALL 发送 `data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}` 然后发送 `data: [DONE]`

#### Scenario: 错误事件处理
- **WHEN** API 返回 `event: error` + `data: {"message":"..."}`
- **THEN** SHALL 通过 `sendErrorSSE` 将错误信息发送给前端

### Requirement: 协议选择配置项
系统 SHALL 提供 `CodeMaker.CodeChatWireApi` VSCode Settings 配置项，允许用户选择 API 协议类型。

#### Scenario: 默认值
- **WHEN** 用户未配置 `CodeMaker.CodeChatWireApi`
- **THEN** SHALL 使用默认值 `chat-completions`，行为与当前完全一致

#### Scenario: 配置为 responses
- **WHEN** 用户设置 `CodeMaker.CodeChatWireApi` 为 `responses`
- **THEN** API Server SHALL 使用 Responses API 协议进行外部 API 通信

#### Scenario: 配置传递链路
- **WHEN** 插件启动
- **THEN** SHALL 通过 `apiServer.ts` fork 子进程的环境变量 `AI_WIRE_API` 传递协议配置，`config.mjs` 读取并暴露为 `config.wireApi`

### Requirement: 协议分流入口
`ai-provider.mjs` 的 `streamChatCompletion` 函数 SHALL 根据 `config.wireApi` 值分流到不同的处理逻辑。

#### Scenario: chat-completions 分流
- **WHEN** `config.wireApi` 为 `chat-completions` 或空
- **THEN** SHALL 使用现有的 Chat Completions API 逻辑（行为不变）

#### Scenario: responses 分流
- **WHEN** `config.wireApi` 为 `responses`
- **THEN** SHALL 调用新的 `streamResponsesApi()` 函数处理请求