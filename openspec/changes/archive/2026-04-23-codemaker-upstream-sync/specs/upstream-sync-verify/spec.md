## ADDED Requirements

### Requirement: Webview 编译检查
系统 SHALL 在合并完成后执行 webview 前端的编译命令，确认编译通过。

#### Scenario: 编译成功
- **WHEN** 执行 `cd resources/webview_source_code && npm run build`
- **THEN** 编译成功，无报错，报告验证通过

#### Scenario: 编译失败
- **WHEN** 编译出现错误
- **THEN** 系统展示错误信息，提示工程师修复后重新验证

### Requirement: Extension 编译检查
系统 SHALL 在合并完成后执行 extension 的编译命令，确认编译通过。

#### Scenario: 编译成功
- **WHEN** 执行项目根目录的 webpack/tsc 编译
- **THEN** 编译成功，无报错，报告验证通过

#### Scenario: 编译失败
- **WHEN** 编译出现错误
- **THEN** 系统展示错误信息，提示工程师修复后重新验证

### Requirement: 消息协议一致性校验
系统 SHALL 提取前端代码中发送的消息类型集合，与后端 `messageHandlers.ts` 中处理的消息类型集合进行交叉对比，报告不一致项。

#### Scenario: 前端发送但后端未处理
- **WHEN** 前端代码中有 `postMessage({ type: 'FOO' })` 但后端 `messageHandlers.ts` 中没有 `case 'FOO'`
- **THEN** 报告中标记 `FOO` 为"前端发送但后端未处理"，标注为 ⚠️ 警告（不一定是错误，可能是有意不处理的消息）

#### Scenario: 全部一致
- **WHEN** 前后端消息类型完全匹配（考虑排除列表）
- **THEN** 报告"消息协议一致性检查通过"

### Requirement: 更新基准版本
系统 SHALL 在验证通过后，将本次同步的目标 commit 写入 `baseline.json` 作为新的基准。

#### Scenario: 验证通过后更新基准
- **WHEN** 编译检查和协议校验都通过
- **THEN** `baseline.json` 中的 commit hash 和日期更新为本次同步的目标值

#### Scenario: 验证失败不更新基准
- **WHEN** 编译检查或协议校验失败
- **THEN** `baseline.json` 不被修改，保持上次的基准值