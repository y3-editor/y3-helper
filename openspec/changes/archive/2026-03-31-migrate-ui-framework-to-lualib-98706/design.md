## Context

UI 框架原先以模板形式存放在 y3-helper 的 `template/ui_framework/` 中。y3-helper 侧的代码已被同事 revert。本次变更仅涉及 y3-lualib 仓库（https://github.com/y3-editor/y3-lualib）。

## Goals / Non-Goals

**Goals:**
- 将 UI 框架集成到 y3-lualib，用户 clone 后自动获得
- 提供 `y3.ui_manager` 公开 API，用户无需修改 lualib 内部文件
- 内部使用 share 模块管理状态，不污染全局命名空间

**Non-Goals:**
- 不修改 y3-helper 仓库（已由同事清理）

## Decisions

### Decision 1: 使用 `ui_framework/` 顶级目录
UI 框架作为 y3-lualib 的一个顶级模块，通过 `include 'y3.ui_framework.init'` 加载。

### Decision 2: 内部使用 share.lua 替代全局 GamePlay 表
按仓库 master 要求，不使用全局变量。内部模块通过 `require 'y3.ui_framework.share'` 共享 event 和 uiMgr 实例。

### Decision 3: 导出公开 API 到 y3.ui_manager
按仓库 master 要求，参考其他模块（如 y3.local_ui）的模式，通过 api.lua 导出用户 API。用户通过 `y3.ui_manager.register_popup()` / `y3.ui_manager.open()` 等方法注册和控制界面。

### Decision 4: BasePanel 新增类级别 on_event
按仓库 master 要求，事件监听与 on_init 平行定义。`Panel:on_event("event_name", function(self, ...) end)` 在 attach 时自动绑定到事件总线，destroy 时自动清理。

## Risks / Trade-offs

**[权衡] UIConst.lua 仍在 lualib 中** — 虽然导出了注册 API，UIConst.lua 仍保留作为内部默认配置。用户应通过 API 注册，不直接编辑 UIConst。