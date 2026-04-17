## Context

当前 MCP Server 的启动链路：

```
activate() → Helper.start() → setTimeout(100ms) → startTCPServer(true)
                                                  → McpHub 在 WebView resolve 时初始化
```

问题：
1. `startTCPServer(true)` 在扩展激活时无条件调用，不检查 Y3 仓库是否已初始化。McpHub 初始化时读取 `.y3maker/mcp_settings.json`，文件不存在则自动创建空目录+空配置，干扰 `.codemaker → .y3maker` 迁移逻辑。
2. MCP 连接错误通过 `notifyCallback({ type: "SHOW_MCP_ERROR" })` 发送到 WebView，WebView 渲染为全屏模态弹窗（如截图所示），阻断用户操作且体验差。

现有初始化检测方式：`y3Uri/.git` 目录存在表示已初始化（`extension.ts:91`）。

## Goals / Non-Goals

**Goals:**
- MCP TCP Server 和 McpHub 仅在 Y3 仓库已初始化后才自动启动
- `initProject` 命令成功完成后立即启动 MCP Server
- 提供 MCP 内存缓存清理能力（清除 McpHub 连接缓存）
- MCP 错误提示统一改为 VSCode 原生 Toast 通知（右下角悬浮窗）

**Non-Goals:**
- 不改变 MCP Server 的核心连接/传输协议逻辑
- 不改变手动启动/停止 MCP 命令的行为（用户主动执行命令不受守卫限制）
- 不重构 WebView 中 MCP 面板的其他 UI 功能
- 不改变 MCP 配置文件的格式或校验逻辑

## Decisions

### D1: 初始化检测方法

**选择**: 复用现有的 `.git` 目录检测 + `README.md` 文件检测。

**逻辑**: `y3Uri/.git` 目录存在即视为仓库已初始化。

**理由**: 这是 `registerCommandOfInitProject` 中已使用的检测方式（`extension.ts:91`），语义清晰且可靠。`README.md` 检测（`extension.ts:152`）则用于确认 clone 成功，作为辅助判断。

**备选方案**:
- 检查 `.y3maker` 目录是否存在 → 不可靠，因为 McpHub 自动创建空 `.y3maker/mcp_settings.json` 就是本次要解决的问题
- 添加专用标志文件（如 `.y3maker/.initialized`）→ 过度设计，`.git` 已足够

**提取公共方法**: 在 `extension.ts` 的 `Helper` 类中新增 `isY3Initialized(): Promise<boolean>` 方法，统一检测逻辑，供自动启动和初始化命令复用。

### D2: 自动启动守卫位置

**选择**: 在 `Helper.start()` 的 `setTimeout` 回调中，`startTCPServer(true)` 前增加 `isY3Initialized()` 检查。

```typescript
setTimeout(async () => {
    this.checkNewProject();
    mainMenu.init();
    // 守卫：仅在仓库已初始化后自动启动 MCP Server
    if (!this.tcpServer && await this.isY3Initialized()) {
        await this.startTCPServer(true);
    }
    // ...其余初始化
}, 100);
```

**理由**: 改动最小，逻辑清晰，不影响其他初始化流程。

### D3: 初始化完成时启动 MCP

**选择**: 在 `registerCommandOfInitProject` 的成功路径末尾（`vscode.commands.executeCommand('vscode.openFolder')` 之前），调用 `startTCPServer(true)` 启动 MCP。

**注意**: `initProject` 执行成功后会调用 `vscode.openFolder` 重新加载窗口，此时扩展会重新激活。因此 MCP Server 在新窗口中会通过守卫检查（因为 `.git` 已存在）自动启动。额外在 initProject 中启动只是为了覆盖窗口未重载的边界情况。

### D4: 项目切换时 MCP 缓存自动清理

**核心场景**: 用户从项目 A 切换到项目 B 时，项目 A 的 MCP 连接缓存（`McpHub.connections` 中的 tools、resources 等内存数据）应被自动清理，然后根据项目 B 的 `.y3maker/mcp_settings.json` 重新初始化。

**选择**: 监听工作区变更事件，自动执行清理 + 重新初始化：
1. 监听 `vscode.workspace.onDidChangeWorkspaceFolders` 事件
2. 断开所有现有 `McpHub.connections`，清空数组
3. 通知 WebView 同步清空状态
4. 重新读取新项目的 `mcp_settings.json` 并初始化连接

**手动清理不新增命令**：已有 `y3-helper.stopMCPServer` / `y3-helper.startMCPServer` 和 McpHub 的 `restartAllConnections()` 可覆盖手动场景。

### D5: 错误提示改为 Toast 通知

**选择**: 将 McpHub 中所有 `notifyCallback({ type: "SHOW_MCP_ERROR" })` 调用替换为 `vscode.window.showErrorMessage()` / `vscode.window.showWarningMessage()`。

**改动点**:
- `mcpHandlers/index.ts` 中的 `notifyCallback({ type: "SHOW_MCP_ERROR" })` 调用 → 替换为 `vscode.window.showErrorMessage(friendlyMessage)`，不再向 WebView 发送 `SHOW_MCP_ERROR` 消息
- 保留 `SYNC_MCP_SERVERS` 同步通知（WebView 面板仍需显示连接状态）
- **WebView 前端的 MCP 错误弹窗组件代码保留不动**，仅后端不再发送 `SHOW_MCP_ERROR`，前端自然不会触发弹窗。保留前端代码以备后续复用

**理由**: `vscode.window.showErrorMessage` 是 VSCode 原生 Toast 通知，显示在右下角，不阻断用户操作，符合 VSCode UX 规范。

**备选方案**:
- 使用 `vscode.window.showInformationMessage` → 错误用 Error 级别更合适
- 保留 WebView 弹窗但改为非模态 → 需改前端代码量更大，且不如原生 Toast 体验好

## Risks / Trade-offs

- **[风险] 初始化检测误判**: 用户手动删除 `.git` 目录后 MCP 不会自动启动 → 用户可通过 `y3-helper.startMCPServer` 命令手动启动，影响极小
- **[风险] initProject 后窗口未重载**: 如果 `vscode.openFolder` 未触发（极端情况），MCP 需要在当前窗口中启动 → 已在 D3 中覆盖
- **[取舍] 移除 WebView 错误弹窗**: WebView 面板不再显示详细的 MCP 错误弹窗 → Toast 通知信息量较少，但对于连接错误已足够。详细错误可在 Output Channel 日志中查看
- **[取舍] 内存缓存清理**: 清理连接缓存后需要重新连接所有 MCP Server → 影响可控，用户主动触发或 Server 停止时才执行
