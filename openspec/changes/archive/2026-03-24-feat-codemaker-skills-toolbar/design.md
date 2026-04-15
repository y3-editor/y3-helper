## Context

Y3Helper 集成的 CodeMaker 在移植时跳过了 Skills 系统的后端实现。前端 WebView 已内置完整的 Skills UI（工具栏开关、`/skill` 命令菜单、skill 激活展示），但后端 `GET_SKILLS` 返回空数组，导致前端判断 `skills.length === 0` 后直接隐藏 Skills 工具栏项。

当前已实现的 Rules 功能（`.codemaker/rules/*.mdc` 文件读写）提供了很好的参考模式，Skills 实现可复用相同的文件 I/O 模式。

### 前端已有的 Skill 数据结构

前端 Skill Store（`useSkillsStore`）中的 skill 对象结构：

```typescript
interface Skill {
    name: string;           // skill 名称（kebab-case）
    description: string;    // 描述（用于触发匹配和工具栏展示）
    content: string;        // skill 指令内容
    source: string;         // 来源标识
    path?: string;          // 文件路径
    userInvocable?: boolean; // 是否允许用户手动调用（默认 true）
}
```

### 前端已有的消息协议

| 方向 | 消息类型 | 用途 |
|---|---|---|
| WebView → Extension | `GET_SKILLS` | 请求加载 skills |
| WebView → Extension | `CREATE_SKILL_TEMPLATE` | 创建 skill 模板文件 |
| WebView → Extension | `INSTALL_BUILTIN_SKILL` | 安装内置 skill |
| Extension → WebView | `SYNC_SKILLS` | 同步 skills 列表到前端 |
| Extension → WebView | `CREATE_SKILL_TEMPLATE_RESULT` | 模板创建结果 |
| Extension → WebView | `INSTALL_BUILTIN_SKILL_RESULT` | 内置 skill 安装结果 |
| Extension → WebView | `TOOL_CALL_RESULT` (use_skill) | skill 内容返回给 AI |

### Skill 文件格式

与 `.mdc` 类似的 front-matter 格式：

```
---
name: my-skill
description: What this skill does and when to use it.
---

# Instructions content here
```

### Skill 来源目录

前端 `getSkillSourceLabel` 支持的 source 类型和对应目录：
| source 标识 | 目录路径 | 说明 |
|---|---|---|
| `codemaker-project` | `.codemaker/skills/` | 项目级 skill（优先实现） |
| `codemaker-user` | `~/.codemaker/skills/` | 用户级 skill |
| `claude-project` | `.claude/skills/` | Claude 兼容目录 |
| `claude-user` | `~/.claude/skills/` | Claude 兼容用户目录 |

## Goals / Non-Goals

**Goals:**
- 实现 `GET_SKILLS` 后端逻辑，从多个 skills 目录读取 `.md` 文件，解析并返回 skill 列表给前端
- 实现 `CREATE_SKILL_TEMPLATE` 后端逻辑，在 `.codemaker/skills/` 下创建 skill 模板文件并打开编辑器
- 实现 `INSTALL_BUILTIN_SKILL` 后端逻辑，从 Skills Hub API 下载内置 skill 并安装到项目
- 实现 `use_skill` 工具执行逻辑，根据 skill name 加载对应内容并返回给 AI

**Non-Goals:**
- 不修改前端 WebView 代码（WebView 已内置完整 UI）
- 不实现 skill 的在线市场/搜索功能（INSTALL_BUILTIN_SKILL 仅做本地安装）
- 不实现 skill 运行时沙箱或安全隔离

## Decisions

### Decision 1: Skill 文件扫描范围

**选择**：扫描 `.codemaker/skills/` 项目级目录，暂不扫描用户级目录（`~/.codemaker/skills/`、`~/.claude/skills/`）。

**理由**：Y3Helper 的使用场景是项目级的（一个地图项目一个工作区），用户级 skill 目录的使用概率低，且增加扫描目录会增加复杂度。后续可轻松扩展。

**替代方案**：扫描所有 4 个目录 — 增加首次加载时间，且可能引入非预期的 skill 冲突。

### Decision 2: Skill 文件格式

**选择**：使用 `.md` 扩展名，front-matter 解析方式与 Rules 的 `.mdc` 解析逻辑一致。

**理由**：前端 `CREATE_SKILL_TEMPLATE` 发送的模板内容格式为 `---\nname: ...\ndescription: ...\n---\n# content`，与 `.mdc` front-matter 格式一致。使用 `.md` 扩展名便于用户直接在 VSCode 中编辑和预览。

### Decision 3: `use_skill` 工具实现方式

**选择**：`use_skill` 被调用时，根据 `skill_name` 在已加载的 skills 列表中查找对应 skill，返回其 `content` 作为 AI 的指令。返回格式为 JSON（包含 `name`、`content`、`source`、`path` 字段），与前端 `parseSkillToolResult` 解析逻辑匹配。

**理由**：前端 `parseSkillToolResult` 期望 `JSON.parse` 后得到 `{ name, content, source }` 结构，成功后会构造 `<activated_skill>` 标签注入到系统 prompt。

### Decision 4: `INSTALL_BUILTIN_SKILL` 实现策略

**选择**：通过 HTTP GET 从 `SKILLS_HUB_API_URL`（默认 `http://localhost:3001`，即 CodeMaker API Server）下载 skill 文件内容，保存到 `.codemaker/skills/` 目录。

**理由**：前端发送的 `downloadUrl` 是 `${SKILLS_HUB_API_URL}/api/skills/@skill-creator/download`，需要后端代理请求（WebView 无法直接访问本地服务）。如果 API Server 未运行或请求失败，返回错误提示。

**替代方案**：将内置 skill 内容硬编码在扩展中 — 不灵活，且 skill 更新时需要发版。

### Decision 5: 复用 Rules 模式的代码组织

**选择**：在 `messageHandlers.ts` 中新增 `handleGetSkills`、`handleCreateSkillTemplate`、`handleInstallBuiltinSkill` 函数，与已有的 `handleGetRules`、`handleCreateNewRule` 等函数并列。

**理由**：保持代码组织一致性，减少学习成本。Skills 和 Rules 的文件 I/O 模式高度相似。

## Implementation Constraint: 严格从源码移植

**核心原则**：所有实现 MUST 完全基于前端 WebView 打包产物（`resources/codemaker/webview/assets/index-6ea24312.js`）中逆向分析出的消息协议和数据格式，以及已有的 `handleGetRules` / `handleCreateNewRule` 等实现模式进行移植。不得凭空创造任何逻辑。

### 前端代码逆向分析的关键约束

**1. `GET_SKILLS` → `SYNC_SKILLS` 响应格式**（来自 L81609-L81611）

前端期望 `SYNC_SKILLS` 的 data 为 `Skill[]` 数组，通过 `Array.isArray(L)` 校验后调用 `setSkills(L)` 更新 store。

**2. `INSTALL_BUILTIN_SKILL_RESULT` 响应格式**（来自 L78774-L78816）

前端期望响应 data 包含：
- `success: boolean`
- `skillName: string`（成功时）
- `installPath: string`（成功时，用于 toast 展示）
- `error?: string`（失败时）

成功后前端会自动调用 `use_skill` 工具（通过 `TOOL_CALL` 消息发到 extension host），所以 extension 需要能处理连锁调用。

**3. `CREATE_SKILL_TEMPLATE_RESULT` 响应格式**（来自 L63200-L63219）

前端期望响应 data 包含：
- `success: boolean`
- `path?: string`（成功时，前端会发 `OPEN_FILE` 消息打开文件）
- `message?: string`（失败时）

注意：前端成功后会自己发 `OPEN_FILE` 消息，所以后端**不需要**自己打开文件（避免重复打开）。

**4. `use_skill` 工具返回格式**（来自 L78818-L78831 + L1952-L1960 `parseSkillToolResult`）

前端 `parseSkillToolResult` 执行 `JSON.parse(content)`，期望得到 `{ name, content, source, path? }`。成功后设置 skill runner（L78825-78829）。

**5. Skills 工具栏显示条件**（来自 L71976）

`S.length === 0 ? null : A({...})` — skills 为空数组时工具栏项返回 null 不渲染。只要 `GET_SKILLS` 返回非空数组，UI 就会出现。

**6. Skill Store 数据结构**（来自 L1979-L1986 + L62867-62885）

每个 skill 对象需要的字段：
- `name: string` — skill 名称
- `description: string` — 描述
- `content: string` — 指令内容（不直接展示，仅在 use_skill 时使用）
- `source: string` — 来源标识（`codemaker-project` / `codemaker-user` / `claude-project` / `claude-user`）
- `path?: string` — 文件路径
- `userInvocable?: boolean` — 是否允许用户调用（L62868: `if (de.userInvocable === false) continue;`）

### 如果发现源码无法处理的地方

如果在实现过程中发现前端期望的某些行为在 Y3Helper 环境下无法实现（如 `SKILLS_HUB_API_URL` 不可用、特定 API 不存在等），MUST 通知用户，不得自行绕过。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|---|---|
| Skills Hub API Server 未运行时 `INSTALL_BUILTIN_SKILL` 失败 | 返回明确错误提示，引导用户检查 API Server 状态；不阻塞其他功能 |
| Skill 文件格式不规范导致解析失败 | 沿用 Rules 的容错策略：解析失败的文件静默跳过，不影响其他 skill 加载 |
| `use_skill` 找不到指定 skill | 返回 `isError: true` 和提示信息，而非静默失败 |
| 项目目录下没有 `.codemaker/skills/` 目录 | `GET_SKILLS` 返回空数组（正常行为），`CREATE_SKILL_TEMPLATE` 时自动创建目录 |

## Implementation Notes（实现后补充）

### 已完成功能

| 功能 | 状态 | 说明 |
|---|---|---|
| `GET_SKILLS` → `SYNC_SKILLS` | ✅ | 从 `.codemaker/skills/` 读取，前端 Skills 总开关已显示 |
| `CREATE_SKILL_TEMPLATE` | ✅ | 创建模板文件 + 返回结果 + 自动刷新 |
| `INSTALL_BUILTIN_SKILL` | ✅ | HTTP 下载 + 保存 + 结果 + 自动刷新 |
| `use_skill` 工具 | ✅ | 动态加载 + JSON 返回 + 匹配 `parseSkillToolResult` |

### 实现过程中发现的问题

#### 问题 1：Skill 文件结构不是简单的 `skills/*.md`

**发现**：源码版的 skill 文件实际采用**子目录结构**（如 `skills/y3-lua-pipeline/SKILL.md`），而非直接在 `skills/` 根目录放 `.md` 文件。

**解决**：`loadSkillsFromDir` 函数同时支持两种结构：
1. `skills/*.md` — 根目录直接放置的 `.md` 文件
2. `skills/<name>/SKILL.md` — 子目录形式（源码版实际格式）

**参考**：`src/codemaker/messageHandlers.ts` 中 `loadSkillsFromDir` 函数。

#### 问题 2：F5 启动不自动编译

**发现**：`.vscode/launch.json` 第 19 行 `preLaunchTask` 被注释掉了，F5 不会触发编译，需要手动执行 `npm run compile`。

#### 问题 3：前端 WebView 版本不支持 Skills 子列表 UI

**发现**：集成版的前端打包产物（`resources/codemaker/webview/assets/index-6ea24312.js`）版本较旧，Skills 工具栏仅实现了**总开关**功能（L71976-71991 的 `j()` 函数），没有子列表展开和管理按钮的 UI 代码。

正式版（源码版 CodeMaker）的前端代码有更完整的 Skills UI：
- Skills 工具栏项可展开，显示每个 skill 的名称和单独启用/关闭开关
- 有管理按钮（设置/编辑图标）
- 有 "find-skills" 搜索功能

**根因**：这是**前端打包产物版本差异**，不是后端代码问题。后端返回的数据格式完全正确（`SYNC_SKILLS` data 为 `Skill[]` 数组），前端 store 也正确接收了（L81609-81611），只是 UI 渲染层没有子列表功能。

**影响范围**：
- 总开关功能正常 ✅（`enableSkills` store 状态正确切换）
- `use_skill` 工具正常 ✅（AI 可通过工具调用任何已加载的 skill）
- skills 在 system prompt 中正确注入 ✅（前端 `buildTools` 函数 L3307/L4652/L6862 正确读取 `enableSkills` 和 `skills` 数据）
- 每个 skill 的单独启用/关闭 ❌（UI 没有此功能）
- 管理按钮 ❌（UI 没有此功能）

## TODO：后续功能升级

### P0：更新前端 WebView 打包产物

**操作**：从正式版 CodeMaker 获取新版前端打包产物，替换 `resources/codemaker/webview/assets/` 下的文件。

**注意事项**：
- 替换时需确认新版前端的消息协议没有 breaking changes
- 特别检查 `SYNC_SKILLS` 的 data 格式是否有新增字段要求
- 替换后需要同步更新 `resources/codemaker/webview/index.html` 中的 `<script>` 引用路径（文件名含 hash）
- 新版前端可能依赖新的后端消息类型（如 `TOGGLE_SKILL`、`DELETE_SKILL` 等），需要在 `messageHandlers.ts` 中补充处理

### P1：补充 Skill CRUD 消息处理

如果新版前端支持单个 skill 的管理操作，可能需要在 `messageHandlers.ts` 中新增以下消息处理：
- `TOGGLE_SKILL` — 切换单个 skill 的启用/关闭状态
- `DELETE_SKILL` — 删除 skill 文件
- `UPDATE_SKILL` — 更新 skill 文件内容
- `RENAME_SKILL` — 重命名 skill

### P2：用户级 Skills 目录支持

当前仅扫描项目级 `.codemaker/skills/` 目录。后续可扩展支持：
- `~/.codemaker/skills/` — 用户级 skill（source: `codemaker-user`）
- `.claude/skills/` — Claude 兼容目录（source: `claude-project`）
- `~/.claude/skills/` — Claude 兼容用户目录（source: `claude-user`）
