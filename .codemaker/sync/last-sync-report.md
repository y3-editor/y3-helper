# CodeMaker 同步报告
- 生成时间: 2026-05-06T07:00:00.000Z
- 上游 extension: `b4c4de9c` → `32a4df10` (2026-03-30 → 2026-03-31, 3 commits)
- 上游 webui: `1b028d73` → `1b028d73` (2026-03-27 → 2026-03-27, 已合并)

## 📊 概览
| 分类 | 数量 |
|------|------|
| 🟢 SAFE (可直接覆盖) | 1 |
| 🟡 REVIEW (需对比决策) | 1 |
| 🔴 NEW (新增功能) | 1 |
| ⏭️ EXISTS (已有实现) | 0 |
| ⚪ SKIP (已排除) | 5 |
| 合计 | 8 |
| **🏷️ 涉及新需求 (需用户确认)** | **8** |

## 🏷️ FEAT — 涉及新需求（需用户确认是否合并）

> 以下文件的变更来自 `feat` 开头的 commit，表示是上游新需求。
> **合并时 AI 必须逐项询问用户是否需要此功能，不得自动合并。**

| # | 分类 | 仓库 | 上游文件 | Y3文件 | feat commit |
|---|------|------|---------|--------|------------|
| 1 | 🔴 SKIP | extension | CHANGELOG.md | - | 32a4df10 chore: 发布 v26.3.7 版本 |
| 2 | 🔴 SKIP | extension | package.json | - | 32a4df10 chore: 发布 v26.3.7 版本 |
| 3 | 🔴 SKIP | extension | src/handlers/searchHandler/globHandler.ts | - | e187da68 feat: 支持glob检索文件 |
| 4 | 🔴 SKIP | extension | src/http/chatHistory.ts | - | d633d81f refactor: 修复新建会话没有继承父会话模型问题，移除会话恢复相关的 restoreSessionId 参数 |
| 5 | 🟡 REVIEW | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | d633d81f refactor: 修复新建会话没有继承父会话模型问题，移除会话恢复相关的 restoreSessionId 参数 |
| 6 | 🔴 SKIP | extension | src/utils/CodebaseChatPanelManager.ts | - | d633d81f refactor: 修复新建会话没有继承父会话模型问题，移除会话恢复相关的 restoreSessionId 参数 |
| 7 | 🔴 NEW | extension | src/utils/executeFunction.ts | - | e187da68 feat: 支持glob检索文件 |
| 8 | 🟢 SAFE | extension | src/utils/file.ts | src/codemaker/utils/file.ts | e187da68 feat: 支持glob检索文件 |

## 🟢 SAFE - 可直接覆盖
| # | 仓库 | 上游文件 | Y3文件 | 变更类型 | 新需求? |
|---|------|---------|--------|---------|--------|
| 8 | extension | src/utils/file.ts | src/codemaker/utils/file.ts | modified | 🏷️ 需确认 |

## 🟡 REVIEW - 需对比决策
| # | 仓库 | 上游文件 | Y3文件 | 原因 | 变更类型 | 新需求? |
|---|------|---------|--------|------|---------|--------|
| 5 | extension | src/provider/webviewProvider/index.ts | src/codemaker/webviewProvider.ts + src/codemaker/messageHandlers.ts | 上游单文件映射到 Y3 的 2 个文件 (1:N 映射) | modified | 🏷️ 需确认 |

## 🔴 NEW - 新增功能
| # | 仓库 | 上游文件 | 变更类型 |
|---|------|---------|---------|
| 7 | extension | src/utils/executeFunction.ts | modified |

<details>
<summary>⚪ SKIP - 已排除 (5 项)</summary>

| # | 仓库 | 上游文件 | 原因 |
|---|------|---------|------|
| 1 | extension | CHANGELOG.md | 在排除列表中 |
| 2 | extension | package.json | 在排除列表中 |
| 3 | extension | src/handlers/searchHandler/globHandler.ts | 在排除列表中 |
| 4 | extension | src/http/chatHistory.ts | 在排除列表中 |
| 6 | extension | src/utils/CodebaseChatPanelManager.ts | 在排除列表中 |

</details>

---

## 📝 2026-05-06 合并经验总结

### 本次合并范围
- **WebUI**: 2026-03-27 批次 (Token Breakdown + Codebase Chat Response)
- **Extension**: 2026-03-30 ~ 2026-03-31 批次 (Session重构 + Glob搜索)

### 关键经验

#### 1. 内置服务端文件 → 全部SKIP
CodeMaker上游新增了内置HTTP服务端（`initInsideServer.ts`/`serverRoutes.ts`/`swaggerUI.ts`），Y3用自己写的`api-server`，这些文件完全不需要。已加入`excluded_upstream_dirs`永久排除。

#### 2. 缺失目录需手动创建
合并`messageHandlers.ts`时引用了`agentsHandler`目录，Y3不存在。需从上游fetch完整目录（`index.ts`/`types.ts`/`parser.ts`），然后适配Y3环境：
- `printLog` → `console.log`
- `getErrorMessage` → 内联实现
- `getWebviewProvider` → 通过参数传入
- `EXCLUDED_DIRECTORIES` → 内联定义
- `syncAgents` → 通过`webviewProvider._sendToWebview`发送

#### 3. ESM Import路径规则
Y3的Node层`moduleResolution`要求显式扩展名+完整路径：
- ❌ `import('./handlers/agentsHandler')`
- ✅ `import('./handlers/agentsHandler/index.js')`

#### 4. file.ts 覆盖风险
上游`file.ts`新增了`createTempFile`函数改用系统临时目录。Y3的`file.ts`是精简版，import路径不同。**不要用上游完整文件覆盖**，只应用具体diff。

#### 5. 编译验证时机
每批合并后必须立即`tsc --noEmit`验证，发现错误当场修复。本次积累到verify阶段才发现`agentsHandler`缺失和ESM路径问题，修复成本更高。

#### 6. Commit分类规则
- `docs:` → 通常跳过（openspec文档归档），但代码改动需单独判断
- `feat:` → 必须询问用户确认
- `fix:`/`refactor:`/`style:`/`chore:` → 通常直接合并
- `chore: 发布 vX.X.X` → 跳过（CHANGELOG/package.json版本号）

#### 7. Token Breakdown 合并要点
- `store/chat.ts`: 新增`consumedTokensSnapshot`字段，在每轮最后一条消息上保存快照
- `GroupAIMessage.tsx`: 计算token增量（当前快照 - 上一轮快照），用Popover展示
- `reassembleContentWithImages`: 防止prompt替换时丢失图片URL

#### 8. Session重构 (restoreSessionId移除)
上游移除`restoreSessionId`，改为强制`onNewSession`回调 + webview通知`session_ready`。Y3需同步更新`App.tsx`和`CodeChat.tsx`的会话切换逻辑，并新增`patchSession`用于部分更新会话属性。
