## 1. 移除失效的 userClosed 机制

- [x] 1.1 删除 `setupDisposeListener` 函数定义（`src/codemaker/index.ts` 第 76-88 行）
- [x] 1.2 删除 `initCodeMaker` 中对 `setupDisposeListener(context)` 的调用（`src/codemaker/index.ts` 第 73 行）
- [x] 1.3 删除 `y3-helper.codemaker.open` 命令中的 `context.globalState.update('codemaker.userClosed', false)` 行（`src/codemaker/index.ts` 第 39 行）

## 2. 实现首次自动弹出逻辑

- [x] 2.1 修改 `startApiServer` 函数中的自动弹出判断：将 `globalState.get('codemaker.userClosed', false)` 替换为 `globalState.get('codemaker.everOpened', false)`，条件从 `!userClosed` 改为 `!everOpened`（`src/codemaker/index.ts` 第 100-104 行）
- [x] 2.2 在首次弹出命令执行后，立即调用 `context.globalState.update('codemaker.everOpened', true)` 持久化标记（`src/codemaker/index.ts`，`startApiServer` 函数内）

## 3. 验证

- [x] 3.1 确认 `src/codemaker/index.ts` 中不再包含 `userClosed`、`setupDisposeListener` 相关字符串
- [x] 3.2 手动测试：清除 globalState 后打开项目，面板应自动弹出
- [x] 3.3 手动测试：关闭面板后重新打开 VS Code，面板不应自动弹出
