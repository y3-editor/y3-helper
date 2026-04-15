# Tasks: 补充 UI 框架

## 任务列表

- [x] 创建 UI 框架模板文件（Lua 源码）
  - `template/ui_framework/game/init.lua`
  - `template/ui_framework/game/ui/init.lua`
  - `template/ui_framework/game/ui/UIManager.lua`
  - `template/ui_framework/game/ui/UIConst.lua`
  - `template/ui_framework/game/ui/base/init.lua`
  - `template/ui_framework/game/ui/base/BasePanel.lua`
  - `template/ui_framework/game/ui/base/BaseView.lua`
  - `template/ui_framework/game/ui/base/BaseTips.lua`
  - `template/ui_framework/game/ui/base/EventBus.lua`

- [x] 创建 `src/uiFramework.ts` 核心模块
  - `initUIFramework()` 函数：复制模板到 global_script
  - `isUIFrameworkInitialized()` 函数：检查框架是否已安装

- [x] 在 `src/extension.ts` 中集成
  - 新建项目流程中添加 UI 框架生成询问
  - 注册 `y3-helper.generateUIFramework` 命令

- [x] 在功能菜单中添加入口 (`src/mainMenu/pages/features.ts`)
  - 添加「生成 UI 框架」菜单项
  - 支持已生成状态检测和图标切换

- [x] 更新 `package.json` 注册命令

## 涉及文件

| 文件 | 变更类型 | 行数 |
|------|----------|------|
| `package.json` | 修改 | +5 |
| `src/extension.ts` | 修改 | +53 |
| `src/mainMenu/pages/features.ts` | 修改 | +18 |
| `src/uiFramework.ts` | 新增 | +145 |
| `template/ui_framework/game/init.lua` | 新增 | +69 |
| `template/ui_framework/game/ui/UIConst.lua` | 新增 | +95 |
| `template/ui_framework/game/ui/UIManager.lua` | 新增 | +401 |
| `template/ui_framework/game/ui/base/BasePanel.lua` | 新增 | +405 |
| `template/ui_framework/game/ui/base/BaseTips.lua` | 新增 | +168 |
| `template/ui_framework/game/ui/base/BaseView.lua` | 新增 | +110 |
| `template/ui_framework/game/ui/base/EventBus.lua` | 新增 | +164 |
| `template/ui_framework/game/ui/base/init.lua` | 新增 | +17 |
| `template/ui_framework/game/ui/init.lua` | 新增 | +98 |

**总计**: 13 个文件, +1748 行
