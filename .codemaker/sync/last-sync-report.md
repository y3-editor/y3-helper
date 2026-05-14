# CodeMaker 同步报告
- 生成时间: 2026-05-14T07:13:15.629Z
- 上游 extension: `784c5571` → `529df6ab` (2026-04-23 → 2026-04-27, 2 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 1 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 1 |
| 合计 | 2 |
| **🏷️ 涉及新需求 (需用户确认)** | **2** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | README.md | - | 529df6ab docs: 添加本地 LSP Debug 启动的配置说明 |
| 2 | 🟡 REVIEW | extension | src/handlers/mcpHandlers/index.ts | src/codemaker/mcpHandlers/index.ts | 11b5d589 refactor: 优化 MCP 工具调用的会话过期重试机制 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | extension | src/handlers/mcpHandlers/index.ts | src/codemaker/mcpHandlers/index.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (1 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | README.md | 在排除列表中 |

</details>
