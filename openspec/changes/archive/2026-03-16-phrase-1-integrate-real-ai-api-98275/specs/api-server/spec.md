## ADDED Requirements

### Requirement: 独立的生产级服务
系统 SHALL 作为独立的 Node.js 服务运行在 `packages/api-server` 目录下，可独立部署。

#### Scenario: 服务启动
- **WHEN** 执行 `pnpm --filter @codemaker/api-server start`
- **THEN** 服务启动并监听配置的端口（默认 3001）

#### Scenario: 健康检查
- **WHEN** 客户端请求 `/health` 端点
- **THEN** 服务返回 200 状态码和健康状态信息

### Requirement: API Key 配置
系统 SHALL 支持通过环境变量 `LINKAPI_API_KEY` 配置 LinkAPI 的 API 密钥。

#### Scenario: 配置了 API Key
- **WHEN** 环境变量 `LINKAPI_API_KEY` 已设置
- **THEN** 服务正常启动并可以调用 LinkAPI

#### Scenario: 未配置 API Key
- **WHEN** 环境变量 `LINKAPI_API_KEY` 未设置
- **THEN** 服务启动时输出警告信息，请求时返回配置错误提示

### Requirement: API 地址配置
系统 SHALL 支持通过环境变量 `LINKAPI_BASE_URL` 配置 LinkAPI 的 API 地址，默认值为 `https://api.linkapi.ai`。

#### Scenario: 使用默认 API 地址
- **WHEN** 环境变量 `LINKAPI_BASE_URL` 未设置
- **THEN** 系统使用默认地址 `https://api.linkapi.ai`

#### Scenario: 使用自定义 API 地址
- **WHEN** 环境变量 `LINKAPI_BASE_URL` 设置为自定义地址
- **THEN** 系统向该自定义地址的 `/v1/chat/completions` 发送请求

### Requirement: 流式聊天请求转发
系统 SHALL 将 `/proxy/gpt/gpt/text_chat_stream/:event` 端点的请求转发到 LinkAPI，并流式返回响应。

#### Scenario: 成功的流式对话
- **WHEN** 客户端向 `/proxy/gpt/gpt/text_chat_stream/:event` 发送聊天请求
- **THEN** 系统向 LinkAPI 发送请求，并以 SSE 格式逐块返回 AI 响应

#### Scenario: 保持 SSE 格式兼容
- **WHEN** LinkAPI 返回流式响应
- **THEN** 系统输出的 SSE 格式与 Mock Server 格式一致：`data: {"choices":[{"delta":{"content":"..."}}]}\n\n`

### Requirement: Codebase 聊天端点支持
系统 SHALL 对 `/proxy/gpt/u5_chat/codebase_chat_stream` 和 `/proxy/gpt/u5_chat/codebase_agent_stream` 端点实现 LinkAPI 调用。

#### Scenario: Codebase 聊天请求
- **WHEN** 客户端向 `/proxy/gpt/u5_chat/codebase_chat_stream` 发送请求
- **THEN** 系统使用 LinkAPI 进行真实 AI 对话并流式返回响应

#### Scenario: Agent 聊天请求
- **WHEN** 客户端向 `/proxy/gpt/u5_chat/codebase_agent_stream` 发送请求
- **THEN** 系统使用 LinkAPI 进行真实 AI 对话并流式返回响应

### Requirement: Hangyan 前缀端点支持
系统 SHALL 对 `/proxy/gpt/hangyan/` 前缀的聊天端点实现相同的 LinkAPI 调用逻辑。

#### Scenario: Hangyan 前缀端点
- **WHEN** 客户端向 `/proxy/gpt/hangyan/gpt/text_chat_stream/:event` 发送请求
- **THEN** 系统以相同逻辑调用 LinkAPI 并返回响应

### Requirement: 模型参数传递
系统 SHALL 将请求中的 `model` 参数传递给 LinkAPI，如果请求中未指定模型，则使用环境变量 `LINKAPI_MODEL` 的值。

#### Scenario: 使用请求指定的模型
- **WHEN** 请求体中包含 `model: "gpt-4"`
- **THEN** 系统向 LinkAPI 请求时使用 `gpt-4` 模型

#### Scenario: 使用默认模型
- **WHEN** 请求体中未包含 `model` 且 `LINKAPI_MODEL` 设置为 `gpt-3.5-turbo`
- **THEN** 系统向 LinkAPI 请求时使用 `gpt-3.5-turbo` 模型

### Requirement: 错误处理
系统 SHALL 在 API 调用失败时返回清晰的错误消息给客户端，以 SSE 格式。

#### Scenario: API 请求超时
- **WHEN** LinkAPI 请求超时
- **THEN** 系统返回包含超时错误信息的 SSE 响应

#### Scenario: API 认证失败
- **WHEN** LinkAPI 返回 401 认证错误
- **THEN** 系统返回包含认证失败信息的 SSE 响应

#### Scenario: API 服务不可用
- **WHEN** LinkAPI 返回 5xx 错误
- **THEN** 系统返回包含服务不可用信息的 SSE 响应

### Requirement: Docker 部署支持
系统 SHALL 提供 Dockerfile 支持容器化部署。

#### Scenario: Docker 构建
- **WHEN** 执行 `docker build -t api-server .`
- **THEN** 成功构建 Docker 镜像

#### Scenario: Docker 运行
- **WHEN** 执行 `docker run -e LINKAPI_API_KEY=xxx api-server`
- **THEN** 容器启动并正常提供服务

### Requirement: 消息格式转换
系统 SHALL 将请求中的消息数组正确传递给 LinkAPI。

#### Scenario: 传递用户消息
- **WHEN** 请求包含用户消息数组 `messages: [{role: "user", content: "你好"}]`
- **THEN** 系统将相同格式的消息数组发送给 LinkAPI

#### Scenario: 保留系统消息
- **WHEN** 请求包含系统消息 `{role: "system", content: "..."}`
- **THEN** 系统在转发时保留系统消息