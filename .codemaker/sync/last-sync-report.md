# CodeMaker 同步报告
- 生成时间: 2026-04-30T03:01:49.834Z
- 上游 extension: `24245749` → `f01d2d70` (2026-03-18 → 2026-03-19, 2 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 1 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 2 |
| 合计 | 6 |
| **🏷️ 涉及新需求 (需用户确认)** | **6** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | src/extension.ts | - | 1a77e15d feat: 为 Spec 事件上报增加失败重试机制; f01d2d70 feat: 新增终端交互提示检测，自动终止卡住的交互式命令 |
| 2 | 🟡 REVIEW | extension | src/handlers/specHandler/specHandler.ts | - | 1a77e15d feat: 为 Spec 事件上报增加失败重试机制 |
| 3 | 🔴 SKIP | extension | src/utils/report.ts | - | 1a77e15d feat: 为 Spec 事件上报增加失败重试机制 |
| 4 | 🟡 REVIEW | extension | src/utils/terminal/TerminalProcess.ts | - | f01d2d70 feat: 新增终端交互提示检测，自动终止卡住的交互式命令 |
| 5 | 🟡 REVIEW | extension | src/utils/terminal/index.ts | - | f01d2d70 feat: 新增终端交互提示检测，自动终止卡住的交互式命令 |
| 6 | 🔴 NEW | extension | src/utils/textDocumentChange.ts | - | 1a77e15d feat: 为 Spec 事件上报增加失败重试机制 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 4 | extension | src/utils/terminal/TerminalProcess.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 5 | extension | src/utils/terminal/index.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 6 | extension | src/utils/textDocumentChange.ts | modified |

<details>
<summary>⚪ SKIP - 已排除 (2 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | src/extension.ts | 在排除列表中 |
| 3 | extension | src/utils/report.ts | 在排除列表中 |

</details>
