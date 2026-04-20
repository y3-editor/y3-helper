## Why

当前 `.y3maker` 目录（包含 skills、rules、mcp_settings 等配置）打包在 `y3-lualib` 仓库中，用户初始化 Y3 项目时会被复制到工程根目录。初始化后 `.y3maker` 与 lualib 仓库完全脱钩，官方更新 `.y3maker` 内容后用户无法获取更新，只能通过"新建图 → 初始化 → 搬到工程中"的方式手动更新，体验极差。

## What Changes

- **新建独立 Git 仓库 `y3-maker-config`**：将 `.y3maker` 内容从 `y3-lualib` 中剥离，建立 GitHub + Gitee 镜像仓库，官方控制提交权限，外部用户走 PR/MR
- **改造初始化流程**：初始化时除了 clone `y3-lualib`，额外 clone `y3-maker-config` 到 `.y3maker/` 目录，跟随用户选择的来源（Github/Gitee）
- **新增 Y3Maker 配置更新检测**：插件激活时后台执行 `git fetch`，比较本地 HEAD 与 `origin/main` 判断是否有更新；老用户（`.y3maker` 存在但无 `.git`）首次检测时自动备份 + clone 最新版本
- **新增更新 UI 节点**：在主菜单"打开 Y3Maker"节点上方新增"⬆ Y3Maker 配置需要更新！"子节点，仅版本落后时显示，风格与"编辑器需要更新！"一致
- **更新执行**：点击更新节点执行 `git pull`；无冲突时静默更新并重载 skills/rules/MCP；有冲突时弹框让用户选择"使用远端版本"（`git reset --hard origin/main`）或"自行解决"
- **清理 y3-lualib**：从 `y3-lualib` 仓库中删除 `.y3maker` 目录，移除初始化代码中 copy + delete `.y3maker` 的逻辑

## Capabilities

### New Capabilities
- `y3maker-config-update`: Y3Maker 配置版本检测与更新功能，包括 git fetch 检测、git pull 更新、冲突处理、老用户迁移、更新后资源重载

### Modified Capabilities
（无现有 spec 需要修改）

## Impact

- **src/extension.ts**: 初始化流程改造（新增 clone y3-maker-config 步骤，移除 copy/delete .y3maker 逻辑）
- **src/mainMenu/mainMenu.ts**: 在 `CodeMaker入口` 上方插入更新检测节点
- **src/mainMenu/pages/**: 新增 y3maker 配置更新相关的 TreeNode 页面
- **外部依赖**: 需要先创建 `y3-maker-config` GitHub/Gitee 仓库，并从 `y3-lualib` 中移除 `.y3maker` 目录
- **存量用户**: 老用户的 `.y3maker`（无 `.git`）会在首次检测时被备份为 `.y3maker.bak` 并替换为最新 clone
