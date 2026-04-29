## Context

Y3Maker 面板以 `WebviewViewProvider` 形式注册在 VS Code Secondary Sidebar 中（`package.json` 声明 `viewsContainers.secondarySidebar`），view type 为 `codemaker.webview`，注册时启用了 `retainContextWhenHidden: true`。

当前自动弹出逻辑位于 `src/codemaker/index.ts`：
- `startApiServer()` 在 API Server 启动成功后，读取 `globalState['codemaker.userClosed']`，若为 `false`（默认值）则执行 `codemaker.webview.focus` 弹出面板
- `setupDisposeListener()` 尝试在面板 dispose 时将 `codemaker.userClosed` 设为 `true`，但由于 `retainContextWhenHidden: true` 导致关闭 sidebar 不触发 dispose，加上 2 秒 `setTimeout` 竞态，该监听 100% 失效

VS Code 本身具备窗口布局恢复能力——重新打开同一 workspace 时会自动恢复 Secondary Sidebar 的开关状态和当前显示的 view。当前的 `.focus()` 调用实际上在干扰这一原生行为。

## Goals / Non-Goals

**Goals:**
- 首次安装/首次打开项目时自动弹出 Y3Maker 面板，提供开箱即用体验
- 后续打开项目时尊重用户上次的面板状态（开/关），由 VS Code 原生布局恢复接管
- 移除所有失效的状态追踪代码，简化逻辑

**Non-Goals:**
- 不做 per-workspace 的面板状态追踪（`globalState` 是全局的，且 VS Code 的布局恢复本身已 per-window）
- 不处理"打开 Y3Maker"按钮的行为（`y3-helper.codemaker.open` 命令保持不变）
- 不修改 `retainContextWhenHidden` 配置（它对面板性能有正面作用）

## Decisions

### Decision 1：用 `codemaker.everOpened` 替代 `codemaker.userClosed`

**选择**：引入一个只写一次的 `globalState` 标记 `codemaker.everOpened`，初始值为 `undefined`（等同 `false`），首次弹出后设为 `true`，永不回退。

**替代方案**：
- **继续修复 `userClosed` 机制**（用 `onDidChangeVisibility` 替代 `onDidDispose`）：虽然技术可行，但引入了不必要的状态同步复杂度。VS Code 已经在做布局恢复，再自己维护一套 visible 状态是重复劳动。
- **完全移除自动弹出**：首次用户没有引导体验，需要手动找到 Y3Maker 面板，对新用户不友好。

**理由**：`everOpened` 是一个单调递增标记（false → true），不存在状态回退或同步问题，逻辑极其简单且不可能出 bug。

### Decision 2：在 API Server 就绪后再弹出面板（保持不变）

**选择**：保持现有的"API Server 启动成功后再执行 focus"的时序，只修改弹出条件。

**理由**：如果在 API Server 就绪前弹出面板，iframe 会加载失败显示"请重新连接"。这个时序约束与本次修改正交，应保留。

### Decision 3：删除 `setupDisposeListener` 函数和 `codemaker.userClosed` 相关代码

**选择**：完全删除失效代码，而非尝试修复。

**理由**：`setupDisposeListener` 的整个前提（通过 `onDidDispose` 检测用户关闭面板）在 `retainContextWhenHidden: true` 的 Secondary Sidebar 中不成立。修复它不如直接移除，让 VS Code 的原生布局恢复来处理。

## Risks / Trade-offs

- **[Risk] VS Code 布局恢复偶尔失效** → 如果 VS Code 未能恢复 Secondary Sidebar 状态（如 settings sync 冲突、workspace 首次打开等），面板可能不会自动弹出。但这种情况用户可以通过主菜单"打开 Y3Maker"按钮手动打开，影响极小。

- **[Risk] `globalState` 是全局的，跨 workspace 共享** → `codemaker.everOpened` 设为 `true` 后，所有 workspace 的首次打开都不会再自动弹出。这是可接受的：用户只需被引导一次知道 Y3Maker 面板在哪里即可。

- **[Trade-off] "打开 Y3Maker" 命令中的 `userClosed = false` 写入需要同步清理** → 当前 `y3-helper.codemaker.open` 命令执行时会写 `globalState.update('codemaker.userClosed', false)`，移除 `userClosed` 机制后该行也需删除。命令本身的 `focus` 行为保持不变。
