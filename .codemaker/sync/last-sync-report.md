# CodeMaker 同步报告
- 生成时间: 2026-04-30T10:01:28.497Z
- 上游 extension: `7f4ed5c4` → `a96bc0e0` (2026-03-24 → 2026-03-26, 3 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 1 |
| 🟡 REVIEW (需对比决策) | 0 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 3 |
| 合计 | 4 |
| **🏷️ 涉及新需求 (需用户确认)** | **4** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | CHANGELOG.md | - | a96bc0e0 chore: 发布 v26.3.5 版本 |
| 2 | 🔴 SKIP | extension | package.json | - | a96bc0e0 chore: 发布 v26.3.5 版本 |
| 3 | 🟢 SAFE | extension | src/handlers/mcpHandlers/index.ts | src/codemaker/mcpHandlers/index.ts | 4ca31447 refactor: 优化 MCP 服务器连接错误处理逻辑 |
| 4 | 🔴 SKIP | extension | src/utils/openSetting.ts | - | d4aa0478 style: 移除 webview body 的默认内边距 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 3 | extension | src/handlers/mcpHandlers/index.ts | src/codemaker/mcpHandlers/index.ts | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (3 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 4 | extension | src/utils/openSetting.ts | 在排除列表中 |

</details>
