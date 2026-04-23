# CodeMaker 同步报告
- 生成时间: 2026-04-23T09:13:10.574Z
- 上游 webui: `dc1946bb` → `85d655c8` (2026-02-10 → 2026-02-12, 12 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 52 |
| 🟡 REVIEW (需对比决策) | 2 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 5 |
| 合计 | 59 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 1 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | modified |
| 3 | webui | src/components/FeatureTour/tours/chatEntryTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/chatEntryTour.ts | modified |
| 4 | webui | src/components/FeatureTour/tours/codebaseSpecTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/codebaseSpecTour.ts | modified |
| 5 | webui | src/components/FeatureTour/tours/devKnowledgeTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/devKnowledgeTour.ts | modified |
| 6 | webui | src/components/FeatureTour/tours/index.ts | resources/webview_source_code/src/components/FeatureTour/tours/index.ts | modified |
| 7 | webui | src/components/FeatureTour/tours/parallelSessionTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/parallelSessionTour.ts | modified |
| 8 | webui | src/components/FeatureTour/tours/userDashboardTour.ts | resources/webview_source_code/src/components/FeatureTour/tours/userDashboardTour.ts | added |
| 9 | webui | src/components/RulesPanel/index.tsx | resources/webview_source_code/src/components/RulesPanel/index.tsx | modified |
| 10 | webui | src/components/UserDashboard/UserDashboard.tsx | resources/webview_source_code/src/components/UserDashboard/UserDashboard.tsx | modified |
| 11 | webui | src/context/PanelContext.tsx | resources/webview_source_code/src/context/PanelContext.tsx | modified |
| 12 | webui | src/hooks/useChatStreamNotification.ts | resources/webview_source_code/src/hooks/useChatStreamNotification.ts | modified |
| 13 | webui | src/hooks/useDraftInput.ts | resources/webview_source_code/src/hooks/useDraftInput.ts | modified |
| 14 | webui | src/hooks/useSubmitHandler.ts | resources/webview_source_code/src/hooks/useSubmitHandler.ts | modified |
| 15 | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | modified |
| 16 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified |
| 17 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified |
| 18 | webui | src/routes/CodeChat/ChatMessageActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessageActionBar.tsx | modified |
| 19 | webui | src/routes/CodeChat/ChatMessagesList/EditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/EditFile.tsx | modified |
| 20 | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | modified |
| 21 | webui | src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | modified |
| 22 | webui | src/routes/CodeChat/ChatMessagesList/PreviewCodewikiStructure.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/PreviewCodewikiStructure.tsx | modified |
| 23 | webui | src/routes/CodeChat/ChatMessagesList/Retry.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/Retry.tsx | modified |
| 24 | webui | src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCall.tsx | modified |
| 25 | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | modified |
| 26 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified |
| 27 | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | modified |
| 28 | webui | src/routes/CodeChat/ChatModelSelector.tsx | resources/webview_source_code/src/routes/CodeChat/ChatModelSelector.tsx | modified |
| 29 | webui | src/routes/CodeChat/ChatSamples.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSamples.tsx | modified |
| 30 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/ChatPromptManageModel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/ChatPromptManageModel.tsx | modified |
| 31 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified |
| 32 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | modified |
| 33 | webui | src/routes/CodeChat/CodeChatInputActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChatInputActionBar.tsx | modified |
| 34 | webui | src/routes/CodeChat/CodebaseExceedCost.tsx | resources/webview_source_code/src/routes/CodeChat/CodebaseExceedCost.tsx | added |
| 35 | webui | src/routes/CodeChat/CodebaseModePicker.tsx | resources/webview_source_code/src/routes/CodeChat/CodebaseModePicker.tsx | modified |
| 36 | webui | src/routes/CodeChat/GlobalDataLoader/Hooks/useLoadUserQuota.tsx | resources/webview_source_code/src/routes/CodeChat/GlobalDataLoader/Hooks/useLoadUserQuota.tsx | added |
| 37 | webui | src/routes/CodeChat/GlobalDataLoader/index.tsx | resources/webview_source_code/src/routes/CodeChat/GlobalDataLoader/index.tsx | renamed |
| 38 | webui | src/routes/CodeChat/OpenSpecUpdateModal.tsx | resources/webview_source_code/src/routes/CodeChat/OpenSpecUpdateModal.tsx | modified |
| 39 | webui | src/routes/CodeChat/SpecInitModal.tsx | resources/webview_source_code/src/routes/CodeChat/SpecInitModal.tsx | modified |
| 40 | webui | src/routes/CodeChat/components/SetupErrorDisplay.tsx | resources/webview_source_code/src/routes/CodeChat/components/SetupErrorDisplay.tsx | added |
| 46 | webui | src/services/common.ts | resources/webview_source_code/src/services/common.ts | modified |
| 47 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | modified |
| 48 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | modified |
| 49 | webui | src/store/chatBill.ts | resources/webview_source_code/src/store/chatBill.ts | added |
| 50 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified |
| 51 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified |
| 52 | webui | src/store/workspace/tools/read.ts | resources/webview_source_code/src/store/workspace/tools/read.ts | modified |
| 53 | webui | src/utils/chatAttachParseHandler.ts | resources/webview_source_code/src/utils/chatAttachParseHandler.ts | modified |
| 54 | webui | src/utils/chatNotification.ts | resources/webview_source_code/src/utils/chatNotification.ts | modified |
| 55 | webui | src/utils/eventbus.ts | resources/webview_source_code/src/utils/eventbus.ts | modified |
| 56 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified |
| 57 | webui | src/utils/specVersionUtils.ts | resources/webview_source_code/src/utils/specVersionUtils.ts | modified |
| 58 | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | modified |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |
|---|------|---------|--------|------|---------|
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | Y3有定制修改 | modified |
| 59 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified |

<details>
<summary>⚪ SKIP - 已排除 (5 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 41 | webui | src/routes/CodeCoverage/CodeCoverage.tsx | Y3无代码覆盖率模块 |
| 42 | webui | src/routes/CodeCoverage/Coverage.tsx | Y3无代码覆盖率模块 |
| 43 | webui | src/routes/CodeCoverage/TagShowFilter.tsx | Y3无代码覆盖率模块 |
| 44 | webui | src/routes/CodeReview/IssueFilter.tsx | Y3无代码审查模块，依赖store/localReview、store/review、store/teamReview、services/localReview等Y3不存在的模块 |
| 45 | webui | src/routes/CodeReview/RequestTree.tsx | Y3无代码审查模块，依赖store/localReview、store/review、store/teamReview、services/localReview等Y3不存在的模块 |

</details>
