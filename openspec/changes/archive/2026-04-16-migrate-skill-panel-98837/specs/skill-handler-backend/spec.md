## ADDED Requirements

### Requirement: SkillsHandler 单例生命周期管理
系统 SHALL 提供 `SkillsHandler` 类作为 skill 管理的独立单例，负责 skill 的完整生命周期（加载、缓存、监听、同步、激活、安装、清理）。

#### Scenario: 获取单例实例
- **WHEN** 代码调用 `SkillsHandler.getInstance()`
- **THEN** 系统 SHALL 返回同一个 SkillsHandler 实例（单例模式）

#### Scenario: 初始化
- **WHEN** 调用 `initialize()` 方法
- **THEN** 系统 SHALL 加载所有来源的 skills、启动文件监听器、恢复 skillConfigs 持久化状态

#### Scenario: 销毁
- **WHEN** 调用 `dispose()` 方法
- **THEN** 系统 SHALL 清理所有 FileSystemWatcher 和轮询定时器，释放资源

### Requirement: 多来源 Skill 加载
系统 SHALL 从 8 个目录来源并行加载 skills，合并为统一列表。

#### Scenario: 加载所有来源
- **WHEN** 调用 `loadSkills()` 方法
- **THEN** 系统 SHALL 从以下 8 个路径加载 skills：`~/.y3maker/skills/`、`.y3maker/skills/`、`~/.codemaker/skills/`、`.codemaker/skills/`、`~/.claude/skills/`、`.claude/skills/`、`~/.agents/skills/`、`.agents/skills/`

#### Scenario: 部分来源目录不存在
- **WHEN** 某些来源目录不存在
- **THEN** 系统 SHALL 静默跳过不存在的目录，继续加载其他来源

#### Scenario: 同名 Skill 去重
- **WHEN** 多个来源目录中存在同名的 skill
- **THEN** 系统 SHALL 按来源优先级合并（项目级 > 用户级），优先级高的覆盖低的

#### Scenario: 支持单文件和目录型 Skill
- **WHEN** 来源目录下存在 `.md` 文件或包含 `index.md` 的子目录
- **THEN** 系统 SHALL 同时支持单文件型 skill（`skill-name.md`）和目录型 skill（`skill-name/index.md` + 可选 resources）

### Requirement: MdcParser 格式解析
系统 SHALL 使用 MdcParser 解析 skill 文件的 front-matter 元数据，替代旧的正则表达式解析。

#### Scenario: 解析标准 front-matter
- **WHEN** skill 文件包含 `---\nname: xxx\ndescription: xxx\n---\ncontent` 格式
- **THEN** 系统 SHALL 正确解析出 `name`、`description`、`content` 及其他 front-matter 字段

#### Scenario: 解析 user-invocable 字段
- **WHEN** skill 文件 front-matter 中包含 `user-invocable: true` 或 `user-invocable: false`
- **THEN** 系统 SHALL 将其映射为 `userInvocable` 布尔值字段

#### Scenario: 解析 description_cn 字段
- **WHEN** skill 文件 front-matter 中包含 `description_cn` 字段
- **THEN** 系统 SHALL 将其作为中文描述保留在 skill 对象中

#### Scenario: front-matter 格式异常
- **WHEN** skill 文件的 front-matter 格式异常或无法解析
- **THEN** 系统 SHALL 静默跳过该文件，记录警告日志，不影响其他 skill 加载

### Requirement: 文件系统监听与自动刷新
系统 SHALL 监听所有 skill 来源目录的文件变更，自动刷新 skill 列表。

#### Scenario: 文件新增触发刷新
- **WHEN** 用户在某个来源目录中新增了 `.md` 文件
- **THEN** 系统 SHALL 在 200ms 防抖延迟后自动重新加载 skills 并同步到前端

#### Scenario: 文件修改触发刷新
- **WHEN** 用户修改了某个 skill 文件的内容
- **THEN** 系统 SHALL 在 200ms 防抖延迟后自动重新加载 skills 并同步到前端

#### Scenario: 文件删除触发刷新
- **WHEN** 用户删除了某个 skill 文件
- **THEN** 系统 SHALL 在 200ms 防抖延迟后自动重新加载 skills 并同步到前端

#### Scenario: 轮询兜底机制
- **WHEN** FileSystemWatcher 事件未触发（某些文件系统不支持）
- **THEN** 系统 SHALL 每 5 秒轮询检查 skill 文件变更作为兜底

### Requirement: 目录型 Skill 资源文件管理
系统 SHALL 支持目录型 skill 的资源文件（resources），在 `use_skill` 激活时返回资源信息。

#### Scenario: 返回资源文件信息
- **WHEN** 激活一个目录型 skill（如 `skill-name/index.md` + `skill-name/resources/`）
- **THEN** 系统 SHALL 在返回结果中包含 `resources: { cwd: "<skill-dir-path>", files: ["file1.txt", "file2.json"] }`

#### Scenario: 单文件 Skill 无资源
- **WHEN** 激活一个单文件型 skill（如 `skill-name.md`）
- **THEN** 系统 SHALL 在返回结果中不包含 `resources` 字段或 `resources` 为 `undefined`

### Requirement: 后端消息处理 - UPDATE_SKILL_CONFIG
系统 SHALL 在收到 `UPDATE_SKILL_CONFIG` 消息时，更新 skill 配置并持久化。

#### Scenario: 更新 Skill 配置
- **WHEN** WebView 发送 `UPDATE_SKILL_CONFIG` 消息，data 包含 `{ name: string, disabled: boolean }`
- **THEN** 系统 SHALL 更新内存中的 skillConfigs，并通过 `context.globalState.update('skillConfigs', configs)` 持久化

#### Scenario: 启动时恢复配置
- **WHEN** SkillsHandler 初始化
- **THEN** 系统 SHALL 从 `context.globalState.get('skillConfigs')` 恢复之前保存的 skill 配置

### Requirement: 后端消息处理 - REMOVE_SKILL
系统 SHALL 在收到 `REMOVE_SKILL` 消息时，删除指定的 skill 文件。

#### Scenario: 删除单文件 Skill
- **WHEN** WebView 发送 `REMOVE_SKILL` 消息，data 包含 `{ skillName: string, path: string }`，且 path 指向一个 `.md` 文件
- **THEN** 系统 SHALL 删除该文件，返回 `REMOVE_SKILL_RESULT`（`success: true`），并自动刷新 skill 列表

#### Scenario: 删除目录型 Skill
- **WHEN** WebView 发送 `REMOVE_SKILL` 消息，data 中 path 指向一个目录型 skill
- **THEN** 系统 SHALL 递归删除该 skill 整个目录，返回 `REMOVE_SKILL_RESULT`（`success: true`）

#### Scenario: 删除失败
- **WHEN** 文件不存在或无权限删除
- **THEN** 系统 SHALL 返回 `REMOVE_SKILL_RESULT`（`success: false`，`error` 包含失败原因）

### Requirement: 后端消息处理 - UPLOAD_SKILL
系统 SHALL 在收到 `UPLOAD_SKILL` 消息时，将上传的文件保存到 skill 目录。

#### Scenario: 上传 .md 文件
- **WHEN** WebView 发送 `UPLOAD_SKILL` 消息，data 包含 `{ fileName: "skill.md", content: "<base64>" }`
- **THEN** 系统 SHALL 将 base64 解码后的内容保存为 `.y3maker/skills/<fileName>`，返回 `UPLOAD_SKILL_RESULT`（`success: true`），并自动刷新 skill 列表

#### Scenario: 上传 .zip 文件
- **WHEN** WebView 发送 `UPLOAD_SKILL` 消息，data 包含 `{ fileName: "skill.zip", content: "<base64>" }`
- **THEN** 系统 SHALL 使用 jszip 解压 base64 内容，将解压后的文件保存到 `.y3maker/skills/` 目录，返回 `UPLOAD_SKILL_RESULT`（`success: true`），并自动刷新 skill 列表

#### Scenario: 重复文件处理
- **WHEN** 上传的文件与已存在的 skill 同名
- **THEN** 系统 SHALL 覆盖已存在的文件

### Requirement: Skill 列表同步到前端
系统 SHALL 支持将当前加载的 skill 列表同步到指定的 WebView 面板。

#### Scenario: 主动同步
- **WHEN** 调用 `syncSkills(panelId?)` 方法
- **THEN** 系统 SHALL 向指定面板（或所有面板）发送 `SYNC_SKILLS` 消息，data 为当前完整的 skill 列表数组

#### Scenario: 文件变更后自动同步
- **WHEN** 文件监听检测到 skill 文件变更并完成重新加载
- **THEN** 系统 SHALL 自动调用 `syncSkills()` 将更新后的列表同步到所有前端面板
