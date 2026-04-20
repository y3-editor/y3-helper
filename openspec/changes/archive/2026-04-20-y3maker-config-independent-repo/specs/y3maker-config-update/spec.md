## ADDED Requirements

### Requirement: 初始化时 clone y3-maker-config 仓库
初始化 Y3 项目时，系统 SHALL 在 clone `y3-lualib` 之后，额外 clone `y3-maker-config` 仓库到工程根目录的 `.y3maker/` 目录，clone 来源 SHALL 跟随用户选择的 lualib 来源（Github / Gitee）。

#### Scenario: 新用户通过 Github 初始化
- **WHEN** 用户选择 Github 作为仓库来源并点击"初始化Y3库"
- **THEN** 系统先 clone `y3-lualib`，然后 clone `https://github.com/y3-editor/y3-maker-config.git` 到 `.y3maker/` 目录
- **THEN** `.y3maker/` 目录包含 `.git/` 子目录（是一个完整的 git 仓库）
- **THEN** 调用 `reloadCodemakerResources()` 重新加载 skills/rules/MCP

#### Scenario: 新用户通过 Gitee 初始化
- **WHEN** 用户选择 Gitee 作为仓库来源并点击"初始化Y3库"
- **THEN** 系统先 clone `y3-lualib`，然后 clone `https://gitee.com/shuizhisu/y3-maker-config.git` 到 `.y3maker/` 目录

#### Scenario: 初始化时不再从 y3-lualib 复制 .y3maker
- **WHEN** 初始化流程执行完成
- **THEN** 系统 SHALL NOT 执行从 `y3-lualib/.y3maker` 复制到工程根目录的逻辑
- **THEN** 系统 SHALL NOT 执行删除 `y3-lualib/.y3maker` 的逻辑

### Requirement: 插件激活时自动检测 y3maker-config 更新
插件激活时，系统 SHALL 在后台异步检测 `.y3maker` 仓库是否有远端更新，不阻塞插件激活流程。

#### Scenario: 检测到有更新
- **WHEN** 插件激活且 `.y3maker/.git` 存在
- **THEN** 系统在后台执行 `git fetch origin` 并比较本地 HEAD 与 `origin/main`
- **THEN** 如果两者不一致，缓存更新状态（包含本地 hash 和远端 hash）
- **THEN** 主菜单树视图中显示"Y3Maker 配置需要更新！"节点

#### Scenario: 检测到无更新
- **WHEN** 插件激活且本地 HEAD 与 `origin/main` 一致
- **THEN** 主菜单中不显示更新节点

#### Scenario: 网络不可达导致 fetch 失败
- **WHEN** 插件激活但 `git fetch` 因网络超时或其他原因失败
- **THEN** 系统 SHALL 静默跳过本次检测，不显示错误提示，不影响其他功能

### Requirement: 老用户自动迁移
当检测到 `.y3maker` 目录存在但不包含 `.git` 子目录时（存量老用户），系统 SHALL 自动执行迁移。

#### Scenario: 老用户首次检测
- **WHEN** 插件激活且 `.y3maker` 目录存在但 `.y3maker/.git` 不存在
- **THEN** 系统将 `.y3maker` 重命名为 `.y3maker.bak`
- **THEN** 系统 clone 最新的 `y3-maker-config` 到 `.y3maker/`
- **THEN** 调用 `reloadCodemakerResources()` 重新加载资源

#### Scenario: .y3maker.bak 已存在时的迁移
- **WHEN** 需要备份 `.y3maker` 但 `.y3maker.bak` 已存在
- **THEN** 系统 SHALL 覆盖已有的 `.y3maker.bak`

### Requirement: 一键更新 y3maker-config
用户点击更新节点时，系统 SHALL 执行 `git pull` 并处理结果。

#### Scenario: 更新成功（无冲突）
- **WHEN** 用户点击"Y3Maker 配置需要更新！"节点
- **THEN** 系统在 `.y3maker` 目录执行 `git pull origin main`
- **THEN** pull 成功后调用 `reloadCodemakerResources()` 重新加载 skills/rules/MCP
- **THEN** 刷新主菜单树视图，隐藏更新节点

#### Scenario: 更新失败（有冲突）
- **WHEN** `git pull` 因冲突失败（退出码非零或输出包含 "CONFLICT"）
- **THEN** 系统弹出提示框，包含两个选项：
  - "使用远端版本"：执行 `git merge --abort && git reset --hard origin/main`，然后 reload 资源
  - "自行解决"：提示用户在终端中手动处理冲突，系统不做进一步操作

#### Scenario: 选择使用远端版本
- **WHEN** 用户在冲突提示中选择"使用远端版本"
- **THEN** 系统执行 `git merge --abort` 和 `git reset --hard origin/main`
- **THEN** 调用 `reloadCodemakerResources()`
- **THEN** 刷新主菜单树视图，隐藏更新节点

### Requirement: 更新节点 UI 展示
主菜单中 SHALL 在"打开 Y3Maker"节点正上方显示更新提示节点，仅在检测到版本落后时可见。

#### Scenario: 有更新时的 UI 展示
- **WHEN** 检测到 `.y3maker` 有远端更新
- **THEN** 在主菜单"打开 Y3Maker"节点正上方显示"Y3Maker 配置需要更新！"节点
- **THEN** 节点使用 `cloud-download` 图标
- **THEN** 节点 description 显示 commit hash 缩写，格式为 `abc1234 → def5678`

#### Scenario: 无更新时隐藏节点
- **WHEN** 未检测到更新，或更新已完成
- **THEN** "Y3Maker 配置需要更新！"节点 SHALL NOT 显示

#### Scenario: 更新完成后节点消失
- **WHEN** 用户成功执行更新（无论是正常 pull 还是强制使用远端版本）
- **THEN** 更新节点立即从主菜单中隐藏
