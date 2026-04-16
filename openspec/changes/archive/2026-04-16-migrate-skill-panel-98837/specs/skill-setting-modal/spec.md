## ADDED Requirements

### Requirement: Skill 配置对话框展示
系统 SHALL 提供 SkillSettingModal 对话框，用户可通过齿轮图标打开，展示已安装的 Skills 列表。

#### Scenario: 打开 SkillSettingModal
- **WHEN** 用户点击 Skills 工具条目旁的齿轮图标
- **THEN** 系统 SHALL 打开模态对话框，标题为「Skills 配置」，默认显示「已安装」Tab

#### Scenario: 隐藏「更多 Skills」Tab
- **WHEN** SkillSettingModal 对话框打开
- **THEN** 系统 SHALL 仅显示「已安装」Tab，不显示「更多 Skills」Tab（SkillHub 在线市场功能在 Y3Maker 中不可用）

### Requirement: 已安装 Skills 列表展示
SkillSettingModal 的「已安装」Tab SHALL 展示所有已加载的 skills，每个 skill 显示名称、描述、来源和启用状态。

#### Scenario: 展示 Skill 信息
- **WHEN** 「已安装」Tab 渲染
- **THEN** 每个 skill 条目 SHALL 显示：名称（优先 `display_name`）、描述（优先 `description_cn`）、来源标识（`source`）、启用/禁用开关

#### Scenario: 无已安装 Skills
- **WHEN** 系统未加载到任何 skill
- **THEN** 系统 SHALL 显示空状态提示

### Requirement: Skills 搜索过滤
SkillSettingModal SHALL 提供搜索功能，用户可按名称或描述过滤 skill 列表。

#### Scenario: 搜索匹配
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统 SHALL 实时过滤 skill 列表，仅显示名称或描述中包含关键词的 skills（不区分大小写）

#### Scenario: 搜索无结果
- **WHEN** 用户输入的关键词不匹配任何 skill
- **THEN** 系统 SHALL 显示「无匹配结果」提示

#### Scenario: 清空搜索
- **WHEN** 用户清空搜索框
- **THEN** 系统 SHALL 恢复显示所有 skills

### Requirement: Skill 启用/禁用切换
SkillSettingModal 中每个 skill 条目 SHALL 提供启用/禁用开关控件。

#### Scenario: 在对话框中启用 Skill
- **WHEN** 用户在 SkillSettingModal 中将某个 skill 的开关切换为启用
- **THEN** 系统 SHALL 更新 `skillConfigs` 中该 skill 的 `disabled` 为 `false`，通过 `UPDATE_SKILL_CONFIG` 消息同步到后端，且 SkillConfigCollapse 面板中对应的状态图标同步更新

#### Scenario: 在对话框中禁用 Skill
- **WHEN** 用户在 SkillSettingModal 中将某个 skill 的开关切换为禁用
- **THEN** 系统 SHALL 更新 `skillConfigs` 中该 skill 的 `disabled` 为 `true`，通过 `UPDATE_SKILL_CONFIG` 消息同步到后端

### Requirement: Skill 删除
SkillSettingModal SHALL 支持删除已安装的 skill 文件。

#### Scenario: 用户删除 Skill
- **WHEN** 用户点击某个 skill 条目的删除按钮并确认
- **THEN** 系统 SHALL 通过 `REMOVE_SKILL` 消息通知后端删除该 skill 文件，后端删除成功后刷新 skill 列表，UI 中移除该 skill 条目

#### Scenario: 删除确认
- **WHEN** 用户点击删除按钮
- **THEN** 系统 SHALL 弹出确认提示，防止误删

### Requirement: Skill 导入
SkillSettingModal SHALL 支持通过文件选择器导入 `.md` 或 `.zip` 格式的 skill 文件。

#### Scenario: 导入 .md 文件
- **WHEN** 用户点击「导入 Skill」按钮并选择一个 `.md` 文件
- **THEN** 系统 SHALL 读取文件内容，通过 `UPLOAD_SKILL` 消息发送给后端（包含文件名和 base64 编码的内容），后端保存成功后刷新 skill 列表

#### Scenario: 导入 .zip 文件
- **WHEN** 用户点击「导入 Skill」按钮并选择一个 `.zip` 文件
- **THEN** 系统 SHALL 读取文件内容，通过 `UPLOAD_SKILL` 消息发送给后端（包含文件名和 base64 编码的内容），后端解压并保存成功后刷新 skill 列表

#### Scenario: 导入文件格式不支持
- **WHEN** 用户选择了非 `.md` 和非 `.zip` 格式的文件
- **THEN** 系统 SHALL 拒绝导入并提示用户仅支持 `.md` 和 `.zip` 格式

### Requirement: 关闭对话框
用户 SHALL 可以通过关闭按钮或点击遮罩层关闭 SkillSettingModal。

#### Scenario: 关闭对话框
- **WHEN** 用户点击关闭按钮（×）或遮罩层
- **THEN** 系统 SHALL 关闭 SkillSettingModal 对话框，所有已做的配置变更已实时生效（无需额外保存）
