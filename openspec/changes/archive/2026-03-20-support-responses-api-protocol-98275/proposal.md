## Why

当前 CodeMaker 集成的 AI API 通信层（`ai-provider.mjs`）仅支持 OpenAI Chat Completions API 协议（`/v1/chat/completions`）。部分用户使用的 API 服务商（如 RightCode）采用 OpenAI 新的 **Responses API** 协议（`/v1/responses`），两者在请求格式、流式响应格式上完全不同，导致这些用户无法正常使用 CodeMaker 聊天功能。

需要让 CodeMaker 的 API 通信层同时支持两种协议，根据用户配置自动选择，实现对不同 API 服务商的通用兼容。

## What Changes

- **新增 Responses API 协议支持**：在 API Server 中实现 OpenAI Responses API 的请求构建和流式响应解析
- **新增协议配置项**：在 VSCode Settings 中增加 `CodeMaker.CodeChatWireApi` 配置项，允许用户选择 `chat-completions`（默认）或 `responses`
- **智能 URL 构建增强**：根据协议类型拼接正确的端点路径（`/v1/chat/completions` 或 `/v1/responses`）
- **请求体格式转换**：Responses API 使用 `input` 数组而非 `messages`，需要做格式映射
- **流式响应适配**：Responses API 的 SSE 格式（`event: response.xxx`）与 Chat Completions 不同，需要转换为前端可消费的统一格式

## Capabilities

### New Capabilities
- `responses-api-support`: 支持 OpenAI Responses API 协议（`/v1/responses`），包括请求格式转换、流式响应解析、协议配置与自动选择

### Modified Capabilities
- `codemaker-integration`: API 通信层新增协议选择逻辑，配置项从 3 个增加到 4 个（新增 `CodeChatWireApi`），环境变量注入新增 `AI_WIRE_API`

## Impact

- **代码**：`resources/codemaker/api-server/ai-provider.mjs`（核心修改）、`src/codemaker/apiServer.ts`（环境变量）、`src/codemaker/configProvider.ts`（新配置项）、`package.json`（Settings 声明）
- **API**：本地 API Server 内部变更，前端接口不变（仍然请求 `/proxy/gpt/...`，由 API Server 内部转换协议）
- **依赖**：无新依赖
- **兼容性**：默认行为不变（`chat-completions`），不影响现有 LinkAPI 等用户