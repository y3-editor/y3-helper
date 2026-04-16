## MODIFIED Requirements

### Requirement: 从项目目录加载 Skills 列表
系统 SHALL 在收到 `GET_SKILLS` 消息时，通过 `SkillsHandler` 从所有来源目录加载 skills，返回 skill 列表给前端。每个 skill 对象 SHALL 包含扩展字段以支持独立配置管理。

#### Scenario: 项目目录存在 skill 文件
- **WHEN** WebView 发送 `GET_SKILLS` 消息，且任一来源目录下存在合法的 skill 文件
- **THEN** 系统 SHALL 返回 `SYNC_SKILLS` 消息，data 为包含所有 skill 对象的数组，每个对象包含 `name`、`display_name`（可选）、`description`、`description_cn`（可选）、`content`、`source`、`path`、`userInvocable`（可选）、`disabled`（可选）字段

#### Scenario: 所有来源目录不存在或为空
- **WHEN** WebView 发送 `GET_SKILLS` 消息，且所有 8 个来源目录均不存在或为空
- **THEN** 系统 SHALL 返回 `SYNC_SKILLS` 消息，data 为空数组 `[]`

#### Scenario: skill 文件解析失败
- **WHEN** 来源目录下存在格式异常的 `.md` 文件（如 front-matter 缺失或字段缺失）
- **THEN** 系统 SHALL 静默跳过该文件，不影响其他 skill 文件的正常加载

### Requirement: Skill 文件 front-matter 格式
系统 SHALL 使用 MdcParser 支持以下 front-matter 格式的 `.md` 文件作为 skill 定义，并支持扩展字段：

```
---
name: <skill-name>
description: <skill-description>
description_cn: <optional-chinese-description>
user-invocable: <true|false>
---
<content>
```

#### Scenario: 完整 front-matter
- **WHEN** skill 文件包含 `name` 和 `description` 字段的 front-matter
- **THEN** 系统 SHALL 使用 MdcParser 解析，`name` 作为 skill 名称，`description` 作为描述，front-matter 后的内容作为 `content`

#### Scenario: front-matter 缺少 name 字段
- **WHEN** skill 文件的 front-matter 中没有 `name` 字段
- **THEN** 系统 SHALL 使用文件名（不含 `.md` 扩展名）作为 skill 名称

#### Scenario: front-matter 缺少 description 字段
- **WHEN** skill 文件的 front-matter 中没有 `description` 字段
- **THEN** 系统 SHALL 使用空字符串作为描述

#### Scenario: user-invocable 字段
- **WHEN** skill 文件 front-matter 中包含 `user-invocable: true`
- **THEN** 系统 SHALL 将 `userInvocable` 字段设置为 `true`，标识该 skill 可被用户直接调用

### Requirement: 安装内置 Skill
系统 SHALL 在收到 `INSTALL_BUILTIN_SKILL` 消息时，从指定 URL 下载 skill 内容，保存到 `.y3maker/skills/` 目录，支持 .md 和 .zip 格式。

#### Scenario: 成功安装 .md 格式内置 skill
- **WHEN** WebView 发送 `INSTALL_BUILTIN_SKILL` 消息，data 中包含 `skillName` 和 `downloadUrl`，且 HTTP 请求成功返回 .md 内容
- **THEN** 系统 SHALL 将下载的内容保存为 `.y3maker/skills/<skillName>.md`，返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`success: true`，`skillName`，`installPath`），并自动刷新 skills 列表

#### Scenario: 成功安装 .zip 格式内置 skill
- **WHEN** 下载的内容为 .zip 格式
- **THEN** 系统 SHALL 使用 jszip 解压，将解压后的文件保存到 `.y3maker/skills/<skillName>/` 目录

#### Scenario: 下载失败
- **WHEN** HTTP 请求失败或超时
- **THEN** 系统 SHALL 返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`success: false`，`error` 包含失败原因）

#### Scenario: 重复安装检查
- **WHEN** `.y3maker/skills/<skillName>.md` 或 `.y3maker/skills/<skillName>/` 已存在
- **THEN** 系统 SHALL 覆盖写入新内容

## ADDED Requirements

### Requirement: skillConfigs 独立配置状态管理
前端 `useSkillsStore` SHALL 维护 `skillConfigs: Record<string, SkillConfig>` 状态，支持每个 skill 的独立启用/禁用配置。

#### Scenario: 初始化 skillConfigs
- **WHEN** Store 初始化
- **THEN** `skillConfigs` SHALL 默认为空对象 `{}`，所有 skill 默认启用

#### Scenario: 设置单个 Skill 配置
- **WHEN** 调用 `setSkillConfig(name, { disabled: true })`
- **THEN** 系统 SHALL 更新 `skillConfigs[name]` 为 `{ name, disabled: true }`，并通过 PostMessage 发送 `UPDATE_SKILL_CONFIG` 消息到后端

#### Scenario: 查询 Skill 是否启用
- **WHEN** 调用 `isSkillEnabled(name)`
- **THEN** 若 `skillConfigs[name]?.disabled === true` 则返回 `false`，否则返回 `true`

### Requirement: 多 Skill 激活模式
前端 `useSkillPromptApp` SHALL 从单 runner 模式升级为 Map-based 多 Skill 模式，支持多个 Skill 同时激活。

#### Scenario: 激活多个 Skill
- **WHEN** AI 调用 `use_skill` 工具传入多个 skill 名称
- **THEN** 系统 SHALL 为每个 skill 创建独立的 `SkillPromptRunner`，存储在 `activeSkills: Map<string, SkillPromptRunner>` 中

#### Scenario: 合并多 Skill 结果
- **WHEN** 多个 Skill 同时激活
- **THEN** `resultText` SHALL 自动合并所有激活 Skill 的内容

#### Scenario: ChatSkillPromptRunner 多标签显示
- **WHEN** 有多个 Skill 同时激活
- **THEN** ChatSkillPromptRunner 组件 SHALL 渲染多个 Skill 标签，每个标签显示对应 Skill 的名称和状态

### Requirement: SkillSource 类型扩展
前端 `SkillSource` 类型 SHALL 支持多种来源标识，与后端 8 个加载路径对应。

#### Scenario: 显示来源标识
- **WHEN** 前端渲染 skill 列表项
- **THEN** 系统 SHALL 根据 `source` 字段显示对应的来源标识（如 `y3maker-project`、`y3maker-user`、`claude-project`、`claude-user`、`agents-project`、`agents-user` 等）
