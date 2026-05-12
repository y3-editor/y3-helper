# CodeMaker 同步报告
- 生成时间: 2026-05-12T10:07:43.486Z
- 上游 extension: `1d7336d8` → `58cbde2e` (2026-04-21 → 2026-04-22, 1 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 2 |
| 合计 | 6 |
| **🏷️ 涉及新需求 (需用户确认)** | **6** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | src/extension.ts | - | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |
| 2 | 🟡 REVIEW | extension | src/provider/editApplyProvider.ts | - | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |
| 3 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |
| 4 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |
| 5 | 🟡 REVIEW | extension | src/utils/editFile/claudeEdit.ts | src/codemaker/utils/editFile/claudeEdit.ts | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |
| 6 | 🟡 REVIEW | extension | src/utils/sendWebviewInitData.ts | - | 58cbde2e feat: 新增 BackendApplyCode 配置项支持 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 2 | extension | src/provider/editApplyProvider.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 3 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 5 | extension | src/utils/editFile/claudeEdit.ts | src/codemaker/utils/editFile/claudeEdit.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 6 | extension | src/utils/sendWebviewInitData.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): UPDATE_SETTINGS

<details>
<summary>⚪ SKIP - 已排除 (2 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | src/extension.ts | 在排除列表中 |
| 4 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |

</details>
