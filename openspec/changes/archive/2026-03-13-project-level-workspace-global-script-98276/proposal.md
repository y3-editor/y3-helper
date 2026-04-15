## Why

#98276

当前 Y3 Helper 在切换地图时，会将 VSCode 工作目录切换到 `scriptUri`（脚本目录）。这导致用户无法在 VSCode 中直接访问项目级别的文件（如 global script 等），限制了开发效率。需要将工作目录切换逻辑改为项目级别（`projectUri`），并增加快捷入口让用户可以方便地打开地图根目录。

## What Changes

- **修改工作目录切换逻辑**：将 `selectAnotherMap` 命令中的工作目录从 `scriptUri` 改为 `projectUri`，使 VSCode 打开项目根目录而非脚本目录
- **新增地图管理菜单项**：在地图管理页面增加「打开地图根目录」选项，允许用户快速在 VSCode 中打开项目根目录
- **增加国际化支持**：为新增的菜单项添加中英文翻译

## Capabilities

### New Capabilities
- `map-root-directory-access`: 在地图管理页面提供「打开地图根目录」的快捷入口，支持一键在 VSCode 中打开项目根目录

### Modified Capabilities
- `workspace-folder-switching`: 修改工作目录切换逻辑，从脚本目录级别提升到项目目录级别，使用户能够访问更完整的项目结构

## Impact

### 受影响的代码
- `src/extension.ts`: `selectAnotherMap` 命令的工作目录切换逻辑
- `src/mainMenu/pages/mapManager.ts`: 地图管理页面的菜单项
- `l10n/bundle.l10n.json`: 国际化文本

### 用户影响
- 切换地图后，VSCode 工作区将显示整个项目目录而非仅脚本目录
- 用户可以通过地图管理页面快速打开地图根目录
- **注意**：打开地图根目录会重启 VSCode 窗口

### 依赖
- 依赖 `y3.env.projectUri` 提供项目根目录路径
- 使用现有的 `ViewInVSCode` 组件实现目录打开功能
