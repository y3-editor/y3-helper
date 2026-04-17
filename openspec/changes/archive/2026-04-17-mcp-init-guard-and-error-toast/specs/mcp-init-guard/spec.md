## ADDED Requirements

### Requirement: Y3 仓库初始化检测
系统 SHALL 提供 `isY3Initialized(): Promise<boolean>` 方法，通过检查 `y3Uri/.git` 目录是否存在来判断 Y3 仓库是否已初始化。

#### Scenario: 仓库已初始化
- **WHEN** `y3Uri/.git` 目录存在且类型为 `Directory`
- **THEN** `isY3Initialized()` 返回 `true`

#### Scenario: 仓库未初始化
- **WHEN** `y3Uri/.git` 目录不存在
- **THEN** `isY3Initialized()` 返回 `false`

#### Scenario: y3Uri 未就绪
- **WHEN** `env.y3Uri` 为 `undefined`（未找到 Y3 地图路径）
- **THEN** `isY3Initialized()` 返回 `false`

### Requirement: MCP Server 自动启动守卫
系统 SHALL 在扩展激活的延迟初始化阶段（`setTimeout` 回调中），先调用 `isY3Initialized()` 检查仓库状态，仅在返回 `true` 时才自动启动 MCP TCP Server（静默模式）。

#### Scenario: 已初始化仓库自动启动 MCP
- **WHEN** 扩展激活且延迟初始化执行
- **AND** `isY3Initialized()` 返回 `true`
- **AND** `tcpServer` 尚未创建
- **THEN** 系统 SHALL 调用 `startTCPServer(true)` 静默启动 MCP Server

#### Scenario: 未初始化仓库跳过 MCP 启动
- **WHEN** 扩展激活且延迟初始化执行
- **AND** `isY3Initialized()` 返回 `false`
- **THEN** 系统 SHALL 跳过 `startTCPServer` 调用，不启动 MCP Server

#### Scenario: 手动启动不受守卫限制
- **WHEN** 用户通过命令面板执行 `y3-helper.startMCPServer`
- **THEN** 系统 SHALL 直接启动 MCP Server，不检查仓库初始化状态

### Requirement: 初始化完成时启动 MCP
系统 SHALL 在 `y3-helper.initProject` 命令成功完成后（git clone 成功、配置复制完成），自动启动 MCP TCP Server。

#### Scenario: initProject 成功后启动 MCP
- **WHEN** `y3-helper.initProject` 命令执行成功（`README.md` 存在确认 clone 成功）
- **AND** 配置文件已复制到项目目录
- **THEN** 系统 SHALL 在调用 `vscode.openFolder` 之前启动 MCP TCP Server（静默模式）

#### Scenario: initProject 失败不启动 MCP
- **WHEN** `y3-helper.initProject` 命令执行失败（如 git clone 失败）
- **THEN** 系统 SHALL 不启动 MCP Server

### Requirement: 项目切换时自动清理 MCP 缓存
系统 SHALL 监听工作区变更事件（`vscode.workspace.onDidChangeWorkspaceFolders`），在项目切换时自动清理上一个项目的 MCP 内存连接缓存，并根据新项目的配置重新初始化。

#### Scenario: 项目切换自动清理并重新初始化
- **WHEN** 工作区文件夹发生变更（`onDidChangeWorkspaceFolders` 触发）
- **THEN** 系统 SHALL 断开所有现有 `McpHub.connections` 中的连接
- **AND** 清空 `connections` 数组
- **AND** 通知 WebView 同步清空状态
- **AND** 重新读取新项目的 `.y3maker/mcp_settings.json` 并初始化连接

#### Scenario: 新项目未初始化则不重新初始化 MCP
- **WHEN** 工作区文件夹发生变更
- **AND** 新项目的 `isY3Initialized()` 返回 `false`
- **THEN** 系统 SHALL 清理旧连接缓存但不重新初始化 MCP 连接
