## Why

CodeMaker 集成到 Y3Helper 后（#98275），WebView 前端与 Extension 之间的消息通道存在大量未处理的消息类型，导致多个核心功能不可用：`@` 附加文件卡 loading、AI 无法读写本地文件、聊天发送后无响应、Rules/MCP 配置不生效等。原始设计低估了 Extension 侧需要处理的消息量（源码版有 96 个 case，集成版仅实现了 8 个）。

## What Changes

- **新增 60+ 消息类型处理**：从源码版移植所有 WebView 消息处理逻辑到新文件 `messageHandlers.ts`
- **修复 `@` 附加文件/目录功能**：实现 `GET_WORKSPACE_FILES` 和 `SEARCH_WORKSPACE_PATH` 消息处理
- **修复 AI 工具调用（TOOL_CALL）**：实现 `read_file`、`list_files_top_level`、`list_files_recursive`、`grep_search`、`view_source_code_definitions_top_level` 五个本地工具
- **修复 API Server 端口冲突**：重写启动逻辑，支持 `EADDRINUSE` 错误自动递增端口重试
- **修复聊天发送无响应**：`SYNC_RULES` 数据格式从 `{rules:[]}` 修正为 `[]`（数组），修复 `onUserSubmit` 崩溃
- **修复 Rules 管理**：文件后缀从 `.md` 改为 `.mdc`，添加 `metaData`（含 `globs`）字段，创建/更新/删除后自动刷新列表
- **实现 MCP 配置管理**：支持 MCP Server 的增删改查和打开配置文件（实际连接功能待后续实现）
- **新增编辑器操作**：`INSERT_TO_EDITOR`、`INSERT_WITH_DIFF`、`OPEN_FILE`、`CREATE_FILE_AND_INSERT_CODE`
- **新增终端操作**：`INSERT_TERMINAL`、`STOP_ALL_TERMINAL` 等
- **新增 Diff 预览与代码应用**：`PREVIEW_DIFF_CODE/EDIT/FILE`、`ACCEPT_EDIT`、`BATCH_ACCEPT_EDIT`、`REVERT_EDIT` 等

## Capabilities

### New Capabilities
- `webview-message-handlers`: Extension 侧 WebView 消息处理器，覆盖源码版 96 个 case 中的 60+ 个核心消息类型
- `api-server-port-resilience`: API Server 端口冲突自动重试机制

### Modified Capabilities
- `codemaker-webview-integration`: 修复消息通道和数据格式，确保前端功能正常工作

## Impact

- **新增文件**：`src/codemaker/messageHandlers.ts`（~1600 行）
- **修改文件**：`src/codemaker/webviewProvider.ts`（新增 import、`_handleMessage` 改为 async + 集成扩展处理器）、`src/codemaker/apiServer.ts`（重写端口启动逻辑）
- **无 API 或依赖变更**