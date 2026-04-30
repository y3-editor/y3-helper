# CodeMaker 同步报告
- 生成时间: 2026-04-30T06:39:34.506Z
- 上游 webui: `82ee0794` → `2f5eb10f` (2026-03-21 → 2026-03-22, 1 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 22 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 2 |
| 合计 | 27 |
| **🏷️ 涉及新需求 (需用户确认)** | **27** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | webui | docs/TOKEN_METRICS_CALCULATION_SPEC.md | - | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 2 | 🟡 REVIEW | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 3 | 🟢 SAFE | webui | src/modules/prompts/index.ts | resources/webview_source_code/src/modules/prompts/index.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 4 | 🟢 SAFE | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 5 | 🟢 SAFE | webui | src/modules/prompts/shared.ts | resources/webview_source_code/src/modules/prompts/shared.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 6 | 🟢 SAFE | webui | src/modules/prompts/subagent.ts | resources/webview_source_code/src/modules/prompts/subagent.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 7 | 🟢 SAFE | webui | src/modules/prompts/template-loader.ts | resources/webview_source_code/src/modules/prompts/template-loader.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 8 | 🟢 SAFE | webui | src/modules/prompts/templates/code-edit.txt | resources/webview_source_code/src/modules/prompts/templates/code-edit.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 9 | 🟢 SAFE | webui | src/modules/prompts/templates/external-apis.txt | resources/webview_source_code/src/modules/prompts/templates/external-apis.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 10 | 🟢 SAFE | webui | src/modules/prompts/templates/mcp-tools.txt | resources/webview_source_code/src/modules/prompts/templates/mcp-tools.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 11 | 🟢 SAFE | webui | src/modules/prompts/templates/search-and-reading.txt | resources/webview_source_code/src/modules/prompts/templates/search-and-reading.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 12 | 🟢 SAFE | webui | src/modules/prompts/templates/terminal.txt | resources/webview_source_code/src/modules/prompts/templates/terminal.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 13 | 🟢 SAFE | webui | src/modules/prompts/templates/tool-calling.txt | resources/webview_source_code/src/modules/prompts/templates/tool-calling.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 14 | 🟢 SAFE | webui | src/modules/prompts/templates/user-info.txt | resources/webview_source_code/src/modules/prompts/templates/user-info.txt | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 15 | 🟢 SAFE | webui | src/modules/prompts/types.ts | resources/webview_source_code/src/modules/prompts/types.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 16 | 🟢 SAFE | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 17 | 🟢 SAFE | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 18 | 🟢 SAFE | webui | src/modules/subagent/core/session.ts | resources/webview_source_code/src/modules/subagent/core/session.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 19 | 🟢 SAFE | webui | src/modules/subagent/lifecycle/builtin-hooks.ts | resources/webview_source_code/src/modules/subagent/lifecycle/builtin-hooks.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 20 | 🟢 SAFE | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 21 | 🟢 SAFE | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 22 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 23 | 🟢 SAFE | webui | src/utils/chat.ts | resources/webview_source_code/src/utils/chat.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 24 | 🟢 SAFE | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 25 | 🔴 SKIP | webui | src/utils/specVersionUtils.ts | - | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 26 | 🟢 SAFE | webui | src/utils/subagentTokens.ts | resources/webview_source_code/src/utils/subagentTokens.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |
| 27 | 🟡 REVIEW | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | 2f5eb10f feat: 优化 prompt 生成和 token 统计系统 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | webui | src/modules/prompts/index.ts | resources/webview_source_code/src/modules/prompts/index.ts | modified | 🏷️ 需确认 |
| 4 | webui | src/modules/prompts/main-system.ts | resources/webview_source_code/src/modules/prompts/main-system.ts | modified | 🏷️ 需确认 |
| 5 | webui | src/modules/prompts/shared.ts | resources/webview_source_code/src/modules/prompts/shared.ts | modified | 🏷️ 需确认 |
| 6 | webui | src/modules/prompts/subagent.ts | resources/webview_source_code/src/modules/prompts/subagent.ts | modified | 🏷️ 需确认 |
| 7 | webui | src/modules/prompts/template-loader.ts | resources/webview_source_code/src/modules/prompts/template-loader.ts | added | 🏷️ 需确认 |
| 8 | webui | src/modules/prompts/templates/code-edit.txt | resources/webview_source_code/src/modules/prompts/templates/code-edit.txt | added | 🏷️ 需确认 |
| 9 | webui | src/modules/prompts/templates/external-apis.txt | resources/webview_source_code/src/modules/prompts/templates/external-apis.txt | added | 🏷️ 需确认 |
| 10 | webui | src/modules/prompts/templates/mcp-tools.txt | resources/webview_source_code/src/modules/prompts/templates/mcp-tools.txt | added | 🏷️ 需确认 |
| 11 | webui | src/modules/prompts/templates/search-and-reading.txt | resources/webview_source_code/src/modules/prompts/templates/search-and-reading.txt | added | 🏷️ 需确认 |
| 12 | webui | src/modules/prompts/templates/terminal.txt | resources/webview_source_code/src/modules/prompts/templates/terminal.txt | added | 🏷️ 需确认 |
| 13 | webui | src/modules/prompts/templates/tool-calling.txt | resources/webview_source_code/src/modules/prompts/templates/tool-calling.txt | added | 🏷️ 需确认 |
| 14 | webui | src/modules/prompts/templates/user-info.txt | resources/webview_source_code/src/modules/prompts/templates/user-info.txt | added | 🏷️ 需确认 |
| 15 | webui | src/modules/prompts/types.ts | resources/webview_source_code/src/modules/prompts/types.ts | modified | 🏷️ 需确认 |
| 16 | webui | src/modules/subagent/core/executor.ts | resources/webview_source_code/src/modules/subagent/core/executor.ts | modified | 🏷️ 需确认 |
| 17 | webui | src/modules/subagent/core/message-preprocessor.ts | resources/webview_source_code/src/modules/subagent/core/message-preprocessor.ts | modified | 🏷️ 需确认 |
| 18 | webui | src/modules/subagent/core/session.ts | resources/webview_source_code/src/modules/subagent/core/session.ts | modified | 🏷️ 需确认 |
| 19 | webui | src/modules/subagent/lifecycle/builtin-hooks.ts | resources/webview_source_code/src/modules/subagent/lifecycle/builtin-hooks.ts | modified | 🏷️ 需确认 |
| 20 | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | modified | 🏷️ 需确认 |
| 21 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified | 🏷️ 需确认 |
| 23 | webui | src/utils/chat.ts | resources/webview_source_code/src/utils/chat.ts | modified | 🏷️ 需确认 |
| 24 | webui | src/utils/consumedTokensCalculator.ts | resources/webview_source_code/src/utils/consumedTokensCalculator.ts | added | 🏷️ 需确认 |
| 26 | webui | src/utils/subagentTokens.ts | resources/webview_source_code/src/utils/subagentTokens.ts | deleted | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 22 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 27 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (2 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | docs/TOKEN_METRICS_CALCULATION_SPEC.md | 在排除列表中 |
| 25 | webui | src/utils/specVersionUtils.ts | [OpenSpec] 版本检测工具，Y3不需要 |

</details>
