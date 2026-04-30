# CodeMaker 上游同步工具

将 CodeMaker 源码的更新持续同步到 Y3Maker (Y3Helper) 中。

## 架构

```
CodeMaker 上游仓库                          Y3Helper
┌─────────────────────┐                    ┌─────────────────────┐
│ codemaker-web-ui    │ ──→ webview src ──→ │ resources/          │
│ (前端 React)        │                    │   webview_source_   │
│                     │                    │   code/src/         │
├─────────────────────┤                    ├─────────────────────┤
│ codestream-vscode-  │ ──→ extension  ──→ │ src/codemaker/      │
│ extension           │                    │                     │
│ (VSCode 扩展)       │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

## 三阶段流程

### Phase 1: ANALYZE（分析） — 自己在终端跑
```bash
npm run sync:analyze
# 指定仓库（不指定时自动选优先级高的）：
npm run sync:analyze -- --repo webui
npm run sync:analyze -- --repo extension
# 跳过到某天：
npm run sync:analyze -- --skip-to-date 2026-04-01
```

- **单仓库模式**：每次只分析一个仓库的变更（webui 优先于 extension）
- 同一天两个仓库都处理完才能推进到下一天
- 从上游仓库 fetch 最新代码
- 找到 baseline 后下一天的提交（一天限额）
- 计算 diff 并分类每个变更文件
- 为 SAFE/REVIEW 项提取完整 diff 和上游文件内容
- 生成报告：`.codemaker/sync/last-sync-report.md` 和 `.json`
- **不修改任何 Y3Helper 代码**

### Phase 2: MERGE（合并） — AI 在对话中驱动

**不再使用命令行**。在 AI 对话中说：

> "帮我合并上游同步报告"
> "读取同步报告开始合并"

> [!IMPORTANT]
> **AI 必须先执行 `npm run sync:analyze`，不能直接读取旧的 `last-sync-report.json` 来分析！**
> 报告文件在合并完成后不会自动清理，下次对话时可能读到过时数据。
> 正确流程：先跑 analyze → 确认报告内容是最新的 → 再开始合并。

AI 会：
1. **先执行 `npm run sync:analyze`**，确保报告是基于最新 baseline 生成的
2. 读取 `.codemaker/sync/last-sync-report.json`（含完整 diff）
3. **🏷️ FEAT 项（`needs_user_confirm: true`）**：见下方 [FEAT 项确认规则](#feat-项确认规则)
4. **SAFE 项**：AI 直接用 `upstream_content` 覆盖 Y3 文件（除非被标记为 FEAT）
5. **REVIEW 项**：见下方 [REVIEW 项合并规则](#review-项合并规则)
6. **NEW 项**：AI 判断是否与 Y3 相关，给出建议，你确认后执行
7. **复杂冲突**：AI 标记出来，你用 git merge 工具手动处理

#### FEAT 项确认规则

> [!CRITICAL]
> **涉及 `feat` 开头 commit 的变更文件，无论分类为 SAFE 还是 REVIEW，都必须先询问用户是否合并！**

报告中 `needs_user_confirm: true` 的项表示该文件涉及上游新需求。因为有些新功能 Y3Maker 不需要，AI 必须：

1. **逐个 feat commit 询问用户** — 按 feat commit 分组，每个 feat 单独问一次
2. **列出该 feat 涉及的所有文件和简要说明**
3. **所有 feat 都确认完毕后，再开始合并** — 不能问一个合一个，必须全部确认后统一执行
4. 用户确认 → 按 SAFE/REVIEW 规则正常合并
5. 用户拒绝 → 跳过该文件，并建议是否需要加入排除列表
6. 对于非 feat 的 SAFE 项（`needs_user_confirm: false`），可以在确认完 feat 后直接合并

#### REVIEW 项合并规则

> [!CRITICAL]
> **REVIEW ≠ 跳过！REVIEW = 需要人工审查的智能合并。**

REVIEW 项表示 Y3 对该文件有定制修改，**但上游的新改动仍然需要合并进来**。正确处理方式：

1. **读取上游 diff**：理解上游改了什么（新功能、bug 修复、新增枚举值等）
2. **读取 Y3 当前文件**：理解 Y3 定制了哪些部分
3. **逐项判断每个 diff hunk**：
   - 上游改动与 Y3 定制部分无关 → **直接合并**
   - 上游改动与 Y3 定制部分冲突 → **手动调和**（保留 Y3 定制逻辑，适配上游的新接口/参数）
   - 上游引入了 Y3 不存在的模块依赖 → **替换为 Y3 的等价实现或内联**
   - 上游新增了枚举值/类型 → **通常应该合并**（Y3 的定制枚举也要保留）
4. **绝对不能因为文件有定制就整个跳过**，否则会永久落后于上游

#### 删除文件/目录的规则

> [!CRITICAL]
> **不要因为编译报错就直接删除整个目录！**

如果上游同步进来的文件导致编译错误（缺少依赖模块），正确处理方式：

1. **检查该目录是否被其他已同步文件引用**（如 import 关系）
2. 如果有引用 → **保留被引用的工具文件**（如 `utils.ts`），排除独立的页面组件
3. 如果确实完全不需要 → 加入 `exclusions.json` 的 `excluded_upstream_dirs`
4. 同时检查引用方，做好适配（内联、stub、或条件 import）

### Phase 3: VERIFY（验证） — 自己在终端跑

> [!CRITICAL]
> **必须先编译验证通过，再执行 `--confirm` 更新基准！不能跳过编译直接 confirm！**

```bash
# 1. 先编译验证
# webui 变更时：
cd resources/webview_source_code && npm run build
# extension 变更时：
npx tsc --noEmit

# 2. 编译通过后才能 confirm
npm run sync:verify -- --confirm
```

- 编译检查（webview: `npm run build` / extension: `tsc --noEmit`）
- 消息协议一致性校验
- 验证通过后更新 baseline

## 首次配置

1. 确保已 clone 两个上游仓库到本地
2. 创建 `.codemaker/sync/config.local.json`（已 gitignored）：
```json
{
  "webui": {
    "repoUrl": "ssh://git@...",
    "localPath": "H:/codemaker/codemaker-web-ui",
    "branch": "develop"
  },
  "extension": {
    "repoUrl": "ssh://git@...",
    "localPath": "H:/codemaker/codestream-vscode-extension",
    "branch": "develop"
  }
}
```
3. `baseline.json` 已配置好初始基准版本

## 日常使用

```bash
# 1. 分析（自动选一个仓库，webui 优先）
npm run sync:analyze

# 2. 在 AI 对话中合并该仓库的变更
# 说："帮我合并上游同步报告"

# 3. 验证 + 更新基准
npm run sync:verify

# 4. 再次 analyze 处理同一天的另一个仓库（如有）
npm run sync:analyze

# 5. 合并 + 验证另一个仓库

# 6. 重复直到追上最新版本
```

> **同一天约束**：两个仓库的提交可能无关联，分开处理更清晰。
> 如果发现某个仓库的变更依赖另一个仓库的内容，先合并被依赖方。

## 文件变更分类

| 分类 | 含义 | 处理方式 |
|------|------|---------|
| 🟢 SAFE | 有映射且 Y3 未修改 | AI 直接覆盖 |
| 🟡 REVIEW | Y3 有定制修改 | AI 智能合并 + 你 review |
| 🔴 NEW | 上游新增,Y3 没有 | AI 给建议,你决定 |
| ⚪ SKIP | 在排除列表中 | 自动跳过 |
| 🏷️ FEAT | 涉及 feat commit（新需求） | **必须先询问用户**，确认后按原分类处理 |

## 配置文件说明

| 文件 | 入库 | 用途 |
|------|------|------|
| `config.json` | ✅ | 路径映射和分类规则 |
| `config.local.json` | ❌ | 仓库 URL 和本地路径（敏感） |
| `baseline.json` | ✅ | 上次同步的 commit |
| `exclusions.json` | ✅ | 排除功能清单 |
| `last-sync-report.*` | ✅ | 最近一次分析报告（含完整 diff） |

## FAQ

**Q: 一天没有提交怎么办？**
A: 脚本自动跳到下一个有提交的日期。

**Q: 某个功能确定不需要？**
A: 告诉 AI "永久排除这个文件"，AI 会更新 exclusions.json。

**Q: 怎么快速跳过很多天？**
A: `npm run sync:analyze -- --skip-to-date 2026-04-15` 直接跳到指定日期。

**Q: AI 合并的结果不对怎么办？**
A: 用 git 撤销 AI 的改动，然后自己用 git merge 工具处理。

**Q: 遇到复杂冲突怎么办？**
A: AI 会标记复杂项，你用 VS Code 或其他 git merge 工具手动处理。

## 合并经验记录

> 以下是在实际同步过程中积累的经验，供后续合并参考。

### Conventional Commit 类型判断

| 前缀 | 含义 | 是否合并 |
|------|------|---------|
| `feat:` | 新功能 | ⚠️ 需询问用户确认 |
| `fix:` | Bug 修复 | ✅ 通常需要合并 |
| `refactor:` | 代码重构 | ✅ 通常需要合并 |
| `perf:` | 性能优化 | ✅ 通常需要合并 |
| `chore:` | 构建/发布版本 | ❌ 不需要合并（通常是版本号 bump + CHANGELOG） |
| `docs:` | 文档变更 | ❌ 一般不合（注意：有些 docs 提交实际包含代码，需要看 diff） |
| `style:` | 代码格式化 | ❌ 一般不合 |
| `test:` | 测试用例 | ❌ 一般不合 |
| `ci:` / `build:` | CI/构建配置 | ❌ 不合 |

### Y3 不需要的上游功能

- **OpenSpec 工作流**：所有 `openspec/`、`specHandler`、`specVersionUtils`（Y3 用 stub 替代）、Spec 聚焦检测相关功能一律跳过
- **遥测模块**：`telemetry/otel.ts`（Y3 用 stub 替代）

### 大型合并注意事项

1. **先改排除规则再分析**：如果发现某个被排除的目录（如 `src/modules/`）现在需要合并了，要先修改 `exclusions.json` 和 `config.json`，再重新运行 `analyze`
2. **不要用 PowerShell `Set-Content` 修改含中文的源码文件**：会破坏 UTF-8 编码，导致中文变乱码。用 `replace_in_file` 或 Node.js 脚本替代
3. **合并完必须更新 baseline.json**：否则下次 analyze 会重复分析已合并的提交。baseline 中的 commit hash 和 date 都要更新
4. **REVIEW 文件不能直接覆盖**：Y3 有定制逻辑的文件（如 `chat.ts`、`App.tsx`、`webviewProvider.ts`）需要逐个 diff hunk 手工合并
5. **sync 报告中 `upstream_content` 为空的文件**：需要从上游仓库用 `git show <commit>:<path>` 直接提取

### Stub 文件维护

Y3 对上游独有功能使用 stub 文件替代，目前有：

| Stub 文件 | 替代的上游功能 | 位置 |
|-----------|--------------|------|
| `specVersionUtils.ts` | OpenSpec 版本检查 | `src/utils/` |
| `openspecModeContext.ts` | OpenSpec 模式上下文 | `src/store/workspace/` |

当上游新增对这些模块的引用时，需要在 stub 中补充对应的导出（如 `supportsSubagent`、`OPENSPEC_1X_MODE_CONTEXT`）。

### Y3 适配模式

Extension 端上游代码中的一些通用模式在 Y3 中的替代方案：

| 上游模式 | Y3 替代方案 |
|---------|------------|
| `printLog(...)` | `console.log(...)` |
| `getErrorMessage(err)` | `err?.message \|\| String(err)` |
| `getWebviewProvider().sendMessageWithRouting(...)` | `require('../codemaker/index').webviewProvider.sendMessage(...)` |
| `import { EXCLUDED_DIRECTORIES } from '...'` | 内联 `new Set([...])` |
| `requestCodebaseChatStream(event, data, url, opts)` | `requestCodebaseChatStream(data, url, opts)`（Y3 没有 event 参数） |

### API 路径映射表（前端 → 后端）

Y3Helper 的前端 webui 通过 axios 请求本地 API Server（`localhost:3001`），路径前缀由各 axios 实例的 `baseURL` 决定。**合并上游时如果上游改了 baseURL，必须同步更新 `api-server/routes/` 中的路由注册路径。**

| axios 实例 | baseURL | 用途 |
|-----------|---------|------|
| `codemakerChatHistoryRequest` | `/proxy/gpt/chat` | 会话历史 CRUD、反馈 |
| `codemakderChatGptRequest` | `/proxy/gpt/gpt/` | GPT 聊天、图片上传、token 计算 |
| 硬编码路径 | `/proxy/gpt/u5_chat/` | 流式聊天（codebase_chat_stream / codebase_agent_stream） |

> ⚠️ **踩坑记录（2026-04-30）**：上游在 2026-03-20 将 `codemakerChatHistoryRequest` 的 baseURL 从 `/proxy/gpt/u5_chat` 改为 `/proxy/gpt/chat`（同时 `uploadImg` 也从 `u5_chat` 改到了 `codemakderChatGptRequest` 即 `gpt/gpt/`），但 `api-server/routes/history.mjs` 和 `chat.mjs` 中的路由注册路径没有同步更新，导致前端请求全部 fallback 到 SPA 的 `index.html`，`data.items` 为 `undefined`，触发 `revalidateChatSessions` 中 `.filter()` 崩溃。
>
> **教训**：`api-server/routes/` 下的文件是 Y3 自建的后端，不在上游仓库中，合并时不会自动冲突。每次合并上游 webui 时，**必须检查 `services/chat.ts` 中的 `baseURL` 和硬编码 URL 是否有变更**，如有变更须手动对齐后端路由。
