# CodeMaker 同步报告
- 生成时间: 2026-05-14T10:16:38.125Z
- 上游 webui: `2473031a` → `b5a4b898` (2026-05-06 → 2026-05-07, 13 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 34 |
| 🟡 REVIEW (需对比决策) | 9 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 3 |
| 合计 | 46 |
| **🏷️ 涉及新需求 (需用户确认)** | **46** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 2 | 🟡 REVIEW | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 3 | 🟢 SAFE | webui | src/hooks/useLoadWorkspace.ts | resources/webview_source_code/src/hooks/useLoadWorkspace.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 4 | 🟢 SAFE | webui | src/hooks/useToolCall/handlers.ts | resources/webview_source_code/src/hooks/useToolCall/handlers.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 5 | 🟢 SAFE | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 6 | 🟢 SAFE | webui | src/modules/subagent/core/compression.ts | resources/webview_source_code/src/modules/subagent/core/compression.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 7 | 🟢 SAFE | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 8 | 🟢 SAFE | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 9 | 🟢 SAFE | webui | src/modules/tool-result-processor/handlers.ts | resources/webview_source_code/src/modules/tool-result-processor/handlers.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 10 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置; 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache |
| 11 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/EditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/EditFile.tsx | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 12 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | ccb0bc07 fix: 修复 use_skill 数组结果解析与展示 |
| 13 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector/chatModelTokenCost.tsx | - | a0108961 refactor: 重构价格信息展示组件的样式和结构; 4529ac78 feat: 优化聊天模型价格展示，支持缓存命中价格和自动路由定价 |
| 14 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector/index.tsx | - | d0369b4b feat: 新增工具结果卸载到文件系统功能; a0108961 refactor: 重构价格信息展示组件的样式和结构; c239ffce refactor: 取消 Claude 和 Deepseek 模型会话隔离，移除 thinking 字段降级逻辑并优化 Claude 模型判断 |
| 15 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 16 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 17 | 🟢 SAFE | webui | src/routes/CodeChat/CompressionConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/CompressionConfigCollapse.tsx | 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache; b5a4b898 fix: 修复 Gemini 3 Flash 模型配置查询逻辑 |
| 18 | 🟡 REVIEW | webui | src/services/chatModel.ts | resources/webview_source_code/src/services/chatModel.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 19 | 🟢 SAFE | webui | src/services/compactionAgent.ts | resources/webview_source_code/src/services/compactionAgent.ts | 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache |
| 20 | 🟢 SAFE | webui | src/services/compression/fullCompact.ts | resources/webview_source_code/src/services/compression/fullCompact.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache |
| 21 | 🟢 SAFE | webui | src/services/compression/index.ts | resources/webview_source_code/src/services/compression/index.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 22 | 🟢 SAFE | webui | src/services/compression/pruneCore.ts | resources/webview_source_code/src/services/compression/pruneCore.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 23 | 🟢 SAFE | webui | src/services/compression/pruneState.ts | resources/webview_source_code/src/services/compression/pruneState.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 24 | 🟢 SAFE | webui | src/services/compression/sessionStatus.ts | resources/webview_source_code/src/services/compression/sessionStatus.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 25 | 🟢 SAFE | webui | src/services/compressionService.ts | resources/webview_source_code/src/services/compressionService.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 26 | 🟢 SAFE | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | b0ae2caf fix: 优化流式请求错误处理和异常提示 |
| 27 | 🟢 SAFE | webui | src/services/harness/stream/base/index.ts | resources/webview_source_code/src/services/harness/stream/base/index.ts | b0ae2caf fix: 优化流式请求错误处理和异常提示 |
| 28 | 🟢 SAFE | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | b0ae2caf fix: 优化流式请求错误处理和异常提示; 6519aa0b chore: 支持 DeepSeek 模型的缓存 token 统计并优化任务中止判断 |
| 29 | 🟡 REVIEW | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | b0ae2caf fix: 优化流式请求错误处理和异常提示 |
| 30 | 🟡 REVIEW | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置; 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache |
| 31 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置; 901a7e6d refactor: 压缩调用复用主对话 payload,命中 prompt cache; d1a20ef4 fix: 移除压缩功能中对私有模型的限制判断; 6519aa0b chore: 支持 DeepSeek 模型的缓存 token 统计并优化任务中止判断; c239ffce refactor: 取消 Claude 和 Deepseek 模型会话隔离，移除 thinking 字段降级逻辑并优化 Claude 模型判断; b5a4b898 fix: 修复 Gemini 3 Flash 模型配置查询逻辑 |
| 32 | 🟢 SAFE | webui | src/store/extension.ts | resources/webview_source_code/src/store/extension.ts | 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 33 | 🟢 SAFE | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 34 | 🟢 SAFE | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 35 | 🔴 SKIP | webui | src/telemetry/otel.ts | - | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 36 | 🟢 SAFE | webui | src/types/contextCompression.ts | resources/webview_source_code/src/types/contextCompression.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 37 | 🟡 REVIEW | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能; c239ffce refactor: 取消 Claude 和 Deepseek 模型会话隔离，移除 thinking 字段降级逻辑并优化 Claude 模型判断 |
| 38 | 🟢 SAFE | webui | src/utils/compressionPrompt.ts | resources/webview_source_code/src/utils/compressionPrompt.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 39 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | b0ae2caf fix: 优化流式请求错误处理和异常提示 |
| 40 | 🟢 SAFE | webui | src/utils/postCompactFileState.ts | resources/webview_source_code/src/utils/postCompactFileState.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 41 | 🟢 SAFE | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 42 | 🟢 SAFE | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | ccb0bc07 fix: 修复 use_skill 数组结果解析与展示 |
| 43 | 🟢 SAFE | webui | src/utils/toolCallDispatch.ts | resources/webview_source_code/src/utils/toolCallDispatch.ts | 481a300f feat: 支持 RTK 命令拦截开关配置 |
| 44 | 🟢 SAFE | webui | src/utils/toolResultPersistenceConstants.ts | resources/webview_source_code/src/utils/toolResultPersistenceConstants.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 45 | 🟢 SAFE | webui | src/utils/transcript.ts | resources/webview_source_code/src/utils/transcript.ts | d0369b4b feat: 新增工具结果卸载到文件系统功能 |
| 46 | 🟢 SAFE | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | c239ffce refactor: 取消 Claude 和 Deepseek 模型会话隔离，移除 thinking 字段降级逻辑并优化 Claude 模型判断 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | webui | src/hooks/useLoadWorkspace.ts | resources/webview_source_code/src/hooks/useLoadWorkspace.ts | modified | 🏷️ 需确认 |
| 4 | webui | src/hooks/useToolCall/handlers.ts | resources/webview_source_code/src/hooks/useToolCall/handlers.ts | modified | 🏷️ 需确认 |
| 5 | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | modified | 🏷️ 需确认 |
| 6 | webui | src/modules/subagent/core/compression.ts | resources/webview_source_code/src/modules/subagent/core/compression.ts | modified | 🏷️ 需确认 |
| 7 | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | modified | 🏷️ 需确认 |
| 8 | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | modified | 🏷️ 需确认 |
| 9 | webui | src/modules/tool-result-processor/handlers.ts | resources/webview_source_code/src/modules/tool-result-processor/handlers.ts | modified | 🏷️ 需确认 |
| 11 | webui | src/routes/CodeChat/ChatMessagesList/EditFile.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/EditFile.tsx | modified | 🏷️ 需确认 |
| 12 | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | modified | 🏷️ 需确认 |
| 15 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified | 🏷️ 需确认 |
| 17 | webui | src/routes/CodeChat/CompressionConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/CompressionConfigCollapse.tsx | added | 🏷️ 需确认 |
| 19 | webui | src/services/compactionAgent.ts | resources/webview_source_code/src/services/compactionAgent.ts | added | 🏷️ 需确认 |
| 20 | webui | src/services/compression/fullCompact.ts | resources/webview_source_code/src/services/compression/fullCompact.ts | added | 🏷️ 需确认 |
| 21 | webui | src/services/compression/index.ts | resources/webview_source_code/src/services/compression/index.ts | added | 🏷️ 需确认 |
| 22 | webui | src/services/compression/pruneCore.ts | resources/webview_source_code/src/services/compression/pruneCore.ts | added | 🏷️ 需确认 |
| 23 | webui | src/services/compression/pruneState.ts | resources/webview_source_code/src/services/compression/pruneState.ts | added | 🏷️ 需确认 |
| 24 | webui | src/services/compression/sessionStatus.ts | resources/webview_source_code/src/services/compression/sessionStatus.ts | added | 🏷️ 需确认 |
| 25 | webui | src/services/compressionService.ts | resources/webview_source_code/src/services/compressionService.ts | modified | 🏷️ 需确认 |
| 26 | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | modified | 🏷️ 需确认 |
| 27 | webui | src/services/harness/stream/base/index.ts | resources/webview_source_code/src/services/harness/stream/base/index.ts | modified | 🏷️ 需确认 |
| 28 | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | modified | 🏷️ 需确认 |
| 32 | webui | src/store/extension.ts | resources/webview_source_code/src/store/extension.ts | modified | 🏷️ 需确认 |
| 33 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified | 🏷️ 需确认 |
| 34 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified | 🏷️ 需确认 |
| 36 | webui | src/types/contextCompression.ts | resources/webview_source_code/src/types/contextCompression.ts | modified | 🏷️ 需确认 |
| 38 | webui | src/utils/compressionPrompt.ts | resources/webview_source_code/src/utils/compressionPrompt.ts | modified | 🏷️ 需确认 |
| 39 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 40 | webui | src/utils/postCompactFileState.ts | resources/webview_source_code/src/utils/postCompactFileState.ts | added | 🏷️ 需确认 |
| 41 | webui | src/utils/tokenCalculator.ts | resources/webview_source_code/src/utils/tokenCalculator.ts | modified | 🏷️ 需确认 |
| 42 | webui | src/utils/toolCall.tsx | resources/webview_source_code/src/utils/toolCall.tsx | modified | 🏷️ 需确认 |
| 43 | webui | src/utils/toolCallDispatch.ts | resources/webview_source_code/src/utils/toolCallDispatch.ts | added | 🏷️ 需确认 |
| 44 | webui | src/utils/toolResultPersistenceConstants.ts | resources/webview_source_code/src/utils/toolResultPersistenceConstants.ts | added | 🏷️ 需确认 |
| 45 | webui | src/utils/transcript.ts | resources/webview_source_code/src/utils/transcript.ts | added | 🏷️ 需确认 |
| 46 | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 1 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 2 | webui | src/PostMessageProvider.tsx | resources/webview_source_code/src/PostMessageProvider.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 10 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 16 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 18 | webui | src/services/chatModel.ts | resources/webview_source_code/src/services/chatModel.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 29 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 30 | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 31 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 37 | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (3 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 13 | webui | src/routes/CodeChat/ChatModelSelector/chatModelTokenCost.tsx | 在排除列表中 |
| 14 | webui | src/routes/CodeChat/ChatModelSelector/index.tsx | 在排除列表中 |
| 35 | webui | src/telemetry/otel.ts | 在排除列表中 |

</details>
