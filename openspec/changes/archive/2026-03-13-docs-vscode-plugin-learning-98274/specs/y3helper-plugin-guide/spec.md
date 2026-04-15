## ADDED Requirements

### Requirement: 快速开始章节
文档 SHALL 包含「快速开始」章节，指导开发者在 5 分钟内完成一个最小可运行的 TreeView 节点。

#### Scenario: 新开发者阅读快速开始
- **WHEN** 开发者按照「快速开始」章节的步骤操作
- **THEN** 能在 Y3Helper 侧边栏看到一个新的菜单节点，点击后弹出提示消息

### Requirement: TreeNode 使用指南
文档 SHALL 详细说明 `TreeNode` 类的使用方法，包括所有可配置属性。

#### Scenario: 开发者查阅 TreeNode 属性
- **WHEN** 开发者需要配置节点的图标、命令、子节点
- **THEN** 能在文档中找到每个属性的说明和示例代码

#### Scenario: 开发者配置动态显示
- **WHEN** 开发者需要根据条件显示/隐藏节点
- **THEN** 能在文档中找到 `show` 属性的使用方法和示例

### Requirement: 命令注册指南
文档 SHALL 说明如何注册 VSCode 命令并绑定到 TreeNode。

#### Scenario: 开发者注册新命令
- **WHEN** 开发者需要添加一个可点击执行的菜单项
- **THEN** 能在文档中找到 `vscode.commands.registerCommand` 的使用方法
- **THEN** 能在文档中找到如何在 `package.json` 中声明命令

### Requirement: WebView 开发指南
文档 SHALL 包含 WebView 的创建和使用方法，用于展示复杂 UI。

#### Scenario: 开发者创建 WebView 面板
- **WHEN** 开发者需要打开一个新窗口展示自定义 UI
- **THEN** 能在文档中找到 `vscode.window.createWebviewPanel` 的使用方法
- **THEN** 能在文档中找到 WebView 与扩展通信的方法

### Requirement: 完整示例代码
文档 SHALL 提供一个完整的「AI助手」插件示例，作为参考模板。

#### Scenario: 开发者复制示例代码
- **WHEN** 开发者需要快速创建一个类似的插件
- **THEN** 能找到一个可直接运行的完整示例
- **THEN** 示例包含 TreeNode 定义、命令注册、WebView 创建

### Requirement: 文件组织规范
文档 SHALL 说明新插件代码应该放置在哪些目录下。

#### Scenario: 开发者添加新插件文件
- **WHEN** 开发者创建新插件的源文件
- **THEN** 知道应该在 `src/mainMenu/pages/` 下创建页面文件
- **THEN** 知道如何在 `src/mainMenu/mainMenu.ts` 中注册新节点
