# CodeMaker 同步报告
- 生成时间: 2026-05-15T07:54:13.217Z
- 上游 extension: `5fad3949` → `d0484549` (2026-05-09 → 2026-05-11, 4 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 3 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 9 |
| 合计 | 15 |
| **🏷️ 涉及新需求 (需用户确认)** | **13** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 2 | 🔴 SKIP | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/.openspec.yaml | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 3 | 🔴 SKIP | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/design.md | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 4 | 🔴 SKIP | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/proposal.md | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 5 | 🔴 SKIP | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/specs/rtk-savings-reporting/spec.md | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 6 | 🔴 SKIP | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/tasks.md | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 7 | 🔴 SKIP | extension | openspec/specs/rtk-savings-reporting/spec.md | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能; 0b41e271 feat: RTK 节省统计新增 input/output token 字段及历史数据回填机制 |
| 9 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 36f33e42 feat: 【MCP】修复大图被强制落盘 + 落盘开关单源化 |
| 10 | 🟡 REVIEW | extension | src/provider/webviewProvider/postMessageHandlers/userPreferences.ts | - | 36f33e42 feat: 【MCP】修复大图被强制落盘 + 落盘开关单源化 |
| 11 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | 36f33e42 feat: 【MCP】修复大图被强制落盘 + 落盘开关单源化 |
| 12 | 🟡 REVIEW | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | 60dc7065 feat: 新增 RTK token 节省统计上报功能 |
| 13 | 🔴 NEW | extension | src/utils/persistToolResult.ts | - | 36f33e42 feat: 【MCP】修复大图被强制落盘 + 落盘开关单源化 |
| 14 | 🔴 NEW | extension | src/utils/rtk/rtkSavingsReporter.ts | - | 60dc7065 feat: 新增 RTK token 节省统计上报功能; 0b41e271 feat: RTK 节省统计新增 input/output token 字段及历史数据回填机制 |
| 15 | 🔴 NEW | extension | src/utils/userPreferences.ts | - | 36f33e42 feat: 【MCP】修复大图被强制落盘 + 落盘开关单源化 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 9 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 10 | extension | src/provider/webviewProvider/postMessageHandlers/userPreferences.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | added | 🏷️ 需确认 |
| 12 | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 13 | extension | src/utils/persistToolResult.ts | modified |
| 14 | extension | src/utils/rtk/rtkSavingsReporter.ts | added |
| 15 | extension | src/utils/userPreferences.ts | added |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): UPDATE_USER_PREFERENCE

<details>
<summary>⚪ SKIP - 已排除 (9 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/.openspec.yaml | 在排除列表中 |
| 3 | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/design.md | 在排除列表中 |
| 4 | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/proposal.md | 在排除列表中 |
| 5 | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/specs/rtk-savings-reporting/spec.md | 在排除列表中 |
| 6 | extension | openspec/changes/archive/2026-05-11-report-rtk-tokens-saved/tasks.md | 在排除列表中 |
| 7 | extension | openspec/specs/rtk-savings-reporting/spec.md | 在排除列表中 |
| 8 | extension | package.json | 在排除列表中 |
| 11 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |

</details>
