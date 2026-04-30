# CodeMaker 同步报告
- 生成时间: 2026-04-30T09:06:54.714Z
- 上游 webui: `53d5e386` → `9877bca6` (2026-03-23 → 2026-03-24, 9 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 18 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 1 |
| 合计 | 23 |
| **🏷️ 涉及新需求 (需用户确认)** | **23** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | 39be0a52 fix: 禁用 Subagent 功能; 463669f4 fix: 优化表单输入项的删除逻辑 |
| 2 | 🟡 REVIEW | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 3 | 🟢 SAFE | webui | src/ThemeContext.ts | resources/webview_source_code/src/ThemeContext.ts | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 4 | 🟢 SAFE | webui | src/ThemeProvider.tsx | resources/webview_source_code/src/ThemeProvider.tsx | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 5 | 🟢 SAFE | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | 08652304 refactor: 移除会话关联工作区功能及相关代码 |
| 6 | 🟢 SAFE | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | 08652304 refactor: 移除会话关联工作区功能及相关代码 |
| 7 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | 08652304 refactor: 移除会话关联工作区功能及相关代码 |
| 8 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector.tsx | - | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 9 | 🟢 SAFE | webui | src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | 781720ce feat: 重构 Spec 关联状态导航栏，支持关联换绑，调整关联文件为下拉式文件导航按钮 |
| 10 | 🟢 SAFE | webui | src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | 781720ce feat: 重构 Spec 关联状态导航栏，支持关联换绑，调整关联文件为下拉式文件导航按钮 |
| 11 | 🟢 SAFE | webui | src/routes/CodeChat/SpecActiveChangeGuide/SpecAssociationBar.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/SpecAssociationBar.tsx | 781720ce feat: 重构 Spec 关联状态导航栏，支持关联换绑，调整关联文件为下拉式文件导航按钮; 9877bca6 fix: 修正 SpecAssociationBar 最大宽度计算单位 |
| 12 | 🟢 SAFE | webui | src/routes/CodeChat/SpecActiveChangeGuide/index.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/index.tsx | 781720ce feat: 重构 Spec 关联状态导航栏，支持关联换绑，调整关联文件为下拉式文件导航按钮 |
| 13 | 🟢 SAFE | webui | src/routes/CodeReview/CodeReview.tsx | resources/webview_source_code/src/routes/CodeReview/CodeReview.tsx | e72d9f43 feat: 新增 LocalReview 面板自定义滚动条样式 |
| 14 | 🟢 SAFE | webui | src/routes/CodeReview/LocalReview/LocalReview.module.scss | resources/webview_source_code/src/routes/CodeReview/LocalReview/LocalReview.module.scss | e72d9f43 feat: 新增 LocalReview 面板自定义滚动条样式 |
| 15 | 🟢 SAFE | webui | src/routes/CodeReview/LocalReview/LocalReview.tsx | resources/webview_source_code/src/routes/CodeReview/LocalReview/LocalReview.tsx | e72d9f43 feat: 新增 LocalReview 面板自定义滚动条样式 |
| 16 | 🟢 SAFE | webui | src/routes/Help/index.tsx | resources/webview_source_code/src/routes/Help/index.tsx | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 17 | 🟢 SAFE | webui | src/services/auth.ts | resources/webview_source_code/src/services/auth.ts | 35a64a01 feat: 优化请求拦截器并增强身份验证处理 |
| 18 | 🟢 SAFE | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | 35a64a01 feat: 优化请求拦截器并增强身份验证处理; 11d4eced refactor: 优化登录状态校验逻辑 |
| 19 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | 08652304 refactor: 移除会话关联工作区功能及相关代码 |
| 20 | 🟢 SAFE | webui | src/store/config.ts | resources/webview_source_code/src/store/config.ts | 463669f4 fix: 优化表单输入项的删除逻辑 |
| 21 | 🟢 SAFE | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | 0f7b8491 refactor: 简化 MCP 工具 Input Schema 的格式化输出 |
| 22 | 🟢 SAFE | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | 781720ce feat: 重构 Spec 关联状态导航栏，支持关联换绑，调整关联文件为下拉式文件导航按钮 |
| 23 | 🟡 REVIEW | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | 35a64a01 feat: 优化请求拦截器并增强身份验证处理 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | webui | src/ThemeContext.ts | resources/webview_source_code/src/ThemeContext.ts | modified | 🏷️ 需确认 |
| 4 | webui | src/ThemeProvider.tsx | resources/webview_source_code/src/ThemeProvider.tsx | modified | 🏷️ 需确认 |
| 5 | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | modified | 🏷️ 需确认 |
| 6 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified | 🏷️ 需确认 |
| 7 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified | 🏷️ 需确认 |
| 9 | webui | src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | modified | 🏷️ 需确认 |
| 10 | webui | src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | modified | 🏷️ 需确认 |
| 11 | webui | src/routes/CodeChat/SpecActiveChangeGuide/SpecAssociationBar.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/SpecAssociationBar.tsx | added | 🏷️ 需确认 |
| 12 | webui | src/routes/CodeChat/SpecActiveChangeGuide/index.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/index.tsx | modified | 🏷️ 需确认 |
| 13 | webui | src/routes/CodeReview/CodeReview.tsx | resources/webview_source_code/src/routes/CodeReview/CodeReview.tsx | modified | 🏷️ 需确认 |
| 14 | webui | src/routes/CodeReview/LocalReview/LocalReview.module.scss | resources/webview_source_code/src/routes/CodeReview/LocalReview/LocalReview.module.scss | added | 🏷️ 需确认 |
| 15 | webui | src/routes/CodeReview/LocalReview/LocalReview.tsx | resources/webview_source_code/src/routes/CodeReview/LocalReview/LocalReview.tsx | modified | 🏷️ 需确认 |
| 16 | webui | src/routes/Help/index.tsx | resources/webview_source_code/src/routes/Help/index.tsx | modified | 🏷️ 需确认 |
| 17 | webui | src/services/auth.ts | resources/webview_source_code/src/services/auth.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified | 🏷️ 需确认 |
| 20 | webui | src/store/config.ts | resources/webview_source_code/src/store/config.ts | modified | 🏷️ 需确认 |
| 21 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified | 🏷️ 需确认 |
| 22 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 1 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 19 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 23 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (1 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 8 | webui | src/routes/CodeChat/ChatModelSelector.tsx | Y3不需要模型选择功能，固定使用VSCode Settings中的模型配置 |

</details>
