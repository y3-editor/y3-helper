# CodeMaker 同步报告
- 生成时间: 2026-05-14T07:44:32.439Z
- 上游 extension: `529df6ab` → `be7a0ab5` (2026-04-27 → 2026-04-28, 4 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 5 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 6 |
| 合计 | 11 |
| **🏷️ 涉及新需求 (需用户确认)** | **11** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | package.json | - | 0b707841 chore: 调整ChatApplyMode 默认值为 claudeedit; ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 2 | 🔴 SKIP | extension | package.nls.json | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 3 | 🔴 SKIP | extension | package.nls.zh-cn.json | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 4 | 🔴 SKIP | extension | src/extension.ts | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 5 | 🟡 REVIEW | extension | src/handlers/skillsHandler/index.ts | src/codemaker/skillsHandler.ts | 96919a61 feat: Skill 配置支持 autoRun 自动执行参数 |
| 6 | 🟡 REVIEW | extension | src/handlers/skillsHandler/types.ts | - | 96919a61 feat: Skill 配置支持 autoRun 自动执行参数 |
| 7 | 🔴 SKIP | extension | src/param/configures.ts | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 8 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 96919a61 feat: Skill 配置支持 autoRun 自动执行参数; ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 9 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |
| 10 | 🟡 REVIEW | extension | src/utils/editFile/claudeEdit.ts | src/codemaker/utils/editFile/claudeEdit.ts | be7a0ab5 refactor: 支持跨工作区修改 |
| 11 | 🟡 REVIEW | extension | src/utils/sendWebviewInitData.ts | - | ade8ae9e feat: 新增隐藏内置 OpenSpec 命令的配置项 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 5 | extension | src/handlers/skillsHandler/index.ts | src/codemaker/skillsHandler.ts | 在监控列表中且有映射 | modified | 🏷️ 需确认 |
| 6 | extension | src/handlers/skillsHandler/types.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |
| 8 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 10 | extension | src/utils/editFile/claudeEdit.ts | src/codemaker/utils/editFile/claudeEdit.ts | Y3有定制修改 | modified | 🏷️ 需确认 |
| 11 | extension | src/utils/sendWebviewInitData.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified | 🏷️ 需确认 |

<details>
<summary>⚪ SKIP - 已排除 (6 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | package.json | 在排除列表中 |
| 2 | extension | package.nls.json | 在排除列表中 |
| 3 | extension | package.nls.zh-cn.json | 在排除列表中 |
| 4 | extension | src/extension.ts | 在排除列表中 |
| 7 | extension | src/param/configures.ts | 在排除列表中 |
| 9 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |

</details>
