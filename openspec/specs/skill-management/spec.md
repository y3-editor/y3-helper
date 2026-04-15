## ADDED Requirements

### Requirement: 从项目目录加载 Skills 列表
系统 SHALL 在收到 `GET_SKILLS` 消息时，从 `.codemaker/skills/` 目录读取所有 `.md` 文件，解析 front-matter 元数据和内容，返回 skill 列表给前端。

#### Scenario: 项目目录存在 skill 文件
- **WHEN** WebView 发送 `GET_SKILLS` 消息，且 `.codemaker/skills/` 目录下存在合法的 `.md` 文件
- **THEN** 系统 SHALL 返回 `SYNC_SKILLS` 消息，data 为包含所有 skill 对象的数组，每个对象包含 `name`、`description`、`content`、`source`（值为 `codemaker-project`）、`path` 字段

#### Scenario: 项目目录不存在或为空
- **WHEN** WebView 发送 `GET_SKILLS` 消息，且 `.codemaker/skills/` 目录不存在或目录下无 `.md` 文件
- **THEN** 系统 SHALL 返回 `SYNC_SKILLS` 消息，data 为空数组 `[]`

#### Scenario: skill 文件解析失败
- **WHEN** `.codemaker/skills/` 目录下存在格式异常的 `.md` 文件（如 front-matter 缺失或字段缺失）
- **THEN** 系统 SHALL 静默跳过该文件，不影响其他 skill 文件的正常加载

### Requirement: Skill 文件 front-matter 格式
系统 SHALL 支持以下 front-matter 格式的 `.md` 文件作为 skill 定义：

```
---
name: <skill-name>
description: <skill-description>
---
<content>
```

#### Scenario: 完整 front-matter
- **WHEN** skill 文件包含 `name` 和 `description` 字段的 front-matter
- **THEN** 系统 SHALL 使用 front-matter 中的 `name` 作为 skill 名称，`description` 作为描述，front-matter 后的内容作为 `content`

#### Scenario: front-matter 缺少 name 字段
- **WHEN** skill 文件的 front-matter 中没有 `name` 字段
- **THEN** 系统 SHALL 使用文件名（不含 `.md` 扩展名）作为 skill 名称

#### Scenario: front-matter 缺少 description 字段
- **WHEN** skill 文件的 front-matter 中没有 `description` 字段
- **THEN** 系统 SHALL 使用空字符串作为描述

### Requirement: 创建 Skill 模板文件
系统 SHALL 在收到 `CREATE_SKILL_TEMPLATE` 消息时，在 `.codemaker/skills/` 目录下创建 skill 模板文件，并在编辑器中打开该文件。

#### Scenario: 创建模板文件
- **WHEN** WebView 发送 `CREATE_SKILL_TEMPLATE` 消息，data 中包含 `templateContent` 字符串
- **THEN** 系统 SHALL 在 `.codemaker/skills/` 目录下创建 `new-skill.md` 文件（如已存在则追加数字后缀），写入 `templateContent` 内容，在 VSCode 编辑器中打开该文件，并返回 `CREATE_SKILL_TEMPLATE_RESULT` 消息（`success: true`，`filePath` 为创建的文件路径）

#### Scenario: 目录不存在时自动创建
- **WHEN** `.codemaker/skills/` 目录不存在
- **THEN** 系统 SHALL 自动递归创建该目录，然后创建模板文件

#### Scenario: 创建后自动刷新 Skills 列表
- **WHEN** skill 模板文件创建成功
- **THEN** 系统 SHALL 自动触发 `GET_SKILLS` 流程，将更新后的 skills 列表同步到前端

### Requirement: 安装内置 Skill
系统 SHALL 在收到 `INSTALL_BUILTIN_SKILL` 消息时，从指定 URL 下载 skill 内容，保存到 `.codemaker/skills/` 目录。

#### Scenario: 成功安装内置 skill
- **WHEN** WebView 发送 `INSTALL_BUILTIN_SKILL` 消息，data 中包含 `skillName` 和 `downloadUrl`，且 HTTP 请求成功
- **THEN** 系统 SHALL 将下载的内容保存为 `.codemaker/skills/<skillName>.md`，返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`success: true`，`skillName`，`installPath`），并自动刷新 skills 列表

#### Scenario: 下载失败
- **WHEN** HTTP 请求失败或超时
- **THEN** 系统 SHALL 返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`success: false`，`error` 包含失败原因）

#### Scenario: 覆盖已存在的同名 skill
- **WHEN** `.codemaker/skills/<skillName>.md` 已存在
- **THEN** 系统 SHALL 覆盖写入新内容
