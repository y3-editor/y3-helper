# CodeMaker 同步报告
- 生成时间: 2026-05-15T02:20:29.993Z
- 上游 extension: `4ee76a4b` → `92221b5c` (2026-04-30 → 2026-05-07, 4 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 3 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 9 |
| 合计 | 15 |
| **🏷️ 涉及新需求 (需用户确认)** | **15** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | CHANGELOG.md | - | 92221b5c chore: 发布 v26.5.0 版本 |
| 2 | 🔴 SKIP | extension | package.json | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制; a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑; 92221b5c chore: 发布 v26.5.0 版本 |
| 3 | 🔴 SKIP | extension | package.nls.json | - | a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 4 | 🔴 SKIP | extension | package.nls.zh-cn.json | - | a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 5 | 🔴 SKIP | extension | src/commands/index.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 6 | 🔴 SKIP | extension | src/extension.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制; a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 7 | 🔴 SKIP | extension | src/http/chatHistory.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 8 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制; a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 9 | 🟡 REVIEW | extension | src/provider/webviewProvider/postMessageHandlers/toolCall.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 10 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 11 | 🟡 REVIEW | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制; a662d4bd refactor: 移除 CodebaseChatRtk 配置项并调整 RTK 功能逻辑 |
| 12 | 🔴 SKIP | extension | src/utils/getWorkspaceInfo.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 13 | 🔴 NEW | extension | src/utils/internalFs.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 14 | 🔴 NEW | extension | src/utils/persistToolResult.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |
| 15 | 🔴 NEW | extension | src/utils/transcriptCleanup.ts | - | e8d5a141 feat: 支持超大工具输出自动落盘与清理机制 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 8 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 9 | extension | src/provider/webviewProvider/postMessageHandlers/toolCall.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 11 | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 13 | extension | src/utils/internalFs.ts | added |
| 14 | extension | src/utils/persistToolResult.ts | added |
| 15 | extension | src/utils/transcriptCleanup.ts | added |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): CLEAN_SESSION_FILES

<details>
<summary>⚪ SKIP - 已排除 (9 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 3 | extension | package.nls.json | 在排除列表中 |
| 4 | extension | package.nls.zh-cn.json | 在排除列表中 |
| 5 | extension | src/commands/index.ts | 在排除列表中 |
| 6 | extension | src/extension.ts | 在排除列表中 |
| 7 | extension | src/http/chatHistory.ts | 在排除列表中 |
| 10 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |
| 12 | extension | src/utils/getWorkspaceInfo.ts | 在排除列表中 |

</details>
