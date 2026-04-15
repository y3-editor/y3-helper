## 1. 工作目录切换逻辑修改

- [x] 1.1 修改 `src/extension.ts` 中 `selectAnotherMap` 命令的工作目录比较逻辑，将 `scriptUri` 改为 `projectUri`
- [x] 1.2 修改 `src/extension.ts` 中 `vscode.openFolder` 的目标路径，从 `env.scriptUri` 改为 `env.projectUri`

## 2. 地图管理菜单项新增

- [x] 2.1 在 `src/mainMenu/pages/mapManager.ts` 中添加「打开地图根目录」菜单项
- [x] 2.2 添加 `y3.env.projectUri` 存在性检查条件
- [x] 2.3 复用 `ViewInVSCode` 组件创建菜单项实例
- [x] 2.4 设置菜单项的 `description` 和 `tooltip` 属性

## 3. 国际化支持

- [x] 3.1 在 `l10n/bundle.l10n.json` 中添加「打开地图根目录」的中文文本
- [x] 3.2 在 `l10n/bundle.l10n.json` 中添加「Open Map Root Directory」的英文翻译

## 4. 测试验证

- [x] 4.1 验证切换地图后 VSCode 工作目录正确切换到项目根目录
- [x] 4.2 验证地图管理页面显示「打开地图根目录」菜单项
- [x] 4.3 验证点击菜单项后 VSCode 窗口正确重新加载
- [x] 4.4 验证 `projectUri` 未定义时菜单项不显示