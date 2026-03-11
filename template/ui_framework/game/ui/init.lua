--[[
    UI 框架入口

    目录结构：
    game/ui/
    ├── init.lua              # 本文件
    ├── UIManager.lua         # UI管理器
    ├── UIConst.lua           # 常量定义
    ├── base/                 # 基础类
    │   ├── BasePanel.lua     # 面板基类
    │   ├── BaseView.lua      # 视图基类
    │   └── BaseTips.lua      # 提示基类
    ├── hud/                  # 常驻HUD
    ├── popup/                # 弹出界面
    ├── menu/                 # 菜单界面
    ├── tips/                 # 悬浮提示
    └── components/           # 复用组件

    使用示例：

    1. 定义界面（继承 BasePanel）
    ```lua
    ---@class MyPopup : BasePanel
    local MyPopup = Class("MyPopup", "BasePanel")

    -- 初始化（attach 后只执行一次），对应 LocalUILogic:on_init
    function MyPopup:on_init(ui, local_player)
        -- 以 _ 开头的子控件已通过 _autoBind 自动绑定到 self
        self._confirmBtn:add_event("左键-抬起", function()
            GamePlay.uiMgr:closeUI("MyPopup")
        end)
    end

    -- 每次打开/刷新时调用，对应 LocalUILogic:on_refresh
    function MyPopup:on_refresh(data)
        self._titleText:set_text(data.title or "默认标题")
    end

    return MyPopup
    ```

    2. 注册界面（在 UIConst.lua 中）
    ```lua
    UIConst.Popup = {
        MyPopup = "MyPopup",
    }
    UIConst.UUID = {
        MyPopup = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    }
    ```

    3. 打开/关闭界面
    ```lua
    GamePlay.uiMgr:openUI("MyPopup", { title = "选择奖励" })
    GamePlay.uiMgr:closeUI("MyPopup")
    ```

    4. 显示/隐藏Tips
    ```lua
    GamePlay.uiMgr:showTips("SmallTips", { text = "获得金币x100" })
    GamePlay.uiMgr:hideTips("SmallTips")
    ```
]]

----------------------------
-- 加载基础类
----------------------------
include 'game.ui.base.init'

----------------------------
-- 加载 UIManager
----------------------------
include 'game.ui.UIManager'

----------------------------
-- 加载具体界面
-- 按分类加载，新增界面时在对应分类下添加 include
----------------------------

-- HUD 界面
-- include 'game.ui.hud.MainHUD'

-- 弹出界面
-- include 'game.ui.popup.MyPopup'

-- 菜单界面
-- include 'game.ui.menu.MainMenu'

-- 悬浮提示
-- include 'game.ui.tips.SmallTips'

-- 复用组件
-- include 'game.ui.components.ItemCmp'

----------------------------
-- 导出模块信息
----------------------------
log.info("[UI Framework] UI框架加载完成")
