# CodeMaker 同步报告
- 生成时间: 2026-04-23T07:07:56.996Z
- 上游 webui: `dd6978c2` → `b49e4a40` (2026-02-06 → 2026-02-08, 1 commits)
- 上游 extension: `0589c1d1` → `50ce61a6` (2026-02-08 → 2026-02-10, 5 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 3 |
| 🟡 REVIEW (需对比决策) | 6 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 11 |
| 合计 | 20 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 5 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified |
| 6 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | modified |
| 7 | webui | src/utils/validateBeforeChat.ts | resources/webview_source_code/src/utils/validateBeforeChat.ts | modified |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |
|---|------|---------|--------|------|---------|
| 13 | extension | src/handlers/specHandler/parsers/openspecParser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 14 | extension | src/handlers/specHandler/setupHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 15 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 16 | extension | src/handlers/specHandler/types.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 17 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified |
| 20 | extension | src/utils/terminal/TerminalProcess.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |

## 📨 消息类型变更
### 🔴 新增 (Y3未实现): OPENSPEC_UPDATE, OPEN_WORKSPACE, RELOAD_WINDOW

<details>
<summary>⚪ SKIP - 已排除 (11 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | openspec/changes/archive/2026-02-08-add-clpc-codeblock-validation/proposal.md | 在排除列表中 |
| 2 | webui | openspec/changes/archive/2026-02-08-add-clpc-codeblock-validation/specs/clpc-security-restriction/spec.md | 在排除列表中 |
| 3 | webui | openspec/changes/archive/2026-02-08-add-clpc-codeblock-validation/tasks.md | 在排除列表中 |
| 4 | webui | openspec/specs/clpc-security-restriction/spec.md | 在排除列表中 |
| 8 | extension | CHANGELOG.md | 在排除列表中 |
| 9 | extension | configuration-test.json | 在排除列表中 |
| 10 | extension | package.json | 在排除列表中 |
| 11 | extension | package.nls.json | 在排除列表中 |
| 12 | extension | package.nls.zh-cn.json | 在排除列表中 |
| 18 | extension | src/utils/localReview.ts | 在排除列表中 |
| 19 | extension | src/utils/openCoveragePanel.ts | 在排除列表中 |

</details>
