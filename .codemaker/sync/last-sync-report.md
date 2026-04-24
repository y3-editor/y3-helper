# CodeMaker 同步报告
- 生成时间: 2026-04-24T08:33:16.776Z
- 上游 webui: `9549f2f1` → `a34f1bbe` (2026-02-25 → 2026-02-26, 7 commits)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 8 |
| 🟡 REVIEW (需对比决策) | 6 |
| 🔴 NEW (新增功能) | 0 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 14 |
| 合计 | 28 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 |
|---|------|---------|--------|---------|
| 2 | webui | index.html | resources/webview_source_code/index.html | modified |
| 15 | webui | src/main.tsx | resources/webview_source_code/src/main.tsx | modified |
| 16 | webui | src/routes/AuthProvider.tsx | resources/webview_source_code/src/routes/AuthProvider.tsx | modified |
| 19 | webui | src/routes/CodeChat/CodeChat.tsx | resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx | modified |
| 20 | webui | src/routes/CodeChat/TaskProgressPanel.tsx | resources/webview_source_code/src/routes/CodeChat/TaskProgressPanel.tsx | modified |
| 21 | webui | src/routes/CodeChat/chatNavigationUtils.ts | resources/webview_source_code/src/routes/CodeChat/chatNavigationUtils.ts | modified |
| 24 | webui | src/store/workspace/tools/read.ts | resources/webview_source_code/src/store/workspace/tools/read.ts | modified |
| 27 | webui | src/utils/index.ts | resources/webview_source_code/src/utils/index.ts | modified |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 |
|---|------|---------|--------|------|---------|
| 12 | webui | package.json | resources/webview_source_code/package.json | Y3有定制修改 | modified |
| 14 | webui | src/App.tsx | resources/webview_source_code/src/App.tsx | Y3有定制修改 | modified |
| 17 | webui | src/routes/CodeChat/ChatFunctionalToolbar.tsx | resources/webview_source_code/src/routes/CodeChat/ChatFunctionalToolbar.tsx | Y3有定制修改 | modified |
| 22 | webui | src/services/useChatStream.ts | resources/webview_source_code/src/services/useChatStream.ts | Y3有定制修改 | modified |
| 23 | webui | src/store/chat.ts | resources/webview_source_code/src/store/chat.ts | Y3有定制修改 | modified |
| 28 | webui | vite.config.ts | resources/webview_source_code/vite.config.ts | Y3有定制修改 | modified |

<details>
<summary>⚪ SKIP - 已排除 (14 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | webui | conf/default.nginx.tpl | 在排除列表中 |
| 3 | webui | openspec/changes/archive/2026-02-10-optimize-chat-tracing/design.md | 在排除列表中 |
| 4 | webui | openspec/changes/archive/2026-02-10-optimize-chat-tracing/proposal.md | 在排除列表中 |
| 5 | webui | openspec/changes/archive/2026-02-10-optimize-chat-tracing/specs/chat-tracing/spec.md | 在排除列表中 |
| 6 | webui | openspec/changes/archive/2026-02-10-optimize-chat-tracing/tasks.md | 在排除列表中 |
| 7 | webui | openspec/changes/update-default-chat-tracing-scene/design.md | 在排除列表中 |
| 8 | webui | openspec/changes/update-default-chat-tracing-scene/proposal.md | 在排除列表中 |
| 9 | webui | openspec/changes/update-default-chat-tracing-scene/specs/chat-tracing/spec.md | 在排除列表中 |
| 10 | webui | openspec/changes/update-default-chat-tracing-scene/tasks.md | 在排除列表中 |
| 11 | webui | openspec/specs/chat-tracing/spec.md | 在排除列表中 |
| 13 | webui | pnpm-lock.yaml | 在排除列表中 |
| 18 | webui | src/routes/CodeChat/ChatModelSelector.tsx | Y3不需要模型选择功能，固定使用VSCode Settings中的模型配置 |
| 25 | webui | src/telemetry/const.ts | 在排除列表中 |
| 26 | webui | src/telemetry/otel.ts | 在排除列表中 |

</details>
