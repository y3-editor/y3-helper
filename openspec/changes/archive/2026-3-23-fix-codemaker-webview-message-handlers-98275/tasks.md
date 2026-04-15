# Tasks

## Bug 1: `@` 附加文件/目录一直 loading
- [x] 在 `webviewProvider.ts` 中添加 `GET_WORKSPACE_FILES` 消息处理
- [x] 在 `webviewProvider.ts` 中添加 `SEARCH_WORKSPACE_PATH` 消息处理
- [x] 实现 `_searchWorkspaceFiles()` 方法（使用 `vscode.workspace.findFiles`）
- [x] 实现 `_searchWorkspacePaths()` 方法（支持 file/folder 过滤）

## Bug 2: AI 无法读写本地文件（TOOL_CALL 未处理）
- [x] 在 `webviewProvider.ts` 中添加 `TOOL_CALL` 消息处理
- [x] 实现 `_toolReadFile()` — 读取文件内容（支持 offset/limit，带行号）
- [x] 实现 `_toolListFiles()` — 列出目录（支持递归）
- [x] 实现 `_toolViewDefinitions()` — 查看源码定义
- [x] 实现 `_toolGrepSearch()` — 正则搜索文件内容

## Bug 3: 源码版 60+ 消息类型遗漏
- [x] 创建 `src/codemaker/messageHandlers.ts`
- [x] 实现 `handleExtendedMessage()` 入口函数
- [x] 编辑器操作: `INSERT_TO_EDITOR`, `INSERT_WITH_DIFF`, `GET_EDITOR_FILE_STATE`
- [x] 文件操作: `OPEN_FILE`, `CREATE_FILE_AND_INSERT_CODE`, `EXPORT_FILE`, `LOAD_DIRECTORY_FILES`
- [x] 终端操作: `INSERT_TERMINAL`, `STOP_ALL_TERMINAL`, `STOP_TERMINAL_PROGRESS`, `SHOW_TERMINAL_WINDOW`
- [x] Diff 预览: `PREVIEW_DIFF_CODE`, `PREVIEW_DIFF_EDIT`, `PREVIEW_DIFF_FILE`
- [x] 代码应用: `ACCEPT_EDIT`, `BATCH_ACCEPT_EDIT`, `REVERT_EDIT`, `BATCH_REVERT_EDIT`, `REAPPLY_EDIT`, `REAPPLY_REPLACE`, `BATCH_APPLY_CHANGES`, `APPLY_SINGLE_CHANGES`
- [x] 聊天控制: `stopCodeChat`, `CHAT_REQUEST_START`, `CHAT_REPLY_DONE`
- [x] 工作区: `GET_WORKSPACE_LIST`, `GET_WORKSPACE_PROBLEMS`
- [x] 可视化: `OPEN_MERMAID`, `OPEN_PLANTUML`, `OPEN_GRAPHVIZ`, `OPEN_HTML`
- [x] 配置: `OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH`, `EDIT_CODEBASE_RULES`
- [x] 日志: `CONSOLE_ERROR`, `CONSOLE_LOG`, `CONSOLE_WARN`
- [x] 其他: `WEBVIEW_ACK`, `OPEN_NEW_WINDOW`, `OPEN_SOURCE_CONTROL`
- [x] 在 `webviewProvider.ts` 中集成 `handleExtendedMessage` 调用

## Bug 4: API Server 端口冲突导致启动失败
- [x] 重写 `apiServer.ts` 启动逻辑为 `_tryStartOnPort()` 递归方法
- [x] 监听 stderr 检测 `EADDRINUSE`，自动重试下一端口
- [x] 监听 exit 事件处理非零退出码
- [x] 3 秒超时确认机制替代 1 秒盲等

## Bug 5: 聊天发送消息后无响应
- [x] 修复 `SYNC_RULES` 数据格式：`{ rules: [] }` → `[]`（直接数组）
- [x] 修复 `SYNC_SKILLS` 数据格式：`{ skills: [] }` → `[]`
- [x] 添加调试日志 `[CodeMaker MSG]` 便于排查

## Bug 6: Rules 管理功能异常
- [x] 文件后缀过滤从 `.md` 改为 `.mdc`
- [x] 新建 rule 文件名自动添加 `.mdc` 后缀
- [x] 新建 rule 写入默认 `.mdc` front-matter（description, alwaysApply）
- [x] 实现 `parseMdcFile()` 解析 front-matter（含 globs 字段）
- [x] 返回数据包含 `metaData: { description, alwaysApply, globs }` 结构
- [x] 创建/更新/删除后自动调用 `handleGetRules()` 刷新列表
- [x] 额外加载 `.codemaker.codebase.md` 特殊文件

## Bug 7: MCP 配置管理不可用
- [x] 实现 `readMcpSettings()` / `writeMcpSettings()` 读写 `.codemaker/mcp_settings.json`
- [x] 实现 `handleGetMcpServers()` — 读取配置并转换为前端格式
- [x] 实现 `handleAddMcpServer()` — 添加 server 到配置文件
- [x] 实现 `handleUpdateMcpServer()` — 更新配置（支持重命名）
- [x] 实现 `handleRemoveMcpServer()` — 删除 server
- [x] 实现 `handleOpenMcpSetting()` — 打开配置文件编辑
- [x] `PING_MCP_SERVERS` / `RESTART_MCP_SERVERS` 重新读取配置
- [x] `GET_MCP_PROMPT` 返回 "not supported" 错误信息

## 遗留项（后续任务）
- [ ] MCP Server 实际连接功能（需要 `@modelcontextprotocol/sdk` 升级到 1.13.1，移植 McpHub 类）
