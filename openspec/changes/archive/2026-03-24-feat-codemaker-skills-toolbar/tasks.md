## 1. Skill 文件解析基础设施 (src/codemaker/messageHandlers.ts)

- [x] 1.1 新增 `parseSkillFile` 函数：解析 `.md` 文件的 front-matter（name、description）和 content，复用 `parseMdcFile` 的正则模式，name 缺失时回退到文件名，description 缺失时使用空字符串
- [x] 1.2 新增 `loadSkillsFromDir` 函数：扫描指定目录下所有 `.md` 文件，逐个调用 `parseSkillFile`，解析失败的文件静默跳过，返回 `Skill[]` 数组（含 name、description、content、source、path 字段）

## 2. GET_SKILLS 消息处理 (src/codemaker/messageHandlers.ts)

- [x] 2.1 新增 `handleGetSkills` 函数：调用 `loadSkillsFromDir` 读取 `.codemaker/skills/` 目录，目录不存在时返回空数组
- [x] 2.2 替换 `case 'GET_SKILLS'` 中的空数组返回，改为调用 `handleGetSkills`，通过 `SYNC_SKILLS` 消息返回 skill 列表

## 3. CREATE_SKILL_TEMPLATE 消息处理 (src/codemaker/messageHandlers.ts)

- [x] 3.1 新增 `handleCreateSkillTemplate` 函数：从 `message.data.templateContent` 获取模板内容，在 `.codemaker/skills/` 下创建 `new-skill.md`（已存在则追加数字后缀），自动创建目录
- [x] 3.2 创建成功后返回 `CREATE_SKILL_TEMPLATE_RESULT` 消息（`{ success: true, path: filePath }`），注意**不要**在后端打开文件（前端收到 path 后会自己发 `OPEN_FILE`）
- [x] 3.3 创建成功后自动调用 `handleGetSkills` 刷新 skills 列表
- [x] 3.4 替换 `case 'CREATE_SKILL_TEMPLATE'` 的静默忽略逻辑，改为调用 `handleCreateSkillTemplate`

## 4. INSTALL_BUILTIN_SKILL 消息处理 (src/codemaker/messageHandlers.ts)

- [x] 4.1 新增 `handleInstallBuiltinSkill` 函数：从 `message.data.downloadUrl` 发 HTTP GET 请求下载 skill 内容，保存到 `.codemaker/skills/<skillName>.md`
- [x] 4.2 成功时返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`{ success: true, skillName, installPath }`），并自动刷新 skills 列表
- [x] 4.3 失败时返回 `INSTALL_BUILTIN_SKILL_RESULT` 消息（`{ success: false, error: '错误描述' }`）
- [x] 4.4 替换 `case 'INSTALL_BUILTIN_SKILL'` 的静默忽略逻辑，改为调用 `handleInstallBuiltinSkill`

## 5. use_skill 工具实现 (src/codemaker/webviewProvider.ts)

- [x] 5.1 重写 `_toolUseSkill` 方法：调用 `loadSkillsFromDir` 动态从文件系统加载最新 skills（不使用缓存）
- [x] 5.2 根据 `skill_name` 参数在 skills 列表中查找匹配项，找到后返回 `{ content: JSON.stringify({ name, content, source, path }), path: skill.path, isError: false }`
- [x] 5.3 未找到时返回 `{ content: '错误信息（列出可用skill名称）', path: skillName, isError: true }`
- [x] 5.4 `skill_name` 为空时返回 `{ content: 'skill_name参数是必需的', path: '', isError: true }`

## 6. 验证与冒烟测试

- [x] 6.1 在 `.codemaker/skills/` 下手动创建一个测试 skill 文件，验证 WebView 工具栏出现 Skills 开关（已通过手动测试验证）
- [ ] 6.2 通过前端 `/` 命令菜单点击 "Skill Init"，验证模板文件创建和编辑器打开（前端版本限制，暂无法测试）
- [ ] 6.3 验证 `use_skill` 工具调用能正确返回 skill 内容（在聊天中触发 skill）（待后续测试）
