## 1. 配置层扩展

- [x] 1.1 在 `package.json` 中声明 `CodeMaker.CodeChatWireApi` 配置项，类型为 enum（`chat-completions` / `responses`），默认 `chat-completions`，添加中英文描述
- [x] 1.2 修改 `src/codemaker/configProvider.ts`，新增 `wireApi` 字段读取 `CodeMaker.CodeChatWireApi`
- [x] 1.3 修改 `src/codemaker/apiServer.ts`，在 fork 子进程的环境变量中注入 `AI_WIRE_API`
- [x] 1.4 修改 `resources/codemaker/api-server/config.mjs`，新增 `wireApi` 配置项读取 `AI_WIRE_API` 环境变量

## 2. Responses API 请求构建

- [x] 2.1 在 `resources/codemaker/api-server/ai-provider.mjs` 中新增 `buildResponsesUrl(baseUrl)` 函数，根据 baseUrl 是否以 `/v1` 结尾智能拼接 `/responses` 端点
- [x] 2.2 新增 `buildResponsesRequestBody(requestBody)` 函数，将 `messages` 映射为 `input`，构建 Responses API 格式的请求体（含 `model`、`stream: true`）

## 3. Responses API 流式响应解析与转换

- [x] 3.1 新增 `parseResponsesSSE(chunk)` 函数，解析 Responses API 的 SSE 格式（`event:` + `data:` 行），提取事件类型和数据
- [x] 3.2 新增 `convertToCompletionsSSE(eventType, eventData)` 函数，将 `response.output_text.delta` 转换为 Chat Completions 的 `choices.delta.content` 格式，将 `response.completed` 转换为 `finish_reason: "stop"` + `[DONE]`

## 4. 协议分流与核心流程

- [x] 4.1 新增 `streamResponsesApi(requestBody, res, apiKey, baseUrl)` 函数，实现完整的 Responses API 请求-响应-转发流程
- [x] 4.2 修改 `streamChatCompletion` 函数，在配置提取和校验后根据 `config.wireApi` 分流到 `streamResponsesApi` 或现有 Chat Completions 逻辑
- [x] 4.3 确保错误处理（HTTP 错误、网络错误、超时）复用现有的 `handleHttpError` 和 `sendErrorSSE`

## 5. 编译与验证

- [x] 5.1 执行 Webpack 编译，确保 TypeScript 变更（`configProvider.ts`、`apiServer.ts`）编译通过
- [x] 5.2 使用 RightCode 的 API Key 和 Base URL 进行端到端测试：配置 `wireApi: responses`，发送消息验证流式聊天正常工作
- [x] 5.3 使用 Codex (capi.quan2go.com) 的 API Key 进行端到端测试：配置 `wireApi: responses`，验证流式聊天正常工作
