# CodeMaker 同步报告
- 生成时间: 2026-05-07T06:48:53.252Z
- 上游 webui: `78e28618` → `2dfbed26` (2026-04-02 → 2026-04-03, 3 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 6 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 9 |
| **🏷️ 涉及新需求 (需用户确认)** | **9** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟢 SAFE | webui | src/hooks/useToolCall/mcpInfo.ts | resources/webview_source_code/src/hooks/useToolCall/mcpInfo.ts | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 2 | 🟡 REVIEW | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | f13dff66 feat: 支持 JetBrains IDE 使用新建并行会话功能 |
| 3 | 🟢 SAFE | webui | src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 4 | 🟡 REVIEW | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 5 | 🟢 SAFE | webui | src/routes/CodeChat/MCPConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/MCPConfigCollapse.tsx | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 6 | 🟢 SAFE | webui | src/routes/CodeChat/MCPStatus.tsx | resources/webview_source_code/src/routes/CodeChat/MCPStatus.tsx | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 7 | 🟢 SAFE | webui | src/services/toolExecution/MainAgentExecutionStrategy.ts | resources/webview_source_code/src/services/toolExecution/MainAgentExecutionStrategy.ts | 34a7f7d9 fix: mcp不能自动调用问题排查 |
| 8 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | 34a7f7d9 fix: mcp不能自动调用问题排查; 2dfbed26 refactor: 简化 MCP 工具调用的自动执行逻辑 |
| 9 | 🟢 SAFE | webui | src/store/mcp.ts | resources/webview_source_code/src/store/mcp.ts | 34a7f7d9 fix: mcp不能自动调用问题排查 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 1 | webui | src/hooks/useToolCall/mcpInfo.ts | resources/webview_source_code/src/hooks/useToolCall/mcpInfo.ts | modified | 🏷️ 需确认 |
| 3 | webui | src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/MCPToolCall.tsx | modified | 🏷️ 需确认 |
| 5 | webui | src/routes/CodeChat/MCPConfigCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/MCPConfigCollapse.tsx | modified | 🏷️ 需确认 |
| 6 | webui | src/routes/CodeChat/MCPStatus.tsx | resources/webview_source_code/src/routes/CodeChat/MCPStatus.tsx | modified | 🏷️ 需确认 |
| 7 | webui | src/services/toolExecution/MainAgentExecutionStrategy.ts | resources/webview_source_code/src/services/toolExecution/MainAgentExecutionStrategy.ts | modified | 🏷️ 需确认 |
| 9 | webui | src/store/mcp.ts | resources/webview_source_code/src/store/mcp.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | webui | src/routes/CodeChat/ChatHeaderToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHeaderToolbar.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 4 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | Y3有定制修改 | modified | 🏷️ 需确认 |
| 8 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
