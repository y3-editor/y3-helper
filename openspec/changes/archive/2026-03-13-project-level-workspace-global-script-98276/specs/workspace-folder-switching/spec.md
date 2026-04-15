## ADDED Requirements

### Requirement: 切换地图后的工作目录目标
系统 SHALL 在切换地图时打开项目根目录（projectUri），而非脚本目录（scriptUri）。

#### Scenario: 切换地图打开项目目录
- **WHEN** 用户执行 `y3-helper.selectAnotherMap` 命令
- **AND** 用户选择了不同的地图
- **AND** 当前工作目录不是项目根目录
- **THEN** 系统 SHALL 使用 `env.projectUri` 执行 `vscode.openFolder` 命令
- **AND** VSCode 窗口 SHALL 以项目根目录作为工作区重新加载

#### Scenario: 当前目录已是项目目录
- **WHEN** 用户执行 `y3-helper.selectAnotherMap` 命令
- **AND** 用户选择了不同的地图
- **AND** 当前工作目录已经是项目根目录
- **THEN** 系统 SHALL NOT 执行 `vscode.openFolder` 命令
- **AND** VSCode 窗口 SHALL NOT 重新加载

### Requirement: 工作目录比较逻辑
系统 SHALL 将工作目录与 `projectUri` 进行比较，而非 `scriptUri`。

#### Scenario: 检查工作目录匹配
- **WHEN** 系统检查当前工作区是否包含目标目录
- **THEN** 系统 SHALL 将 `vscode.workspace.workspaceFolders[].uri.fsPath` 与 `env.projectUri.fsPath` 进行比较