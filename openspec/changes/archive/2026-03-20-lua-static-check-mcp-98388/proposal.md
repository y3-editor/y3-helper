# Proposal: Lua 静态检查 MCP 工具

## 问题陈述

当前 AI 辅助开发流程中，AI 在修改 Lua 代码后无法主动获取代码的静态检查结果（语法错误、类型警告等）。需要用户手动查看 VSCode Problems 面板或运行游戏后才能发现问题，导致修复周期长、效率低。

## 目标

为 MCP 协议添加 `read_problems_lua` 工具，使 AI 能够：
1. 在修改代码后主动检查 Lua 文件的诊断问题
2. 根据检查结果自动修复代码问题
3. 支持按路径过滤检查范围

## 关联 Issue

#98388 基于LSP增加lua代码的静态检查逻辑，静态检查错误后交付AI修复问题

## 解决方案概述

通过调用 `sumneko.vscode-operator` 扩展提供的 `vscodeOperator_readProblems` 工具，获取 VSCode Problems 面板中的 Lua 诊断信息，并通过 MCP 协议暴露给 AI。

### 核心设计

1. **调用链**：MCP Tool → `GameSessionManager.readProblemsLua()` → `vscode.lm.invokeTool('vscodeOperator_readProblems')`
2. **过滤策略**：
   - 固定 `maxItems: 100`（限制返回数量）
   - 固定 `minSeverity: 'warning'`（只返回 warning 和 error）
   - 用户可指定 `pathGlob` 过滤路径，自动追加 `**/*.lua` 后缀

## 验收标准

- [x] AI 可通过 MCP 调用 `read_problems_lua` 获取 Lua 诊断
- [x] 支持单路径和多路径数组形式的 `pathGlob` 参数
- [x] 非 `.lua` 结尾的路径自动追加 `**/*.lua` 后缀
- [x] 返回结果包含文件路径、严重程度、消息、行列号等信息
