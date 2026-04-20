## Context

当前 `.y3maker` 目录（skills、rules、mcp_settings.json）嵌套在 `y3-lualib` 仓库中，初始化时被复制到工程根目录后就与上游脱钩。用户无法获取官方更新，只能通过重新初始化新图来解决。

现有初始化流程（`src/extension.ts` L120-200）：
1. `git clone y3-lualib` → `y3/`
2. `vscode.workspace.fs.copy(y3Uri/.y3maker, projectUri/.y3maker)`
3. `vscode.workspace.fs.delete(y3Uri/.y3maker)`
4. `reloadCodemakerResources()`

现有的 `reloadCodemakerResources()`（`webviewProvider.ts` L1345）已支持重新加载 rules/skills/MCP，更新后可直接复用。

## Goals / Non-Goals

**Goals:**
- `.y3maker` 内容独立为 `y3-maker-config` 仓库，通过 git 管理版本
- 初始化时自动 clone `y3-maker-config` 到 `.y3maker/`
- 插件激活时自动检测 `.y3maker` 是否有远端更新
- 提供一键更新 UI，冲突时给用户选择权
- 存量老用户（无 `.git` 的 `.y3maker`）自动迁移

**Non-Goals:**
- 不做 `.y3maker` 内容的增量/选择性更新（不区分官方文件和用户文件，由 git merge 自然处理）
- 不做多分支支持（仅 main 分支）
- 不做定时轮询检测（仅激活时检测一次）

## Decisions

### D1: `.y3maker` 作为独立 git 仓库存在于工程目录

**选择**: `.y3maker/` 目录本身就是一个完整的 git 仓库（含 `.y3maker/.git/`）

**备选方案**:
- A. 版本号文件 + HTTP 下载 — 轻量但需要额外的版本管理基础设施
- B. npm 包分发 — 过重，不适合配置文件的分发场景

**理由**: Git 天然提供版本追踪、增量更新、冲突检测，且用户已有 git 环境（初始化 y3-lualib 就需要 git）。用户自定义的 skills/rules 修改会被 git 自动跟踪，pull 时自然合并。

### D2: 更新检测使用 `git fetch` + HEAD 比较

**方式**:
```
cd .y3maker
git fetch origin --quiet
git rev-parse HEAD  vs  git rev-parse origin/main
```

**时机**: 插件激活时（`extension.ts` activate 阶段），后台异步执行，不阻塞激活流程。结果缓存为模块级变量，供树视图渲染时读取。

**对于无 `.git` 的老用户**: 检测时发现 `.y3maker` 存在但无 `.git` 子目录，自动执行备份 + clone 流程，等价于"有更新"。

### D3: 更新执行策略 — git pull + 冲突降级

**正常路径**:
```
cd .y3maker && git pull origin main
```
- 成功（无冲突）→ 调用 `reloadCodemakerResources()` → 刷新树视图 → 隐藏更新节点

**冲突路径**:
- `git pull` 返回非零退出码或输出包含 "CONFLICT"
- 弹框提示用户，提供两个选项：
  - **使用远端版本**: `git merge --abort && git reset --hard origin/main` → reload
  - **自行解决**: 提示用户在终端中手动处理冲突，不做进一步操作

### D4: 初始化流程改造

**新流程**:
1. 用户选择来源（Github / Gitee）— 沿用现有选择逻辑
2. `git clone y3-lualib` → `y3/`（lualib 仓库中已不包含 `.y3maker`）
3. `git clone y3-maker-config` → `.y3maker/`（跟随来源选择）
4. `reloadCodemakerResources()`

**仓库地址**:
```
GitHub: https://github.com/y3-editor/y3-maker-config.git
Gitee:  https://gitee.com/shuizhisu/y3-maker-config.git
```

**变更**: 移除现有 `extension.ts` 中 copy + delete `.y3maker` 的逻辑（L187-200），替换为 clone 步骤。

### D5: UI 节点位置 — 主菜单顶层，紧挨 CodeMaker入口 上方

**位置**: `mainMenu.ts` 的 `childs` 数组中，在 `new CodeMaker入口` 之前插入更新节点

**行为模式**（参考现有 "编辑器需要更新！" 节点 `features.ts` L129-157）:
- `show`: 仅当检测到版本落后时返回 `true`
- `iconPath`: `new vscode.ThemeIcon('cloud-download')`
- `description`: 显示 commit hash 缩写 `abc1234 → def5678`
- `command`: 注册新命令 `y3-helper.updateY3MakerConfig`，执行更新逻辑

### D6: 新增模块 `src/y3makerConfig.ts`

将版本检测、更新执行、老用户迁移逻辑集中在一个独立模块中：

```
src/y3makerConfig.ts
  ├── checkForUpdates()     → { hasUpdate, localHash, remoteHash }
  ├── performUpdate()       → { success, conflict }
  ├── migrateOldUser()      → backup + clone
  └── getConfigRepoUrl()    → 根据 lualib 来源返回对应地址
```

**理由**: 更新逻辑独立于 `extension.ts` 和 `mainMenu`，便于测试和维护。`extension.ts` 激活时调用 `checkForUpdates()`，mainMenu 节点调用 `performUpdate()`。

## Risks / Trade-offs

- **[网络不可达]**
