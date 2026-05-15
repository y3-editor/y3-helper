# CodeMaker 同步报告
- 生成时间: 2026-05-15T06:42:37.757Z
- 上游 webui: `a6cd0abe` → `ddacbf13` (2026-05-08 → 2026-05-09, 7 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 15 |
| 🟡 REVIEW (需对比决策) | 6 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 21 |
| **🏷️ 涉及新需求 (需用户确认)** | **20** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟢 SAFE | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 2 | 🟢 SAFE | webui | src/modules/subagent/core/llm.ts | resources/webview_source_code/src/modules/subagent/core/llm.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 4 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 5 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | 26e81a37 fix: 中止后apply还能继续修改代码 |
| 6 | 🟢 SAFE | webui | src/routes/CodeChat/CompressionConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/CompressionConfigCollapse.tsx | a93e7f49 feat: 优化压缩策略切换私有模型后保留用户偏好 |
| 7 | 🟢 SAFE | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 8 | 🟢 SAFE | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | b8d71b0e fix: 修复流式中cm自定义错误文本显示 #29551 修复流式中cm自定义错误异常 |
| 9 | 🟢 SAFE | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 10 | 🟡 REVIEW | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | 59a48c60 feat: 增加流式异常时，重试请求场景 |
| 11 | 🟡 REVIEW | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | a93e7f49 feat: 优化压缩策略切换私有模型后保留用户偏好; 9ced4587 feat: 支持Auto模型配置思维链 |
| 12 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 13 | 🟢 SAFE | webui | src/store/toolCallRepeatStore.ts | resources/webview_source_code/src/store/toolCallRepeatStore.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 14 | 🟢 SAFE | webui | src/types/contextCompression.ts | resources/webview_source_code/src/types/contextCompression.ts | a93e7f49 feat: 优化压缩策略切换私有模型后保留用户偏好 |
| 15 | 🟢 SAFE | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 16 | 🟢 SAFE | webui | src/utils/abort.ts | resources/webview_source_code/src/utils/abort.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 17 | 🟡 REVIEW | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | 9ced4587 feat: 支持Auto模型配置思维链 |
| 18 | 🟢 SAFE | webui | src/utils/computeRoundKey.ts | resources/webview_source_code/src/utils/computeRoundKey.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 19 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | 59a48c60 feat: 增加流式异常时，重试请求场景 |
| 20 | 🟢 SAFE | webui | src/utils/stableStringify.ts | resources/webview_source_code/src/utils/stableStringify.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |
| 21 | 🟢 SAFE | webui | src/utils/toolCallRepeatGuard.ts | resources/webview_source_code/src/utils/toolCallRepeatGuard.ts | ddacbf13 feat: 新增重复 tool_call 检测机制防止模型死循环 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 1 | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | modified | 🏷️ 需确认 |
| 2 | webui | src/modules/subagent/core/llm.ts | resources/webview_source_code/src/modules/subagent/core/llm.ts | modified | 🏷️ 需确认 |
| 4 | webui | src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | modified | 🏷️ 需确认 |
| 6 | webui | src/routes/CodeChat/CompressionConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/CompressionConfigCollapse.tsx | modified | 🏷️ 需确认 |
| 7 | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | modified | 🏷️ 需确认 |
| 8 | webui | src/services/harness/stream/cmCodebase/index.ts | resources/webview_source_code/src/services/harness/stream/cmCodebase/index.ts | modified | 🏷️ 需确认 |
| 9 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified | 🏷️ 需确认 |
| 13 | webui | src/store/toolCallRepeatStore.ts | resources/webview_source_code/src/store/toolCallRepeatStore.ts | added | 🏷️ 需确认 |
| 14 | webui | src/types/contextCompression.ts | resources/webview_source_code/src/types/contextCompression.ts | modified | 🏷️ 需确认 |
| 15 | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | modified | 🏷️ 需确认 |
| 16 | webui | src/utils/abort.ts | resources/webview_source_code/src/utils/abort.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/utils/computeRoundKey.ts | resources/webview_source_code/src/utils/computeRoundKey.ts | added | 🏷️ 需确认 |
| 19 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 20 | webui | src/utils/stableStringify.ts | resources/webview_source_code/src/utils/stableStringify.ts | added | 🏷️ 需确认 |
| 21 | webui | src/utils/toolCallRepeatGuard.ts | resources/webview_source_code/src/utils/toolCallRepeatGuard.ts | added | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 3 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified |  |
| 5 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 10 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 11 | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 12 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 17 | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
