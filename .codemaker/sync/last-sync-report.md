# CodeMaker 同步报告
- 生成时间: 2026-05-13T02:25:34.677Z
- 上游 webui: `6dc8bfa0` → `7b0eb9ad` (2026-04-22 → 2026-04-23, 11 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 73 |
| 🟡 REVIEW (需对比决策) | 9 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 2 |
| 合计 | 84 |
| **🏷️ 涉及新需求 (需用户确认)** | **75** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 2 | 🟡 REVIEW | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑; 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 3 | 🟢 SAFE | webui | src/components/BackendApplyToggle.tsx | resources/webview_source_code/src/components/BackendApplyToggle.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能; 0bcba205 chore: 调整自动打开文案 |
| 4 | 🟢 SAFE | webui | src/components/TaskStatusRadio/index.tsx | resources/webview_source_code/src/components/TaskStatusRadio/index.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 5 | 🟢 SAFE | webui | src/components/TodoList/index.tsx | resources/webview_source_code/src/components/TodoList/index.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 6 | 🟢 SAFE | webui | src/hooks/usePlanEditing.ts | resources/webview_source_code/src/hooks/usePlanEditing.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 7 | 🟢 SAFE | webui | src/hooks/useToolCall/handlers.ts | resources/webview_source_code/src/hooks/useToolCall/handlers.ts | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 9 | 🟢 SAFE | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | 6c9ce003 feat:新增 Caveman 简洁模式支持; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 10 | 🟢 SAFE | webui | src/modules/prompts/shared.ts | resources/webview_source_code/src/modules/prompts/shared.ts | 6c9ce003 feat:新增 Caveman 简洁模式支持; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 11 | 🟢 SAFE | webui | src/modules/prompts/templates/terminal-rtk-slim.txt | resources/webview_source_code/src/modules/prompts/templates/terminal-rtk-slim.txt | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 12 | 🟢 SAFE | webui | src/modules/prompts/templates/terminal-rtk.txt | resources/webview_source_code/src/modules/prompts/templates/terminal-rtk.txt | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 13 | 🟢 SAFE | webui | src/modules/prompts/types.ts | resources/webview_source_code/src/modules/prompts/types.ts | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 14 | 🟢 SAFE | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 15 | 🟢 SAFE | webui | src/modules/tool-result-processor/utils.ts | resources/webview_source_code/src/modules/tool-result-processor/utils.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 16 | 🟢 SAFE | webui | src/modules/tool/handlers/edit-file.ts | resources/webview_source_code/src/modules/tool/handlers/edit-file.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 17 | 🟢 SAFE | webui | src/modules/tool/handlers/read-file.ts | resources/webview_source_code/src/modules/tool/handlers/read-file.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 18 | 🟢 SAFE | webui | src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | resources/webview_source_code/src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 19 | 🟢 SAFE | webui | src/routes/CodeChat/ChatBottomTabs/tabs/TodoEditForm.tsx | resources/webview_source_code/src/routes/CodeChat/ChatBottomTabs/tabs/TodoEditForm.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 20 | 🟢 SAFE | webui | src/routes/CodeChat/ChatCodeBlock.tsx | resources/webview_source_code/src/routes/CodeChat/ChatCodeBlock.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 21 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | 6c9ce003 feat:新增 Caveman 简洁模式支持 |
| 22 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/ClaudeEditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ClaudeEditFile.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 23 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/CompressionSummary.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/CompressionSummary.tsx | da1925be refactor: 优化上下文压缩提示组件的样式和文案; f6058549 style: 修改压缩显示文案; 16b08fd7 style: 移除错误图标并优化提示文案排版; 0bcba205 chore: 调整自动打开文案 |
| 24 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/EditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/EditFile.tsx | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 25 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | 8e5fd74b refactor: 优化分享页工具的展示渲染逻辑 |
| 27 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 28 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑; 361c16ac feat: 新增后台 Apply 模式配置功能; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 29 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectFileAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectFileAttach.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 30 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 33 | 🟢 SAFE | webui | src/services/Agents/Stream/ParseNoneCodeFile/Interface.ts | resources/webview_source_code/src/services/Agents/Stream/ParseNoneCodeFile/Interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 34 | 🟢 SAFE | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | f1ae966a refactor: 抽离 codebase chat payload 构造 + 私有化模型压缩修复 |
| 35 | 🟢 SAFE | webui | src/services/harness/index.ts | resources/webview_source_code/src/services/harness/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 36 | 🟢 SAFE | webui | src/services/harness/stream/aigwCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/aigwCodebase/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 37 | 🟢 SAFE | webui | src/services/harness/stream/aigwCodebase/interface.ts | resources/webview_source_code/src/services/harness/stream/aigwCodebase/interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 38 | 🟢 SAFE | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 39 | 🟢 SAFE | webui | src/services/harness/stream/azureOpenAI/interface.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 40 | 🟢 SAFE | webui | src/services/harness/stream/base/index.ts | resources/webview_source_code/src/services/harness/stream/base/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 41 | 🟢 SAFE | webui | src/services/harness/stream/base/interface.ts | resources/webview_source_code/src/services/harness/stream/base/interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 42 | 🟢 SAFE | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 43 | 🟢 SAFE | webui | src/services/harness/stream/cmCodebase/interface.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 44 | 🟢 SAFE | webui | src/services/harness/stream/parserDocument/index.ts | resources/webview_source_code/src/services/harness/stream/parserDocument/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 45 | 🟢 SAFE | webui | src/services/harness/stream/parserDocument/interface.ts | resources/webview_source_code/src/services/harness/stream/parserDocument/interface.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 46 | 🟢 SAFE | webui | src/services/harness/stream/streamTracker.ts | resources/webview_source_code/src/services/harness/stream/streamTracker.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 47 | 🟢 SAFE | webui | src/services/harness/swarm/agentEntry.ts | resources/webview_source_code/src/services/harness/swarm/agentEntry.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 48 | 🟢 SAFE | webui | src/services/harness/tools/askUserQuestion.ts | resources/webview_source_code/src/services/harness/tools/askUserQuestion.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 49 | 🟢 SAFE | webui | src/services/harness/tools/codewiki.ts | resources/webview_source_code/src/services/harness/tools/codewiki.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 50 | 🟢 SAFE | webui | src/services/harness/tools/index.ts | resources/webview_source_code/src/services/harness/tools/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 51 | 🟢 SAFE | webui | src/services/harness/tools/plan/index.ts | resources/webview_source_code/src/services/harness/tools/plan/index.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 52 | 🟢 SAFE | webui | src/services/harness/tools/read.ts | resources/webview_source_code/src/services/harness/tools/read.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 53 | 🟢 SAFE | webui | src/services/harness/tools/search/glob.ts | resources/webview_source_code/src/services/harness/tools/search/glob.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 54 | 🟢 SAFE | webui | src/services/harness/tools/search/grep.ts | resources/webview_source_code/src/services/harness/tools/search/grep.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 55 | 🟢 SAFE | webui | src/services/harness/tools/task.ts | resources/webview_source_code/src/services/harness/tools/task.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 56 | 🟢 SAFE | webui | src/services/harness/tools/todo.ts | resources/webview_source_code/src/services/harness/tools/todo.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 57 | 🟢 SAFE | webui | src/services/harness/tools/webSearch.ts | resources/webview_source_code/src/services/harness/tools/webSearch.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 58 | 🟢 SAFE | webui | src/services/harness/tools/write.ts | resources/webview_source_code/src/services/harness/tools/write.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 59 | 🟢 SAFE | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 61 | 🟡 REVIEW | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | 361c16ac feat: 新增后台 Apply 模式配置功能; 6c9ce003 feat:新增 Caveman 简洁模式支持 |
| 62 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑; f1ae966a refactor: 抽离 codebase chat payload 构造 + 私有化模型压缩修复; 361c16ac feat: 新增后台 Apply 模式配置功能; 6c9ce003 feat:新增 Caveman 简洁模式支持 |
| 63 | 🟢 SAFE | webui | src/store/extension.ts | resources/webview_source_code/src/store/extension.ts | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 64 | 🟢 SAFE | webui | src/store/listeners/todoCompletionListener.ts | resources/webview_source_code/src/store/listeners/todoCompletionListener.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 66 | 🟢 SAFE | webui | src/store/skills/prompt.ts | resources/webview_source_code/src/store/skills/prompt.ts | 6c9ce003 feat:新增 Caveman 简洁模式支持 |
| 67 | 🟢 SAFE | webui | src/store/workspace/constructReActPrompt.ts | resources/webview_source_code/src/store/workspace/constructReActPrompt.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 68 | 🟢 SAFE | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | 6c9ce003 feat:新增 Caveman 简洁模式支持; 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 70 | 🟢 SAFE | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | 7b0eb9ad feat: 集成 RTK (Rust Token Killer) 以优化 Codebase Chat 终端输出的 token 消耗 |
| 71 | 🟢 SAFE | webui | src/store/workspace/planModePrompts.ts | resources/webview_source_code/src/store/workspace/planModePrompts.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 72 | 🟡 REVIEW | webui | src/store/workspace/tools.ts | resources/webview_source_code/src/store/workspace/tools.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 73 | 🟡 REVIEW | webui | src/store/workspace/toolsEN.ts | resources/webview_source_code/src/store/workspace/toolsEN.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 75 | 🟢 SAFE | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | 6c9ce003 feat:新增 Caveman 简洁模式支持 |
| 76 | 🟢 SAFE | webui | src/utils/abort.ts | resources/webview_source_code/src/utils/abort.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 77 | 🟢 SAFE | webui | src/utils/chatAttachParseHandler.ts | resources/webview_source_code/src/utils/chatAttachParseHandler.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 78 | 🟢 SAFE | webui | src/utils/computeEffectiveRules.ts | resources/webview_source_code/src/utils/computeEffectiveRules.ts | f1ae966a refactor: 抽离 codebase chat payload 构造 + 私有化模型压缩修复 |
| 79 | 🟢 SAFE | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑 |
| 80 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | 361c16ac feat: 新增后台 Apply 模式配置功能 |
| 81 | 🟢 SAFE | webui | src/utils/inferCodebaseCacheEnable.ts | resources/webview_source_code/src/utils/inferCodebaseCacheEnable.ts | f1ae966a refactor: 抽离 codebase chat payload 构造 + 私有化模型压缩修复 |
| 83 | 🟢 SAFE | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | bbc3b737 refactor: 重构流式请求架构，统一 Agent 处理逻辑; 8e5fd74b refactor: 优化分享页工具的展示渲染逻辑 |
| 84 | 🔴 SKIP | webui | test/fetchPureContext.ts | - | 361c16ac feat: 新增后台 Apply 模式配置功能 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | webui | src/components/BackendApplyToggle.tsx | resources/webview_source_code/src/components/BackendApplyToggle.tsx | added | 🏷️ 需确认 |
| 4 | webui | src/components/TaskStatusRadio/index.tsx | resources/webview_source_code/src/components/TaskStatusRadio/index.tsx | modified | 🏷️ 需确认 |
| 5 | webui | src/components/TodoList/index.tsx | resources/webview_source_code/src/components/TodoList/index.tsx | modified | 🏷️ 需确认 |
| 6 | webui | src/hooks/usePlanEditing.ts | resources/webview_source_code/src/hooks/usePlanEditing.ts | modified | 🏷️ 需确认 |
| 7 | webui | src/hooks/useToolCall/handlers.ts | resources/webview_source_code/src/hooks/useToolCall/handlers.ts | modified | 🏷️ 需确认 |
| 8 | webui | src/hooks/useToolCall/mcpInfo.ts | resources/webview_source_code/src/hooks/useToolCall/mcpInfo.ts | modified |  |
| 9 | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | modified | 🏷️ 需确认 |
| 10 | webui | src/modules/prompts/shared.ts | resources/webview_source_code/src/modules/prompts/shared.ts | modified | 🏷️ 需确认 |
| 11 | webui | src/modules/prompts/templates/terminal-rtk-slim.txt | resources/webview_source_code/src/modules/prompts/templates/terminal-rtk-slim.txt | added | 🏷️ 需确认 |
| 12 | webui | src/modules/prompts/templates/terminal-rtk.txt | resources/webview_source_code/src/modules/prompts/templates/terminal-rtk.txt | added | 🏷️ 需确认 |
| 13 | webui | src/modules/prompts/types.ts | resources/webview_source_code/src/modules/prompts/types.ts | modified | 🏷️ 需确认 |
| 14 | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | modified | 🏷️ 需确认 |
| 15 | webui | src/modules/tool-result-processor/utils.ts | resources/webview_source_code/src/modules/tool-result-processor/utils.ts | modified | 🏷️ 需确认 |
| 16 | webui | src/modules/tool/handlers/edit-file.ts | resources/webview_source_code/src/modules/tool/handlers/edit-file.ts | modified | 🏷️ 需确认 |
| 17 | webui | src/modules/tool/handlers/read-file.ts | resources/webview_source_code/src/modules/tool/handlers/read-file.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | resources/webview_source_code/src/routes/CodeChat/ChatBottomTabs/ChatBottomTabsV2.tsx | modified | 🏷️ 需确认 |
| 19 | webui | src/routes/CodeChat/ChatBottomTabs/tabs/TodoEditForm.tsx | resources/webview_source_code/src/routes/CodeChat/ChatBottomTabs/tabs/TodoEditForm.tsx | modified | 🏷️ 需确认 |
| 20 | webui | src/routes/CodeChat/ChatCodeBlock.tsx | resources/webview_source_code/src/routes/CodeChat/ChatCodeBlock.tsx | modified | 🏷️ 需确认 |
| 22 | webui | src/routes/CodeChat/ChatMessagesList/ClaudeEditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ClaudeEditFile.tsx | modified | 🏷️ 需确认 |
| 23 | webui | src/routes/CodeChat/ChatMessagesList/CompressionSummary.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/CompressionSummary.tsx | modified | 🏷️ 需确认 |
| 24 | webui | src/routes/CodeChat/ChatMessagesList/EditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/EditFile.tsx | modified | 🏷️ 需确认 |
| 25 | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | modified | 🏷️ 需确认 |
| 26 | webui | src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | modified |  |
| 27 | webui | src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/TermialPanel.tsx | modified | 🏷️ 需确认 |
| 28 | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | modified | 🏷️ 需确认 |
| 29 | webui | src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectFileAttach.ts | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectFileAttach.ts | modified | 🏷️ 需确认 |
| 31 | webui | src/routes/CodeChat/MCPConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/MCPConfigCollapse.tsx | modified |  |
| 32 | webui | src/routes/CodeChat/MCPStatus.tsx | resources/webview_source_code/src/routes/CodeChat/MCPStatus.tsx | modified |  |
| 33 | webui | src/services/Agents/Stream/ParseNoneCodeFile/Interface.ts | resources/webview_source_code/src/services/Agents/Stream/ParseNoneCodeFile/Interface.ts | deleted | 🏷️ 需确认 |
| 34 | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | added | 🏷️ 需确认 |
| 35 | webui | src/services/harness/index.ts | resources/webview_source_code/src/services/harness/index.ts | added | 🏷️ 需确认 |
| 36 | webui | src/services/harness/stream/aigwCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/aigwCodebase/index.ts | added | 🏷️ 需确认 |
| 37 | webui | src/services/harness/stream/aigwCodebase/interface.ts | resources/webview_source_code/src/services/harness/stream/aigwCodebase/interface.ts | added | 🏷️ 需确认 |
| 38 | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | added | 🏷️ 需确认 |
| 39 | webui | src/services/harness/stream/azureOpenAI/interface.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/interface.ts | added | 🏷️ 需确认 |
| 40 | webui | src/services/harness/stream/base/index.ts | resources/webview_source_code/src/services/harness/stream/base/index.ts | renamed | 🏷️ 需确认 |
| 41 | webui | src/services/harness/stream/base/interface.ts | resources/webview_source_code/src/services/harness/stream/base/interface.ts | renamed | 🏷️ 需确认 |
| 42 | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | added | 🏷️ 需确认 |
| 43 | webui | src/services/harness/stream/cmCodebase/interface.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/interface.ts | added | 🏷️ 需确认 |
| 44 | webui | src/services/harness/stream/parserDocument/index.ts | resources/webview_source_code/src/services/harness/stream/parserDocument/index.ts | renamed | 🏷️ 需确认 |
| 45 | webui | src/services/harness/stream/parserDocument/interface.ts | resources/webview_source_code/src/services/harness/stream/parserDocument/interface.ts | added | 🏷️ 需确认 |
| 46 | webui | src/services/harness/stream/streamTracker.ts | resources/webview_source_code/src/services/harness/stream/streamTracker.ts | added | 🏷️ 需确认 |
| 47 | webui | src/services/harness/swarm/agentEntry.ts | resources/webview_source_code/src/services/harness/swarm/agentEntry.ts | added | 🏷️ 需确认 |
| 48 | webui | src/services/harness/tools/askUserQuestion.ts | resources/webview_source_code/src/services/harness/tools/askUserQuestion.ts | renamed | 🏷️ 需确认 |
| 49 | webui | src/services/harness/tools/codewiki.ts | resources/webview_source_code/src/services/harness/tools/codewiki.ts | renamed | 🏷️ 需确认 |
| 50 | webui | src/services/harness/tools/index.ts | resources/webview_source_code/src/services/harness/tools/index.ts | added | 🏷️ 需确认 |
| 51 | webui | src/services/harness/tools/plan/index.ts | resources/webview_source_code/src/services/harness/tools/plan/index.ts | renamed | 🏷️ 需确认 |
| 52 | webui | src/services/harness/tools/read.ts | resources/webview_source_code/src/services/harness/tools/read.ts | renamed | 🏷️ 需确认 |
| 53 | webui | src/services/harness/tools/search/glob.ts | resources/webview_source_code/src/services/harness/tools/search/glob.ts | renamed | 🏷️ 需确认 |
| 54 | webui | src/services/harness/tools/search/grep.ts | resources/webview_source_code/src/services/harness/tools/search/grep.ts | renamed | 🏷️ 需确认 |
| 55 | webui | src/services/harness/tools/task.ts | resources/webview_source_code/src/services/harness/tools/task.ts | renamed | 🏷️ 需确认 |
| 56 | webui | src/services/harness/tools/todo.ts | resources/webview_source_code/src/services/harness/tools/todo.ts | renamed | 🏷️ 需确认 |
| 57 | webui | src/services/harness/tools/webSearch.ts | resources/webview_source_code/src/services/harness/tools/webSearch.ts | added | 🏷️ 需确认 |
| 58 | webui | src/services/harness/tools/write.ts | resources/webview_source_code/src/services/harness/tools/write.ts | renamed | 🏷️ 需确认 |
| 59 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified | 🏷️ 需确认 |
| 63 | webui | src/store/extension.ts | resources/webview_source_code/src/store/extension.ts | modified | 🏷️ 需确认 |
| 64 | webui | src/store/listeners/todoCompletionListener.ts | resources/webview_source_code/src/store/listeners/todoCompletionListener.ts | modified | 🏷️ 需确认 |
| 65 | webui | src/store/mcp.ts | resources/webview_source_code/src/store/mcp.ts | modified |  |
| 66 | webui | src/store/skills/prompt.ts | resources/webview_source_code/src/store/skills/prompt.ts | modified | 🏷️ 需确认 |
| 67 | webui | src/store/workspace/constructReActPrompt.ts | resources/webview_source_code/src/store/workspace/constructReActPrompt.ts | modified | 🏷️ 需确认 |
| 68 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified | 🏷️ 需确认 |
| 69 | webui | src/store/workspace/constructToolCallPrompt.ts | resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts | modified |  |
| 70 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified | 🏷️ 需确认 |
| 71 | webui | src/store/workspace/planModePrompts.ts | resources/webview_source_code/src/store/workspace/planModePrompts.ts | modified | 🏷️ 需确认 |
| 75 | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | modified | 🏷️ 需确认 |
| 76 | webui | src/utils/abort.ts | resources/webview_source_code/src/utils/abort.ts | modified | 🏷️ 需确认 |
| 77 | webui | src/utils/chatAttachParseHandler.ts | resources/webview_source_code/src/utils/chatAttachParseHandler.ts | modified | 🏷️ 需确认 |
| 78 | webui | src/utils/computeEffectiveRules.ts | resources/webview_source_code/src/utils/computeEffectiveRules.ts | added | 🏷️ 需确认 |
| 79 | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | modified | 🏷️ 需确认 |
| 80 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 81 | webui | src/utils/inferCodebaseCacheEnable.ts | resources/webview_source_code/src/utils/inferCodebaseCacheEnable.ts | added | 🏷️ 需确认 |
| 82 | webui | src/utils/mcpToolSearch.ts | resources/webview_source_code/src/utils/mcpToolSearch.ts | added |  |
| 83 | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 1 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 21 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 30 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 60 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified |  |
| 61 | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 62 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 72 | webui | src/store/workspace/tools.ts | resources/webview_source_code/src/store/workspace/tools.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 73 | webui | src/store/workspace/toolsEN.ts | resources/webview_source_code/src/store/workspace/toolsEN.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (2 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 74 | webui | src/telemetry/otel.ts | 在排除列表中 |
| 84 | webui | test/fetchPureContext.ts | 在排除列表中 |

</details>
