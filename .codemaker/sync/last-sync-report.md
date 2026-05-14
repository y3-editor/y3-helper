# CodeMaker 同步报告
- 生成时间: 2026-05-14T06:44:40.807Z
- 上游 webui: `582846d2` → `dcc701b0` (2026-04-24 → 2026-04-27, 3 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 4 |
| 🟡 REVIEW (需对比决策) | 2 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 6 |
| **🏷️ 涉及新需求 (需用户确认)** | **6** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟢 SAFE | webui | src/modules/subagent/core/llm.ts | resources/webview_source_code/src/modules/subagent/core/llm.ts | 9b555ffa refactor: 优化 GPT-5 模型判断逻辑及配置处理 |
| 2 | 🟢 SAFE | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | 9b555ffa refactor: 优化 GPT-5 模型判断逻辑及配置处理 |
| 3 | 🟢 SAFE | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | 9b555ffa refactor: 优化 GPT-5 模型判断逻辑及配置处理; dcc701b0 refactor: 优化 GPT 模型缓存token判定 |
| 4 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | dcb18237 chore: 移除提交2s限制(AgentEntry入口已有判定); 9b555ffa refactor: 优化 GPT-5 模型判断逻辑及配置处理 |
| 5 | 🟡 REVIEW | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | 9b555ffa refactor: 优化 GPT-5 模型判断逻辑及配置处理 |
| 6 | 🟢 SAFE | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | dcc701b0 refactor: 优化 GPT 模型缓存token判定 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 1 | webui | src/modules/subagent/core/llm.ts | resources/webview_source_code/src/modules/subagent/core/llm.ts | modified | 🏷️ 需确认 |
| 2 | webui | src/services/buildCodebaseChatPayload.ts | resources/webview_source_code/src/services/buildCodebaseChatPayload.ts | modified | 🏷️ 需确认 |
| 3 | webui | src/services/harness/stream/azureOpenAI/index.ts | resources/webview_source_code/src/services/harness/stream/azureOpenAI/index.ts | modified | 🏷️ 需确认 |
| 6 | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 4 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 5 | webui | src/utils/chatThinkingHandler.ts | resources/webview_source_code/src/utils/chatThinkingHandler.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
