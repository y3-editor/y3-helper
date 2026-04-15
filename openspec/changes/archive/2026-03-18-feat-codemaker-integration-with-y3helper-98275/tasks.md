## 1. CodeMaker 源码分析与资源准备

- [x] 1.1 分析 `H:\CodemakerOpenSource` 源码结构，梳理前端资源（WebView HTML/CSS/JS）与后端 API Server 入口及依赖
- [x] 1.2 确定需要打入扩展包的最小文件集合（前端构建产物 + 后端代码 + 依赖），记录清单
- [x] 1.3 在 Y3Helper 项目中创建 CodeMaker 资源目录（如 `src/codemaker/` 或 `resources/codemaker/`），将所需文件复制/链接到位

## 2. package.json 视图容器与命令声明

- [x] 2.1 在 `package.json` 的 `viewsContainers` 中新增 `panel` 或合适位置声明 CodeMaker 右侧容器（`codemaker`），配置图标与标题
- [x] 2.2 在 `package.json` 的 `views` 中为 CodeMaker 容器声明一个 WebviewView（`codemaker.webview`）
- [x] 2.3 在 `package.json` 的 `commands` 中注册 `y3-helper.codemaker.open` 命令

## 3. 用户 API 配置声明与传递

- [x] 3.1 在 `package.json` 的 `configuration` 中声明 `CodeMaker.CodeChatApiKey`（string，默认空）、`CodeMaker.CodeChatApiBaseUrl`（string，默认空）和 `CodeMaker.CodeChatModel`（string，默认空）配置项
- [x] 3.2 在 `src/codemaker/configProvider.ts` 中实现配置读取工具函数，从 `vscode.workspace.getConfiguration` 获取三个配置值
- [x] 3.3 在 WebView 初始化时通过 `postMessage('INIT_DATA')` 将 API Key、API Base URL 和 Model 单次传递给 WebView 前端
- [x] 3.4 在 API Server 启动时将配置映射为环境变量注入子进程（`AI_API_KEY`、`AI_API_BASE_URL`、`AI_DEFAULT_MODEL`）

## 4. WebviewViewProvider 实现（`src/codemaker/`）

- [x] 4.1 创建 `src/codemaker/webviewProvider.ts`，实现 `vscode.WebviewViewProvider` 接口，加载 CodeMaker 前端资源到 WebView
- [x] 4.2 在 `src/codemaker/index.ts` 中注册 `WebviewViewProvider` 到 `codemaker.webview` 视图
- [x] 4.3 实现 WebView HTML 加载逻辑：读取 CodeMaker 前端构建产物并注入 WebView，配置 `localResourceRoots`
- [x] 4.4 在 WebView resolveWebviewView 时调用 `postMessage('INIT_DATA')` 传递用户配置（API Key、API Base URL、API Server 端口）

## 5. API Server 生命周期管理（`src/codemaker/`）

- [x] 5.1 创建 `src/codemaker/apiServer.ts`，封装 CodeMaker API Server 的启动/停止逻辑（参考源码启动流程）
- [x] 5.2 启动子进程时注入用户配置的环境变量（API Key、Base URL、Model）和动态端口号
- [x] 5.3 在 WebView 首次渲染时触发 API Server 启动，并将服务地址传递给 WebView 前端
- [x] 5.4 在扩展 `deactivate` 中注册 API Server 停止逻辑，确保 VSCode 关闭时终止进程
- [x] 5.5 实现端口冲突自动递增：从 3001 开始，端口 +1 递增，最多尝试 100 次（3001~3100），超过上限报错提示

## 5b. 聊天历史记录持久化

- [x] 5b.1 修改 API Server 的 `routes/history.mjs`，将内存存储替换为文件读写（或在外层封装文件 I/O）
- [x] 5b.2 存储位置使用 VSCode 扩展的 `globalStorageUri` 目录，启动 API Server 时通过环境变量传入存储路径
- [x] 5b.3 API Server 启动时从 JSON 文件加载历史记录到内存
- [x] 5b.4 会话创建/更新/删除时同步写入 JSON 文件
- [x] 5b.5 处理文件不存在（首次使用）和读写异常的边界情况

## 6. 视图显示/隐藏与状态管理（`src/codemaker/`）

- [x] 6.1 使用 `globalState` 持久化 `userClosed` 状态（用户是否主动关闭过 CodeMaker 视图）
- [x] 6.2 实现首次启动自动展开逻辑：插件激活时检查 `userClosed`，若为 false 则执行 `vscode.commands.executeCommand` 打开右侧容器
- [x] 6.3 监听 CodeMaker 视图的关闭事件（X 按钮），设置 `userClosed = true`
- [x] 6.4 实现 Activity Bar 切换绑定：严格跟随 Activity Bar 切换显示/隐藏整个右侧容器（含图标）（需运行时探索最佳信号源）
- [x] 6.5 隐藏时不改变 `userClosed` 状态，仅在点击 X 时改变

## 7. 主菜单入口（`src/mainMenu/`）

- [x] 7.1 在 `src/mainMenu/pages/` 中创建 CodeMaker 入口页面文件，定义 TreeNode（图标 + 命令绑定 `y3-helper.codemaker.open`）
- [x] 7.2 在 `src/mainMenu/mainMenu.ts` 的 `makeMainNode()` 中注册该 TreeNode
- [x] 7.3 实现 `y3-helper.codemaker.open` 命令处理：打开右侧 CodeMaker 视图并重置 `userClosed = false`

## 8. 构建与打包流程

- [x] 8.1 修改 Webpack 配置，将 CodeMaker 前端资源与后端代码打入 `dist/` 产物（无需修改：resources/ 为静态资源直接随包发布）
- [x] 8.2 更新 `.vscodeignore`，确保 CodeMaker 资源不被排除（已确认：resources/ 未被排除）
- [x] 8.3 验证 `vsce package` 产物包含 CodeMaker 所有必需文件（y3-helper-1.21.7.vsix, 240 files, 11.85MB，所有 CodeMaker 资源已确认包含）

## 9. 集成测试与验证

- [x] 9.1 本地 F5 调试：验证插件激活后右侧 CodeMaker 容器自动展开、WebView 加载正常、API Server 启动正常
- [x] 9.2 验证在 Settings 中填写 API Key / API Base URL / Model 后，WebView 和 API Server 能正确接收配置
- [x] 9.3 验证关闭 X 后重启不再自动展开，手动打开后恢复自动展开
- [x] 9.4 验证切换 Activity Bar 时右侧容器隐藏/恢复行为
- [x] 9.5 验证端口冲突时自动递增行为
- [x] 9.6 验证聊天历史记录持久化：发送消息 → 重启 VSCode → 历史记录仍可见
- [x] 9.7 执行 `vsce package` 打包后安装验证，确认外部用户可正常使用
