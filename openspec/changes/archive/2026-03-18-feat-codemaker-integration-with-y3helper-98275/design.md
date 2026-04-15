## Context

当前 Y3Helper 为 VSCode 扩展，使用 TypeScript + Webpack 构建与打包，发布后供外部用户安装使用。CodeMaker 源码位于本机 `H:\CodemakerOpenSource`，需要在保持可维护性的前提下，将其功能集成到 Y3Helper，并确保打包产物包含所需资源与依赖。

## Goals / Non-Goals

**Goals:**
- 将 CodeMaker 作为 Y3Helper 的内置能力，发布后外部用户无需额外配置即可使用
- 在 Y3Helper 中新增可访问入口（命令/菜单/视图）以调用 CodeMaker 功能
- 调整构建与打包流程，保证 CodeMaker 代码与资源随扩展发布

**Non-Goals:**
- 不在本次变更中改造 CodeMaker 核心业务逻辑或重构其模块
- 不在本次变更中引入新的在线服务或远程部署流程

## Decisions

<!-- Key design decisions and rationale -->

1. **集成方式：以源码/构建产物方式内嵌到扩展包**
   - 方案 A：将 CodeMaker 作为独立运行时依赖，通过外部路径加载
   - 方案 B：将 CodeMaker 源码或构建产物复制到扩展包并随发布交付
   - 决策：采用方案 B，避免外部用户环境差异导致不可用；通过构建流程将 CodeMaker 代码与必要资源打入扩展包。

2. **功能入口：右侧独立容器 + WebView，默认展开可见**
   - 方案 A：放在现有左侧 Y3Helper 容器内
   - 方案 B：新增右侧独立容器（Secondary Side Bar）+ WebView 视图
   - 决策：采用方案 B，符合期望的“右侧固定视图”体验。
   - 行为细则：插件启动时自动展开；若用户关闭过视图，不强制重新打开，需点击入口手动打开。
   - 状态规则：
     - 用户点击 CodeMaker 视图的 X 视为“关闭”，不再自动展开
     - 用户手动打开视图后，记录“已打开”，后续启动可自动展开
     - 切换到其他 Activity Bar 视图（如资源管理器）时自动隐藏；切回 Y3Helper 时根据状态恢复
   - 入口位置：Y3Helper 主菜单新增“打开 CodeMaker”命令用于手动打开
   - 隐藏细则：切换到其他 Activity Bar 时隐藏整个右侧容器（图标不显示）；隐藏不视为关闭，不影响 userClosed

3. **通信方式：不与主扩展进行业务通信**
   - 方案 A：WebView 与主扩展消息通信
   - 方案 B：CodeMaker 内置 MCP，自行完成业务通信
   - 决策：采用方案 B，减少耦合与主扩展逻辑依赖。
   - 例外：初始化阶段通过单次 postMessage 将用户配置（API Key、API Base URL）传递给 WebView，属于单向配置注入，不涉及业务通信。

4. **运行形态：WebView + Node.js API Server**
   - 方案 A：仅前端 WebView + 扩展侧代理逻辑
   - 方案 B：WebView + 内置 Node.js API Server（与源码版一致）
   - 决策：采用方案 B，按 CodeMaker 源码流程启动 API Server，保持行为一致。

## Risks / Trade-offs

<!-- Known risks and trade-offs -->

- **[发布包体积增加]** → 评估 CodeMaker 资源体积，必要时裁剪非必需资源并拆分可选组件
- **[依赖冲突或版本不兼容]** → 明确 CodeMaker 依赖范围，优先复用已有依赖或使用依赖隔离方式
- **[构建流程变复杂]** → 将新增步骤封装在脚本中并加入构建说明，确保 CI/本地一致
- **[API Server 生命周期与端口冲突]** → 明确启动/退出时机与端口占用策略，避免多窗口冲突

## 补充决策

5. **用户配置传递：VSCode Settings → postMessage + 环境变量双通道**
   - 在 Y3Helper 的 `package.json` 中声明以下配置项：
     - `CodeMaker.CodeChatApiKey`（string，默认空）— API 密钥
     - `CodeMaker.CodeChatApiBaseUrl`（string，默认空）— API 基础地址
     - `CodeMaker.CodeChatModel`（string，默认空）— 默认模型名称
   - WebView 通道：插件启动 / WebView 初始化时，通过 `postMessage('INIT_DATA')` 单次传递给 WebView
   - API Server 通道：启动 API Server 子进程时，将配置映射为环境变量注入（`AI_API_KEY`、`AI_API_BASE_URL`、`AI_DEFAULT_MODEL`），API Server 通过 `config.mjs` 自动读取
   - 后续新增配置项只需加声明 + 两端传递即可

6. **聊天历史记录持久化**
   - 源码版 API Server 的历史记录路由（`routes/history.mjs`）使用内存存储，重启丢失
   - 集成到 Y3Helper 后，SHALL 将历史记录持久化到本地文件，确保重启后可恢复上次聊天记录
   - 存储位置：使用 VSCode 扩展的 `globalStorageUri` 目录下的 JSON 文件
   - 读写时机：API Server 启动时加载、会话更新时写入

7. **端口冲突策略：自动递增寻找可用端口**
   - 默认端口：`3001`（来源：CodeMaker `packages/api-server/src/config.mjs`）
   - 冲突处理：端口被占用时自动 +1 递增，直到找到可用端口
   - 递增上限：最多尝试 100 次（即 3001~3100），超过则报错提示用户
   - 端口传递：API Server 启动后，将实际端口通过 WebView HTML 注入方式传递给前端（单向注入，非双向通信）
