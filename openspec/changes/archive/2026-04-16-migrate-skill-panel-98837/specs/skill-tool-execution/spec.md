## MODIFIED Requirements

### Requirement: use_skill 工具加载并返回 Skill 内容
系统 SHALL 在 AI 调用 `use_skill` 工具时，根据 `skill_name` 参数查找对应的 skill，加载其内容并返回 JSON 格式结果。参数支持单个字符串或字符串数组。

#### Scenario: 成功加载单个 skill
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 为字符串且匹配已加载的某个 skill
- **THEN** 系统 SHALL 返回 JSON 字符串，包含 `name`（skill 名称）、`content`（skill 指令内容）、`source`（来源标识）、`path`（文件路径）字段，目录型 skill 额外包含 `resources: { cwd, files }` 字段，且 `isError` 为 `false`

#### Scenario: 成功加载多个 skill
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 为字符串数组且所有名称均匹配已加载的 skill
- **THEN** 系统 SHALL 返回 JSON 数组字符串，数组中每个元素包含对应 skill 的 `name`、`content`、`source`、`path`（及可选的 `resources`）字段，且 `isError` 为 `false`

#### Scenario: 数组中部分 skill 不存在
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 为数组但其中某些名称不匹配任何已加载的 skill
- **THEN** 系统 SHALL 返回成功加载的 skill 结果数组，并在数组中为不存在的 skill 包含错误信息条目

#### Scenario: skill 不存在
- **WHEN** AI 调用 `use_skill` 工具，`skill_name` 参数不匹配任何已加载的 skill
- **THEN** 系统 SHALL 返回错误提示（`isError: true`），内容说明该 skill 不存在并列出可用的 skill 名称

#### Scenario: 未提供 skill_name 参数
- **WHEN** AI 调用 `use_skill` 工具，未提供 `skill_name` 参数或参数为空
- **THEN** 系统 SHALL 返回错误提示（`isError: true`），内容说明 `skill_name` 参数是必需的

### Requirement: use_skill 工具返回格式兼容前端解析
系统 SHALL 确保 `use_skill` 工具返回的 `content` 字段为 JSON 字符串，可被前端 `parseSkillToolResult` 正确解析，兼容单个对象和数组格式。

#### Scenario: 前端解析单个 skill 返回结果
- **WHEN** 前端收到 `use_skill` 工具的 `TOOL_CALL_RESULT` 消息且结果为单个 skill
- **THEN** `JSON.parse(result.content)` SHALL 得到包含 `name`（字符串）、`content`（字符串）、`source`（字符串）字段的对象

#### Scenario: 前端解析多 skill 返回结果
- **WHEN** 前端收到 `use_skill` 工具的 `TOOL_CALL_RESULT` 消息且结果为多个 skill
- **THEN** `JSON.parse(result.content)` SHALL 得到对象数组，`Array.isArray(parsed)` 为 `true`，每个元素包含 `name`、`content`、`source` 字段

### Requirement: use_skill 工具动态获取最新 Skills
系统 SHALL 通过 SkillsHandler 的缓存 + 文件监听机制获取 skills，确保返回最新内容。

#### Scenario: 用户编辑 skill 文件后调用 use_skill
- **WHEN** 用户修改了某个 skill 文件的内容，FileSystemWatcher 检测到变更并触发 SkillsHandler 重新加载，随后 AI 调用 `use_skill` 且 `skill_name` 匹配该 skill
- **THEN** 系统 SHALL 返回修改后的最新内容

## ADDED Requirements

### Requirement: use_skill 工具参数 Schema 支持数组
前端 `toolsEN.ts` 中 `use_skill` 工具的 `skill_name` 参数 SHALL 使用 `oneOf` schema 同时支持字符串和字符串数组。

#### Scenario: 工具定义包含 oneOf schema
- **WHEN** 前端构建 `use_skill` 工具的 JSON Schema
- **THEN** `skill_name` 参数 SHALL 使用 `oneOf: [{ type: 'string', enum: skillNames }, { type: 'array', items: { type: 'string', enum: skillNames }, minItems: 1 }]`

#### Scenario: 仅已启用的 Skill 出现在 enum 中
- **WHEN** 前端构建 `use_skill` 工具的 `skill_name` 参数枚举值
- **THEN** 系统 SHALL 仅包含 `isSkillEnabled(name)` 返回 `true` 的 skill 名称，被禁用的 skill 不出现在 enum 中

### Requirement: use_skill 返回包含资源文件信息
`use_skill` 工具返回的结果 SHALL 对目录型 skill 包含资源文件信息。

#### Scenario: 目录型 skill 返回资源
- **WHEN** 激活一个目录型 skill
- **THEN** 返回结果 SHALL 额外包含 `resources: { cwd: string, files: string[] }` 字段

#### Scenario: 单文件 skill 不返回资源
- **WHEN** 激活一个单文件型 skill
- **THEN** 返回结果 SHALL 不包含 `resources` 字段
