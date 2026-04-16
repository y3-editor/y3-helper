## 1. Phase 1 - 后端核心：SkillsHandler 类重构

- [x] 1.1 创建 `src/codemaker/skillsHandler.ts`，实现 `SkillsHandler` 单例类骨架（`getInstance()`、`initialize()`、`dispose()`），参考源码库 `handlers/skillsHandler/index.ts`
- [x] 1.2 实现 MdcParser 解析逻辑，替代 `messageHandlers.ts` 中的正则表达式 `parseSkillFile`，支持 `name`、`description`、`description_cn`、`user-invocable` 等 front-matter 字段
- [x] 1.3 实现多来源 Skill 加载（`loadSkills()`），支持 8 个目录来源：`~/.y3maker/skills/`、`.y3maker/skills/`、`~/.codemaker/skills/`、`.codemaker/skills/`、`~/.claude/skills/`、`.claude/skills/`、`~/.agents/skills/`、`.agents/skills/`
- [x] 1.4 实现单文件型（`skill.md`）和目录型（`skill-name/index.md` + resources）Skill 加载，同名 Skill 按优先级去重（项目级 > 用户级）
- [x] 1.5 实现 FileSystemWatcher 文件监听 + 200ms 防抖 + 5s 轮询兜底机制，文件变更后自动调用 `loadSkills()` + `syncSkills()`
- [x] 1.6 实现 `syncSkills(panelId?)` 方法，向指定或所有 WebView 面板发送 `SYNC_SKILLS` 消息
- [x] 1.7 实现 `activateSkill(name)` 方法，返回 skill 内容 + 资源文件信息（目录型 skill 返回 `resources: { cwd, files }`）
- [x] 1.8 将 `messageHandlers.ts` 中的 `loadSkillsFromDir`、`parseSkillFile`、`handleGetSkills` 等散落函数迁移到 `SkillsHandler`，保持向后兼容
- [x] 1.9 实现 `UPDATE_SKILL_CONFIG` 消息处理：更新内存 skillConfigs + `context.globalState.update('skillConfigs', configs)` 持久化，启动时从 `context.globalState.get('skillConfigs')` 恢复
- [x] 1.10 实现 `REMOVE_SKILL` 消息处理：删除单文件或递归删除目录型 skill，返回 `REMOVE_SKILL_RESULT`，自动刷新列表
- [x] 1.11 实现 `UPLOAD_SKILL` 消息处理：base64 解码，`.md` 直接写入 `.y3maker/skills/`，`.zip` 使用 jszip 解压后写入，返回 `UPLOAD_SKILL_RESULT`，自动刷新列表
- [x] 1.12 更新 `src/codemaker/webviewProvider.ts`，在初始化时创建 `SkillsHandler.getInstance().initialize()`，在 dispose 时调用 `dispose()`，新增 `UPDATE_SKILL_CONFIG`、`REMOVE_SKILL`、`UPLOAD_SKILL` 消息 case
- [x] 1.13 实现 `installBuiltinSkill(name, url)` 方法，支持 .md 和 .zip 格式下载安装，重复安装覆盖，失败返回错误

## 2. Phase 2 - 数据层：前端 Store 升级

- [x] 2.1 扩展 `resources/webview_source_code/src/store/skills/index.ts` 中的 `SkillIndexItem` 接口，新增 `display_name?`、`description_cn?`、`userInvocable?`、`disabled?`、`hubSkillId?`、`installedVersion?`、`latestVersion?`、`hasUpdate?` 可选字段
- [x] 2.2 新增 `SkillConfig` 接口（`{ name: string; disabled: boolean; hubSkillId?: string }`），新增 `skillConfigs: Record<string, SkillConfig>` 状态到 `useSkillsStore`
- [x] 2.3 实现 `setSkillConfig(name, config)` 方法：更新 `skillConfigs[name]` + 通过 PostMessage 发送 `UPDATE_SKILL_CONFIG` 到后端
- [x] 2.4 实现 `isSkillEnabled(name)` 方法：`skillConfigs[name]?.disabled === true` 返回 `false`，否则返回 `true`
- [x] 2.5 扩展 `SkillSource` 类型，支持 `y3maker-project`、`y3maker-user`、`codemaker-project`、`codemaker-user`、`claude-project`、`claude-user`、`agents-project`、`agents-user` 等来源标识
- [x] 2.6 更新 `resources/webview_source_code/src/PostMessageProvider.tsx`，新增 `UPDATE_SKILL_CONFIG`、`REMOVE_SKILL`、`UPLOAD_SKILL` 消息类型定义和发送方法

## 3. Phase 3 - UI 层：Skill 面板组件移植

- [x] 3.1 从源码库复制 `src/routes/CodeChat/SkillConfigCollapse.tsx` 到 `resources/webview_source_code/src/routes/CodeChat/SkillConfigCollapse.tsx`，修正导入路径
- [x] 3.2 从源码库复制 `src/routes/CodeChat/SkillSettingModal.tsx` 到 `resources/webview_source_code/src/routes/CodeChat/SkillSettingModal.tsx`，修正导入路径，隐藏「更多 Skills」Tab（注释或条件渲染相关代码）
- [x] 3.3 更新 `resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx`：将原来的 Skills 全局开关替换为集成 `SkillConfigCollapse` 组件，添加齿轮图标按钮打开 `SkillSettingModal`
- [ ] 3.4 验证 SkillConfigCollapse 功能：折叠面板渲染、默认显示前 3 个 skill、展开/收起、每个 skill 的绿色勾号/灰色叉号状态图标、独立启用/禁用下拉
- [ ] 3.5 验证 SkillSettingModal 功能：对话框打开/关闭、已安装 Skills 列表展示、搜索过滤、启用/禁用切换、删除（含确认）、导入 .md/.zip

## 4. Phase 4 - 协议层：use_skill 工具升级

- [x] 4.1 更新 `resources/webview_source_code/src/store/workspace/toolsEN.ts` 中 `use_skill` 工具定义：`skill_name` 参数从 `{ type: 'string' }` 改为 `oneOf: [{ type: 'string', enum }, { type: 'array', items: { type: 'string', enum }, minItems: 1 }]`
- [x] 4.2 更新 `toolsEN.ts` 中 `use_skill` 的 enum 生成逻辑：仅包含 `isSkillEnabled(name)` 返回 `true` 的 skill，被禁用的 skill 不出现在 enum 中
- [x] 4.3 更新 `src/codemaker/webviewProvider.ts` 中 `_toolUseSkill` 方法：判断 `skill_name` 是字符串还是数组，字符串调用 `skillsHandler.activateSkill(name)` 返回单个结果，数组遍历调用返回 JSON 数组
- [x] 4.4 更新前端 `parseSkillToolResult` 解析逻辑：`Array.isArray(parsed)` 兼容单个对象和对象数组两种格式

## 5. Phase 5 - 高级功能：多 Skill 激活

- [x] 5.1 从源码库复制并更新 `resources/webview_source_code/src/store/skills/skill-prompt.ts`：将 `useSkillPromptApp` 从单 runner（`runner?: SkillPromptRunner`）升级为 Map-based 多 runner（`activeSkills: Map<string, SkillPromptRunner>`）
- [x] 5.2 实现 `resultText` 自动合并所有激活 Skill 内容的逻辑
- [x] 5.3 从源码库复制并更新 `resources/webview_source_code/src/routes/CodeChat/ChatSkillPromptRunner.tsx`：支持渲染多个 Skill 标签，每个标签显示 Skill 名称和状态

## 6. 集成测试与验收

- [ ] 6.1 端到端测试：启动 Y3Maker → 打开聊天面板 → 验证 Skills 工具条目显示折叠面板 → 展开/收起 → 单个 skill 启用/禁用 → 齿轮图标打开 SkillSettingModal
- [ ] 6.2 端到端测试：SkillSettingModal 中搜索、删除 skill、导入 .md 文件、导入 .zip 文件
- [ ] 6.3 端到端测试：在 `.y3maker/skills/`、`~/.claude/skills/` 等多个目录放置 skill 文件，验证全部加载并显示正确的来源标识
- [ ] 6.4 端到端测试：编辑 skill 文件后验证 FileSystemWatcher 自动刷新（列表更新无需手动操作）
- [ ] 6.5 端到端测试：AI 调用 `use_skill` 传入单个 skill 名称 → 验证返回正确内容；传入数组 → 验证返回 JSON 数组
- [ ] 6.6 端到端测试：禁用某个 skill → 验证 AI 的 `use_skill` enum 中不包含该 skill → 重新启用 → 验证 enum 恢复
- [ ] 6.7 端到端测试：同时激活多个 skill → 验证 ChatSkillPromptRunner 渲染多个标签 → resultText 合并正确
- [ ] 6.8 回归测试：验证 Y3Maker 特有功能（Y3 编辑器相关）未受影响
