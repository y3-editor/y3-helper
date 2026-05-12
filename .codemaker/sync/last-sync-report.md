# CodeMaker 同步报告
- 生成时间: 2026-05-12T07:02:50.036Z
- 上游 extension: `d531ed8b` → `35cee12e` (2026-04-15 → 2026-04-16, 4 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 0 |
| 🟡 REVIEW (需对比决策) | 3 |
| 🔴 NEW (新增功能) | 4 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 10 |
| 合计 | 17 |
| **🏷️ 涉及新需求 (需用户确认)** | **17** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 NEW | extension | .vscode/launch.json | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 2 | 🔴 SKIP | extension | CHANGELOG.md | - | 0958e9f6 chore: 发布 v26.4.4 版本 |
| 3 | 🔴 SKIP | extension | package.json | - | 0958e9f6 chore: 发布 v26.4.4 版本 |
| 4 | 🔴 SKIP | extension | resources/language-server/.gitkeep | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 5 | 🔴 SKIP | extension | resources/language-server/codemaker-agent-v0.4.1.zip | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 6 | 🔴 SKIP | extension | src/extension.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 7 | 🔴 SKIP | extension | src/lsp/CodeMakerLanguageClient.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 8 | 🔴 SKIP | extension | src/lsp/WebviewRegistry.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 9 | 🔴 SKIP | extension | src/lsp/index.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 10 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 11 | 🟡 REVIEW | extension | src/provider/webviewProvider/postMessageHandlers/hookCall.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 12 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 13 | 🟡 REVIEW | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | 8e3355ac fix: 添加 run_terminal_cmd 命令参数校验; b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 14 | 🔴 NEW | extension | src/utils/languageClient/config.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 15 | 🔴 NEW | extension | src/utils/languageClient/instance.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 16 | 🔴 NEW | extension | src/utils/languageClient/update.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |
| 17 | 🔴 SKIP | extension | src/utils/login.ts | - | b91daeab refactor: 集成 codemaker-language-server 替换旧的 LSPGateway |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 10 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |
| 11 | extension | src/provider/webviewProvider/postMessageHandlers/hookCall.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | added | 🏷️ 需确认 |
| 13 | extension | src/utils/executeFunction.ts | src/codemaker/utils/executeFunction.ts | Y3有定制修改 | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 1 | extension | .vscode/launch.json | modified |
| 14 | extension | src/utils/languageClient/config.ts | modified |
| 15 | extension | src/utils/languageClient/instance.ts | modified |
| 16 | extension | src/utils/languageClient/update.ts | modified |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): EXECUTE_HOOK

<details>
<summary>⚪ SKIP - 已排除 (10 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 2 | extension | CHANGELOG.md | 在排除列表中 |
| 3 | extension | package.json | 在排除列表中 |
| 4 | extension | resources/language-server/.gitkeep | 在排除列表中 |
| 5 | extension | resources/language-server/codemaker-agent-v0.4.1.zip | 在排除列表中 |
| 6 | extension | src/extension.ts | 在排除列表中 |
| 7 | extension | src/lsp/CodeMakerLanguageClient.ts | 在排除列表中 |
| 8 | extension | src/lsp/WebviewRegistry.ts | 在排除列表中 |
| 9 | extension | src/lsp/index.ts | 在排除列表中 |
| 12 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |
| 17 | extension | src/utils/login.ts | 在排除列表中 |

</details>
