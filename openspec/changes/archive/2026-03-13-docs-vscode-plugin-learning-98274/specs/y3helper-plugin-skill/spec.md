## ADDED Requirements

### Requirement: Skill 触发条件
Skill SHALL 在用户请求「创建 Y3Helper 插件」、「新增 Y3Helper 功能模块」等场景时被触发。

#### Scenario: 用户请求创建插件
- **WHEN** 用户输入「帮我创建一个 Y3Helper 插件」
- **THEN** Skill 被激活并开始交互式问答流程

### Requirement: 交互式信息收集
Skill SHALL 通过 `ask_user_question` 工具收集必要信息。

#### Scenario: 收集插件名称
- **WHEN** Skill 启动
- **THEN** 询问用户插件的中文名称（用于菜单显示）
- **THEN** 询问用户插件的英文标识（用于代码命名，kebab-case）

#### Scenario: 收集功能类型
- **WHEN** 用户提供了插件名称
- **THEN** 询问用户插件的功能类型（纯命令 / WebView 面板 / 带子菜单的分组）

#### Scenario: 收集图标选择
- **WHEN** 用户确定了功能类型
- **THEN** 提供常用 VSCode 图标列表供选择，或允许用户输入自定义图标名称

### Requirement: 代码生成
Skill SHALL 根据收集的信息生成脚手架代码。

#### Scenario: 生成 TreeNode 页面文件
- **WHEN** 信息收集完成
- **THEN** 在 `src/mainMenu/pages/` 目录下生成新的 TypeScript 文件
- **THEN** 文件包含继承 `TreeNode` 的类定义

#### Scenario: 生成命令注册代码
- **WHEN** 功能类型包含命令
- **THEN** 生成 `vscode.commands.registerCommand` 调用代码

#### Scenario: 生成 WebView 代码
- **WHEN** 功能类型为 WebView 面板
- **THEN** 生成 `vscode.window.createWebviewPanel` 调用代码
- **THEN** 生成基础的 HTML 模板

### Requirement: 注册提示
Skill SHALL 提示用户如何将新插件注册到主菜单。

#### Scenario: 提示修改 mainMenu.ts
- **WHEN** 代码生成完成
- **THEN** 显示需要在 `src/mainMenu/mainMenu.ts` 中添加的 import 语句
- **THEN** 显示需要在 `makeMainNode()` 函数中添加的节点位置

### Requirement: package.json 更新提示
Skill SHALL 提示用户更新 `package.json` 中的命令声明（如需要）。

#### Scenario: 提示添加命令声明
- **WHEN** 生成的代码包含新命令
- **THEN** 显示需要在 `package.json` 的 `contributes.commands` 中添加的内容
