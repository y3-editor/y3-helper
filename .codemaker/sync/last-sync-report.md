# CodeMaker 同步报告
- 生成时间: 2026-04-30T09:29:05.792Z
- 上游 webui: `9877bca6` → `8a72b0e5` (2026-03-24 → 2026-03-26, 9 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 23 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 15 |
| 合计 | 42 |
| **🏷️ 涉及新需求 (需用户确认)** | **42** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/proposal.md | - | 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 2 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/specs/chat-model-selector/spec.md | - | 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 3 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/tasks.md | - | 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 4 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-add-report-reliability/design.md | - | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 5 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-add-report-reliability/proposal.md | - | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 6 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-add-report-reliability/specs/event-reporting/spec.md | - | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 7 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-add-report-reliability/tasks.md | - | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 8 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/proposal.md | - | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 9 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/specs/chat-message-metadata/spec.md | - | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 10 | 🔴 SKIP | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/tasks.md | - | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 11 | 🔴 SKIP | webui | openspec/specs/chat-model-selector/spec.md | - | 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 12 | 🔴 SKIP | webui | openspec/specs/event-reporting/spec.md | - | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 13 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 14 | 🟢 SAFE | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | a77be661 feat: 会话底部上下文占用窗口支持查看当前分布情况 |
| 15 | 🟢 SAFE | webui | src/routes/CodeChat/ChatExporter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatExporter.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 16 | 🟢 SAFE | webui | src/routes/CodeChat/ChatFavoriter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFavoriter.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 17 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 18 | 🟢 SAFE | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 19 | 🟢 SAFE | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 20 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 21 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 22 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 23 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/Retry.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/Retry.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 24 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 25 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 26 | 🔴 SKIP | webui | src/routes/CodeChat/ChatModelSelector.tsx | - | 347aef4c feat: 已下线模型动态切换到同系列模型; 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 27 | 🟢 SAFE | webui | src/routes/CodeChat/TokenUsageIndicator.tsx | resources/webview_source_code/src/routes/CodeChat/TokenUsageIndicator.tsx | a77be661 feat: 会话底部上下文占用窗口支持查看当前分布情况 |
| 28 | 🟢 SAFE | webui | src/services/chat.ts | resources/webview_source_code/src/services/chat.ts | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 29 | 🟢 SAFE | webui | src/services/chatModel.ts | resources/webview_source_code/src/services/chatModel.ts | 2b54b51e refactor: 移除冗余的模型价格接口调用，直接使用 chatModels 中的 priceInfo |
| 30 | 🟢 SAFE | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 31 | 🟡 REVIEW | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | a649d58a fix:观测系统新增 请求头traceparent 字段和修复 object 错误上报 |
| 32 | 🟢 SAFE | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | 347aef4c feat: 已下线模型动态切换到同系列模型 |
| 33 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | 389bd4a2 fix: 切换会话时先清空 Spec 绑定，避免残留到新会话; 8ab9ff3d feat:多级缓存系统提高命中率; ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示; 8a72b0e5 feat: 增强关键事件上报可靠性 |
| 34 | 🟢 SAFE | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | 8ab9ff3d feat:多级缓存系统提高命中率; a77be661 feat: 会话底部上下文占用窗口支持查看当前分布情况 |
| 35 | 🟢 SAFE | webui | src/store/workspace/constructToolCallPrompt.ts | resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts | a77be661 feat: 会话底部上下文占用窗口支持查看当前分布情况 |
| 36 | 🟢 SAFE | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | 8ab9ff3d feat:多级缓存系统提高命中率; a77be661 feat: 会话底部上下文占用窗口支持查看当前分布情况 |
| 37 | 🔴 SKIP | webui | src/telemetry/const.ts | - | a649d58a fix:观测系统新增 请求头traceparent 字段和修复 object 错误上报 |
| 38 | 🔴 SKIP | webui | src/telemetry/otel.ts | - | a649d58a fix:观测系统新增 请求头traceparent 字段和修复 object 错误上报 |
| 39 | 🟢 SAFE | webui | src/utils/addCacheMarksToMessages.ts | resources/webview_source_code/src/utils/addCacheMarksToMessages.ts | 8ab9ff3d feat:多级缓存系统提高命中率 |
| 40 | 🟢 SAFE | webui | src/utils/chatAttachParseHandler.ts | resources/webview_source_code/src/utils/chatAttachParseHandler.ts | 7a7123b8 fix: 修复模型主动读取图片时，解析异常 |
| 41 | 🟢 SAFE | webui | src/utils/eventbus.ts | resources/webview_source_code/src/utils/eventbus.ts | ed764a97 feat: 新增收藏会话功能并修复 Token 计算与耗时显示 |
| 42 | 🟢 SAFE | webui | src/utils/report.ts | resources/webview_source_code/src/utils/report.ts | 8a72b0e5 feat: 增强关键事件上报可靠性 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 14 | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | modified | 🏷️ 需确认 |
| 15 | webui | src/routes/CodeChat/ChatExporter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatExporter.tsx | modified | 🏷️ 需确认 |
| 16 | webui | src/routes/CodeChat/ChatFavoriter.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFavoriter.tsx | added | 🏷️ 需确认 |
| 18 | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | modified | 🏷️ 需确认 |
| 19 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified | 🏷️ 需确认 |
| 20 | webui | src/routes/CodeChat/ChatMentionAreatext.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMentionAreatext.tsx | modified | 🏷️ 需确认 |
| 21 | webui | src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/AssistantMessage.tsx | modified | 🏷️ 需确认 |
| 22 | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | modified | 🏷️ 需确认 |
| 23 | webui | src/routes/CodeChat/ChatMessagesList/Retry.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/Retry.tsx | modified | 🏷️ 需确认 |
| 24 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified | 🏷️ 需确认 |
| 25 | webui | src/routes/CodeChat/ChatMessagesList/types.ts | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/types.ts | modified | 🏷️ 需确认 |
| 27 | webui | src/routes/CodeChat/TokenUsageIndicator.tsx | resources/webview_source_code/src/routes/CodeChat/TokenUsageIndicator.tsx | modified | 🏷️ 需确认 |
| 28 | webui | src/services/chat.ts | resources/webview_source_code/src/services/chat.ts | modified | 🏷️ 需确认 |
| 29 | webui | src/services/chatModel.ts | resources/webview_source_code/src/services/chatModel.ts | modified | 🏷️ 需确认 |
| 30 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified | 🏷️ 需确认 |
| 32 | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | modified | 🏷️ 需确认 |
| 34 | webui | src/store/workspace/constructRemixPrompt.ts | resources/webview_source_code/src/store/workspace/constructRemixPrompt.ts | modified | 🏷️ 需确认 |
| 35 | webui | src/store/workspace/constructToolCallPrompt.ts | resources/webview_source_code/src/store/workspace/constructToolCallPrompt.ts | modified | 🏷️ 需确认 |
| 36 | webui | src/store/workspace/index.ts | resources/webview_source_code/src/store/workspace/index.ts | modified | 🏷️ 需确认 |
| 39 | webui | src/utils/addCacheMarksToMessages.ts | resources/webview_source_code/src/utils/addCacheMarksToMessages.ts | modified | 🏷️ 需确认 |
| 40 | webui | src/utils/chatAttachParseHandler.ts | resources/webview_source_code/src/utils/chatAttachParseHandler.ts | modified | 🏷️ 需确认 |
| 41 | webui | src/utils/eventbus.ts | resources/webview_source_code/src/utils/eventbus.ts | modified | 🏷️ 需确认 |
| 42 | webui | src/utils/report.ts | resources/webview_source_code/src/utils/report.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 13 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 17 | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 31 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 33 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (15 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/proposal.md | 在排除列表中 |
| 2 | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/specs/chat-model-selector/spec.md | 在排除列表中 |
| 3 | webui | openspec/changes/archive/2026-03-25-refactor-model-price-source/tasks.md | 在排除列表中 |
| 4 | webui | openspec/changes/archive/2026-03-26-add-report-reliability/design.md | 在排除列表中 |
| 5 | webui | openspec/changes/archive/2026-03-26-add-report-reliability/proposal.md | 在排除列表中 |
| 6 | webui | openspec/changes/archive/2026-03-26-add-report-reliability/specs/event-reporting/spec.md | 在排除列表中 |
| 7 | webui | openspec/changes/archive/2026-03-26-add-report-reliability/tasks.md | 在排除列表中 |
| 8 | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/proposal.md | 在排除列表中 |
| 9 | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/specs/chat-message-metadata/spec.md | 在排除列表中 |
| 10 | webui | openspec/changes/archive/2026-03-26-fix-round-tokens-and-duration/tasks.md | 在排除列表中 |
| 11 | webui | openspec/specs/chat-model-selector/spec.md | 在排除列表中 |
| 12 | webui | openspec/specs/event-reporting/spec.md | 在排除列表中 |
| 26 | webui | src/routes/CodeChat/ChatModelSelector.tsx | Y3不需要模型选择功能，固定使用VSCode Settings中的模型配置 |
| 37 | webui | src/telemetry/const.ts | 在排除列表中 |
| 38 | webui | src/telemetry/otel.ts | 在排除列表中 |

</details>
