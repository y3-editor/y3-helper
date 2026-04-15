# Proposal: CodeMaker 固定模型设置

## 问题
用户需要在 VSCode Settings 中配置一个模型名称，填写后锁定 CodeMaker 聊天界面的模型选择，不可在 UI 中切换。支持任意模型名称（不限于内置列表）。

## 方案
1. 在 `package.json` 中声明 `CodeMaker.CodeChatModel` 设置项
2. Extension 端通过 `INIT_DATA` 传递 `fixedModel` 字段给前端
3. 前端收到 `fixedModel` 后：
   - 强制覆盖 `chatConfig.model`
   - 跳过模型列表验证（允许任意模型名）
   - 模型选择器替换为静态文本显示
4. 留空则保持原有行为，用户自由选择

## 涉及文件
- `package.json` — 设置项声明
- `src/codemaker/webviewProvider.ts` — 传递 fixedModel
- 源码 `App.tsx` — 接收并应用 fixedModel
- 源码 `store/extension.ts` — 存储 fixedModel
- 源码 `store/chat-config.ts` — 跳过模型验证
- 源码 `ChatModelSelector.tsx` — 条件渲染静态文本