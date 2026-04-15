# Proposal: 补充 UI 框架

## 问题

Y3 Helper 缺少 UI 开发框架的模板系统。用户在创建新项目或现有项目中需要手动编写 UI 框架基础代码（UIManager、BasePanel、BaseView、BaseTips、EventBus 等），重复劳动且容易出错。

## 方案

在 Y3 Helper 中添加一键生成 UI 框架的功能：

1. **模板文件**：在插件的 `template/ui_framework/` 目录下提供完整的 UI 框架模板，包括：
   - `game/init.lua` - 游戏初始化入口
   - `game/ui/UIManager.lua` - UI 管理器
   - `game/ui/UIConst.lua` - UI 常量定义
   - `game/ui/base/BasePanel.lua` - 面板基类
   - `game/ui/base/BaseView.lua` - 视图基类
   - `game/ui/base/BaseTips.lua` - 提示基类
   - `game/ui/base/EventBus.lua` - 事件总线

2. **生成入口**：
   - 创建新项目时，询问用户是否生成 UI 框架
   - 在功能菜单中添加「生成 UI 框架」按钮，支持随时生成/更新

3. **核心模块** (`src/uiFramework.ts`)：
   - `initUIFramework()` - 将模板文件复制到 `global_script/game/` 目录，强制覆盖同名文件
   - `isUIFrameworkInitialized()` - 检查关键文件是否已存在，用于菜单状态显示
   - 生成后自动检测 `global_main.lua` 是否已引用，给予用户相应提示

4. **注册命令** (`y3-helper.generateUIFramework`)：带确认对话框，支持进度条显示
