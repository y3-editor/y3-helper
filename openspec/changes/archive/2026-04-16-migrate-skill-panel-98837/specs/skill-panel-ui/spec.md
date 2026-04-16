## ADDED Requirements

### Requirement: Skill 列表折叠面板渲染
系统 SHALL 在 ChatFunctionalToolbar 的 Skills 工具条目下方渲染一个可折叠的 Skill 列表面板（SkillConfigCollapse），展示当前已加载的所有 Skills。

#### Scenario: Skills 工具启用时显示折叠面板
- **WHEN** 用户将 Skills 工具设置为「启用」状态
- **THEN** 系统 SHALL 在 Skills 工具条目下方渲染 SkillConfigCollapse 组件，默认折叠显示前 3 个 skill

#### Scenario: Skills 工具禁用时隐藏折叠面板
- **WHEN** 用户将 Skills 工具设置为「关闭」状态
- **THEN** 系统 SHALL 隐藏 SkillConfigCollapse 组件，不渲染任何 skill 列表

#### Scenario: 无 Skill 时显示空状态
- **WHEN** 系统未加载到任何 skill
- **THEN** 系统 SHALL 不渲染 SkillConfigCollapse 组件，或显示空状态提示

### Requirement: Skill 列表项渲染
每个 Skill 列表项 SHALL 显示 skill 的启用状态图标、名称和独立的启用/禁用下拉控件。

#### Scenario: 已启用的 Skill 显示绿色勾号
- **WHEN** skill 的 `disabled` 配置为 `false` 或未设置
- **THEN** 系统 SHALL 在 skill 名称左侧显示绿色勾号图标（✓）

#### Scenario: 已禁用的 Skill 显示灰色叉号
- **WHEN** skill 的 `disabled` 配置为 `true`
- **THEN** 系统 SHALL 在 skill 名称左侧显示灰色叉号图标（✗）

#### Scenario: Skill 名称显示
- **WHEN** skill 有 `display_name` 字段
- **THEN** 系统 SHALL 优先显示 `display_name`，否则显示 `name`

### Requirement: 单个 Skill 启用/禁用控制
每个 Skill 列表项右侧 SHALL 提供独立的启用/禁用下拉控件，用户可单独控制每个 skill 的启用状态。

#### Scenario: 用户启用单个 Skill
- **WHEN** 用户将某个 skill 的下拉控件切换为「启用」
- **THEN** 系统 SHALL 调用 `setSkillConfig(name, { disabled: false })`，更新 UI 状态图标为绿色勾号，并通过 `UPDATE_SKILL_CONFIG` 消息同步到后端

#### Scenario: 用户禁用单个 Skill
- **WHEN** 用户将某个 skill 的下拉控件切换为「禁用」
- **THEN** 系统 SHALL 调用 `setSkillConfig(name, { disabled: true })`，更新 UI 状态图标为灰色叉号，并通过 `UPDATE_SKILL_CONFIG` 消息同步到后端

### Requirement: Skill 列表展开/收起
系统 SHALL 支持展开/收起完整的 skill 列表，默认折叠仅显示前 N 个 skill。

#### Scenario: 默认折叠状态
- **WHEN** Skill 列表首次渲染且 skill 数量超过 3 个
- **THEN** 系统 SHALL 仅显示前 3 个 skill，并在底部显示「展开」按钮

#### Scenario: 用户点击展开
- **WHEN** 用户点击「展开」按钮
- **THEN** 系统 SHALL 显示所有 skill，并将按钮文案变为「收起 ∧」

#### Scenario: 用户点击收起
- **WHEN** 用户点击「收起」按钮
- **THEN** 系统 SHALL 折叠列表回到仅显示前 3 个 skill

#### Scenario: Skill 数量不超过默认显示数
- **WHEN** skill 总数不超过 3 个
- **THEN** 系统 SHALL 显示所有 skill，不渲染展开/收起按钮

### Requirement: Skill 配置齿轮入口
系统 SHALL 在 Skills 工具条目旁提供一个齿轮图标按钮，点击后打开 SkillSettingModal 配置对话框。

#### Scenario: 点击齿轮图标
- **WHEN** 用户点击 Skills 工具条目旁的齿轮图标
- **THEN** 系统 SHALL 打开 SkillSettingModal 对话框
