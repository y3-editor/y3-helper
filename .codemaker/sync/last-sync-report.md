# CodeMaker 同步报告
- 生成时间: 2026-04-29T07:04:57.921Z
- 上游 webui: `d6c2c681` → `22850b93` (2026-03-09 → 2026-03-10, 17 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 29 |
| 🟡 REVIEW (需对比决策) | 8 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 10 |
| 合计 | 47 |
| **🏷️ 涉及新需求 (需用户确认)** | **32** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | webui | conf/default.nginx.tpl | - | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 2 | 🟡 REVIEW | webui | package.json | resources/webview_source_code/package.json | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 3 | 🔴 SKIP | webui | pnpm-lock.yaml | - | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 4 | 🟢 SAFE | webui | src/components/ErrorBoundary/index.tsx | resources/webview_source_code/src/components/ErrorBoundary/index.tsx | 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 6 | 🟢 SAFE | webui | src/components/UserDashboard/UserDashboard.tsx | resources/webview_source_code/src/components/UserDashboard/UserDashboard.tsx | 48661e73 feat: 普通聊天支持限额 |
| 7 | 🟢 SAFE | webui | src/main.tsx | resources/webview_source_code/src/main.tsx | 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 8 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | 403e290a feat: 移除 Skills 工具项的空数组判断逻辑; 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 9 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | 27b09679 feat: 移除新建并行会话按钮的禁用状态 |
| 11 | 🟢 SAFE | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | 48661e73 feat: 普通聊天支持限额 |
| 12 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | 48661e73 feat: 普通聊天支持限额 |
| 13 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | 5ee5bf56 feat: 优化按钮确认框 |
| 14 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | c94a33dd feat: 兼容图片路径判定; 5ee5bf56 feat: 优化按钮确认框 |
| 16 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector.tsx | - | d1b3475e feat: 优化聊天模型选择逻辑，支持用户手动选择记忆; 48661e73 feat: 普通聊天支持限额 |
| 17 | 🟢 SAFE | webui | src/routes/CodeChat/ChatSamples.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSamples.tsx | 48661e73 feat: 普通聊天支持限额 |
| 18 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | c94a33dd feat: 兼容图片路径判定; 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题; 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 19 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChatInputActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChatInputActionBar.tsx | 48661e73 feat: 普通聊天支持限额 |
| 24 | 🔴 SKIP | webui | src/routes/CodeReview/RequestTree.tsx | - | aca6feb1 feat: 实现 Code Review 过滤 issues 同步到 diff 视图功能 |
| 27 | 🟢 SAFE | webui | src/services/error.ts | resources/webview_source_code/src/services/error.ts | 48661e73 feat: 普通聊天支持限额 |
| 28 | 🟡 REVIEW | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | 48661e73 feat: 普通聊天支持限额; 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 29 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | c94a33dd feat: 兼容图片路径判定; 48661e73 feat: 普通聊天支持限额; 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题; 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 32 | 🔴 SKIP | webui | src/telemetry/const.ts | - | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 33 | 🔴 SKIP | webui | src/telemetry/otel.ts | - | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 34 | 🟢 SAFE | webui | src/types/teamReview.ts | resources/webview_source_code/src/types/teamReview.ts | aca6feb1 feat: 实现 Code Review 过滤 issues 同步到 diff 视图功能 |
| 36 | 🟢 SAFE | webui | src/utils/chatMention.ts | resources/webview_source_code/src/utils/chatMention.ts | 48661e73 feat: 普通聊天支持限额 |
| 37 | 🟢 SAFE | webui | src/utils/chunkErrorDialog.ts | resources/webview_source_code/src/utils/chunkErrorDialog.ts | 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 38 | 🟢 SAFE | webui | src/utils/chunkErrorHandler.ts | resources/webview_source_code/src/utils/chunkErrorHandler.ts | 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 39 | 🟢 SAFE | webui | src/utils/error.ts | resources/webview_source_code/src/utils/error.ts | 48661e73 feat: 普通聊天支持限额 |
| 40 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | c94a33dd feat: 兼容图片路径判定 |
| 42 | 🟢 SAFE | webui | src/utils/report.ts | resources/webview_source_code/src/utils/report.ts | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |
| 43 | 🟢 SAFE | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 44 | 🟢 SAFE | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | c94a33dd feat: 兼容图片路径判定; 5c0b9316 feat: 修复 dynamic import chunk 加载失败无提示问题 |
| 47 | 🟡 REVIEW | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | 343e6360 feat:埋点事件双写 OTEL + 新增看板所需 Span 属性 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 4 | webui | src/components/ErrorBoundary/index.tsx | resources/webview_source_code/src/components/ErrorBoundary/index.tsx | modified | 🏷️ 需确认 |
| 5 | webui | src/components/Markdown/BrainMakerImage.tsx | resources/webview_source_code/src/components/Markdown/BrainMakerImage.tsx | modified |  |
| 6 | webui | src/components/UserDashboard/UserDashboard.tsx | resources/webview_source_code/src/components/UserDashboard/UserDashboard.tsx | modified | 🏷️ 需确认 |
| 7 | webui | src/main.tsx | resources/webview_source_code/src/main.tsx | modified | 🏷️ 需确认 |
| 10 | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | modified |  |
| 11 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified | 🏷️ 需确认 |
| 12 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified | 🏷️ 需确认 |
| 13 | webui | src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | modified | 🏷️ 需确认 |
| 14 | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | modified | 🏷️ 需确认 |
| 15 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified |  |
| 17 | webui | src/routes/CodeChat/ChatSamples.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSamples.tsx | modified | 🏷️ 需确认 |
| 23 | webui | src/routes/CodeReview/IssueFilter.tsx | resources/webview_source_code/src/routes/CodeReview/IssueFilter.tsx | modified |  |
| 25 | webui | src/routes/CodeSearch/CodeSearch.tsx | resources/webview_source_code/src/routes/CodeSearch/CodeSearch.tsx | modified |  |
| 26 | webui | src/services/Agents/Stream/Base/index.ts | resources/webview_source_code/src/services/Agents/Stream/Base/index.ts | modified |  |
| 27 | webui | src/services/error.ts | resources/webview_source_code/src/services/error.ts | modified | 🏷️ 需确认 |
| 30 | webui | src/store/diff.ts | resources/webview_source_code/src/store/diff.ts | modified |  |
| 31 | webui | src/store/review.ts | resources/webview_source_code/src/store/review.ts | modified |  |
| 34 | webui | src/types/teamReview.ts | resources/webview_source_code/src/types/teamReview.ts | modified | 🏷️ 需确认 |
| 35 | webui | src/utils/abort.ts | resources/webview_source_code/src/utils/abort.ts | added |  |
| 36 | webui | src/utils/chatMention.ts | resources/webview_source_code/src/utils/chatMention.ts | modified | 🏷️ 需确认 |
| 37 | webui | src/utils/chunkErrorDialog.ts | resources/webview_source_code/src/utils/chunkErrorDialog.ts | added | 🏷️ 需确认 |
| 38 | webui | src/utils/chunkErrorHandler.ts | resources/webview_source_code/src/utils/chunkErrorHandler.ts | added | 🏷️ 需确认 |
| 39 | webui | src/utils/error.ts | resources/webview_source_code/src/utils/error.ts | modified | 🏷️ 需确认 |
| 40 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 41 | webui | src/utils/localAiExplain.ts | resources/webview_source_code/src/utils/localAiExplain.ts | modified |  |
| 42 | webui | src/utils/report.ts | resources/webview_source_code/src/utils/report.ts | modified | 🏷️ 需确认 |
| 43 | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | modified | 🏷️ 需确认 |
| 44 | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | modified | 🏷️ 需确认 |
| 45 | webui | src/vite-env.d.ts | resources/webview_source_code/src/vite-env.d.ts | modified |  |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | webui | package.json | resources/webview_source_code/package.json | Y3有定制修改 | modified | 🏷️ 需确认 |
| 8 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 9 | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 18 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 19 | webui | src/routes/CodeChat/CodeChatInputActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChatInputActionBar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 28 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 29 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 47 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (10 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | conf/default.nginx.tpl | 在排除列表中 |
| 3 | webui | pnpm-lock.yaml | 在排除列表中 |
| 16 | webui | src/routes/CodeChat/ChatModelSelector.tsx | Y3不需要模型选择功能，固定使用VSCode Settings中的模型配置 |
| 20 | webui | src/routes/CodeCoverage/ActionPopover.tsx | Y3无代码覆盖率模块 |
| 21 | webui | src/routes/CodeCoverage/CodeCoverage.tsx | Y3无代码覆盖率模块 |
| 22 | webui | src/routes/CodeCoverage/CodeCoverageTree.tsx | Y3无代码覆盖率模块 |
| 24 | webui | src/routes/CodeReview/RequestTree.tsx | Y3无代码审查功能，不需要审查请求树组件 |
| 32 | webui | src/telemetry/const.ts | 在排除列表中 |
| 33 | webui | src/telemetry/otel.ts | 在排除列表中 |
| 46 | webui | vite-plugin-abort-source.ts | 在排除列表中 |

</details>
