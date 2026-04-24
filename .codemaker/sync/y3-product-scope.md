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
