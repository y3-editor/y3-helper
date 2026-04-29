## ADDED Requirements

### Requirement: First-time auto-open
当 Y3Maker 面板从未被打开过时（`globalState['codemaker.everOpened']` 为 `undefined` 或 `false`），系统 SHALL 在 API Server 启动成功后自动执行 `codemaker.webview.focus` 弹出面板，并立即将 `codemaker.everOpened` 设为 `true`。

#### Scenario: 首次安装后打开项目
- **WHEN** 用户首次安装扩展后打开一个 Y3 项目
- **THEN** API Server 启动成功后，Y3Maker 面板自动弹出在 Secondary Sidebar 中

#### Scenario: everOpened 标记持久化
- **WHEN** 面板首次自动弹出成功
- **THEN** `globalState['codemaker.everOpened']` MUST 被设为 `true`，后续重启 VS Code 仍可读取到该值

### Requirement: Subsequent open respects VS Code layout restoration
当 `globalState['codemaker.everOpened']` 为 `true` 时，系统 SHALL NOT 主动执行任何弹出面板的命令。面板的可见性完全由 VS Code 原生的窗口布局恢复机制管理。

#### Scenario: 用户上次关闭了面板后重新打开项目
- **WHEN** 用户在上一次会话中手动关闭了 Secondary Sidebar，然后重新打开同一个项目
- **THEN** 系统不执行 `codemaker.webview.focus`，面板保持关闭状态（VS Code 恢复上次的布局）

#### Scenario: 用户上次面板是打开的后重新打开项目
- **WHEN** 用户在上一次会话中面板处于打开状态，然后重新打开同一个项目
- **THEN** 系统不执行 `codemaker.webview.focus`，面板由 VS Code 自动恢复为打开状态

### Requirement: Manual open command remains functional
`y3-helper.codemaker.open` 命令 SHALL 始终可用，执行时 MUST 调用 `codemaker.webview.focus` 弹出面板，不受 `everOpened` 标记影响。

#### Scenario: 用户通过菜单手动打开面板
- **WHEN** 用户点击主菜单中的"打开 Y3Maker"按钮
- **THEN** 面板立即弹出，无论 `everOpened` 的值是什么

### Requirement: Remove defunct userClosed mechanism
系统 SHALL NOT 包含 `setupDisposeListener` 函数、`codemaker.userClosed` globalState 的读写、以及 `y3-helper.codemaker.open` 命令中对 `codemaker.userClosed` 的重置逻辑。所有相关代码 MUST 被移除。

#### Scenario: 代码中不存在 userClosed 引用
- **WHEN** 代码审查 `src/codemaker/index.ts`
- **THEN** 文件中不包含字符串 `userClosed`、`setupDisposeListener` 函数定义、以及对 `codemaker.userClosed` 的任何 `globalState.get` 或 `globalState.update` 调用
