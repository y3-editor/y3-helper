## Context

Y3Maker 的 Skill 面板当前仅有一个全局启用/禁用开关，功能远落后于 `codemaker-web-ui` 源码库。源码库已实现完整的 Skill 管理系统（SkillConfigCollapse 折叠列表、SkillSettingModal 配置对话框、多 Skill 激活、自动更新等）。本次设计目标是将这些能力从源码库移植到 Y3Maker，采用"直接复制 + 适配修改"的策略最大化复用现有代码。

**当前状态**：
- 前端位于 `resources/webview_source_code/src/`，使用 React + Zustand + Chakra UI
- 后端位于 `src/codemaker/`，通过 PostMessage 协议与 WebView 通信
- 源码库 (`H:\codemaker\codemaker-web-ui`) 结构与 Y3Maker 前端同构，组件路径一致

## Goals / Non-Goals

**Goals:**
- 使 Y3Maker 的 Skill 面板与 `codemaker-web-ui` 功能一致
- 支持展开/折叠的 Skill 列表，每个 Skill 独立启用/禁用
- 支持 SkillSettingModal 配置对话框（仅「已安装」Tab：搜索、删除、导入；隐藏「更多 Skills」Tab）
- 升级数据模型支持 `skillConfigs` 独立配置和多 Skill 激活
- 新增后端消息处理支持新的 PostMessage 协议

**Non-Goals:**
- 不引入新的第三方依赖（使用 Chakra UI 现有组件和 Node.js 内置模块）
- 不接入 SkillHub 在线市场功能。Y3Maker 是面向外部 Y3 用户的专用工具，不需要 Skill 插件市场。具体排除：SkillSettingModal 中「更多 Skills」Tab 隐藏、skillAutoUpdate 自动更新服务不移植、`CHECK_SKILLS_VERSION` 消息不实现、使用上报（skillUsage）不实现

## Decisions

### Decision 1: 直接复制 + 适配修改策略

**选择**: 从源码库直接复制 UI 组件文件，仅修改导入路径和 Y3Maker 特有适配。

**理由**: 两个仓库的前端架构同构（React + Zustand + Chakra UI，组件路径一致），直接复制可最大化代码一致性，减少后续同步维护成本。

**备选方案**:
- 从零重写参考源码库设计 → 工作量大且容易偏离源码库行为
- 抽取为共享 npm 包 → 过度工程化，两个项目迭代节奏不同

### Decision 2: 分阶段移植

**选择**: 分 5 个阶段递进实施：后端核心 → 数据层 → UI 层 → 协议层 → 高级功能。

| 阶段 | 内容 | 风险 |
|------|------|------|
| Phase 1 - 后端核心 | 重构 Skill 加载为独立 SkillsHandler 类、多来源支持、MdcParser 解析、文件监听、资源文件支持 | 高 |
| Phase 2 - 数据层 | 升级 SkillIndexItem / SkillConfig / useSkillsStore / SkillSource | 低 |
| Phase 3 - UI 层 | 复制 SkillConfigCollapse、SkillSettingModal（隐藏「更多 Skills」Tab），更新 ChatFunctionalToolbar | 中 |
| Phase 4 - 协议层 | 升级 `use_skill` 工具支持多 Skill 参数（`string \| string[]`）、后端支持数组处理、前端结果解析兼容 | 中 |
| Phase 5 - 高级功能 | 多 Skill 激活（useSkillPromptApp）、ChatSkillPromptRunner 升级 | 中 |

**理由**: Phase 1 先对齐后端核心能力（这是前后端一切功能的基础），Phase 2+3 完成数据和 UI 层，Phase 4 升级 AI 调用协议支持多 Skill，Phase 5 补全高级功能。

### Decision 3: 文件映射方案

**选择**: 源码库和 Y3Maker 文件 1:1 对应映射，包含前端和后端。

**前端文件映射**（源码库 → Y3Maker `resources/webview_source_code/`）：

| 源码库文件 | Y3Maker 目标文件 | 操作 |
|-----------|-----------------|------|
| `src/store/skills/index.ts` | `src/store/skills/index.ts` | 合并更新 |
| `src/store/skills/skill-prompt.ts` | `src/store/skills/skill-prompt.ts` | 替换 |
| `src/store/workspace/toolsEN.ts` | `src/store/workspace/toolsEN.ts` | 合并更新（use_skill 定义） |
| `src/routes/CodeChat/SkillConfigCollapse.tsx` | `src/routes/CodeChat/SkillConfigCollapse.tsx` | 直接复制 |
| `src/routes/CodeChat/SkillSettingModal.tsx` | `src/routes/CodeChat/SkillSettingModal.tsx` | 复制 + 隐藏「更多 Skills」Tab |
| `src/routes/CodeChat/ChatFunctionalToolbar.tsx` | `src/routes/CodeChat/ChatFunctionalToolbar.tsx` | 合并更新 |
| `src/routes/CodeChat/ChatSkillPromptRunner.tsx` | `src/routes/CodeChat/ChatSkillPromptRunner.tsx` | 替换 |
| ~~`src/services/skillAutoUpdate.ts`~~ | ~~`src/services/skillAutoUpdate.ts`~~ | ❌ 不移植（SkillHub 依赖） |
| `src/PostMessageProvider.tsx` | `src/PostMessageProvider.tsx` | 合并更新 |

**后端文件映射**（CodeMaker 扩展 → Y3Maker `src/codemaker/`）：

| CodeMaker 扩展文件 | Y3Maker 目标文件 | 操作 |
|-------------------|-----------------|------|
| `handlers/skillsHandler/index.ts` | `src/codemaker/skillsHandler.ts` | 参考重写 |
| `handlers/skillsHandler/types.ts` | `src/codemaker/skillsHandler.ts` | 合入同一文件 |
| N/A | `src/codemaker/messageHandlers.ts` | 新增消息处理函数 |
| N/A | `src/codemaker/webviewProvider.ts` | 更新 `_toolUseSkill`、新增 case |

**"合并更新"** 指保留 Y3Maker 特有的代码（如 Y3 编辑器相关功能），仅添加/替换 Skill 相关部分。

### Decision 4: 数据模型升级方案

**选择**: 扩展 `SkillIndexItem` 接口（新增可选字段）+ 新增 `SkillConfig` 接口 + 扩展 `useSkillsStore`。

```typescript
// 扩展 SkillIndexItem（向后兼容）
interface SkillIndexItem {
  name: string;
  display_name?: string;        // 新增
  description: string;
  description_cn?: string;      // 新增
  source: SkillSource;
  userInvocable?: boolean;
  disabled?: boolean;           // 新增
  hubSkillId?: string;          // 新增
  installedVersion?: string;    // 新增
  latestVersion?: string;       // 新增
  hasUpdate?: boolean;          // 新增
}

// 全新接口
interface SkillConfig {
  name: string;
  disabled: boolean;
  hubSkillId?: string;
}

// 扩展 Store
interface SkillsStore {
  skills: SkillIndexItem[];
  skillConfigs: Record<string, SkillConfig>;  // 新增
  setSkillConfig: (name: string, config: Partial<SkillConfig>) => void;
  isSkillEnabled: (name: string) => boolean;
  isHubSkillInstalled: (hubSkillId: string) => boolean;
}
```

**理由**: 所有新字段都是可选的，不会破坏现有后端返回的 skill 数据。`skillConfigs` 作为前端本地状态管理，与后端通过 `UPDATE_SKILL_CONFIG` 消息同步。

### Decision 5: 多 Skill 激活架构

**选择**: 将 `useSkillPromptApp` 从单 runner 模式升级为 Map-based 多 Skill 模式。

```typescript
// 旧：单 runner
{ runner?: SkillPromptRunner; resultText?: string; }

// 新：多 runner
{ activeSkills: Map<string, SkillPromptRunner>; resultText?: string; }
```

**理由**: 源码库已实现此模式，且 `resultText` 会自动合并所有激活 Skill 的内容。`ChatSkillPromptRunner` 相应升级为渲染多个 Skill 标签。

### Decision 6: 后端消息处理实现

**选择**: 在 `messageHandlers.ts` 中新增 4 个消息处理函数。

| 消息类型 | 处理逻辑 |
|---------|---------|
| `UPDATE_SKILL_CONFIG` | 更新内存中的 skill 配置状态，可选持久化到 `.y3maker/skill-config.json` |
| `REMOVE_SKILL` | 从 `.y3maker/skills/` 目录删除对应 skill 文件，刷新列表 |
| `UPLOAD_SKILL` | 将 base64 编码的文件内容写入 `.y3maker/skills/` 目录，支持 .md 和 .zip |
| ~~`CHECK_SKILLS_VERSION`~~ | ❌ 不实现（依赖 SkillHub API） |

**理由**: 前 3 个消息类型对应 SkillSettingModal「已安装」Tab 的功能需求。`CHECK_SKILLS_VERSION` 属于 SkillHub 在线市场功能，Y3Maker 不需要。

### Decision 7: 后端 Skill 加载重构为 SkillsHandler 类

**选择**: 将 `messageHandlers.ts` 中散落的 skill 函数（`loadSkillsFromDir`、`parseSkillFile`、`handleGetSkills` 等）提取为独立的 `SkillsHandler` 类，对齐源码库的 `handlers/skillsHandler/` 架构。

**关键变更**：

| 当前 Y3Helper | 目标（对齐源码库） |
|--------------|------------------|
| 正则表达式解析 front-matter | 使用 MdcParser 解析（更健壮） |
| 仅支持 `.y3maker/skills/` 一个来源 | 支持 8 个来源：`~/.y3maker/skills/`、`.y3maker/skills/`、`~/.codemaker/skills/`、`.codemaker/skills/`、`~/.claude/skills/`、`.claude/skills/`、`~/.agents/skills/`、`.agents/skills/` |
| 无缓存，每次读文件 | 单例模式 + 内存缓存 + 动态读取 |
| 无文件监听 | FileSystemWatcher + 防抖（200ms）+ 轮询兜底（5s） |
| 不支持 `userInvocable` 字段 | 完整支持 front-matter 中的 `user-invocable` 字段 |
| `use_skill` 返回无资源文件 | 目录型 skill 返回 `resources: { cwd, files }` |
| `use_skill` 仅支持单个 `skill_name: string` | 支持 `skill_name: string \| string[]` |
| 安装 skill 仅支持文本下载 | 支持 zip 解压、重复检查（不需要 SkillHub 令牌认证） |

**SkillsHandler 核心 API**：
```typescript
class SkillsHandler {
  static getInstance(): SkillsHandler;
  async initialize(): Promise<void>;        // 初始化 + 启动文件监听
  async loadSkills(): Promise<void>;        // 加载所有来源的 skills
  syncSkills(panelId?: string): void;       // 同步 skill 列表到前端
  getSkillByName(name: string): Skill | undefined;
  async activateSkill(name: string): Promise<UseSkillResult>;  // use_skill 调用
  async createSkillTemplate(content?: string): Promise<Result>;
  async installBuiltinSkill(name: string, url: string): Promise<Result>;
  dispose(): void;                          // 清理监听器
}
```

**理由**: 源码库使用独立的 SkillsHandler 类管理 skill 的完整生命周期。对齐此架构可以：
1. 代码更清晰，职责单一
2. 支持多来源并行加载
3. 文件监听自动刷新（用户编辑 skill 文件后无需手动刷新）
4. 缓存 + 动态读取兼顾性能和实时性

### Decision 8: `use_skill` 工具协议升级

**选择**: 升级 `use_skill` 的参数 schema 和后端处理，支持一次激活多个 Skill。

**前端工具定义变更**（`toolsEN.ts`）：
```typescript
// 旧：仅字符串
skill_name: { type: 'string', enum: skillNames }

// 新：支持字符串或数组
skill_name: {
  oneOf: [
    { type: 'string', enum: skillNames, description: 'A single skill name...' },
    { type: 'array', items: { type: 'string', enum: skillNames }, minItems: 1, description: 'An array of skill names...' }
  ]
}
```

**后端处理变更**（`_toolUseSkill`）：
- 接收 `skill_name` 参数，判断是字符串还是数组
- 字符串：调用 `skillsHandler.activateSkill(name)` 返回单个结果
- 数组：遍历调用，返回 JSON 数组

**前端结果解析变更**：
- `parseSkillToolResult` 兼容单个对象和对象数组
- `Array.isArray(parsed)` 判断后分别处理

**理由**: 多 Skill 激活是源码库的核心能力，与 Decision 5（多 Skill 激活架构）配套。不升级此协议，AI 无法一次激活多个 Skill。

## Risks / Trade-offs

- **[风险] 源码库持续演进导致分化** → 通过 1:1 文件映射和最小化适配修改，降低后续同步成本。重要更新可通过 diff 对比快速合并。

- **[决策] 全量复制，SkillHub 除外** → 全量复制源码库实现，但排除 SkillHub 在线市场相关功能（「更多 Skills」Tab、skillAutoUpdate、CHECK_SKILLS_VERSION、skillUsage 上报）。Y3Maker 是面向外部 Y3 用户的专用工具，不需要 Skill 插件市场。

- **[决策] 多 Skill 激活必须支持** → 与源码库保持一致，完整支持多 Skill 同时激活。

## Open Questions

（无）

## Resolved Questions

- **`skillConfigs` 持久化方案** → 与源码版一致，前端通过 `UPDATE_SKILL_CONFIG` 消息发给后端，后端使用 `context.globalState.update('skillConfigs', configs)` 持久化到 VS Code globalState 中。
- **`.zip` 文件处理** → Y3Maker 已有 `jszip@^3.10.1` 依赖，`UPLOAD_SKILL` 可直接支持 .md 和 .zip 两种格式导入，无需新增依赖。
- **Chakra UI 版本** → 两个仓库完全一致，均为 `@chakra-ui/react@^2.7.1`。`Collapse` 组件的 `animate` prop 正常支持，无兼容性问题。