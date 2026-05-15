# CodeMaker 同步报告
- 生成时间: 2026-05-14T09:55:51.302Z
- 上游 webui: `326cb318` → `2473031a` (2026-05-02 → 2026-05-06, 1 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 1 |
| 🟡 REVIEW (需对比决策) | 1 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 0 |
| 合计 | 2 |
| **🏷️ 涉及新需求 (需用户确认)** | **2** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🟡 REVIEW | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | 2473031a refactor: 更新会话标题生成的事件类型 |
| 2 | 🟢 SAFE | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | 2473031a refactor: 更新会话标题生成的事件类型 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 2 | webui | src/types/report.ts | resources/webview_source_code/src/types/report.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 1 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
