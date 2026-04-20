## 1. 新增核心模块 `src/y3makerConfig.ts`

- [x] 1.1 创建 `src/y3makerConfig.ts` 模块，定义 `getConfigRepoUrl(source: 'github' | 'gitee'): string` 函数，返回对应的 `y3-maker-config` 仓库地址
- [x] 1.2 实现 `checkForUpdates(projectUri): Promise<{ hasUpdate, localHash, remoteHash } | null>`，在 `.y3maker` 目录执行 `git fetch origin --quiet` + `git rev-parse HEAD` vs `git rev-parse origin/main`，fetch 失败时返回 null（静默跳过）
- [x] 1.3 实现 `migrateOldUser(projectUri): Promise<void>`，检测 `.y3maker` 存在但无 `.git` 时，重命名为 `.y3maker.bak`（已有则覆盖），然后 clone 最新 `y3-maker-config`
- [x] 1.4 实现 `performUpdate(projectUri): Promise<{ success: boolean, conflict: boolean }>`，执行 `git pull origin main`，检测冲突（退出码非零或输出含 "CONFLICT"），返回结果
- [x] 1.5 实现 `forceRemoteUpdate(projectUri): Promise<void>`，执行 `git merge --abort && git reset --hard origin/main`

## 2. 改造初始化流程 (`src/extension.ts`)

- [x] 2.1 在初始化流程中（用户选择 Github/Gitee 后，clone y3-lualib 之后），新增 clone `y3-maker-config` 到 `.y3maker/` 目录的步骤，来源跟随用户的 lualib 选择
- [x] 2.2 移除现有 `extension.ts` L187-200 中从 `y3-lualib/.y3maker` 复制到工程根目录并删除源目录的逻辑

## 3. 插件激活时后台检测更新 (`src/extension.ts`)

- [x] 3.1 在插件 activate 流程中（mapReady 之后），后台异步调用 `checkForUpdates()`，先检测是否需要老用户迁移（调用 `migrateOldUser`），然后执行版本比较
- [x] 3.2 将检测结果缓存为模块级变量（导出），供主菜单树视图渲染时读取
- [x] 3.3 检测完成后触发主菜单树视图刷新，使更新节点根据缓存状态显示/隐藏

## 4. 更新 UI 节点 (`src/mainMenu/`)

- [x] 4.1 新建 `src/mainMenu/pages/y3makerConfigUpdate.ts`，创建更新提示 TreeNode，使用 `cloud-download` 图标，description 显示 `localHash短 → remoteHash短`，`show` 根据缓存的更新状态返回 true/false
- [x] 4.2 在 `src/mainMenu/mainMenu.ts` 的 `childs` 数组中，在 `new CodeMaker入口` 之前插入更新节点
- [x] 4.3 注册命令 `y3-helper.updateY3MakerConfig`，绑定到更新节点的 `command`，执行更新逻辑

## 5. 更新执行与冲突处理

- [x] 5.1 在 `y3-helper.updateY3MakerConfig` 命令处理中，调用 `performUpdate()`，成功时调用 `webviewProvider.reloadCodemakerResources()` 并刷新树视图、清除缓存的更新状态
- [x] 5.2 pull 冲突时弹出 `vscode.window.showWarningMessage` 提供"使用远端版本"和"自行解决"两个选项
- [x] 5.3 用户选择"使用远端版本"时调用 `forceRemoteUpdate()`，然后 reload 资源并刷新树视图；选择"自行解决"时提示用户在终端中手动处理

## 6. 外部仓库操作（人工步骤）

- [x] 6.1 在 GitHub 上创建 `y3-editor/y3-maker-config` 公开仓库
- [x] 6.2 将现有 `y3-lualib/.y3maker` 内容作为初始提交推送到 `y3-maker-config` 仓库
- [x] 6.3 在 Gitee 上通过"从 GitHub 导入"创建 `shuizhisu/y3-maker-config` 镜像仓库，开启自动同步
- [x] 6.4 从 `y3-lualib` 仓库中删除 `.y3maker` 目录并提交
