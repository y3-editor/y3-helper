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
