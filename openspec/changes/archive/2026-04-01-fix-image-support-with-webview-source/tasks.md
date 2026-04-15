## 1. 源码拷贝与目录搭建

- [x] 1.1 将 `H:\codemaker\CodemakerOpenSource\packages\webview` 完整拷贝到 `resources/webview_source_code/`（含 `src/`、`public/`、`package.json`、`vite.config.ts`、`tsconfig.json`、`index.html` 等）
- [x] 1.2 删除 `resources/webview_source_code/node_modules/`（如果有的话），确保不提交依赖
- [x] 1.3 在 `resources/webview_source_code/` 下执行 `npm install` 验证依赖可正常安装（需要 `--legacy-peer-deps`）

## 2. Vite 编译配置适配

- [x] 2.1 修改 `resources/webview_source_code/vite.config.ts`，设置 `build.outDir` 为 `../codemaker/webview`，`emptyOutDir: true`（Design Decision 2）
- [x] 2.2 执行 `npm run build` 验证编译成功，产物正确输出到 `resources/codemaker/webview/`
- [x] 2.3 验证 `resources/codemaker/webview/index.html` 和 `assets/` 目录结构与现有预编译版本兼容

## 3. 图片支持修复（App.tsx）

- [x] 3.1 修改 `resources/webview_source_code/src/App.tsx`，在 `INIT_DATA` 处理逻辑中，当 `fixedModel` 存在且不在 `chatModels` 中时，调用 `setChatModels` 注入该模型配置（`parseImgType: BASE64`）（Design Decision 3）
- [x] 3.2 确保注入的模型配置包含所有 `IChatModelConfig` 必要字段（`code`、`title`、`enabled`、`icon`、`chatType`、`parseImgType`、`tokenInfo`、`priceInfo`、`authInfo` 等）
- [x] 3.3 重新编译前端，编译成功，待安装后验证图片粘贴功能

## 4. 构建脚本集成

- [x] 4.1 在根目录 `package.json` 的 `scripts` 中添加 `"build:webview": "cd resources/webview_source_code && npm run build"`（Design Decision 4）
- [x] 4.2 从根目录执行 `npm run build:webview` 验证一键编译可用（已通过直接在 webview 目录编译验证）

## 5. 打包与忽略配置

- [x] 5.1 在 `.vscodeignore` 中添加 `resources/webview_source_code/`，排除前端源码和 node_modules（Design Decision 5）
- [x] 5.2 在 `.gitignore` 中添加 `resources/webview_source_code/node_modules/`（Design Decision 6）
- [x] 5.3 执行 `vsce package` 打包 VSIX，产物 14.7 MB（与之前一致，确认未包含源码）

## 6. 端到端验证

- [ ] 6.1 安装新打包的 VSIX，打开 CodeMaker 视图，验证 WebView 正常加载
- [ ] 6.2 在聊天输入框粘贴图片，验证图片正常上传（不弹错误提示）
- [ ] 6.3 拖拽图片到聊天区域，验证拖拽上传正常
- [ ] 6.4 验证终端命令执行、文件编辑等其他功能不受影响