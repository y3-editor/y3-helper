# Tasks: CodeMaker 固定模型设置

- [x] 1.1 在 package.json 中更新 CodeMaker.CodeChatModel 设置项描述为"固定模型"，支持任意模型名称
- [x] 2.1 在 webviewProvider.ts 的 INIT_DATA 中传递 fixedModel 字段
- [x] 3.1 源码 store/extension.ts 新增 fixedModel / setFixedModel 状态
- [x] 3.2 源码 App.tsx 从 INIT_DATA 解构 fixedModel 并存入 extensionStore
- [x] 3.3 源码 App.tsx 收到 fixedModel 后通过 useChatConfig 强制设置 chatConfig.model
- [x] 3.4 源码 store/chat-config.ts update() 方法中固定模型模式下跳过模型验证
- [x] 3.5 源码 ChatModelSelector.tsx 当 fixedModel 非空时渲染静态文本（注意 Hooks 调用顺序不可变）
- [x] 3.6 源码 ChatModelSelector.tsx useEffect 中固定模型模式下跳过模型选择逻辑
- [x] 4.1 重新构建 webview 前端并替换 resources/codemaker/webview/
- [x] 5.1 F5 验证：留空时模型选择器正常工作
- [x] 5.2 F5 验证：填写已知模型名时锁定模型且实际请求使用该模型
- [x] 5.3 F5 验证：填写任意模型名时锁定模型且实际请求使用该模型