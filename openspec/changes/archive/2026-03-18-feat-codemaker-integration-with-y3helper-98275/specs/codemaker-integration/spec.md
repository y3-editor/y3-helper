## ADDED Requirements

### Requirement: CodeMaker 右侧 WebView 视图容器
系统 SHALL 在 VSCode 右侧侧边栏（Secondary Side Bar）提供一个独立的 CodeMaker 视图容器，内含一个 WebView 视图，展示完整的 CodeMaker UI。

#### Scenario: 首次启动自动展开
- **WHEN** 用户首次激活 Y3Helper 插件且未曾关闭过 CodeMaker 视图
- **THEN** CodeMaker 右侧视图容器 SHALL 自动展开并显示 WebView

#### Scenario: 用户关闭后不再自动展开
- **WHEN** 用户点击 CodeMaker 视图的 X 按钮关闭视图
- **THEN** 系统 SHALL 记录 userClosed 状态，后续启动不再自动展开

#### Scenario: 用户手动打开后恢复自动展开
- **WHEN** 用户通过主菜单命令手动打开 CodeMaker 视图
- **THEN** 系统 SHALL 重置 userClosed 状态，后续启动恢复自动展开

### Requirement: CodeMaker 视图与 Activity Bar 绑定
CodeMaker 右侧视图容器 SHALL 严格跟随 Y3Helper Activity Bar 视图的切换而显示/隐藏。

#### Scenario: 切换到其他 Activity Bar 视图时隐藏
- **WHEN** 用户从 Y3Helper 切换到其他 Activity Bar 视图（如资源管理器）
- **THEN** CodeMaker 右侧容器 SHALL 完全隐藏（包括图标），且不改变 userClosed 状态

#### Scenario: 切回 Y3Helper 时恢复显示
- **WHEN** 用户切回 Y3Helper Activity Bar 视图，且 userClosed 为 false
- **THEN** CodeMaker 右侧容器 SHALL 恢复显示

#### Scenario: 切回 Y3Helper 但用户曾关闭
- **WHEN** 用户切回 Y3Helper Activity Bar 视图，但 userClosed 为 true
- **THEN** CodeMaker 右侧容器 SHALL 不恢复显示

### Requirement: 主菜单打开 CodeMaker 命令
Y3Helper 主菜单（mainMenu TreeNode）SHALL 提供一个"打开 CodeMaker"入口，用于手动打开右侧 CodeMaker 视图。

#### Scenario: 用户点击主菜单打开 CodeMaker
- **WHEN** 用户在 Y3Helper 主菜单点击"打开 CodeMaker"
- **THEN** 系统 SHALL 打开右侧 CodeMaker 视图容器并展示 WebView

### Requirement: CodeMaker API Server 自动启动
系统 SHALL 在 CodeMaker 视图首次显示时自动启动内置的 Node.js API Server，按照 CodeMaker 源码版相同的流程运行。

#### Scenario: 视图显示时启动 API Server
- **WHEN** CodeMaker WebView 首次渲染
- **THEN** 系统 SHALL 启动 CodeMaker API Server 进程，默认端口为 3001

#### Scenario: 端口冲突自动递增
- **WHEN** 默认端口 3001 被占用
- **THEN** 系统 SHALL 自动将端口号 +1 递增尝试，直到找到可用端口或达到上限（最多 100 次，即 3001~3100）

#### Scenario: 端口递增超过上限
- **WHEN** 3001~3100 范围内所有端口均被占用
- **THEN** 系统 SHALL 报错提示用户无法启动 API Server

#### Scenario: 动态端口传递给 WebView
- **WHEN** API Server 成功启动在某个端口
- **THEN** 系统 SHALL 将实际端口号通过 HTML 注入方式传递给 WebView 前端

#### Scenario: 扩展停用时停止 API Server
- **WHEN** Y3Helper 扩展被停用或 VSCode 窗口关闭
- **THEN** 系统 SHALL 终止 CodeMaker API Server 进程

### Requirement: 用户 API 配置支持
Y3Helper SHALL 在 VSCode Settings 中提供 CodeMaker 的 API Key 和 API Base URL 配置项，并在 WebView 初始化时将配置传递给前端。

#### Scenario: 用户在设置中填写 API 配置
- **WHEN** 用户在 VSCode Settings 中填写 `CodeMaker.CodeChatApiKey`、`CodeMaker.CodeChatApiBaseUrl` 和 `CodeMaker.CodeChatModel`
- **THEN** 系统 SHALL 保存配置值

#### Scenario: WebView 初始化时接收配置
- **WHEN** CodeMaker WebView 初始化
- **THEN** 系统 SHALL 通过 `postMessage('INIT_DATA')` 将 API Key、API Base URL 和 Model 单次传递给 WebView

#### Scenario: API Server 启动时接收配置
- **WHEN** 系统启动 CodeMaker API Server 子进程
- **THEN** 系统 SHALL 将 API Key、API Base URL 和 Model 映射为环境变量（`AI_API_KEY`、`AI_API_BASE_URL`、`AI_DEFAULT_MODEL`）注入子进程

#### Scenario: 配置为空时 WebView 可正常加载
- **WHEN** 用户未填写 API Key 或 API Base URL
- **THEN** WebView SHALL 正常加载并提示用户补充配置

### Requirement: 聊天历史记录持久化
系统 SHALL 将 CodeMaker 的聊天历史记录持久化到本地文件，确保扩展重启或 VSCode 重启后用户仍可查看上次的聊天记录。

#### Scenario: 历史记录写入
- **WHEN** 用户进行聊天会话（创建/更新/删除）
- **THEN** 系统 SHALL 将历史记录写入 `globalStorageUri` 目录下的 JSON 文件

#### Scenario: 历史记录加载
- **WHEN** API Server 启动
- **THEN** 系统 SHALL 从持久化文件加载历史记录到内存

#### Scenario: 重启后历史记录可见
- **WHEN** 用户重启 VSCode 后打开 CodeMaker
- **THEN** 之前的聊天记录 SHALL 完整可见

### Requirement: CodeMaker 资源打包
构建流程 SHALL 将 CodeMaker 的前端资源与后端代码打入 Y3Helper 扩展发布包，确保外部用户安装后无需额外配置即可使用。

#### Scenario: 打包后包含 CodeMaker 资源
- **WHEN** 执行 Y3Helper 扩展构建打包
- **THEN** 产物 SHALL 包含 CodeMaker WebView 前端资源与 API Server 后端代码

#### Scenario: 外部用户安装后可用
- **WHEN** 外部用户从 Marketplace 安装 Y3Helper 扩展
- **THEN** CodeMaker 功能 SHALL 可正常使用，无需手动安装额外依赖
