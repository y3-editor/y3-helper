# CodeMaker 同步报告
- 生成时间: 2026-04-24T08:13:24.980Z
- 上游 webui: `85d655c8` → `630a1a91` (2026-02-12 → 2026-02-13, 8 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 8 |
| 🟡 REVIEW (需对比决策) | 0 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 3 |
| 合计 | 11 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 1 | webui | src/components/UserDashboard/UserDashboard.tsx | resources/webview_source_code/src/components/UserDashboard/UserDashboard.tsx | modified |
| 2 | webui | src/routes/CodeChat/ChatHistories.tsx | resources/webview_source_code/src/routes/CodeChat/ChatHistories.tsx | modified |
| 3 | webui | src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/GroupAIMessage.tsx | modified |
| 4 | webui | src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/ToolCallResults.tsx | modified |
| 5 | webui | src/routes/CodeChat/ChatModelSelector.tsx | resources/webview_source_code/src/routes/CodeChat/ChatModelSelector.tsx | modified |
| 8 | webui | src/routes/CodeReview/IssueFilter.tsx | resources/webview_source_code/src/routes/CodeReview/IssueFilter.tsx | modified |
| 9 | webui | src/store/chat-config.ts | resources/webview_source_code/src/store/chat-config.ts | modified |
| 10 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified |

<details>
<summary>⚪ SKIP - 已排除 (3 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 6 | webui | src/routes/CodeChat/GlobalDataLoader/Hooks/useLoadUserQuota.tsx | Y3有自己的GlobalDataLoader.tsx（从VSCode Settings读取固定模型），上游的index.tsx会调getUserModels接口（Y3没有），且目录优先于文件导致Y3版本被覆盖 |
| 7 | webui | src/routes/CodeChat/GlobalDataLoader/index.tsx | Y3有自己的GlobalDataLoader.tsx（从VSCode Settings读取固定模型），上游的index.tsx会调getUserModels接口（Y3没有），且目录优先于文件导致Y3版本被覆盖 |
| 11 | webui | src/utils/specVersionUtils.ts | [OpenSpec] 版本检测工具，Y3不需要 |

</details>
