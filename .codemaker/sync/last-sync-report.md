# CodeMaker 同步报告
- 生成时间: 2026-04-23T02:43:47.269Z
- 上游 webui: `10be173b` → `ab58bc52` (2026-03-02 → 2026-03-03, 6 commits)
- 上游 extension: `fbf9134f` → `61ab1041` (2026-03-04 → 2026-03-05, 10 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 11 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 19 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 14 |
| 合计 | 48 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 1 | webui | src/routes/AuthProvider.tsx | resources/webview_source_code/src/routes/AuthProvider.tsx | modified |
| 2 | webui | src/routes/CodeChat/ChatInput.tsx | resources/webview_source_code/src/routes/CodeChat/ChatInput.tsx | modified |
| 3 | webui | src/routes/CodeChat/ChatMessagesList/index.tsx | resources/webview_source_code/src/routes/CodeChat/ChatMessagesList/index.tsx | modified |
| 4 | webui | src/routes/CodeChat/ChatModelSelector.tsx | resources/webview_source_code/src/routes/CodeChat/ChatModelSelector.tsx | modified |
| 5 | webui | src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/PromptsPanel.tsx | modified |
| 6 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | modified |
| 7 | webui | src/routes/CodeChat/DevspaceCollapse.tsx | resources/webview_source_code/src/routes/CodeChat/DevspaceCollapse.tsx | modified |
| 8 | webui | src/services/index.ts | resources/webview_source_code/src/services/index.ts | modified |
| 9 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | modified |
| 10 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | modified |
| 25 | extension | src/handlers/workspaceTracker/index.ts | src/codemaker/handlers/workspaceTracker.ts | modified |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |
|---|------|---------|--------|------|---------|
| 20 | extension | src/handlers/skillsHandler/index.ts | src/codemaker/skillsHandler.ts | 在监控列表中且有映射 | modified |
| 21 | extension | src/handlers/specHandler/parsers/openspecParser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 22 | extension | src/handlers/specHandler/parsers/speckitParser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |
| 23 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 28 | extension | src/utils/executeFunction.ts | modified |
| 29 | extension | src/utils/fileType.ts | added |
| 30 | extension | src/utils/generateCode.ts | modified |
| 31 | extension | src/utils/generateComments.ts | modified |
| 32 | extension | src/utils/generateCommentsNew.ts | modified |
| 33 | extension | src/utils/generateDocstring.ts | modified |
| 34 | extension | src/utils/getCodeFix.ts | modified |
| 37 | extension | src/utils/modifyCode.ts | modified |
| 38 | extension | vendor/mac.noindex/alerter/alerter | added |
| 39 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Info.plist | deleted |
| 40 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier | deleted |
| 41 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/PkgInfo | deleted |
| 42 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/Terminal.icns | deleted |
| 43 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/Credits.rtf | deleted |
| 44 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/InfoPlist.strings | deleted |
| 45 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/MainMenu.nib | deleted |
| 46 | extension | vendor/snoreToast/LICENSE | deleted |
| 47 | extension | vendor/snoreToast/snoretoast-x64.exe | deleted |
| 48 | extension | vendor/snoreToast/snoretoast-x86.exe | deleted |

<details>
<summary>⚪ SKIP - 已排除 (14 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 11 | webui | src/telemetry/otel.ts | 在排除列表中 |
| 12 | extension | CHANGELOG.md | 在排除列表中 |
| 13 | extension | package.json | 在排除列表中 |
| 14 | extension | pnpm-lock.yaml | 在排除列表中 |
| 15 | extension | src/commands/addComments/index.ts | 在排除列表中 |
| 16 | extension | src/commands/addDocstring/index.ts | 在排除列表中 |
| 17 | extension | src/commands/editSuggestions/unisdk.ts | 在排除列表中 |
| 18 | extension | src/config.ts | 在排除列表中 |
| 19 | extension | src/extension.ts | 在排除列表中 |
| 24 | extension | src/handlers/uriHandler.ts | 在排除列表中 |
| 26 | extension | src/param/configures.ts | 在排除列表中 |
| 27 | extension | src/utils/chatNotification.ts | 在排除列表中 |
| 35 | extension | src/utils/localRepo.ts | 在排除列表中 |
| 36 | extension | src/utils/localReview.ts | 在排除列表中 |

</details>
