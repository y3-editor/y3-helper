## MODIFIED Requirements

### Requirement: 用户 API 配置支持
Y3Helper SHALL 在 VSCode Settings 中提供 CodeMaker 的 API Key、API Base URL、Model 和 Wire API 协议配置项，并在 WebView 初始化和 API Server 启动时将配置传递到位。

#### Scenario: 用户在设置中填写 API 配置
- **WHEN** 用户在 VSCode Settings 中填写 `CodeMaker.CodeChatApiKey`、`CodeMaker.CodeChatApiBaseUrl`、`CodeMaker.CodeChatModel` 和 `CodeMaker.CodeChatWireApi`
- **THEN** 系统 SHALL 保存配置值

#### Scenario: WebView 初始化时接收配置
- **WHEN** CodeMaker WebView 初始化
- **THEN** 系统 SHALL 通过 `postMessage('INIT_DATA')` 将 API Key、API Base URL、Model 和 Wire API 单次传递给 WebView

#### Scenario: API Server 启动时接收配置
- **WHEN** 系统启动 CodeMaker API Server 子进程
- **THEN** 系统 SHALL 将 API Key、API Base URL、Model 和 Wire API 映射为环境变量（`AI_API_KEY`、`AI_API_BASE_URL`、`AI_DEFAULT_MODEL`、`AI_WIRE_API`）注入子进程

#### Scenario: 配置为空时 WebView 可正常加载
- **WHEN** 用户未填写 API Key 或 API Base URL
- **THEN** WebView SHALL 正常加载并提示用户补充配置

#### Scenario: Wire API 默认值
- **WHEN** 用户未设置 `CodeMaker.CodeChatWireApi`
- **THEN** SHALL 使用默认值 `chat-completions`，与当前行为完全一致