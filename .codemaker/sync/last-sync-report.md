# CodeMaker 同步报告
- 生成时间: 2026-04-29T09:10:38.373Z
- 上游 webui: `d406cde1` → `14038295` (2026-03-12 → 2026-03-13, 4 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 4 |
| 🟡 REVIEW (需对比决策) | 1 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 5 |
| **🏷️ 涉及新需求 (需用户确认)** | **2** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟢 SAFE | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | 14038295 feat: GPT5错误提示兼容 |
| 4 | 🟢 SAFE | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | 14038295 feat: GPT5错误提示兼容 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 1 | webui | src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatConsumeTokenPanel/index.tsx | modified | 🏷️ 需确认 |
| 3 | webui | src/store/workspace/pomptLinkMgr.ts | resources/webview_source_code/src/store/workspace/pomptLinkMgr.ts | modified |  |
| 4 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified | 🏷️ 需确认 |
| 5 | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | modified |  |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified |  |
