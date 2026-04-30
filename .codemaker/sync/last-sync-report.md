# CodeMaker 同步报告
- 生成时间: 2026-04-30T06:55:34.645Z
- 上游 extension: `d0176047` → `55b7d60d` (2026-03-20 → 2026-03-22, 2 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 1 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 4 |
| 合计 | 5 |
| **🏷️ 涉及新需求 (需用户确认)** | **5** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | CHANGELOG.md | - | 55b7d60d chore: 发布 v26.3.3 版本 |
| 2 | 🔴 SKIP | extension | package.json | - | 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭; 55b7d60d chore: 发布 v26.3.3 版本 |
| 3 | 🔴 SKIP | extension | package.nls.json | - | 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 4 | 🔴 SKIP | extension | package.nls.zh-cn.json | - | 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 5 | 🟡 REVIEW | extension | src/handlers/specHandler/specHandler.ts | - | 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 5 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (4 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 3 | extension | package.nls.json | 在排除列表中 |
| 4 | extension | package.nls.zh-cn.json | 在排除列表中 |

</details>
