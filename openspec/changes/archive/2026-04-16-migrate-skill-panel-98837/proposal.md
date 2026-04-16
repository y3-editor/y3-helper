## Why

#98837

Y3Maker 当前的 Skill 面板功能简陋，仅在 ChatFunctionalToolbar 中提供一个「Skills 工具」的全局启用/禁用开关（通过 `SelectWithTooltip` 切换 on/off）。用户无法查看已加载的 skill 列表，无法对单个 skill 进行独立的启用/禁用控制，也没有 skill 管理配置入口。

而源码库 `codemaker-web-ui` 中已实现了完整的 Skill 面板功能：支持展开/折叠的 skill 列表、每个 skill 的独立启用/禁用控制、齿轮图标打开完整配置对话框（SkillSettingModal）、以及多 skill 激活支持等。需要将这些能力移植到 Y3Maker 中，使两端功能一致。

## What Changes

- **新增 `SkillConfigCollapse` 组件**：在 ChatFunctionalToolbar 的 Skills 条目下方渲染可折叠的 skill 列表面板，默认显示前 3 个 skill，支持展开/收起查看全部；每个 skill 显示启用状态图标（绿色勾号/灰色叉）和独立的启用/禁用下拉
- **新增 `SkillSettingModal` 组件**：点击齿轮图标打开 Skill 配置对话框，仅保留「已安装 Skills」Tab（隐藏「更多 Skills」Tab，不接入 SkillHub 在线市场），支持搜索、启用/禁用、删除、导入（.md/.zip）等功能
- **升级 `useSkillsStore`**：新增 `skillConfigs: Record<string, SkillConfig>` 状态，支持 `setSkillConfig()`、`isSkillEnabled()` 等方法，实现每个 skill 的独立配置管理
- **升级 `useSkillPromptApp`**：从单 skill runner 模式升级为多 skill 模式，使用 `activeSkills: Map<string, SkillPromptRunner>` 管理多个同时激活的 skill
- **升级 `ChatSkillPromptRunner`**：支持多 skill 标签显示
- **修改 ChatFunctionalToolbar**：将原来的单一 Skills 开关替换为集成 `SkillConfigCollapse` 和 `SkillSettingModal` 的完整面板
- **新增后端消息处理**：支持 `UPDATE_SKILL_CONFIG`、`REMOVE_SKILL`、`UPLOAD_SKILL`、`CHECK_SKILLS_VERSION` 等新消息类型
- **重构后端 Skill 加载为 `SkillsHandler` 类**：从 `messageHandlers.ts` 中散落的函数提取为独立类，支持单例模式、多来源加载（4 个目录）、MdcParser 解析、文件监听（FileSystemWatcher + 防抖 + 轮询）、资源文件管理
- **升级 `use_skill` 工具协议**：参数 `skill_name` 从仅支持 `string` 升级为 `string | string[]`，后端支持数组处理返回多 skill 结果，前端解析兼容单个和数组格式
- **升级 `parseSkillFile`**：从正则表达式解析替换为 MdcParser，新增 `user-invocable` 字段支持
- **升级 `installBuiltinSkill`**：支持 zip 解压、令牌认证、重复安装检查

## Capabilities

### New Capabilities
- `skill-panel-ui`: Skill 面板的展开/折叠列表 UI 组件（SkillConfigCollapse），包含 skill 列表渲染、独立启用/禁用下拉、展开/收起控制、齿轮配置入口
- `skill-setting-modal`: Skill 完整配置管理对话框（SkillSettingModal），包含已安装/推荐 Skills 两个 Tab、搜索、删除、导入、自动更新等功能
- `skill-handler-backend`: 后端 SkillsHandler 独立类，包含多来源加载、MdcParser 解析、文件监听、资源文件管理、单例生命周期

### Modified Capabilities
- `skill-management`: 升级 skill 数据存储，新增 `skillConfigs` 状态和每个 skill 的独立启用/禁用配置管理；升级 skill-prompt 为多 skill 激活模式
- `skill-tool-execution`: 升级 `use_skill` 工具协议，支持 `skill_name: string | string[]` 多 skill 参数、数组返回格式、资源文件信息

## Impact

- **前端 UI 组件**：新增 `SkillConfigCollapse.tsx`、`SkillSettingModal.tsx`；修改 `ChatFunctionalToolbar.tsx`、`ChatSkillPromptRunner.tsx`
- **状态管理**：修改 `store/skills/index.ts`（新增 skillConfigs）、`store/skills/skill-prompt.ts`（多 skill 支持）
- **后端消息处理**：修改 `src/codemaker/messageHandlers.ts`、`src/codemaker/webviewProvider.ts` 支持新消息类型
- **后端架构**：新增 `src/codemaker/skillsHandler.ts`（独立 SkillsHandler 类）；重构现有散落的 skill 函数
- **PostMessage 协议**：新增 `UPDATE_SKILL_CONFIG`、`REMOVE_SKILL`、`UPLOAD_SKILL`、`CHECK_SKILLS_VERSION` 等消息类型
- **工具协议**：修改 `toolsEN.ts` 中 `use_skill` 的参数 schema、`webviewProvider.ts` 中 `_toolUseSkill` 的处理逻辑
- **依赖**：可能需要新增 Chakra UI 的 Collapse、Modal、Switch 等组件（需确认当前项目 UI 库版本）
