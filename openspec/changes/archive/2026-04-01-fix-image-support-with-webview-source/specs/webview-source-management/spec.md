## ADDED Requirements

### Requirement: Webview 前端源码纳入仓库管理
系统 SHALL 将 CodeMaker webview 前端源码完整存放在 `resources/webview_source_code/` 目录下，作为我们自主维护的前端代码库。

#### Scenario: 源码目录结构完整
- **WHEN** 开发者查看 `resources/webview_source_code/` 目录
- **THEN** 目录 SHALL 包含完整的前端项目结构：`src/`、`public/`、`package.json`、`vite.config.ts`、`tsconfig.json`、`index.html` 等

#### Scenario: 源码可独立编译
- **WHEN** 开发者在 `resources/webview_source_code/` 下执行 `npm install && npm run build`
- **THEN** SHALL 成功编译出前端产物，无编译错误

### Requirement: Vite 编译产物输出到 resources 目录
`resources/webview_source_code/` 的 Vite 编译产物 SHALL 直接输出到 `resources/codemaker/webview/` 目录，覆盖现有的预编译文件。

#### Scenario: 编译产物输出路径正确
- **WHEN** 执行 `npm run build:webview`
- **THEN** 编译产物（`index.html`、`assets/*.js`、`assets/*.css`）SHALL 输出到 `resources/codemaker/webview/`

#### Scenario: Extension 侧无需修改即可加载
- **WHEN** 编译产物输出到 `resources/codemaker/webview/` 后
- **THEN** `webviewProvider.ts` 中现有的 HTML 加载逻辑 SHALL 无需任何修改即可正常加载新编译的前端

### Requirement: 根目录提供 webview 编译脚本
根目录的 `package.json` SHALL 提供 `build:webview` 脚本，使开发者可以从项目根目录一键编译前端。

#### Scenario: 根目录编译脚本可用
- **WHEN** 开发者在项目根目录执行 `npm run build:webview`
- **THEN** SHALL 自动进入 `resources/webview_source_code/` 目录并执行编译

### Requirement: VSIX 发布包不包含前端源码
`.vscodeignore` SHALL 配置排除 `resources/webview_source_code/` 目录，确保 VSIX 发布包只包含编译产物，不包含前端源码和 `node_modules`。

#### Scenario: 打包排除源码
- **WHEN** 执行 `vsce package` 生成 VSIX
- **THEN** 产物 SHALL 不包含 `resources/webview_source_code/src/` 和 `resources/webview_source_code/node_modules/`

#### Scenario: 打包包含编译产物
- **WHEN** 执行 `vsce package` 生成 VSIX
- **THEN** 产物 SHALL 包含 `resources/codemaker/webview/` 下的编译产物

### Requirement: Git 忽略前端依赖但提交编译产物
`.gitignore` SHALL 忽略 `resources/webview_source_code/node_modules/`，但 SHALL NOT 忽略 `resources/codemaker/webview/assets/` 下的编译产物。

#### Scenario: node_modules 不提交
- **WHEN** 开发者执行 `npm install` 安装前端依赖
- **THEN** `resources/webview_source_code/node_modules/` SHALL 被 `.gitignore` 忽略

#### Scenario: 编译产物可提交
- **WHEN** 开发者编译前端产生新的 assets 文件
- **THEN** `resources/codemaker/webview/assets/` 下的文件 SHALL 可以被 git 跟踪和提交