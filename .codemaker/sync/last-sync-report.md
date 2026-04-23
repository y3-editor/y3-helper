# CodeMaker 同步报告
- 生成时间: 2026-04-23T08:39:08.923Z
- 上游 webui: `bd4434f7` → `dc1946bb` (2026-02-09 → 2026-02-10, 6 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 34 |
| 🟡 REVIEW (需对比决策) | 2 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 36 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | modified |
| 3 | webui | src/ThemeProvider.tsx | resources/webview_source_code/src/ThemeProvider.tsx | modified |
| 4 | webui | src/components/FeatureTour/tours/devKnowledgeTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/devKnowledgeTour.ts | modified |
| 5 | webui | src/components/Icon/index.tsx | resources/webview_source_code/src/components/Icon/index.tsx | modified |
| 6 | webui | src/components/Split/Split.tsx | resources/webview_source_code/src/components/Split/Split.tsx | modified |
| 7 | webui | src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | resources/webview_source_code/src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | modified |
| 8 | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | modified |
| 9 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | modified |
| 10 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified |
| 11 | webui | src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | modified |
| 12 | webui | src/routes/CodeChat/ChatNavigationButtons.tsx | resources/webview_source_code/src/routes/CodeChat/ChatNavigationButtons.tsx | modified |
| 13 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PluginAppList.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PluginAppList.tsx | modified |
| 14 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | modified |
| 15 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified |
| 16 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | modified |
| 17 | webui | src/routes/CodeChat/CodeChatInputActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChatInputActionBar.tsx | modified |
| 18 | webui | src/routes/CodeChat/CodebaseModePicker.tsx | resources/webview_source_code/src/routes/CodeChat/CodebaseModePicker.tsx | modified |
| 19 | webui | src/routes/CodeChat/OpenSpecUpdateModal.tsx | resources/webview_source_code/src/routes/CodeChat/OpenSpecUpdateModal.tsx | added |
| 20 | webui | src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/ChangeTabNav.tsx | modified |
| 21 | webui | src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | resources/webview_source_code/src/routes/CodeChat/SpecActiveChangeGuide/FeatureTabNav.tsx | modified |
| 22 | webui | src/routes/CodeChat/SpecInitModal.tsx | resources/webview_source_code/src/routes/CodeChat/SpecInitModal.tsx | modified |
| 23 | webui | src/routes/CodeChat/TokenUsageIndicator.tsx | resources/webview_source_code/src/routes/CodeChat/TokenUsageIndicator.tsx | modified |
| 24 | webui | src/routes/CodeReview/LocalReview/LocalReview.tsx | resources/webview_source_code/src/routes/CodeReview/LocalReview/LocalReview.tsx | modified |
| 25 | webui | src/routes/CodeReview/LocalReview/localReviewConfig.test.ts | resources/webview_source_code/src/routes/CodeReview/LocalReview/localReviewConfig.test.ts | added |
| 26 | webui | src/routes/CodeReview/TeamReview.tsx | resources/webview_source_code/src/routes/CodeReview/TeamReview.tsx | modified |
| 27 | webui | src/routes/CodeReview/utils.ts | resources/webview_source_code/src/routes/CodeReview/utils.ts | modified |
| 28 | webui | src/services/builtInPrompts/index.ts | resources/webview_source_code/src/services/builtInPrompts/index.ts | modified |
| 29 | webui | src/services/builtInPrompts/openSpecPrompts.ts | resources/webview_source_code/src/services/builtInPrompts/openSpecPrompts.ts | modified |
| 30 | webui | src/services/builtInPrompts/openSpecPromptsV1.ts | resources/webview_source_code/src/services/builtInPrompts/openSpecPromptsV1.ts | added |
| 31 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | modified |
| 32 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified |
| 33 | webui | src/utils/compressionPrompt.ts | resources/webview_source_code/src/utils/compressionPrompt.ts | modified |
| 34 | webui | src/utils/report.ts | resources/webview_source_code/src/utils/report.ts | modified |
| 35 | webui | src/utils/specVersionUtils.ts | resources/webview_source_code/src/utils/specVersionUtils.ts | modified |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |
|---|------|---------|--------|------|---------|
| 1 | webui | package.json | resources/webview_source_code/package.json | Y3有定制修改 | modified |
| 36 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified |
