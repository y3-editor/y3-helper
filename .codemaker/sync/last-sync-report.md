# CodeMaker 同步报告
- 生成时间: 2026-04-30T03:44:29.890Z
- 上游 extension: `f01d2d70` → `66830584` (2026-03-19 → 2026-03-20, 3 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 7 |
| 🔴 NEW (新增功能) | 1 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 7 |
| 合计 | 15 |
| **🏷️ 涉及新需求 (需用户确认)** | **15** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | .vscodeignore | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 2 | 🔴 SKIP | extension | package.json | - | f0f270b0 feat: Spec 聚焦检测改为可配置开关，默认全平台启用; d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理; 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 3 | 🔴 SKIP | extension | package.nls.json | - | f0f270b0 feat: Spec 聚焦检测改为可配置开关，默认全平台启用; d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理; 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 4 | 🔴 SKIP | extension | package.nls.zh-cn.json | - | f0f270b0 feat: Spec 聚焦检测改为可配置开关，默认全平台启用; d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理; 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 5 | 🔴 SKIP | extension | src/extension.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 6 | 🟡 REVIEW | extension | src/handlers/agentsHandler/index.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 7 | 🟡 REVIEW | extension | src/handlers/agentsHandler/parser.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 8 | 🟡 REVIEW | extension | src/handlers/agentsHandler/types.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 9 | 🟡 REVIEW | extension | src/handlers/specHandler/specHandler.ts | - | f0f270b0 feat: Spec 聚焦检测改为可配置开关，默认全平台启用; 66830584 feat: Spec 聚焦检测改为路径感知自动启用，配置开关默认关闭 |
| 10 | 🔴 SKIP | extension | src/param/configures.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 11 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 12 | 🟡 REVIEW | extension | src/provider/webviewProvider/postMessageHandlers/toolCall.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 13 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 14 | 🔴 NEW | extension | src/utils/executeFunction.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |
| 15 | 🟡 REVIEW | extension | src/utils/sendWebviewInitData.ts | - | d0176047 feat: 新增 AgentsHandler 模块支持自定义 Agent 管理 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 6 | extension | src/handlers/agentsHandler/index.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | added | 🏷️ 需确认 |
| 7 | extension | src/handlers/agentsHandler/parser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | added | 🏷️ 需确认 |
| 8 | extension | src/handlers/agentsHandler/types.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | added | 🏷️ 需确认 |
| 9 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 11 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 12 | extension | src/provider/webviewProvider/postMessageHandlers/toolCall.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 15 | extension | src/utils/sendWebviewInitData.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 14 | extension | src/utils/executeFunction.ts | modified |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): GET_AGENTS

<details>
<summary>⚪ SKIP - 已排除 (7 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | .vscodeignore | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 3 | extension | package.nls.json | 在排除列表中 |
| 4 | extension | package.nls.zh-cn.json | 在排除列表中 |
| 5 | extension | src/extension.ts | 在排除列表中 |
| 10 | extension | src/param/configures.ts | 在排除列表中 |
| 13 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |

</details>
