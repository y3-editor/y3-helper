--[[
    UI 基础类入口

    加载顺序很重要：
    1. EventBus   → 事件总线（最基础，无依赖）
    2. BasePanel  → 面板基类
    3. BaseView   → 视图基类（可选嵌套组件）
    4. BaseTips   → 提示基类（特殊显隐逻辑）
]]

include 'game.ui.base.EventBus'
include 'game.ui.base.BasePanel'
include 'game.ui.base.BaseView'
include 'game.ui.base.BaseTips'

-- 加载常量定义
include 'game.ui.UIConst'
