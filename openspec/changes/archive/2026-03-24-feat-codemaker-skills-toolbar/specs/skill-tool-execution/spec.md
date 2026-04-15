## ADDED Requirements

### Requirement: use_skill 工具加载并返回 Skill 内容
系统 SHALL 在 AI 调用 `use_skill` 工具时，根据 `skill_name` 参数查找对应的 skill，加载其内容并返回 JSON 格式结果。

#### Scenario: 成功加载 skill
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 参数匹配已加载的某个 skill
- **THEN** 系统 SHALL 返回 JSON 字符串，包含 `name`（skill 名称）、`content`（skill 指令内容）、`source`（来源标识）、`path`（文件路径）字段，且 `isError` 为 `false`

#### Scenario: skill 不存在
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 参数不匹配任何已加载的 skill
- **THEN** 系统 SHALL 返回错误提示（`isError: true`），内容说明该 skill 不存在并列出可用的 skill 名称

#### Scenario: 未提供 skill_name 参数
- **WHEN** AI 调用 `use_skill` 工具，未提供 `skill_name` 参数或参数为空
- **THEN** 系统 SHALL 返回错误提示（`isError: true`），内容说明 `skill_name` 参数是必需的

### Requirement: use_skill 工具返回格式兼容前端解析
系统 SHALL 确保 `use_skill` 工具返回的 `content` 字段为 JSON 字符串，可被前端 `parseSkillToolResult` 正确解析。

#### Scenario: 前端解析返回结果
- **WHEN** 前端收到 `use_skill` 工具的 `TOOL_CALL_RESULT` 消息
- **THEN** `JSON.parse(result.content)` SHALL 得到包含 `name`（字符串）、`content`（字符串）、`source`（字符串）字段的对象

### Requirement: use_skill 工具动态获取最新 Skills
系统 SHALL 在每次 `use_skill` 被调用时重新从文件系统加载 skills（而非使用缓存），确保用户编辑 skill 文件后立即生效。

#### Scenario: 用户编辑 skill 文件后调用 use_skill
- **WHEN** 用户修改了 `.codemaker/skills/my-skill.md` 的内容，随后 AI 调用 `use_skill` 且 `skill_name` 为 `my-skill`
- **THEN** 系统 SHALL 返回修改后的最新内容
