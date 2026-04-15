## Why

Y3Helper 集成的 CodeMaker 在用户尝试粘贴/上传图片时，会弹出"该模型不支持选择图片"的提示。根本原因是：前端的 `chatModels` 映射表是硬编码的内部模型列表，用户自定义模型（通过配置 API Key + Base URL）不在其中，导致 `chatModels[model].parseImgType` 为 `undefined`，前端判定为不支持图片。

当前 webview 前端仅以编译后的单个 JS 文件存在于仓库中，无法直接修改源码。而源码位于外部路径 `H:\codemaker\CodemakerOpenSource`，随时有可能丢失。需要将 webview 源码纳入我们仓库管理，实现自主修改和编译。

## What Changes

- **将 CodeMaker webview 前端源码完整拷贝到我们仓库** — 从 `H:\codemaker\CodemakerOpenSource\packages\webview` 拷贝到 `resources/webview_source_code/`，作为我们自己的前端源码目录
- **修改 `App.tsx` 中 `INIT_DATA` 处理逻辑** — 当 `fixedModel` 存在时，自动将该模型注入到 `chatModels` 中，设置 `parseImgType: ParseImgType.BASE64`，使自定义模型支持图片上传
- **建立前端编译流程** — 在仓库中配置 vite 编译脚本，编译产物输出到 `resources/codemaker/webview/assets/`，替换原有的预编译文件
- **更新 `.vscodeignore` 和打包配置** — 确保源码不打入 VSIX 发布包，只打包编译产物

## Capabilities

### New Capabilities
- `webview-source-management`: 管理 CodeMaker webview 前端源码的拷贝、存放、编译流程，使我们可以自主修改前端代码并编译

### Modified Capabilities
- `codemaker-integration`: 修改 WebView 初始化逻辑，当 `fixedModel` 存在时自动注入模型配置到 `chatModels`，使自定义模型支持图片上传（`parseImgType: BASE64`）

## Impact

- **新增目录**: `resources/webview_source_code/` — 前端源码（约含 `src/`, `public/`, `package.json`, `vite.config.ts` 等）
- **修改文件**: `resources/webview_source_code/src/App.tsx` — 注入 fixedModel 到 chatModels
- **修改文件**: `resources/webview_source_code/src/services/chatModel.ts` — 可能需要调整默认模型映射
- **编译产物**: `resources/codemaker/webview/assets/` — 由我们自己编译生成
- **打包配置**: `.vscodeignore` — 排除 `resources/webview_source_code/src/` 等源码目录
- **依赖管理**: 需要在 `resources/webview_source_code/` 下安装前端依赖（React, Vite 等）
