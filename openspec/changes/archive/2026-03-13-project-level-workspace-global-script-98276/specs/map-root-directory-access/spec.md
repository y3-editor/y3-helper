## ADDED Requirements

### Requirement: 地图根目录菜单项
当 `y3.env.projectUri` 可用时，系统 SHALL 在地图管理页面显示「打开地图根目录」菜单项。

#### Scenario: projectUri 存在时显示菜单项
- **WHEN** 用户打开地图管理页面
- **AND** `y3.env.projectUri` 已定义
- **THEN** 系统 SHALL 在分割线下方显示「打开地图根目录」菜单项

#### Scenario: projectUri 未定义时隐藏菜单项
- **WHEN** 用户打开地图管理页面
- **AND** `y3.env.projectUri` 未定义
- **THEN** 系统 SHALL NOT 显示「打开地图根目录」菜单项

### Requirement: 打开项目目录操作
当用户点击菜单项时，系统 SHALL 在 VSCode 中打开项目根目录。

#### Scenario: 点击打开项目目录
- **WHEN** 用户点击「打开地图根目录」菜单项
- **THEN** 系统 SHALL 使用 `y3.env.projectUri` 执行 `vscode.openFolder` 命令
- **AND** VSCode 窗口 SHALL 以项目根目录作为工作区重新加载

### Requirement: 菜单项工具提示
系统 SHALL 显示提示信息，警告 VSCode 窗口将重启。

#### Scenario: 工具提示显示重启警告
- **WHEN** 用户将鼠标悬停在「打开地图根目录」菜单项上
- **THEN** 系统 SHALL 显示工具提示文本「会重启VSCode窗口」

### Requirement: 国际化支持
系统 SHALL 同时支持中文和英文本地化。

#### Scenario: 中文环境
- **WHEN** 用户的 VSCode 语言设置为中文
- **THEN** 菜单项标签 SHALL 显示「打开地图根目录」

#### Scenario: 英文环境
- **WHEN** 用户的 VSCode 语言设置为英文
- **THEN** 菜单项标签 SHALL 显示「Open Map Root Directory」