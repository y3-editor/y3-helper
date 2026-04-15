## Context

当前 CodeMaker webview 前端以预编译的单个 JS 文件（`resources/codemaker/webview/assets/index-6ea24312.js`）存在于仓库中。源码位于外部路径 `H:\codemaker\CodemakerOpenSource\packages\webview`，不在版本管理内，随时可能丢失。

前端使用 Vite + React + TypeScript 技术栈，编译后产物包含 `index.html`、`assets/` 目录（JS/CSS chunks）。当前存在的图片上传 bug 需要修改 `App.tsx`，但无法在预编译文件上操作。

## Goals / Non-Goals

**Goals:**
- 将源码 webview 完整纳入我们仓库版本管理
- 修改 `App.tsx` 使 `fixedModel` 对应的自定义模型支持图片上传
- 建立从源码到编译产物的完整构建链路
- 编译产物输出到现有的 `resources/codemaker/webview/assets/` 目录，对 extension 侧透明

**Non-Goals:**
- 不重构 webview 前端架构或升级 React/Vite 版本
- 不修改 webview 的其他功能逻辑
- 不改变 extension 侧加载 webview 的方式（`webviewProvider.ts` 中的 HTML 注入逻辑不变）

## Decisions

### Decision 1: 源码存放位置 — `resources/webview_source_code/`

将源码放在 `resources/webview_source_code/` 目录下，与 `resources/codemaker/webview/`（编译产物）同级，目录结构清晰。

**备选方案:**
- `packages/webview/` — 与源码仓库同结构，但与我们仓库现有布局不一致
- `src/codemaker/webview-src/` — 放在 extension 源码下，但 webview 是独立的 React 项目，不应和 extension TS 代码混在一起

**选择理由:** `resources/` 下已有 `codemaker/webview/`（产物），源码也放在 `resources/` 下命名为 `webview_source_code`，一眼就能看出源码和产物的关系。

### Decision 2: 编译产物输出 — 覆盖 `resources/codemaker/webview/`

修改 `vite.config.ts` 的 `build.outDir`，使编译产物直接输出到 `resources/codemaker/webview/`，覆盖现有的预编译文件。

```ts
build: {
  outDir: '../codemaker/webview',
  emptyOutDir: true,
  // ...existing rollupOptions
}
```

**选择理由:** extension 侧的 `webviewProvider.ts` 已经从 `resources/codemaker/webview/` 加载资源，输出到同一目录可以做到零修改。`resources/webview_source_code/` 到 `resources/codemaker/webview` 的相对路径为 `../codemaker/webview`。

### Decision 3: 图片支持修复 — `App.tsx` 中注入 `chatModels`

在 `resources/webview_source_code/src/App.tsx` 处理 `INIT_DATA` 消息时，当 `fixedModel` 存在，自动将其注入到 `chatModels`：

```tsx
// App.tsx INIT_DATA 处理中，设置 fixedModel 后：
if (fixedModel) {
  const setChatModels = useChatConfig.getState().setChatModels;
  const currentModels = useChatConfig.getState().chatModels;
  if (!currentModels[fixedModel]) {
    setChatModels({
      ...currentModels,
      [fixedModel]: {
        code: fixedModel as ChatModel,
        title: fixedModel,
        enabled: true,
        icon: ModelIconType.GPT,
        chatType: ChatModelType.ALL,
        parseImgType: ParseImgType.BASE64,
        isPrivate: false,
        tags: [],
        hasComputableToken: false,
        hasTokenCache: false,
        hasThinking: false,
        peerUserContent: false,
        displayOrder: 0,
        tokenInfo: { maxTokens: 128000, maxTokensInCodebase: 128000 },
        priceInfo: { currency: "CNY", promptWeight: 0, completionWeight: 0, cacheWeightFor5min: 0, hitCacheWeight: 0 },
        authInfo: { allowAll: true, allowedUsers: [], allowedDepartments: [] },
      },
    });
  }
}
```

**选择理由:** 最小改动，只在 `fixedModel` 存在且不在 `chatModels` 中时注入。`parseImgType: BASE64` 确保图片上传功能可用。不影响源码版的内部模型列表。

### Decision 4: 构建脚本集成

在根目录 `package.json` 中添加 webview 编译脚本：

```json
"scripts": {
  "build:webview": "cd resources/webview_source_code && npm run build",
  "prebuild:webview": "cd resources/webview_source_code && npm install"
}
```

日常开发流程：修改 `resources/webview_source_code/src/` → 运行 `npm run build:webview` → 产物自动输出到 `resources/codemaker/webview/`。

### Decision 5: `.vscodeignore` 排除源码

在 `.vscodeignore` 中添加：
```
resources/webview_source_code/**
```

确保 VSIX 发布包只包含 `resources/codemaker/webview/` 下的编译产物，不包含源码和 `node_modules`。

### Decision 6: `.gitignore` 策略

- `resources/webview_source_code/node_modules/` — 忽略（标准做法）
- `resources/codemaker/webview/assets/` — **不忽略**，编译产物需要提交到仓库，因为不是所有开发者都需要编译前端

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| 源码拷贝后与上游不同步 | 我们已经决定自主维护，上游源码本身也不稳定。如需同步可手动 diff |
| webview 依赖安装慢（`node_modules` 很大） | 只在需要修改前端时才安装，编译产物提交到仓库，普通开发者无需安装 |
| 编译产物文件名含 hash，git diff 不友好 | 可接受，hash 确保浏览器缓存刷新。编译产物只在前端变更时才需要重新提交 |
| `vite.config.ts` 中的 `@dep305/codemaker-web-tools` stub 可能需要调整 | 源码已有 stub 文件，拷贝过来即可 |