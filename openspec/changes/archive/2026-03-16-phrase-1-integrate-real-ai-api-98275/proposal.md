## Why

当前 CodeMaker 开源版使用 Mock Server 返回预设的模拟回复，无法进行真正的 AI 对话。Mock Server 仅用于开发调试，不适合生产环境。需要创建一个全新的生产级后端服务，直接接入 LinkAPI（AI 大模型中转服务平台），让开源版用户能够部署真实可用的 AI 编程助手服务。

## What Changes

- **创建新的 `packages/api-server` 包**：一个独立的生产级后端服务
- **直接接入 LinkAPI**：不依赖 Mock Server，直接调用真实 AI API
- **实现核心聊天端点**：与 Mock Server 相同的路由，保持前端兼容
- **支持生产部署**：提供 Docker 配置、环境变量管理等

## Capabilities

### New Capabilities

- `api-server`: 创建独立的生产级后端服务，直接接入 LinkAPI，实现真实的 AI 对话能力

### Modified Capabilities

（无现有能力需要修改）

## Impact

- **新增代码**：
  - `packages/api-server/` - 新的后端服务包
  - `packages/api-server/src/index.mjs` - 服务入口
  - `packages/api-server/src/routes/chat.mjs` - 聊天路由
  - `packages/api-server/src/linkapi.mjs` - LinkAPI 客户端
  
- **配置项**：
  - `LINKAPI_API_KEY` - LinkAPI 的 API Key（必需）
  - `LINKAPI_BASE_URL` - LinkAPI 的 API 地址（默认 https://api.linkapi.ai）
  - `LINKAPI_MODEL` - 默认模型名称（可选）
  - `PORT` - 服务端口（默认 3001）

- **部署支持**：
  - Dockerfile 用于容器化部署
  - 环境变量配置示例

- **兼容性**：
  - 保持与 Mock Server 相同的 API 路由
  - 保持与现有前端的 SSE 格式兼容
  - 可无缝替换 Mock Server