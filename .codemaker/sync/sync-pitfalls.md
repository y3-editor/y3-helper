# 同步上游时的常见坑

记录排查上游同步带来的隐性问题时学到的教训，避免下次重复踩。

---

## 1. 别只盯着症状，先确认走的是哪条 chat 路径

**触发场景**：同步上游某次 ClaudeEdit 相关提交后，发现 AI 创建文件时弹"1 个文件变更"面板，且应用后是空文件 / 提示回退。直觉以为是 ClaudeEdit 工具本身坏了，于是去改 `executeFunction` 派发、`handleAcceptEdit`、`handleBatchApplyChanges` 等下游代码。

**真实根因**：webview 里 chat 有两条路径，由 `enableNewApply` 开关决定：

| 路径 | 触发条件 | system prompt | 工具集 |
|---|---|---|---|
| 老 ToolCall | `enableNewApply=false` | 中文 "你叫 CodeMaker..."（`constructToolCallPrompt.ts`）| `list_files_recursive` / `read_file` 等，**不含 write/edit** |
| 新 Remix（含 ClaudeEdit 子模式） | `enableNewApply=true` | 英文 "You are a powerful agentic AI..."（`constructRemixPrompt.ts`）| 受 `chatApplyMode` 控制；ClaudeEdit 时注入 `write` / `edit` |

`enableNewApply` 在 `src/routes/AuthProvider.tsx` 设值：

```ts
setEnableNewApply(!disableNewApply && data.new_apply_enable && newApplyVersion);
```

`data.new_apply_enable` 来自后端 `/proxy/validate` 接口。Y3 自家 mock 后端**不返回**这个字段 → 默认 false → 永远走老 ToolCall。

只要走的是老 ToolCall，所有 ClaudeEdit 相关补丁（`chatApplyMode='claudeedit'`、`versionCompare` 放行、`executeFunction` 加 write/edit dispatch）都不会被触达，因为这些代码只在 Remix 路径才会运行。

**修复**：`AuthProvider.tsx` 去掉 `data.new_apply_enable` 这个网关：

```ts
setEnableNewApply(!disableNewApply && newApplyVersion);
```

---

## 2. 老路径在合并新功能后可能"被污染"

**症状**：合并 ClaudeEdit 之前老 ToolCall 路径运行良好（无面板、能 silent apply）。合并后**仍走老路径**，但开始弹面板 + 空文件。

**原因**：上游 ClaudeEdit 提交不仅改了 Remix 路径，还顺带升级了 markdown 代码块解析器（识别 `filePath` 元信息并注册到 `recommendFileChanges`）。这个解析器对**两条路径都生效**。结合 system prompt 里 ClaudeEdit 相关的诱导，AI 在老 ToolCall 模式下也开始输出带 filePath 的代码块 → 触发面板。

而老路径根本没有 write/edit 工具来响应面板的"应用"按钮，回落到 `BATCH_APPLY_CHANGES` 路径，加上 Y3 这边 `handleBatchApplyChanges` 字段名与 webview 不一致 → 写空文件。

**教训**：上游一次 feat 提交可能横跨多条代码路径。同步后要重新评估老路径是否还能安全工作。**最简的防御是直接切到新路径**（如 1 节），而不是去给老路径打多处补丁。

---

## 3. 不要给 AI 加私货 prompt 加固

**反面案例**：为压制 AI 输出代码块，曾在 `constructRemixPrompt.ts` 的 ClaudeEdit 分支首段添加：

```
When making code changes, NEVER output code to the USER as a code block in chat — instead, ALWAYS use the `write` tool ...
```

上游原版没有这行。事后回退。

**理由**：

- 上游不带这行也能正常 silent apply，说明在 ClaudeEdit 模式正确激活的前提下 AI 行为已稳定，不需额外加固
- 私自加 prompt 会增加未来合并冲突
- 强 negative instruction（"NEVER 不许 X"）有时反而让 AI 更倾向去做 X
- 真问题（AI 输出冗余代码块）应在解析器层面控制，而不是 prompt 层面

**教训**：发现问题先**和上游对照**。上游没改的地方，往往是问题不在那。

---

## 4. Y3 的版本号不参与版本闸门，需要绕过

`resources/webview_source_code/src/utils/common.ts` 里的 `versionCompare` 已被改成恒返 `1`（即"上游版本永远比你比的版本新"）。

**原因**：webview 多处用 `versionCompare(targetVer, codeMakerVersion) >= 0` 来判断是否启用某新特性（如 `toolsEN.ts:523` 的 ClaudeEdit 分支需 `>= 26.3.7`）。Y3 这边 `INIT_DATA.codeMakerVersion` 不是真实的 codemaker 版本号语义，按字面比较会全卡死所有新特性。

**保留**这个补丁。同步时如果上游 `common.ts` 有修改，**注意不要无脑覆盖**，先确认 `versionCompare` 仍是恒返 `1`。

---

## 5. 排查顺序的建议

下次再遇类似"合并上游后某功能坏了"，按这个顺序查：

1. **确认走的哪条路径**：在 webview DevTools Console 看实际发出的 system prompt 头部
   - "You are a powerful agentic AI..." → Remix 路径
   - "你叫 CodeMaker..." → 老 ToolCall 路径
2. **看 tools 列表**：log 里 `[Chat] tools 数量: N` + 实际数组内容，确认 write/edit 是否注入
3. **再查具体功能逻辑**：dispatch、handler、props 字段名等

跳过步骤 1、2 直接改 dispatch/handler 是浪费。

---

## 6. 受 INIT_DATA 影响的关键开关清单

`src/codemaker/webviewProvider.ts` 发送的 INIT_DATA 是 webview 行为的总开关。同步上游后注意核对以下字段：

| 字段 | 当前值 | 说明 |
|---|---|---|
| `chatApplyMode` | `'claudeedit'` | ClaudeEdit 子模式开关 |
| `disableNewApply` | `false` | 配合 AuthProvider 决定 enableNewApply |
| `codeMakerVersion` | `'26.5.0'` | 配合 versionCompare 恒真 → 不影响 |

如果上游新增了类似的 mode 字段，要同步加进 INIT_DATA。

---

## 7. Subagent (task 工具) 合并的三处坑

合并上游 subagent 大功能后，一次对话可触发三类卡死，全部源于"合并漏 / 路由不全"。按报错顺序排查：

### 7.1 主 agent 调 task → 报 "Tool 'task' is not supported in Y3Helper integration"

**根因**：`resources/webview_source_code/src/store/chat.ts` 有两个 `onMessage`：
- `~4070`：`isReAct=true` 分支（streaming），合并时加上了 task 分流
- `~4861`：`isReAct=false` 分支（主路径），**漏改**，仍把所有 toolCalls 直接 `postMessage(TOOL_CALL)` 发 IDE

上游已统一为单一 `onMessage`（`isReAct` 写死 `false`，老分支删除）。下游因为留了 ReAct 路径，必须**两个 onMessage 都补 task 分流**。

**修复**：在 4861 处 onMessage 的 `if (toolCalls.length) / if (!allResponsed)` 内补上：
- `taskToolCalls = toolCalls.filter(t => t.function.name === 'task')`
- `nonTaskToolCalls = toolCalls.filter(t => t.function.name !== 'task')`
- 调 `taskCoordinator.startSessionWatchdog` / `emitTaskRegistered` / `markRegistrationComplete` / `runSubagent` 全套异步执行块（参考上游 `~5006`）
- 后续 `for (const tool of toolCalls)` → `for (const tool of nonTaskToolCalls)`

### 7.2 Subagent RUNNING 但 Tool Calls=0、Tokens=— → 请求挂死

**根因**：`resources/webview_source_code/src/modules/subagent/core/llm.ts` 写死 `'/proxy/gpt/gpt/codebase_chat_stream'`。Y3 本地 api-server (`resources/codemaker/api-server/routes/chat.mjs`) 只注册了 `/proxy/gpt/u5_chat/...`，未注册 `gpt/gpt/codebase_chat_stream` → 请求无响应、stream 永远不 done。

**修复**：保持 webview URL 与上游一致（不要去改 webview），在 `chat.mjs` 注册同名路由暂复用 `handleStreamChat`：

```js
routes.set('POST:/proxy/gpt/gpt/codebase_chat_stream', handleStreamChat);
routes.set('POST:/proxy/gpt/hangyan/gpt/codebase_chat_stream', handleStreamChat);
```

上游用独立 URL 是为了把 subagent 流量与主 agent 分开（独立 prompt 注入 / tracing 等）。Y3 暂时复用主 handler，后续如需差异化在这条路由上替换 handler 即可，URL 与上游同步。

### 7.3 Subagent 调 run_terminal_cmd / edit_file 后卡 RUNNING（IDE 已回 TOOL_CALL_RESULT）

**根因**：`resources/webview_source_code/src/routes/CodeChat/CodeChat.tsx` 在 `TOOL_CALL_RESULT` 与 `ACCEPT_EDIT_RESULT` 处理上漏了 subagent 路由分支。带 `task_id` 的工具结果走主会话流程，subagent runner 的 `pendingToolResults` 永等。

**修复**（对照上游 `~1453` / `~2198`）：

```ts
// TOOL_CALL_RESULT 分支
const { tool_result, tool_id, tool_name, task_id, extra = {} } = eventData?.data || {};
if (task_id) {
  const { runnerManager } = await import('../../modules/subagent');
  runnerManager.resolveToolResult(task_id, eventData?.data);
  return;
}

// ACCEPT_EDIT_RESULT 分支
if (result?.item?.toolCallId) {
  const { runnerManager } = await import('../../modules/subagent');
  const handled = runnerManager.resolveAcceptEditResult(result.item.toolCallId, result);
  if (handled) return;
}
```

IDE 端 `_handleToolCall` 已透传 `task_id`（`src/codemaker/webviewProvider.ts`），无需改。

### 7.4 排查顺序

合并 subagent 类大功能后按此查：

1. **task 是否被分流**：webview console 看主 agent toolCall 是否走 IDE TOOL_CALL（不该）。报 "Tool 'task' is not supported" → 7.1
2. **subagent LLM 是否能发出请求**：api-server log 是否打印 subagent 用的 URL；无打印就是路由没注册 → 7.2
3. **subagent 工具结果是否回流**：webview console 看 `[Subagent] No active runner / No pending tool result callback`，IDE log 看 TOOL_CALL_RESULT 是否含 `task_id`，CodeChat.tsx 是否拦截路由 → 7.3

---

## 8. 上游"敏感字符串"不要照搬，搬完一定要全文 grep

**触发场景**：合并上游时整文件覆盖 / 大块新增代码（如 `agentsHandler/parser.ts`、`services/agentCreation.ts`），里面藏着上游内部的字符串字面量。最常见就是 `netease`、`netease-codemaker/` 这类前缀。Y3Helper 是对外发布产物，把母公司域名 / 内部 model 命名空间塞进去是事故。

**典型藏身位置**：

| 文件 | 上游写法 | Y3 应改成 |
|---|---|---|
| `agentCreation.ts` | model 字段拼 `netease-codemaker/${model}` | 直接写裸 model 名 |
| `agentsHandler/parser.ts` | `MODEL_PREFIXES_TO_REMOVE = ['netease-codemaker/']` + `normalizeModelName()` | 整段删除，model 透传 |
| 任何 `*.ts` 字符串字面量 | URL `*.nie.netease.com` / `*.netease.com` | 视情况用占位 / 删除 |

**机械动作（每次 Phase 2 合并完跑一次）**：

```bash
git diff --name-only HEAD -- 'src/**' 'resources/webview_source_code/src/**' \
  | xargs grep -nH 'netease\|popo\.netease' 2>/dev/null
```

PowerShell 版：

```powershell
git diff --name-only HEAD | Where-Object { $_ -match '\.(ts|tsx|js)$' } |
  ForEach-Object { Select-String -Path $_ -Pattern 'netease|popo\.netease' }
```

发现命中后：
1. 如果是 URL：判断 Y3 流程是否会走到，不会走到的整段删（含外层 if 分支）。
2. 如果是 model / 包名前缀：去掉拼接逻辑，让函数透传。
3. 删除前后**必须加注释**标注 "⚠️ Y3 定制 (sync)"，说明上游有该字符串，方便下次合并时识别。注释模板：

```ts
// ⚠️ Y3 定制 (sync): 上游会拼 `netease-codemaker/` 前缀, Y3 不需要。
// 同步上游时若 diff 出现该前缀, 请删除拼接逻辑而不是合入。
```

**为什么要加注释而不是仅依赖 customized 列表**：customized 标记会让文件进入 REVIEW，但 REVIEW 仍可能整文件覆盖（特别是上游做大重构、Y3 现状本来就接近 baseline 时）。注释是落在源码里的"防腐层"，AI 整文件覆盖后做后处理时能直接看到提醒。

---

## 9. 跨仓库联动功能：webui 合了但 extension 整组跳

**触发场景**：上游一个需求常拆成两端 commit（webui + extension 同日提交，仅前端字段对应后端消费）。Y3 决策跳过 extension 端时，**webui 端已合的字段会成为 dead field**。

**典型案例**：
- 上游 `webui 3d758725` (run_terminal_cmd 注入 `model`) ↔ `extension 60dc7065` (RTK 遥测消费 `model`)
- 上游 `webui 9fb96c3a` (落盘开关 IDE 单源化) ↔ `extension 36f33e42` (UPDATE_USER_PREFERENCE handler)

Y3 不要 RTK 遥测，跳了 extension 60dc7065；落盘单源依赖 globalState handler，跳了 36f33e42。

**处理原则**：
1. **webui 已合的死字段保留不动**：撤销会造成下次同步上游若改字段触发 REVIEW 噪音，且上游来回改时易产生反复
2. **在死字段处加 Y3 注释**：标明 "Y3 后端不消费 (extension XXXXXXXX 整组未合)，保留对齐上游"
3. **欠债清单维护**：见下方表格

**Y3 dead field 清单（webui 端有，extension 未消费）**：

| 字段 | 注入点 (webui) | 上游对端 commit (extension, 未合) | 备注 |
|---|---|---|---|
| `tool_params.model` (run_terminal_cmd) | `utils/toolCallDispatch.ts::getCurrentModel`、`store/chat.ts` 主 toolcall 注入 | 60dc7065/0b41e271 RTK 遥测 | Y3 后端 `executeFunction.ts:run_terminal_cmd` 解构忽略，零运行时副作用 |

**反向情况（extension 已合，webui 端未消费）**：暂无记录，遇到时同样建议保留 + 加注释。

---

## 10. Y3 主聊天链路不走 CmCodebaseSteam → onMessage 形参别错位

**触发场景**：上游 commit `66fcc070` 在 `CmCodebaseSteam.emitMessage` 给 `onMessage` 多加第 12 参 `autoModel`（Auto 渠道 X-Auto-Model header 值）。同时 `store/chat.ts` 的 `agentEntry.execute` onMessage 也加该参数。Y3 同步时直接照搬 chat.ts 的形参 → 编译报 "Target signature provides too few arguments. Expected 11 or more, but got 10"。

**根因**：

```
上游主聊天链路:
  store/chat.ts → getCodemakerAgentEntry().execute(...)
                  → agentEntry → CmCodebaseSteam.emitMessage(...12 参...)

Y3 主聊天链路:
  store/chat.ts → requestCodebaseChatStream(...)        ← 在 useChatStream.ts，10 参 onMessage
                  (完全不走 agentEntry / CmCodebaseSteam)
```

`getCodemakerAgentEntry / CmCodebaseSteam` 在 Y3 是 dead code（仅 `compactionAgent.ts` 还引用）。

**判定方法**：合并 store/chat.ts 的 onMessage 改动前先 grep：

```bash
grep -n "getCodemakerAgentEntry().execute\|requestCodebaseChatStream(" \
  resources/webview_source_code/src/store/chat.ts
```

若只命中后者 → Y3 走的是 `requestCodebaseChatStream`，签名以它为准（在 useChatStream.ts 找定义）。

**修法**：

- 不动 onMessage 形参（Y3 拿不到 autoModel）
- 想用 responseModel 字段 → 直接在 chat.ts 内 `useChatConfig.getState().config.model` 取（Y3 模型固定，无 Auto 渠道，等价）
- cmCodebase/index.ts 的 12 参签名仍按上游合（dead code 保留对齐，避下次 REVIEW 噪音）

