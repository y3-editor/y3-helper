## Architecture

### 消息处理架构

```
WebView (iframe)
  ↓ window.parent.postMessage()
Bridge Script (WebView HTML 内嵌)
  ↓ vscode.postMessage()
Extension (webviewProvider.ts)
  ↓ _handleMessage()
  ├─ 基础消息 (GET_INIT_DATA, COPY_TO_CLIPBOARD 等) → 直接处理
  ├─ 文件搜索 (GET_WORKSPACE_FILES, SEARCH_WORKSPACE_PATH) → _searchWorkspaceFiles()
  ├─ 工具调用 (TOOL_CALL) → _handleToolCall()
  └─ 扩展消息 (default) → handleExtendedMessage() [messageHandlers.ts]
       ├─ 编辑器操作: INSERT_TO_EDITOR, OPEN_FILE, GET_EDITOR_FILE_STATE
       ├─ 文件操作: CREATE_FILE_AND_INSERT_CODE, EXPORT_FILE, LOAD_DIRECTORY_FILES
       ├─ 终端操作: INSERT_TERMINAL, STOP_ALL_TERMINAL, SHOW_TERMINAL_WINDOW
       ├─ Diff/Apply: PREVIEW_DIFF_*, ACCEPT_EDIT, BATCH_ACCEPT_EDIT, REVERT_EDIT
       ├─ Rules: GET_RULES, CREATE_NEW_RULE, UPDATE_RULE, DELETE_RULE
       ├─ MCP: GET_MCP_SERVERS, ADD/UPDATE/REMOVE_MCP_SERVERS, OPEM_MCP_SETTING
       ├─ 可视化: OPEN_MERMAID, OPEN_PLANTUML, OPEN_HTML
       └─ 其他: 日志、配置、工作区信息等
```

### API Server 端口重试机制

```
apiServer.start()
  → _tryStartOnPort(serverEntry, env, 3001, 100)
       ├─ fork 子进程
       ├─ 监听 stderr → 检测 EADDRINUSE
       │   → kill 子进程 → _tryStartOnPort(..., 3002, 99)  // 递归
       ├─ 监听 exit(非零) → 递归下一端口
       └─ 3秒超时无错误 → 认为启动成功, resolve(port)
```

## Key Decisions

| 决策 | 选择 | 原因 |
|------|------|------|
| 消息处理器位置 | 独立 `messageHandlers.ts` 文件 | 保持 `webviewProvider.ts` 整洁，单一职责 |
| TOOL_CALL 实现 | Extension 本地执行 | 源码版也是 Extension 端执行，非 API Server |
| Rules 文件格式 | `.mdc` + front-matter | 与源码版完全兼容 |
| MCP 配置路径 | `.codemaker/mcp_settings.json` | 项目级配置，便于版本控制 |
| API Server 端口策略 | 监听 stderr + exit 事件自动重试 | 比 TCP 探测更可靠，无时间窗口竞争 |
| `SYNC_RULES` 数据格式 | `data: []`（数组） | 前端 `setRules(data)` 直接使用，不能套对象 |
| Rule metaData | `{ description, alwaysApply, globs }` | 前端渲染组件直接访问 `metaData.globs` |

## Dependencies

- 无新增外部依赖
- 使用 Node.js 内置 `fs`、`path` 模块
- 使用 VSCode API: `workspace.findFiles`、`languages.getDiagnostics`、`window.createTerminal` 等
