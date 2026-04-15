## Why

Y3Helper 集成了 CodeMaker 的源码，沿用了 CodeMaker 的品牌命名。领导要求将产品品牌从 "CodeMaker" 统一改为 "Y3Maker"，包括用户可见的所有 UI 文本、配置项和 AI 提示词，确保用户感知到的是 Y3Maker 品牌。代码内部标识符（类名、变量名）不做改动，以控制变更范围。

## What Changes

### 必改项

- **BREAKING** UI 展示文本：所有菜单标题、tooltip、侧边栏标题中的 "CodeMaker" / "CODEMAKER" 统一改为 "Y3Maker"（不使用全大写形式，保持一致的品牌风格）
  - `package.json` 中的视图容器标题、命令标题、配置项标题和描述
  - `src/mainMenu/pages/codemaker.ts` 中的 TreeNode 文本
  - webview HTML `<title>` 标签
- **BREAKING** VSCode Settings 配置项命名空间：`CodeMaker.*` → `Y3Maker.*`（用户已有配置将丢失，需手动重新配置）
  - `CodeMaker.CodeChatApiKey` → `Y3Maker.CodeChatApiKey`
  - `CodeMaker.CodeChatApiBaseUrl` → `Y3Maker.CodeChatApiBaseUrl`
  - `CodeMaker.CodeChatModel` → `Y3Maker.CodeChatModel`
  - `CodeMaker.CodeChatWireApi` → `Y3Maker.CodeChatWireApi`
- 系统提示词 / LLM Prompt：所有让 AI 自称 "CodeMaker" 的提示词改为 "Y3Maker"
  - `constructH75Prompt.ts` 中 "你叫 CodeMaker" → "你叫 Y3Maker"
  - `config.ts` 中系统 prompt 中 "CodeMaker 编程助手" → "Y3Maker 编程助手"
  - `chatAttachParseHandler.ts` 中 "parsed by CodeMaker" → "parsed by Y3Maker"
  - `specVersionUtils.ts` 中版本提示文本
  - `toast.ts` 中提示文本
- 日志输出前缀：`[CodeMaker]` → `[Y3Maker]`（统一使用 Y3Maker 而非 Y3MAKER），涉及 `webviewProvider.ts`、`apiServer.ts`、`messageHandlers.ts`、`index.ts` 等
- `.codemaker` 目录 → `.y3maker` 目录：
  - 所有引用 `.codemaker/rules`、`.codemaker/skills`、`.codemaker/codewiki`、`.codemaker` 目录的代码路径改为 `.y3maker`
  - `.codemaker.codebase.md` → `.y3maker.codebase.md`
  - 新增自动迁移逻辑：启动时检测到 `.codemaker` 存在但 `.y3maker` 不存在时，自动重命名；如重命名失败（目录被占用等），则提示用户
  - 提示词中引用的 `.codemaker/rules/rules.mdc` 等路径也要同步改
- API/HTTP 低风险部分：
  - HTTP header `codemaker-version` → `y3maker-version`（3处）
  - API 路径 `/proxy/codemaker/reports` → `/proxy/y3maker/reports`（1处）

### 不改项

- 内部类名/变量名（`CodeMakerWebviewProvider`、`CodeMakerApiServer`、`codemakerApiRequest` 等）—— 纯代码重构，用户不可见，控制变更范围
- 高风险 API 标识：
  - `root.${username}.codemaker` prompt 命名空间 —— 改了会导致已有用户自定义 prompt 数据丢失
  - `X-Auth-Project: 'codemaker'` —— 后端权限系统依赖
  - `CODEMAKER_DOCSET_TAG = 'codemaker'` —— 后端文档集标签依赖
  - `codemaker_public` 查询参数字段名 —— 后端接口字段
- 源码注释中的 "移植自 CodeMaker 源码版" 等历史说明 —— 无需改，属于代码考古信息
- `@dep305/codemaker-web-tools` 等 npm 包名引用 —— 外部依赖，不在本次范围

## Capabilities

### New Capabilities
- `y3maker-dir-migration`: `.codemaker` → `.y3maker` 目录自动迁移逻辑（启动时检测旧目录并自动重命名，失败时提示用户）

### Modified Capabilities
- （无现有 spec 需要修改，本次变更主要是品牌重命名，属于全局文本替换 + 迁移逻辑）

## Impact

- **用户配置 (BREAKING)**：`CodeMaker.*` Settings 命名空间变更，用户需重新配置 API Key、Base URL、Model 等
- **用户工程目录**：`.codemaker/` 将被自动迁移为 `.y3maker/`，包括 rules、skills、MCP 配置、codewiki
- **后端 API**：`codemaker-version` header 和 `/proxy/codemaker/reports` 路径需后端同步改动
- **y3-lualib**：其中的 `.codemaker/` 源目录也需同步改名为 `.y3maker/`
- **涉及文件约 30+ 个**，主要集中在：
  - `package.json`（配置项、命令、视图容器）
  - `src/codemaker/` 目录下的 `.ts` 文件（日志、配置读取、webview HTML）
  - `src/mainMenu/pages/codemaker.ts`（菜单入口）
  - `src/extension.ts`（初始化、目录复制）
  - `resources/webview_source_code/src/` 下的多个服务、store、提示词文件
