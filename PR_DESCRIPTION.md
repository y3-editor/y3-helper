# PR: Y3Maker 功能集成合并

## 概述

本次合并包含多个重大功能模块的新增和大量改进。

## 主要变更

### CodeMaker AI 助手集成

将 CodeMaker（AI 编码助手）完整集成到 Y3Helper 中，作为右侧边栏 WebView 视图：

- **WebviewProvider + ApiServer + ConfigProvider**：完整的前后端架构
- **消息桥**：Extension 和 WebView 消息通信，60+ 消息处理器
- **聊天历史持久化**：支持跨 session 保存聊天记录
- **TOOL_CALL 全链路**：补齐 16 个工具（文件编辑、终端命令等）
- **replace_in_file 三层匹配引擎**：精确字符匹配、行级模糊匹配、块级滑窗匹配
- **MCP Server 连接管理**：McpHub + stdio/sse/streamableHttp 传输 + UI 状态同步
- **Skills 工具栏**：GET_SKILLS/CREATE_SKILL_TEMPLATE/INSTALL_BUILTIN_SKILL + use_skill 工具
- **Responses API**：支持 function calling（tools 转换 + tool_call 事件）
- **文件搜索**：移植 workspaceTracker + openFilesHandler，@ 面板正确选中当前文件

### MCP Server（Model Context Protocol）

为 Y3 编辑器提供 MCP 协议支持，实现 Claude Code 等 AI 工具自动化控制游戏：

- **TCP Server**：与游戏运行时通信
- **游戏会话管理**：launch_game、截图、日志管理
- **UI 画布工具**：get_ui_canvas 获取 UI 树结构
- **Lua 静态检查**：基于 LSP 的代码诊断 + MCP 工具暴露

### GMP 保存支持

- VsCode 中直接保存 GMP（Game Mod Package）
- 支持直接修改的 UI 及直接运行
- 多语言 GMP 支持

### UI 框架

- 主控界面、三选一界面优化
- 背景图及 button 图配置默认值
- UI 编写框架（game/ui, UIManager）

### OpenSpec 工作流

- 初始化 OpenSpec 配置
- PM Issue 开发工作流规范
- 多个 change 的完整 spec-driven 开发记录

### 其他改进

- 工作目录支持项目级别配置
- global script 路径选择
- MCP 配置命令统一化
- 完善的中文文档体系

## 变更统计

- **新增/修改文件**：381 个
- **新增代码行**：约 186,000 行
- **主要贡献者**：王浩辰、王一鑫、刘冰

## 测试情况

- 所有功能在内部 UAT 环境下验证通过
- CodeMaker 集成经过多轮 bug 修复和对齐源码版验证
- MCP Server 与游戏运行时通信测试通过

## 注意事项

- 本次合并包含 resources/codemaker/ 下的 WebView 打包产物（约 83K 行 JS），这些是 CodeMaker 前端的编译产物
- openspec/ 目录包含开发过程中的 spec 文档和归档记录
- .codemaker/ 目录包含项目级 AI 配置文件
