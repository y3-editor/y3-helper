## MODIFIED Requirements

### Requirement: CodeMaker 右侧 WebView 视图容器
系统 SHALL 在 VSCode 右侧侧边栏（Secondary Side Bar）提供一个独立的 CodeMaker 视图容器，内含一个 WebView 视图，展示完整的 CodeMaker UI。

WebView 后端 SHALL 正确处理以下 Skills 相关的消息类型，使前端 Skills 工具栏功能可正常使用：
- `GET_SKILLS`：返回 skills 列表（`SYNC_SKILLS` 响应）
- `CREATE_SKILL_TEMPLATE`：创建模板文件（`CREATE_SKILL_TEMPLATE_RESULT` 响应）
- `INSTALL_BUILTIN_SKILL`：安装内置 skill（`INSTALL_BUILTIN_SKILL_RESULT` 响应）
- `use_skill` 工具调用：返回 skill 内容（`TOOL_CALL_RESULT` 响应）

#### Scenario: 首次启动自动展开
- **WHEN** 用户首次激活 Y3Helper 插件且未曾关闭过 CodeMaker 视图
- **THEN** CodeMaker 右侧视图容器 SHALL 自动展开并显示 WebView

#### Scenario: 用户关闭后不再自动展开
- **WHEN** 用户点击 CodeMaker 视图的 X 按钮关闭视图
- **THEN** 系统 SHALL 记录 userClosed 状态，后续启动不再自动展开

#### Scenario: 用户手动打开后恢复自动展开
- **WHEN** 用户通过主菜单命令手动打开 CodeMaker 视图
- **THEN** 系统 SHALL 重置 userClosed 状态，后续启动恢复自动展开

#### Scenario: Skills 工具栏正常显示
- **WHEN** `.codemaker/skills/` 目录下存在至少一个合法的 skill 文件
- **THEN** 前端工具栏 SHALL 显示 Skills 开关项（与 Plan Mode、代码 Apply、执行 CMD、MCP Server 并列）
