## 1. 项目结构创建

- [x] 1.1 创建 `packages/api-server/` 目录
- [x] 1.2 创建 `packages/api-server/package.json`，配置包名 `@codemaker/api-server`
- [x] 1.3 创建 `packages/api-server/src/` 目录结构
- [x] 1.4 创建 `packages/api-server/.env.example` 示例配置文件
- [x] 1.5 创建 `packages/api-server/README.md` 说明文档

## 2. 配置模块

- [x] 2.1 创建 `src/config.mjs`，读取环境变量 `LINKAPI_API_KEY`、`LINKAPI_BASE_URL`、`LINKAPI_MODEL`、`PORT`
- [x] 2.2 实现配置验证，启动时检查必需的 `LINKAPI_API_KEY`
- [x] 2.3 设置默认值：`LINKAPI_BASE_URL` 默认 `https://api.linkapi.ai`，`PORT` 默认 `3001`

## 3. LinkAPI 客户端

- [x] 3.1 创建 `src/linkapi.mjs` 模块
- [x] 3.2 实现 `streamChatCompletion(requestBody, res)` 函数，透传完整请求体（包括 tools）
- [x] 3.3 实现流式响应读取，使用 ReadableStream 逐块转发到客户端响应
- [x] 3.4 实现请求超时处理（使用 AbortController，60 秒）
- [x] 3.5 实现错误响应处理（401、5xx 等），以 SSE 格式返回错误信息

## 4. 聊天路由

- [x] 4.1 创建 `src/routes/chat.mjs`
- [x] 4.2 实现 `POST /proxy/gpt/gpt/text_chat_stream/:event` 端点
- [x] 4.3 实现 `POST /proxy/gpt/u5_chat/codebase_chat_stream` 端点
- [x] 4.4 实现 `POST /proxy/gpt/u5_chat/codebase_agent_stream` 端点
- [x] 4.5 实现 `/proxy/gpt/hangyan/` 前缀的对应端点
- [x] 4.6 透传完整请求体（包括 tools、temperature、max_tokens 等）

## 5. 辅助端点

- [x] 5.1 创建 `src/routes/health.mjs`，实现 `GET /health` 健康检查端点
- [x] 5.2 实现辅助端点的简单响应（token 计算、配额检查等，返回固定值即可）

## 6. 服务入口

- [x] 6.1 创建 `src/index.mjs` 服务入口
- [x] 6.2 使用原生 http 模块创建服务器
- [x] 6.3 注册路由
- [x] 6.4 添加 CORS 支持（GET/POST/PUT/PATCH/DELETE）
- [x] 6.5 添加请求日志
- [x] 6.6 启动时输出配置状态（是否配置了 API Key）
- [x] 6.7 为 POST/PUT/PATCH 请求解析 body

## 7. Docker 支持

- [x] 7.1 创建 `packages/api-server/Dockerfile`
- [x] 7.2 创建 `packages/api-server/docker-compose.yml` 示例
- [x] 7.3 创建 `.dockerignore` 文件

## 8. 测试与验证

- [x] 8.1 配置 `.env` 文件设置 `LINKAPI_API_KEY`
- [x] 8.2 启动 api-server：`pnpm --filter @codemaker/api-server dev`
- [x] 8.3 VS Code launch.json 的 `CODEMAKER_API_URL` 已指向 `http://localhost:3001`
- [x] 8.4 启动扩展，发送聊天消息，验证收到真实 AI 回复
- [x] 8.5 验证 tool calls 功能（创建文件等）
- [ ] 8.6 测试 Docker 构建和运行（跳过）

## 9. 文档完善

- [x] 9.1 `packages/api-server/README.md` 包含快速开始、配置说明
- [ ] 9.2 在项目根目录 README 中添加 api-server 的说明（跳过，不修改仓库代码）
- [ ] 9.3 添加部署到云平台的示例（跳过）

## 10. Bug 修复（调试过程中发现并修复）

- [x] 10.1 修复 PUT/PATCH 请求 body 未解析的问题
- [x] 10.2 修复 tools 参数未透传导致 tool calls 不工作的问题
- [x] 10.3 添加历史记录路由（GET/POST/PUT/DELETE chat_histories）
- [x] 10.4 修复 CORS 头缺少 PUT/PATCH/DELETE 方法的问题

## 已知问题

- [ ] 历史记录偶发性丢失（长时间使用后，复现概率低，原因待查）