## Why

Y3Maker 面板（注册在 VS Code Secondary Sidebar）在每次打开仓库时都会自动弹出，即使用户上次已手动关闭。现有的 `codemaker.userClosed` 状态追踪机制完全失效：`onDidDispose` 在 `retainContextWhenHidden: true` 配置下不会在用户关闭 sidebar 时触发，且 `setupDisposeListener` 存在 2 秒竞态导致事件监听可能永远注册不上。用户反馈 100% 复现，每次打开项目都被强制弹出面板，体验很差。

## What Changes

- **移除失效的 `userClosed` 状态追踪机制**：删除 `setupDisposeListener` 函数及 `codemaker.userClosed` 相关的 `globalState` 读写逻辑
- **改为"仅首次自动弹出"策略**：引入 `codemaker.everOpened` globalState 标记，仅在该标记为 `false`/不存在时执行 `codemaker.webview.focus`，弹出后立即设置为 `true`
- **后续打开完全交给 VS Code 布局恢复**：VS Code 本身会记住并恢复 Secondary Sidebar 的开关状态和当前显示的 view，不再主动干预

## Capabilities

### New Capabilities
- `y3maker-panel-auto-open`: Y3Maker 面板首次自动弹出与后续状态保持策略，包括首次检测逻辑、globalState 标记管理、与 VS Code 原生布局恢复的协作

### Modified Capabilities
（无现有 spec 需要修改）

## Impact

- **src/codemaker/index.ts**: 主要改动文件，修改 `startApiServer` 中的自动弹出判断逻辑，删除 `setupDisposeListener` 函数
- **globalState key 变更**: 新增 `codemaker.everOpened`，废弃 `codemaker.userClosed`（旧 key 无需清理，VS Code 自动忽略未使用的 globalState）
- **用户行为变化**: 首次安装/首次打开项目时面板自动弹出；之后完全由用户手动控制，VS Code 负责恢复布局状态
- **风险**: 极低。改动仅涉及 ~10 行代码，核心逻辑从"每次判断是否弹出"简化为"只弹一次"
