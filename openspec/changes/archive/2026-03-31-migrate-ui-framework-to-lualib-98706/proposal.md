## Why

当前 UI 框架（UIManager、BasePanel、BaseView、BaseTips 等）以模板文件形式存放在 y3-helper 插件的 `template/ui_framework/` 目录中，在初始化项目时通过弹窗询问用户是否生成，并将文件复制到用户项目的 `global_script/game/` 目录下。这种方式存在以下问题：

1. **用户体验差**：初始化流程中多一个弹窗确认步骤，增加用户认知负担
2. **维护分散**：UI 框架作为 y3-helper 的 template 资源管理，与 y3-lualib 仓库的 Lua 库生态割裂
3. **更新不便**：框架更新依赖用户手动重新生成，无法随 lualib 统一更新

需求 #98706 要求将 UI 框架迁移到 lualib 仓库中，作为标准库的一部分随 git clone 自动获取，无需额外的生成步骤。

## What Changes

- 将 UI 框架 Lua 文件迁移到 y3-lualib 仓库的 `ui_framework/` 目录
- 通过 `y3.ui_manager` 公开 API 供用户注册和控制界面
- 内部使用 `share.lua` 模块管理共享状态，不污染全局命名空间
- BasePanel 新增 `on_event` 类级别事件注册，与 `on_init` 平行定义
- y3-helper 侧 UI 框架代码已由同事 revert，本次变更仅涉及 y3-lualib

## Capabilities

### Modified Capabilities

- `ui-framework-migration`: 将 UI 框架从 y3-helper 模板迁移到 y3-lualib，用户通过 `y3.ui_manager` API 注册和控制界面

## Impact

- **y3-lualib 仓库**：新增 `ui_framework/` 目录（10 个文件，1694 行），`init.lua` 新增一行加载
- **用户影响**：零配置，clone lualib 后自动获得 UI 框架，通过 API 注册和控制界面