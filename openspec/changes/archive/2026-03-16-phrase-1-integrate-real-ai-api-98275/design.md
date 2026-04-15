## Context

当前 Mock Server 的 `chat.mjs` 文件实现了多个聊天端点，使用 `streamSSE()` 函数返回模拟的流式响应。响应格式已经是 OpenAI 兼容的 SSE 格式：

```
data: {"id":"...","choices":[{"delta":{"content":"..."},"finish_reason":null}]}\n\n
data: [DONE]\n\n
```

LinkAPI 是一个 AI 大模型中转服务平台，提供 OpenAI 兼容的 API 接口，支持流式输出。其 API 地址为 `https://api.linkapi.ai/v1/chat/completions`。

**来自项目维护者的指导**：
> "需要自己写 server 哦，按照 mock server 的返回来即可"

这意味着：
1. 创建一个全新的独立服务，不修改 Mock Server
2. 保持现有 SSE 响应格式不变即可与前端兼容
3. 核心端点 `/proxy/gpt/gpt/text_chat_stream/:event` 是必须实现的

## Goals / Non-Goals

**Goals:**
- 创建独立的 `packages/api-server` 生产级后端服务
- 直接接入 LinkAPI，实现真实的 AI 对话
- 保持与现有前端的完全兼容（SSE 格式和路由不变）
- 支持通过环境变量配置 API Key 和模型
- 提供 Docker 部署支持

**Non-Goals:**
- 不修改 Mock Server（保留用于开发调试）
- 不修改前端 WebView 代码
- 不修改 VS Code 扩展代码
- 不实现多 AI 提供商切换功能（仅支持 LinkAPI）

## Decisions

### 1. 创建独立的 packages/api-server

**决策**: 创建一个全新的 `packages/api-server` 包，而不是修改 Mock Server。

**理由**:
- 生产服务与开发调试服务分离，职责清晰
- Mock Server 保留用于无 API Key 时的本地开发
- 独立部署，可以单独发布和扩展
- 用户可以选择使用 api-server（生产）或 mock-server（开发）

**目录结构**:
```
packages/api-server/
├── package.json
├── Dockerfile
├── .env.example
├── src/
│   ├── index.mjs          # 服务入口
│   ├── config.mjs          # 配置管理
│   ├── linkapi.mjs         # LinkAPI 客户端
│   └── routes/
│       ├── chat.mjs        # 聊天路由
│       └── health.mjs      # 健康检查
└── README.md
```

### 2. 流式响应处理

**决策**: 使用 Node.js 原生 `fetch` API 进行流式请求，逐块转发响应。

**理由**:
- Node.js 18+ 原生支持 fetch 和 ReadableStream
- 无需添加额外依赖
- 可以实时转发 LinkAPI 的流式响应，保持低延迟

### 3. 配置管理

**决策**: 通过环境变量配置，支持以下变量：
- `LINKAPI_API_KEY`: API 密钥（必需）
- `LINKAPI_BASE_URL`: API 地址（可选，默认 `https://api.linkapi.ai`）
- `LINKAPI_MODEL`: 默认模型（可选）
- `PORT`: 服务端口（可选，默认 3001）

**理由**:
- 环境变量是 12-Factor App 的标准配置方式
- 方便 Docker 部署和云原生环境
- 不需要修改代码即可切换配置

### 4. 端点实现范围

**决策**: 实现以下核心端点：
1. `/proxy/gpt/gpt/text_chat_stream/:event` - 主要聊天流式端点
2. `/proxy/gpt/u5_chat/codebase_chat_stream` - 代码库聊天流式端点
3. `/proxy/gpt/u5_chat/codebase_agent_stream` - Agent 流式端点
4. `/proxy/gpt/hangyan/*` - 同样的端点（hangyan 前缀）
5. `/health` - 健康检查端点

**理由**:
- 这些是核心聊天功能端点
- 与 Mock Server 路由保持一致，前端无需修改
- 健康检查用于负载均衡和容器编排

### 5. 错误处理策略

**决策**: API 调用失败时返回错误消息到前端，以 SSE 格式。

**理由**:
- 用户需要知道 API 调用失败的原因
- 错误信息有助于调试配置问题
- 保持 SSE 格式确保前端能正确解析

### 6. Docker 支持

**决策**: 提供 Dockerfile 和 docker-compose.yml 示例。

**理由**:
- 容器化是生产部署的标准方式
- 方便用户快速部署
- 支持云平台（如 Railway、Fly.io、AWS ECS 等）

## Risks / Trade-offs

### 风险

1. **API Key 泄露风险** → 通过环境变量配置；文档说明安全最佳实践

2. **LinkAPI 服务不可用** → 返回清晰的错误信息；实现健康检查

3. **响应格式差异** → 参考 Mock Server 的 SSE 格式，确保兼容

4. **流式传输中断** → 实现超时处理和连接错误处理

### Trade-offs

- **两个服务并存**: api-server 和 mock-server 并存，但职责清晰（生产 vs 开发）
- **代码复用有限**: 未复用 mock-server 代码，但实现简单且独立