# WebView Message Handlers

## Requirements

### REQ-1: 扩展消息处理器框架
- `handleExtendedMessage()` 函数接收 `message`, `webview`, `provider` 三个参数
- 返回 `boolean` 表示是否已处理该消息
- 未处理的消息在 `webviewProvider.ts` 的 `default` 分支中打印日志
- 所有处理器中的异常被 try-catch 捕获，不影响后续消息处理

### REQ-2: 编辑器操作消息
- `INSERT_TO_EDITOR`: 将内容替换到当前编辑器选区
- `INSERT_WITH_DIFF`: 以 conflict 格式（<<<<<<< / ======= / >>>>>>>）插入差异
- `GET_EDITOR_FILE_STATE`: 返回当前活动文件信息（路径、内容、语言、选区、光标位置）

### REQ-3: 文件操作消息
- `OPEN_FILE`: 打开文件并定位到指定行号或代码片段
- `CREATE_FILE_AND_INSERT_CODE`: 创建新文件并写入内容
- `EXPORT_FILE`: 通过保存对话框导出文件
- `LOAD_DIRECTORY_FILES`: 加载目录下的文件列表

### REQ-4: 终端操作消息
- `INSERT_TERMINAL`: 在终端中执行命令（支持 `execute` 标志控制是否立即执行）
- `STOP_ALL_TERMINAL`: 关闭所有终端
- `STOP_TERMINAL_PROGRESS` / `SHOW_TERMINAL_WINDOW`: 按终端 ID 操作

### REQ-5: Diff 预览与代码应用
- `PREVIEW_DIFF_CODE/EDIT/FILE`: 使用 VSCode Diff 编辑器展示变更
- `ACCEPT_EDIT` / `BATCH_ACCEPT_EDIT`: 接受 AI 编辑（支持冲突检测）
- `REVERT_EDIT` / `BATCH_REVERT_EDIT`: 撤销编辑（新建文件则删除）
- `REAPPLY_EDIT` / `REAPPLY_REPLACE`: 重新应用编辑
- `BATCH_APPLY_CHANGES` / `APPLY_SINGLE_CHANGES`: 批量搜索替换应用

### REQ-6: Rules 管理
- `GET_RULES`: 扫描 `.codemaker/rules/*.mdc` 文件，解析 front-matter（description, alwaysApply, globs），返回带 `metaData` 的数组
- `CREATE_NEW_RULE`: 创建 `.mdc` 文件（含默认 front-matter），创建后自动刷新列表
- `UPDATE_RULE` / `DELETE_RULE`: 更新/删除后自动刷新列表
- 额外加载 `.codemaker.codebase.md` 特殊文件

### REQ-7: MCP 配置管理
- `GET_MCP_SERVERS`: 读取 `.codemaker/mcp_settings.json`，转换为前端格式（`{ servers: [...] }`）
- `ADD/UPDATE/REMOVE_MCP_SERVERS`: 修改配置文件后自动刷新列表
- `OPEM_MCP_SETTING`: 在 VSCode 编辑器中打开配置文件

### REQ-8: 工作区与诊断
- `GET_WORKSPACE_LIST`: 返回当前工作区文件夹列表
- `GET_WORKSPACE_PROBLEMS`: 返回 Error/Warning 级别的 lint 诊断信息

### REQ-9: 其他消息
- 可视化预览: `OPEN_MERMAID/PLANTUML/GRAPHVIZ/HTML`
- 日志: `CONSOLE_ERROR/LOG/WARN`
- 配置: `OPEN_EXTENSION_SETTING_AUTHORIZATION_PATH`, `EDIT_CODEBASE_RULES`
- 源码控制: `OPEN_SOURCE_CONTROL`

## Acceptance Criteria

- 所有已实现的消息类型不会导致前端卡住（loading 永远不结束）
- 未实现的消息类型返回 false 并打印日志，不会抛出异常
- Rules 列表正确显示（含 metaData.globs），创建/删除后自动刷新
- MCP 配置增删改查正常工作
