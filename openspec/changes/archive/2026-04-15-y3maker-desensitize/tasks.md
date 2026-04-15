## 1. WebView 前端源码脱敏

- [x] 1.1 修改 `resources/webview_source_code/src/routes/CodeChat/ChatMaskSelector/ChatMaskManageModel.tsx` L1647，将 `: 获取当前提交者corp邮箱前缀，如 gzxiaoming` 替换为 `: 获取当前用户名`
- [x] 1.2 修改 `resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/ChatPromptManageModel.tsx` L401，将 `: 获取当前提交者 corp 邮箱前缀，如 gzxiaoming` 替换为 `: 获取当前用户名`

## 2. WebView 编译产物重新构建

- [x] 2.1 在 `resources/webview_source_code/` 目录下执行 WebView 构建命令，生成新的编译产物
- [x] 2.2 验证 `resources/codemaker/webview/assets/` 下的 JS 文件中不再包含 `corp邮箱`、`gzxiaoming` 等敏感字符串

## 3. 项目说明文档脱敏

- [x] 3.1 修改 `PR_DESCRIPTION.md` L1 标题，将"网易内部开发集成合并"替换为通用的开源描述
- [x] 3.2 修改 `PR_DESCRIPTION.md` L5 正文，将"网易内部团队"相关描述替换为通用的开源贡献说明

## 4. OpenSpec 归档文档脱敏

- [x] 4.1 修改 `openspec/changes/archive/2026-03-13-docs-vscode-plugin-learning-98274/proposal.md` L3，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.2 修改 `openspec/changes/archive/2026-03-13-project-level-workspace-global-script-98276/proposal.md` L3，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.3 修改 `openspec/changes/archive/2026-03-17-vscode-save-gmp-98280/proposal.md` L3，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.4 修改 `openspec/changes/archive/2026-03-18-feat-codemaker-integration-with-y3helper-98275/proposal.md` L5，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.5 修改 `openspec/changes/archive/2026-03-23-feat-mcp-server-connection-98275/proposal.md` L5，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.6 修改 `openspec/changes/archive/2026-3-23-fix-codemaker-webview-message-handlers-98275/proposal.md` L3，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号
- [x] 4.7 修改 `openspec/changes/archive/2026-04-07-codemaker-session-memory-storage-98702/proposal.md` L12，移除 `up1.pm.netease.com` URL，仅保留 Issue 编号

## 5. 脱敏验证

- [x] 5.1 对 Y3Maker 相关目录执行全局关键词扫描，确认 `corp邮箱`、`gzxiaoming`、`网易内部` 等敏感关键词已全部清除
- [x] 5.2 确认 Y3Helper 核心模块（`src/tools/version.ts` 等）未被修改
- [x] 5.3 确认 `openspec/config.yaml` 未被修改
