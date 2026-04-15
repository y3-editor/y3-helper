# fix-terminal-status-display

> **状态：已完成** | **类型：Bug 修复** | **优先级：高**

## 问题描述

当 Y3Helper 集成的 CodeMaker 执行终端命令时，会出现**实际执行成功但界面显示"执行失败"**的问题。

## 根因分析

Y3Helper 简化移植 CodeMaker 源码时，`_toolRunTerminalCmd` 方法遗漏了 `TERMINAL_TRANSFER_LOG` 消息的发送。

**源码版完整流程：**
1. 发送 `TERMINAL_TRANSFER_LOG`（status: START）→ 前端进入终端处理状态
2. 命令执行中实时发送 `TERMINAL_TRANSFER_LOG`（status: RUNNING）→ 维持 `isTerminalProcessing = true`
3. 命令完成后返回 `TOOL_CALL_RESULT`（terminalStatus: Success/Failed）→ 前端正确更新状态

**我们简化版的问题：**
1. ❌ 没有发送 `TERMINAL_TRANSFER_LOG`，导致前端不知道命令正在执行
2. 前端 `updateTerminalResult` 中判断 `if (!isTerminalProcessing) return` 直接丢弃了结果
3. 前端回退到默认值 `extra?.terminalStatus || ETerminalStatus.FAILED`，显示"执行失败"

## 修复内容

修改文件：`src/codemaker/webviewProvider.ts` — `_toolRunTerminalCmd` 方法

1. 改用 `spawn` 替代 `exec`，支持实时输出流
2. 在命令开始前发送 `TERMINAL_TRANSFER_LOG`（START），通知前端进入终端处理状态
3. 在 stdout/stderr 有数据时实时发送 `TERMINAL_TRANSFER_LOG`（RUNNING），推送输出
4. 命令结束后发送 `TERMINAL_TRANSFER_LOG`（SUCCESS）+ 返回 `TOOL_CALL_RESULT`
5. 添加 UTF-8 编码环境变量（对齐源码版）
6. 超时保护从 30s 提升到 120s
7. 正确处理用户拒绝执行（Canceled）和 catch 异常场景

## 构建产物

- `y3-helper-1.21.7.vsix`（2026-03-31 17:10）

## 时间线

- 2026-03-31：发现问题 → 定位根因 → 修复 → 打包完成