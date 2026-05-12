# CodeMaker 同步报告
- 生成时间: 2026-05-12T08:28:55.209Z
- 上游 webui: `2bd4e8af` → `934e0e74` (2026-04-17 → 2026-04-20, 6 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 15 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 15 |
| 合计 | 34 |
| **🏷️ 涉及新需求 (需用户确认)** | **34** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/proposal.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 2 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/specs/input-clipboard/spec.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 3 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/tasks.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 4 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/proposal.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 5 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/specs/chat-history-pagination/spec.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 6 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/tasks.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 7 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/design.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 8 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/proposal.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 9 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/specs/popover-stacking/spec.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 10 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/tasks.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 11 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/proposal.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 12 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/specs/input-clipboard/spec.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 13 | 🔴 SKIP | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/tasks.md | - | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 14 | 🔴 SKIP | webui | openspec/specs/chat-history-pagination/spec.md | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 15 | 🟢 SAFE | webui | src/ThemeProvider.tsx | resources/webview_source_code/src/ThemeProvider.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 16 | 🟢 SAFE | webui | src/components/RulesPanel/index.tsx | resources/webview_source_code/src/components/RulesPanel/index.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 17 | 🟢 SAFE | webui | src/const.ts | resources/webview_source_code/src/const.ts | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 18 | 🟢 SAFE | webui | src/routes/CodeChat/ChatExporter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatExporter.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 19 | 🟢 SAFE | webui | src/routes/CodeChat/ChatFavoriter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFavoriter.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 20 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 21 | 🟢 SAFE | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 22 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 23 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 24 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 25 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector.tsx | - | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 26 | 🟢 SAFE | webui | src/routes/CodeChat/ChatNavigationButtons.tsx | resources/webview_source_code/src/routes/CodeChat/ChatNavigationButtons.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 27 | 🟢 SAFE | webui | src/routes/CodeChat/ChatSessionPicker.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSessionPicker.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 28 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 29 | 🟢 SAFE | webui | src/routes/CodeChat/chatNavigationUtils.ts | resources/webview_source_code/src/routes/CodeChat/chatNavigationUtils.ts | 3df9b350 fix: 修复 Slash 命令面板与底部工具栏 Popover 的 z-index 遮挡问题 |
| 30 | 🟢 SAFE | webui | src/routes/EventProvider.tsx | resources/webview_source_code/src/routes/EventProvider.tsx | 686a78e7 feat: 新增 ESC 键退出输入框聚焦功能 |
| 31 | 🟢 SAFE | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | db52396f chore: 仓库智聊chat请求增加 spec 统计字段 |
| 32 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | db52396f chore: 仓库智聊chat请求增加 spec 统计字段; 833cd710 fix: 修复工具调用相关的消息处理问题; ea655640 fix: 修复新接入 Gemini 模型回复循环问题; 934e0e74 fix: 压缩后无法提交修改需求 #28166 压缩后无法提交修改需求 |
| 33 | 🟡 REVIEW | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | 833cd710 fix: 修复工具调用相关的消息处理问题 |
| 34 | 🟢 SAFE | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | 833cd710 fix: 修复工具调用相关的消息处理问题; 934e0e74 fix: 压缩后无法提交修改需求 #28166 压缩后无法提交修改需求 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 15 | webui | src/ThemeProvider.tsx | resources/webview_source_code/src/ThemeProvider.tsx | modified | 🏷️ 需确认 |
| 16 | webui | src/components/RulesPanel/index.tsx | resources/webview_source_code/src/components/RulesPanel/index.tsx | modified | 🏷️ 需确认 |
| 17 | webui | src/const.ts | resources/webview_source_code/src/const.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/routes/CodeChat/ChatExporter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatExporter.tsx | modified | 🏷️ 需确认 |
| 19 | webui | src/routes/CodeChat/ChatFavoriter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFavoriter.tsx | modified | 🏷️ 需确认 |
| 21 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified | 🏷️ 需确认 |
| 22 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified | 🏷️ 需确认 |
| 23 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified | 🏷️ 需确认 |
| 24 | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | modified | 🏷️ 需确认 |
| 26 | webui | src/routes/CodeChat/ChatNavigationButtons.tsx | resources/webview_source_code/src/routes/CodeChat/ChatNavigationButtons.tsx | modified | 🏷️ 需确认 |
| 27 | webui | src/routes/CodeChat/ChatSessionPicker.tsx | resources/webview_source_code/src/routes/CodeChat/ChatSessionPicker.tsx | modified | 🏷️ 需确认 |
| 29 | webui | src/routes/CodeChat/chatNavigationUtils.ts | resources/webview_source_code/src/routes/CodeChat/chatNavigationUtils.ts | modified | 🏷️ 需确认 |
| 30 | webui | src/routes/EventProvider.tsx | resources/webview_source_code/src/routes/EventProvider.tsx | modified | 🏷️ 需确认 |
| 31 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified | 🏷️ 需确认 |
| 34 | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 20 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 28 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 32 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 33 | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (15 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/proposal.md | 在排除列表中 |
| 2 | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/specs/input-clipboard/spec.md | 在排除列表中 |
| 3 | webui | openspec/changes/archive/2026-04-02-fix-pycharm-undo-paste/tasks.md | 在排除列表中 |
| 4 | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/proposal.md | 在排除列表中 |
| 5 | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/specs/chat-history-pagination/spec.md | 在排除列表中 |
| 6 | webui | openspec/changes/archive/2026-04-13-add-auto-expand-history/tasks.md | 在排除列表中 |
| 7 | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/design.md | 在排除列表中 |
| 8 | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/proposal.md | 在排除列表中 |
| 9 | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/specs/popover-stacking/spec.md | 在排除列表中 |
| 10 | webui | openspec/changes/archive/2026-04-13-fix-popover-z-index-stacking/tasks.md | 在排除列表中 |
| 11 | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/proposal.md | 在排除列表中 |
| 12 | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/specs/input-clipboard/spec.md | 在排除列表中 |
| 13 | webui | openspec/changes/archive/2026-04-17-fix-undo-cursor-position/tasks.md | 在排除列表中 |
| 14 | webui | openspec/specs/chat-history-pagination/spec.md | 在排除列表中 |
| 25 | webui | src/routes/CodeChat/ChatModelSelector.tsx | Y3不需要模型选择功能，固定使用VSCode Settings中的模型配置 |

</details>
