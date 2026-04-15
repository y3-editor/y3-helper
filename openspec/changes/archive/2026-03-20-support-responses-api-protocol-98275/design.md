## Context

CodeMaker 集成的 API 通信层当前仅支持 OpenAI Chat Completions API。前端（React WebView）发送聊天请求到本地 API Server（`localhost:3001/proxy/gpt/...`），API Server 的 `ai-provider.mjs` 将请求转发到用户配置的外部 API 服务。

现状架构：
```
前端 WebView → 本地 API Server (chat.mjs → ai-provider.mjs) → 外部 API 服务
                  ↑ 请求格式: messages[]          ↑ POST /v1/chat/completions
                  ↓ 响应格式: SSE (choices.delta)  ↓ SSE (choices.delta.content)
```

RightCode 等服务商使用 OpenAI Responses API，协议差异：
- 端点：`/v1/responses`（非 `/v1/chat/completions`）
- 请求体：`input` 数组（非 `messages`），支持 `instructions` 字段
- 流式响应：`event: response.output_text.delta` + `data: {"delta":"..."}` 格式
- 完成标记：`event: response.completed`（非 `data: [DONE]`）

## Goals / Non-Goals

**Goals:**
- 在 API Server 中支持 Responses API 协议，使 RightCode 等用户可正常聊天
- 通过用户配置项选择协议，默认保持 Chat Completions（向后兼容）
- 对前端完全透明：API Server 内部做协议转换，前端无需任何改动

**Non-Goals:**
- 不支持 Responses API 的全部高级特性（如 `tools`、`function_call`、`reasoning` 等），仅保证基础聊天功能
- 不自动检测协议类型（需要用户显式配置 `wireApi`）
- 不修改前端 React 代码

## Decisions

### Decision 1: 协议适配层位置 — API Server 内部（`ai-provider.mjs`）

**选择**：在 `ai-provider.mjs` 中根据 `wireApi` 配置分流，新增 `streamResponsesApi()` 函数处理 Responses API。

**替代方案**：
- A) 新建独立文件 `responses-provider.mjs` — 代码隔离更好但增加文件数量，且两种协议共享大量错误处理逻辑
- B) 在 `chat.mjs` 路由层做分流 — 职责不清，路由层不应关心外部 API 协议

**理由**：`ai-provider.mjs` 已经是 AI API 通信的唯一出口，在此处做协议分流最自然。共享错误处理、配置提取、SSE 发送等公共逻辑。

### Decision 2: 请求格式转换策略 — messages → input 映射

**选择**：在 API Server 中将前端发来的 `messages` 数组直接映射为 Responses API 的 `input` 数组。

映射规则：
```
messages: [{role: "user", content: "hi"}, {role: "assistant", content: "hello"}]
    ↓
input: [{role: "user", content: "hi"}, {role: "assistant", content: "hello"}]
```

Responses API 的 `input` 数组格式与 `messages` 高度兼容（都是 `{role, content}` 对象数组），可以直接透传。

### Decision 3: 流式响应转换策略 — 转换为 Chat Completions SSE 格式

**选择**：API Server 接收 Responses API 的流式响应后，转换为 Chat Completions 的 SSE 格式再转发给前端。

```
Responses API 返回:
  event: response.output_text.delta
  data: {"type":"response.output_text.delta","delta":"Hello"}

转换为 Chat Completions 格式:
  data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}

Responses API 完成:
  event: response.completed
  data: {...}

转换为:
  data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}
  data: [DONE]
```

**理由**：前端已经适配了 Chat Completions 的 SSE 解析逻辑，在 API Server 做转换可以完全不改前端。

### Decision 4: 配置传递链路

```
VSCode Settings (CodeMaker.CodeChatWireApi: "chat-completions" | "responses")
    ↓ configProvider.ts
apiServer.ts fork() env: { AI_WIRE_API: "responses" }
    ↓ config.mjs
ai-provider.mjs: config.wireApi → 选择协议
```

同时通过 `INIT_DATA` postMessage 传递给前端（虽然前端暂不使用，但预留扩展性）。

### Decision 5: URL 构建策略

- `wireApi === "responses"` + baseUrl 以 `/v1` 结尾 → `${baseUrl}/responses`
- `wireApi === "responses"` + baseUrl 不以 `/v1` 结尾 → `${baseUrl}/v1/responses`
- `wireApi === "chat-completions"` → 沿用现有 `buildChatCompletionsUrl()` 逻辑

## Risks / Trade-offs

- **[Risk] Responses API 格式差异** → 不同服务商对 Responses API 的实现可能有差异。Mitigation：以 OpenAI 官方规范为准，RightCode 实测验证。
- **[Risk] 高级功能不支持** → Tool call、reasoning 等 Responses API 特有功能暂不支持。Mitigation：先保证基础聊天，后续按需扩展。
- **[Trade-off] 手动配置 vs 自动检测** → 用户需要手动设置 `wireApi`，但避免了复杂的协议自动探测逻辑。