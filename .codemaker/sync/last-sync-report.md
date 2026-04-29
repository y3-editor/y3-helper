# CodeMaker 同步报告
- 生成时间: 2026-04-29T06:35:36.139Z
- 上游 extension: `fbf9134f` → `61ab1041` (2026-03-04 → 2026-03-05, 10 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 1 |
| 🟡 REVIEW (需对比决策) | 4 |
| 🔴 NEW (新增功能) | 19 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 13 |
| 合计 | 37 |
| **🏷️ 涉及新需求 (需用户确认)** | **28** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 2 | 🔴 SKIP | extension | package.json | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 4 | 🔴 SKIP | extension | src/commands/addComments/index.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 5 | 🔴 SKIP | extension | src/commands/addDocstring/index.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 6 | 🔴 SKIP | extension | src/commands/editSuggestions/unisdk.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 7 | 🔴 SKIP | extension | src/config.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 8 | 🔴 SKIP | extension | src/extension.ts | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例; cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 13 | 🔴 SKIP | extension | src/handlers/uriHandler.ts | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 14 | 🟢 SAFE | extension | src/handlers/workspaceTracker/index.ts | src/codemaker/handlers/workspaceTracker.ts | f33112a4 feat: 为文件路径搜索添加模糊匹配算法 |
| 16 | 🔴 SKIP | extension | src/utils/chatNotification.ts | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 19 | 🔴 NEW | extension | src/utils/generateCode.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 20 | 🔴 NEW | extension | src/utils/generateComments.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 21 | 🔴 NEW | extension | src/utils/generateCommentsNew.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 22 | 🔴 NEW | extension | src/utils/generateDocstring.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 23 | 🔴 NEW | extension | src/utils/getCodeFix.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 24 | 🔴 SKIP | extension | src/utils/localRepo.ts | - | 58fe4042 feat: Local Review支持svn和git仓库未跟踪文件的显示和差异比较 |
| 25 | 🔴 SKIP | extension | src/utils/localReview.ts | - | 58fe4042 feat: Local Review支持svn和git仓库未跟踪文件的显示和差异比较 |
| 26 | 🔴 NEW | extension | src/utils/modifyCode.ts | - | cc054fd3 feat: 功能模型都升级为Claude4.0 |
| 27 | 🔴 NEW | extension | vendor/mac.noindex/alerter/alerter | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 28 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Info.plist | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 29 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 30 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/PkgInfo | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 31 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/Terminal.icns | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 32 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/Credits.rtf | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 33 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/InfoPlist.strings | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 34 | 🔴 NEW | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/MainMenu.nib | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 35 | 🔴 NEW | extension | vendor/snoreToast/LICENSE | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 36 | 🔴 NEW | extension | vendor/snoreToast/snoretoast-x64.exe | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |
| 37 | 🔴 NEW | extension | vendor/snoreToast/snoretoast-x86.exe | - | b2e388b6 feat: 聊天弹出框支持跳转到VSCode实例 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 14 | extension | src/handlers/workspaceTracker/index.ts | src/codemaker/handlers/workspaceTracker.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 9 | extension | src/handlers/skillsHandler/index.ts | src/codemaker/skillsHandler.ts | 在监控列表中且有映射 | modified |  |
| 10 | extension | src/handlers/specHandler/parsers/openspecParser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |  |
| 11 | extension | src/handlers/specHandler/parsers/speckitParser.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |  |
| 12 | extension | src/handlers/specHandler/specHandler.ts | - | 在监控列表中（可能影响 Y3Maker 功能） | modified |  |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 17 | extension | src/utils/executeFunction.ts | modified |
| 18 | extension | src/utils/fileType.ts | added |
| 19 | extension | src/utils/generateCode.ts | modified |
| 20 | extension | src/utils/generateComments.ts | modified |
| 21 | extension | src/utils/generateCommentsNew.ts | modified |
| 22 | extension | src/utils/generateDocstring.ts | modified |
| 23 | extension | src/utils/getCodeFix.ts | modified |
| 26 | extension | src/utils/modifyCode.ts | modified |
| 27 | extension | vendor/mac.noindex/alerter/alerter | added |
| 28 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Info.plist | deleted |
| 29 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier | deleted |
| 30 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/PkgInfo | deleted |
| 31 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/Terminal.icns | deleted |
| 32 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/Credits.rtf | deleted |
| 33 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/InfoPlist.strings | deleted |
| 34 | extension | vendor/mac.noindex/terminal-notifier.app/Contents/Resources/en.lproj/MainMenu.nib | deleted |
| 35 | extension | vendor/snoreToast/LICENSE | deleted |
| 36 | extension | vendor/snoreToast/snoretoast-x64.exe | deleted |
| 37 | extension | vendor/snoreToast/snoretoast-x86.exe | deleted |

<details>
<summary>⚪ SKIP - 已排除 (13 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 3 | extension | pnpm-lock.yaml | 在排除列表中 |
| 4 | extension | src/commands/addComments/index.ts | 在排除列表中 |
| 5 | extension | src/commands/addDocstring/index.ts | 在排除列表中 |
| 6 | extension | src/commands/editSuggestions/unisdk.ts | 在排除列表中 |
| 7 | extension | src/config.ts | 在排除列表中 |
| 8 | extension | src/extension.ts | 在排除列表中 |
| 13 | extension | src/handlers/uriHandler.ts | 在排除列表中 |
| 15 | extension | src/param/configures.ts | 在排除列表中 |
| 16 | extension | src/utils/chatNotification.ts | 在排除列表中 |
| 24 | extension | src/utils/localRepo.ts | 在排除列表中 |
| 25 | extension | src/utils/localReview.ts | 在排除列表中 |

</details>
