# CodeMaker 同步报告
- 生成时间: 2026-04-29T07:59:26.785Z
- 上游 webui: `e7fd4601` → `d406cde1` (2026-03-11 → 2026-03-12, 12 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 33 |
| 🟡 REVIEW (需对比决策) | 7 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 2 |
| 合计 | 42 |
| **🏷️ 涉及新需求 (需用户确认)** | **30** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 2 | 🟡 REVIEW | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | ef4859e7 feat: 新增 Skills 配置管理功能; 77debd9d feat: 添加兼容性消息类型用于 JetBrians 触发代码质量问题自动修复 |
| 7 | 🟢 SAFE | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | ca4d34e3 feat: tokens消耗支持查看组成部分; 51a609bc feat: 兼容错误提示; 06946135 feat: 兼容普通聊天@大文件功能; d406cde1 feat: 兼容GPT5.4异常消息&更改提示文案 |
| 8 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 11 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/UserMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/UserMessage.tsx | 40067e62 feat: 允许从已压缩消息重新发起对话 |
| 14 | 🟢 SAFE | webui | src/routes/CodeChat/ChatSkillPromptRunner.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSkillPromptRunner.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 15 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useFilteredAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useFilteredAttach.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 16 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectCodebaseAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectCodebaseAttach.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 17 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectDocsetAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectDocsetAttach.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 18 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 19 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 20 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | 77debd9d feat: 添加兼容性消息类型用于 JetBrians 触发代码质量问题自动修复 |
| 21 | 🟢 SAFE | webui | src/routes/CodeChat/SkillConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/SkillConfigCollapse.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 22 | 🟢 SAFE | webui | src/routes/CodeChat/SkillSettingModal.tsx | resources/webview_source_code/src/routes/CodeChat/SkillSettingModal.tsx | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 23 | 🟢 SAFE | webui | src/services/chat.ts | resources/webview_source_code/src/services/chat.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 24 | 🟢 SAFE | webui | src/services/compressionService.ts | resources/webview_source_code/src/services/compressionService.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 26 | 🟢 SAFE | webui | src/services/prompt.ts | resources/webview_source_code/src/services/prompt.ts | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 28 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | ca4d34e3 feat: tokens消耗支持查看组成部分; 06946135 feat: 兼容普通聊天@大文件功能 |
| 29 | 🟡 REVIEW | webui | src/store/skills/index.ts | resources/webview_source_code/src/store/skills/index.ts | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 30 | 🟢 SAFE | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 31 | 🟢 SAFE | webui | src/store/workspace/constructToolCallPrompt.ts | resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 32 | 🟢 SAFE | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 33 | 🟢 SAFE | webui | src/store/workspace/pomptLinkMgr.ts | resources/webview_source_code/src/store/workspace/pomptLinkMgr.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 35 | 🟢 SAFE | webui | src/store/workspace/toolsEN.ts | resources/webview_source_code/src/store/workspace/toolsEN.ts | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 37 | 🟢 SAFE | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | ef4859e7 feat: 新增 Skills 配置管理功能 |
| 38 | 🟢 SAFE | webui | src/utils/chat.ts | resources/webview_source_code/src/utils/chat.ts | 40067e62 feat: 允许从已压缩消息重新发起对话; ca4d34e3 feat: tokens消耗支持查看组成部分; 06946135 feat: 兼容普通聊天@大文件功能 |
| 39 | 🟢 SAFE | webui | src/utils/chatMention.ts | resources/webview_source_code/src/utils/chatMention.ts | 06946135 feat: 兼容普通聊天@大文件功能 |
| 40 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | 51a609bc feat: 兼容错误提示; d406cde1 feat: 兼容GPT5.4异常消息&更改提示文案 |
| 41 | 🟢 SAFE | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |
| 42 | 🟢 SAFE | webui | src/utils/tokenEstimate.ts | resources/webview_source_code/src/utils/tokenEstimate.ts | ca4d34e3 feat: tokens消耗支持查看组成部分 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | webui | src/index.scss | resources/webview_source_code/src/index.scss | modified |  |
| 4 | webui | src/init.ts | resources/webview_source_code/src/init.ts | modified |  |
| 5 | webui | src/main.tsx | resources/webview_source_code/src/main.tsx | modified |  |
| 7 | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | modified | 🏷️ 需确认 |
| 9 | webui | src/routes/CodeChat/ChatMessageActionBar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessageActionBar.tsx | modified |  |
| 10 | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | modified |  |
| 11 | webui | src/routes/CodeChat/ChatMessagesList/UserMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/UserMessage.tsx | modified | 🏷️ 需确认 |
| 12 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified |  |
| 13 | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | modified |  |
| 14 | webui | src/routes/CodeChat/ChatSkillPromptRunner.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSkillPromptRunner.tsx | modified | 🏷️ 需确认 |
| 15 | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useFilteredAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useFilteredAttach.ts | modified | 🏷️ 需确认 |
| 16 | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectCodebaseAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectCodebaseAttach.ts | modified | 🏷️ 需确认 |
| 17 | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectDocsetAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectDocsetAttach.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptList.tsx | modified | 🏷️ 需确认 |
| 19 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified | 🏷️ 需确认 |
| 21 | webui | src/routes/CodeChat/SkillConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/SkillConfigCollapse.tsx | added | 🏷️ 需确认 |
| 22 | webui | src/routes/CodeChat/SkillSettingModal.tsx | resources/webview_source_code/src/routes/CodeChat/SkillSettingModal.tsx | added | 🏷️ 需确认 |
| 23 | webui | src/services/chat.ts | resources/webview_source_code/src/services/chat.ts | modified | 🏷️ 需确认 |
| 24 | webui | src/services/compressionService.ts | resources/webview_source_code/src/services/compressionService.ts | modified | 🏷️ 需确认 |
| 25 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified |  |
| 26 | webui | src/services/prompt.ts | resources/webview_source_code/src/services/prompt.ts | modified | 🏷️ 需确认 |
| 30 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified | 🏷️ 需确认 |
| 31 | webui | src/store/workspace/constructToolCallPrompt.ts | resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts | modified | 🏷️ 需确认 |
| 32 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified | 🏷️ 需确认 |
| 33 | webui | src/store/workspace/pomptLinkMgr.ts | resources/webview_source_code/src/store/workspace/pomptLinkMgr.ts | added | 🏷️ 需确认 |
| 34 | webui | src/store/workspace/tools/read.ts | resources/webview_source_code/src/store/workspace/tools/read.ts | modified |  |
| 35 | webui | src/store/workspace/toolsEN.ts | resources/webview_source_code/src/store/workspace/toolsEN.ts | modified | 🏷️ 需确认 |
| 37 | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | modified | 🏷️ 需确认 |
| 38 | webui | src/utils/chat.ts | resources/webview_source_code/src/utils/chat.ts | modified | 🏷️ 需确认 |
| 39 | webui | src/utils/chatMention.ts | resources/webview_source_code/src/utils/chatMention.ts | modified | 🏷️ 需确认 |
| 40 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 41 | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | modified | 🏷️ 需确认 |
| 42 | webui | src/utils/tokenEstimate.ts | resources/webview_source_code/src/utils/tokenEstimate.ts | added | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 1 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 8 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 20 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 27 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified |  |
| 28 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 29 | webui | src/store/skills/index.ts | resources/webview_source_code/src/store/skills/index.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (2 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 6 | webui | src/patchSetup.ts | 在排除列表中 |
| 36 | webui | src/telemetry/otel.ts | 在排除列表中 |

</details>
