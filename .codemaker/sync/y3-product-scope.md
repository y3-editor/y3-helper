# Y3Maker 产品定位与功能边界

Y3Maker 是一个适配了 Y3 游戏引擎需求的智能开发助手。它基于 CodeMaker 上游代码库（webui + extension），但根据 Y3 的产品定位裁剪了以下不适用的功能。

> **AI 同步规则**：在合并上游变更时，如果提交涉及以下功能，应该：
> - 纯属该功能的独立文件 → 自动 SKIP
> - 混合文件中包含该功能的 hunk → REVIEW 时跳过相关 hunk，只合并其他有价值的改动

---

## 不需要的功能

### 1. OpenSpec 初始化与升级
**原因**：Y3Maker 不需要 OpenSpec 的任何功能。Y3 项目有自己的项目初始化流程，不依赖 openspec-cli 的安装/检测/升级。

**涉及的上游文件**：
- `src/routes/CodeChat/SpecInitModal.tsx` — OpenSpec 初始化弹窗
- `src/routes/CodeChat/OpenSpecUpdateModal.tsx` — OpenSpec 升级弹窗
- `src/utils/specVersionUtils.ts` — 版本检测工具
- `src/handlers/specHandler/` — 整个目录（setupHandler, specHandler, types）
- `src/routes/CodeChat/ChatMentionAreatext.tsx` 中的"环境未就绪，点击初始化"链接
- `src/routes/CodeChat/CodeChat.tsx` 中 SpecInitModal/OpenSpecUpdateModal 的渲染

**Y3 处理方式**：相关文件排除，消息（GET_SPEC_INFO, OPEN_SPEC_SETUP, SPECKIT_SETUP, OPENSPEC_UPDATE）在 messageHandlers.ts 中静默处理。

---

### 2. 多会话 / 并行会话
**原因**：Y3Maker 只有侧边栏单会话模式。不需要并行会话窗口、CM2 新窗口、消息路由架构（sendMessageWithRouting）等多会话功能。

**涉及的上游文件**：
- `src/components/FeatureTour/` — 整个目录（功能引导系统，所有 tour 都不适用于 Y3）
- `src/components/Icon/ParallelSessionIcon.tsx` — 并行会话图标
- `src/routes/CodeChat/ChatHeaderToolbar.tsx` 中的并行会话按钮
- `src/App.tsx` 中的 FeatureTour 渲染、user-dashboard-anchor 虚拟锚点、selectedModel 逻辑
- `src/PostMessageProvider.tsx` 中的 OPEN_PARALLEL_SESSION 枚举
- `src/store/chat.ts` 中的 FeatureTour import/调用
- `src/utils/CodebaseChatPanelManager.ts` — 并行会话面板管理
- `src/utils/smartRouting.ts` — 智能路由
- `src/handlers/focusedSessionHandler.ts` — 聚焦会话处理

**Y3 处理方式**：相关文件排除，消息（OPEN_PARALLEL_SESSION, WEBVIEW_BROADCAST, OPEN_WEBVIEW_IN_NEW_WINDOW）在 messageHandlers.ts 中静默处理。

---

### 3. 模型选择
**原因**：Y3Maker 的 AI 模型完全由用户在 VSCode Settings 中指定（`y3-helper.model` 配置项），webview 内不需要模型选择器逻辑。

**涉及的上游文件**：
- `src/routes/CodeChat/ChatModelSelector.tsx` — 模型选择器组件（已存在但不影响核心功能）
- `src/App.tsx` 中的 selectedModel 初始化逻辑

**Y3 处理方式**：ChatModelSelector 组件保留（不影响功能），但不合并 selectedModel 相关的新逻辑。

---

### 4. 积分 / Token 限额系统
**原因**：Y3Maker 使用自己的 Token（由 VSCode Settings 配置），没有 CodeMaker 的积分限制系统。

**涉及的上游文件**：
- `src/store/chatBill.ts` — 积分状态管理（isExceedCost 固定为 false）
- `src/routes/CodeChat/CodebaseExceedCost.tsx` — 超限提示组件（品牌已改为 Y3）

**Y3 处理方式**：chatBill.ts 的 isExceedCost 默认值固定为 false。

---

### 5. 功能引导 (FeatureTour)
**原因**：上游的 FeatureTour 引导系统的所有 tour（聊天入口迁移、Spec Coding、Auto入口、并行会话、用量展示）都是 CodeMaker 特有的功能引导，没有一个适用于 Y3Maker。

**涉及的上游文件**：
- `src/components/FeatureTour/` — 整个目录

**Y3 处理方式**：整个目录排除。

---

### 6. 代码审查 (CodeReview)
**原因**：Y3 没有代码审查模块。CodeReview 目录的页面组件依赖大量 Y3 不存在的 store/service 模块。

**涉及的上游文件**：
- `src/routes/CodeReview/*.tsx` — 页面组件（排除）
- `src/routes/CodeReview/utils.ts` — 工具函数（保留精简版，因为被 useChatStream.ts 引用）
- `src/routes/CodeReview/const.ts` — 常量（排除）

**Y3 处理方式**：页面组件排除，utils.ts 保留精简版（只含被引用的工具函数）。

---

### 7. Event 路由后缀（URL 拼接 `/${event}`）
**原因**：上游在 `requestChatStream`、`requestDeepseekReasonerChatStream`、`requestClaude37ChatStream`、`requestNetworkChatStream` 的请求 URL 上拼接了 `/${event}` 后缀（如 `/proxy/gpt/gpt/text_chat_stream/CodeChat.prompt_custom`），用于上游云端后端的统计/计费/路由分流。Y3 使用本地 API Server 直连 AI 提供商，不需要这套 event 路由机制。

**涉及的上游文件**：
- `src/services/useChatStream.ts` — 4 个普通聊天 stream 函数中的 `const url = chatRequestUrl + \`/${event}\``

**Y3 处理方式**：
- URL 拼接改为 `const url = chatRequestUrl`（不拼 event 后缀）
- 函数签名中 `event` 参数保留但改为 `_event`（下划线前缀标记 unused），以兼容 `chat.ts` 中的调用签名，降低合并冲突
- `requestCodebaseChatStream` 和 `requestDSCodebaseChatStream` 原本就没有 event 参数，不受影响

---

### 8. Vibe/Spec 模式选择器 (CodebaseModePicker)
**原因**：上游新增了 CodebaseModePicker 组件，让用户选择 Vibe Coding 或 Spec Coding 模式。Y3 不需要 OpenSpec/Spec Coding，也不需要 Vibe 品牌概念。

**涉及的上游文件**：
- `src/routes/CodeChat/CodebaseModePicker.tsx` — 模式选择卡片 UI

**Y3 处理方式**：保留组件文件但移除 Vibe/Spec 选择卡片，仅保留"推荐问题"(Recommended Questions) Drawer 功能。

---

## 同步修改记录（踩坑日志）

> 以下记录每次同步中发现的问题和修复方式，防止未来重复踩坑。

### 2025-04-24 下午：WebUI 同步后修复

#### 问题 1：聊天无回复（最严重）
**现象**：发送消息后没有任何 AI 回复。
**根因**：
1. `chatBill.ts` 中 `isExceedCost` 默认值被上游改为 `true`，导致输入框被禁用/请求被拦截。
2. `useChatStream.ts` 中 URL 拼接了 `/${event}` 后缀，而 Y3 本地 API Server 的路由表中 `code_chat_stream` 未注册（只注册了 `text_chat_stream`）。
**修复**：
- `chatBill.ts`：`isExceedCost` 默认值改回 `false`
- `useChatStream.ts`：移除所有 `/${event}` URL 拼接
**规则**：`chatBill.ts` 的 `isExceedCost` 永远为 `false`；stream 函数的 URL 不拼接 event 后缀

#### 问题 2：FeatureTour 编译错误
**现象**：FeatureTour 目录已被删除，但 `chat.ts` 和 `CodeChatInputActionBar.tsx` 中仍有 import 引用。
**根因**：上游在 `chat.ts` 中新增了 `dispatchTourEvent(CODEBASE_SESSION_CREATED_EVENT)` 调用，同步时 SAFE 分类自动合入。
**修复**：删除 `chat.ts` 中的 FeatureTour import 和调用，删除 `CodeChatInputActionBar.tsx` 中的 FeatureTour import。
**规则**：所有引用 `FeatureTour/` 或 `dispatchTourEvent` 的代码必须移除

#### 问题 3：BUILT_IN_PROMPTS_OPENSPEC 导出名变更
**现象**：`chat.ts` 中 import `BUILT_IN_PROMPTS_OPENSPEC` 失败，上游已重命名为 `BUILT_IN_PROMPTS_OPENSPEC_V023` / `BUILT_IN_PROMPTS_OPENSPEC_V1`。
**修复**：Y3 不需要 OpenSpec，直接移除该 import 及其使用处。
**规则**：所有 OpenSpec 相关的 prompt 引用在 Y3 中应被移除

#### 问题 4：品牌标题被覆盖
**现象**：侧边栏标题从"Y3 Maker Agent"变回"CodeMaker"。
**根因**：上游修改了 `ChatHeaderToolbar.tsx`，SAFE 分类自动合入覆盖了 Y3 的品牌定制。
**修复**：恢复 Y3 品牌标题。
**规则**：`ChatHeaderToolbar.tsx` 应列为 REVIEW 文件，Y3 品牌文案不可被覆盖

#### 问题 5：code_chat_stream 路由未注册
**现象**：编程模式聊天可能静默失败。
**根因**：Y3 本地 API Server 的 `routes/chat.mjs` 中注册了 `text_chat_stream` 和 `codebase_chat_stream`，但没有注册 `code_chat_stream`。移除 event 后缀后此问题不再影响（因为不存在 URL 后缀匹配失败的情况），但 `code_chat_stream` 路由仍需补上以防万一。
**修复**：移除 event 后缀拼接后，此问题已规避。后续应在 API Server 中补注册 `code_chat_stream` 路由。
