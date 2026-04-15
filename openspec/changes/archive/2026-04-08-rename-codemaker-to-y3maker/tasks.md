## 1. package.json — UI 文本 + 配置项命名空间

- [x] 1.1 将 `package.json` 中视图容器标题 `"title": "CodeMaker"` 改为 `"title": "Y3Maker"` (`contributes.viewsContainers.panel`)
- [x] 1.2 将 `package.json` 中视图名称 `"name": "CodeMaker AI"` 改为 `"name": "Y3Maker AI"` (`contributes.views.codemaker-sidebar`)
- [x] 1.3 将 `package.json` 中命令标题 `"title": "打开 CodeMaker"` 改为 `"title": "打开 Y3Maker"` (`contributes.commands`)
- [x] 1.4 将 `package.json` 中配置项命名空间 `"CodeMaker.CodeChatApiKey"` 等 4 个配置项的前缀从 `CodeMaker` 改为 `Y3Maker`，包括 title 和 description 中的品牌名 (`contributes.configuration.properties`)
- [x] 1.5 将 `package.json` 中配置项 title/description 文本中所有 "CodeMaker" 改为 "Y3Maker"

## 2. 主菜单入口 — src/mainMenu/

- [x] 2.1 将 `src/mainMenu/pages/codemaker.ts` 中 TreeNode 显示文本 `'打开 CodeMaker'` 改为 `'打开 Y3Maker'`，tooltip `'打开 CodeMaker AI 助手面板'` 改为 `'打开 Y3Maker AI 助手面板'`，command title `'打开 CodeMaker'` 改为 `'打开 Y3Maker'`

## 3. VSCode Settings 配置读取 — src/codemaker/configProvider.ts

- [x] 3.1 将 `src/codemaker/configProvider.ts` 中 `vscode.workspace.getConfiguration('CodeMaker')` 改为 `vscode.workspace.getConfiguration('Y3Maker')`

## 4. 配置变更监听 — src/codemaker/index.ts

- [x] 4.1 将 `src/codemaker/index.ts` 中 `e.affectsConfiguration('CodeMaker.CodeChatApiKey')` 等 4 处配置监听改为 `Y3Maker.*` 前缀
- [x] 4.2 将 `src/codemaker/index.ts` 中 `vscode.window.showErrorMessage('CodeMaker API Server 启动失败...')` 改为 `'Y3Maker API Server 启动失败...'`

## 5. 日志前缀替换 — src/codemaker/*.ts

- [x] 5.1 将 `src/codemaker/apiServer.ts` 中所有 `[CodeMaker API]`、`[CodeMaker API Error]` 日志前缀改为 `[Y3Maker API]`、`[Y3Maker API Error]`（约 7 处）
- [x] 5.2 将 `src/codemaker/index.ts` 中 `[CodeMaker]` 日志前缀改为 `[Y3Maker]`（约 2 处）
- [x] 5.3 将 `src/codemaker/webviewProvider.ts` 中所有 `[CodeMaker]`、`[CodeMaker MSG]`、`[CodeMaker Bridge]` 日志前缀改为 `[Y3Maker]`、`[Y3Maker MSG]`、`[Y3Maker Bridge]`（约 20 处）
- [x] 5.4 将 `src/codemaker/messageHandlers.ts` 中所有 `[CodeMaker]`、`[CodeMaker WebView]` 日志前缀改为 `[Y3Maker]`、`[Y3Maker WebView]`（约 15 处）

## 6. Webview HTML 品牌名 — src/codemaker/webviewProvider.ts

- [x] 6.1 将 `src/codemaker/webviewProvider.ts` 中 HTML `<title>CodeMaker</title>` 改为 `<title>Y3Maker</title>`

## 7. .codemaker → .y3maker 目录路径替换 — src/

- [x] 7.1 将 `src/extension.ts` 中 y3-lualib 复制逻辑的源路径 `.codemaker` 改为 `.y3maker`（codemakerSource、codemakerTarget 两处 Uri），日志文本 `'复制 .codemaker 目录失败'` 改为 `'复制 .y3maker 目录失败'`
- [x] 7.2 将 `src/codemaker/webviewProvider.ts` 中 `.codemaker/skills` 路径改为 `.y3maker/skills`（约 1 处）
- [x] 7.3 将 `src/codemaker/messageHandlers.ts` 中所有 `.codemaker` 路径引用改为 `.y3maker`，包括：`.codemaker/rules`、`.codemaker/skills`、`.codemaker.codebase.md`、`.codemaker.codebase`、`.codemaker/skills/${skillName}.md`（约 12 处）
- [x] 7.4 将 `src/codemaker/mcpHandlers/index.ts` 中 `.codemaker` 目录路径改为 `.y3maker`（约 1 处）

## 8. .codemaker → .y3maker 目录路径替换 — resources/webview_source_code/src/

- [x] 8.1 将 `resources/webview_source_code/src/store/skills/index.ts` 中 `.codemaker/skills` 改为 `.y3maker/skills`（约 2 处）
- [x] 8.2 将 `resources/webview_source_code/src/store/workspace/index.ts` 中 `.codemaker.codebase.md` 引用改为 `.y3maker.codebase.md`（约 2 处）
- [x] 8.3 将 `resources/webview_source_code/src/store/workspace/tools/codewiki.ts` 中 `.codemaker/codewiki/wiki.json` 改为 `.y3maker/codewiki/wiki.json`（约 2 处）
- [x] 8.4 将 `resources/webview_source_code/src/services/builtInPrompts/rules.ts` 中提示词里的 `.codemaker/rules/rules.mdc` 改为 `.y3maker/rules/rules.mdc`（约 2 处）
- [x] 8.5 将 `resources/webview_source_code/src/services/builtInPrompts/spec.ts` 中提示词里的 `.codemaker/rules/rules.mdc` 改为 `.y3maker/rules/rules.mdc`（约 2 处）
- [x] 8.6 将 `resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/CodeWiki/BasicPrompt.ts` 中 `.codemaker/codewiki/wiki.json` 改为 `.y3maker/codewiki/wiki.json`

## 9. 自动迁移逻辑 — src/extension.ts（新增代码）

- [x] 9.1 在 `src/extension.ts` 中新增 `.codemaker` → `.y3maker` 目录自动迁移函数：检测 `.y3maker` 不存在但 `.codemaker` 存在时，自动 `vscode.workspace.fs.rename`；失败时 `showWarningMessage` 提示用户
- [x] 9.2 在同一函数中处理 `.codemaker.codebase.md` → `.y3maker.codebase.md` 文件迁移
- [x] 9.3 在 `initCodeMaker(context)` 调用之前插入迁移函数调用，确保迁移在模块初始化之前完成

## 10. LLM 系统提示词 — resources/webview_source_code/src/

- [x] 10.1 将 `resources/webview_source_code/src/store/workspace/constructH75Prompt.ts` 中 `'你叫 CodeMaker'` 改为 `'你叫 Y3Maker'`（1 处）
- [x] 10.2 将 `resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts` 中 `'你叫 CodeMaker'` 改为 `'你叫 Y3Maker'`（2 处）
- [x] 10.3 将 `resources/webview_source_code/src/store/config.ts` 中系统 prompt `" CodeMaker 编程助手"` 改为 `" Y3Maker 编程助手"`，以及 prompt 正文中所有 `CodeMaker` 改为 `Y3Maker`（约 5 处）
- [x] 10.4 将 `resources/webview_source_code/src/store/mask.ts` 中系统 prompt `" CodeMaker 编程助手"` 改为 `" Y3Maker 编程助手"`，以及 prompt 正文中所有 `CodeMaker` 改为 `Y3Maker`（约 5 处）

## 11. 用户可见提示文本 — resources/webview_source_code/src/

- [x] 11.1 将 `resources/webview_source_code/src/utils/toast.ts` 中 `'联系 CodeMaker 团队'` 改为 `'联系 Y3Maker 团队'`
- [x] 11.2 将 `resources/webview_source_code/src/utils/chatAttachParseHandler.ts` 中 `'parsed by CodeMaker'` 改为 `'parsed by Y3Maker'`
- [x] 11.3 将 `resources/webview_source_code/src/utils/specVersionUtils.ts` 中 `'需要 CodeMaker Extension'`、`'需要 CodeMaker Plugin'`、`'需要更新 CodeMaker 版本'` 改为 Y3Maker（3 处）
- [x] 11.4 将 `resources/webview_source_code/src/services/prompt.ts` 中 `CODEMAKER_CLASSIFY = 'CodeMaker'` 改为 `'Y3Maker'`（1 处，用户可见分类名）
- [x] 11.5 将 `resources/webview_source_code/src/hooks/useDraftInput.ts` 中 localStorage key `'codemaker-draft-input-'` 改为 `'y3maker-draft-input-'`（用户不直接可见但属于品牌标识）

## 12. 低风险 API/HTTP 变更 — resources/webview_source_code/src/

- [x] 12.1 将 `resources/webview_source_code/src/services/index.ts` 中 HTTP header `'codemaker-version'` 改为 `'y3maker-version'`（1 处）
- [x] 12.2 将 `resources/webview_source_code/src/services/common.ts` 中 HTTP header `'codemaker-version'` 改为 `'y3maker-version'`（1 处）
- [x] 12.3 将 `resources/webview_source_code/src/services/useChatStream.ts` 中 HTTP header `'codemaker-version'` 改为 `'y3maker-version'`（1 处）
- [x] 12.4 将 `resources/webview_source_code/src/services/Agents/Stream/Base/index.ts` 中 HTTP header `'codemaker-version'` 改为 `'y3maker-version'`（1 处）
- [x] 12.5 将 `resources/webview_source_code/src/utils/reviewReporter.ts` 中 API 路径 `/proxy/codemaker/reports` 改为 `/proxy/y3maker/reports`（1 处）

## 13. Settings 打开命令中的筛选词 — src/codemaker/messageHandlers.ts

- [x] 13.1 将 `src/codemaker/messageHandlers.ts` 中 `'workbench.action.openSettings', 'CodeMaker'` 改为 `'workbench.action.openSettings', 'Y3Maker'`（2 处）

## 14. 验证与回归

- [x] 14.1 全局搜索项目中剩余的用户可见 "CodeMaker" 文本（排除内部变量名、注释、npm 包名），确认无遗漏
- [ ] 14.2 构建项目 (`npm run build`) 确认无编译错误
- [ ] 14.3 手动测试：全新安装场景 — 验证 UI 文本、Settings 配置项、提示词均显示 Y3Maker
- [ ] 14.4 手动测试：升级场景 — 验证 `.codemaker` → `.y3maker` 自动迁移正常工作
- [ ] 14.5 手动测试：迁移失败场景 — 验证 warning 提示正常弹出
- [x] 14.6 ~~协同确认~~ 后端 api-server 不涉及 header/路由读取，无需改动
- [ ] 14.7 协同确认：y3-lualib 仓库已将 `.codemaker/` 目录改名为 `.y3maker/`
