## ADDED Requirements

### Requirement: 流式响应 delta 字段空值安全处理
所有流处理函数在访问 `choices[0].delta` 的子属性（`content`、`reasoning_content`、`thinking_signature`、`redacted_thinking`、`tool_calls`）时，SHALL 对 `delta` 为 `undefined` 或 `null` 的情况进行安全处理，不得抛出 TypeError。

#### Scenario: 模型返回的 chunk 中无 delta 字段
- **WHEN** SSE chunk 的 `choices[0]` 中不包含 `delta` 字段（如 MiniMax 的最终汇总 chunk 使用 `message` 字段）
- **THEN** 系统 SHALL 跳过该 chunk 的内容解析，不崩溃，不丢失已在前序 delta chunk 中接收的数据

#### Scenario: delta 中不包含 reasoning_content 字段
- **WHEN** SSE chunk 的 `choices[0].delta` 存在，但不包含 `reasoning_content` 字段
- **THEN** 系统 SHALL 将 `reasoning_content` 视为空字符串 `''`，正常继续处理

#### Scenario: delta 中不包含 thinking_signature 字段
- **WHEN** SSE chunk 的 `choices[0].delta` 存在，但不包含 `thinking_signature` 字段
- **THEN** 系统 SHALL 将 `thinking_signature` 视为空字符串 `''`，正常继续处理

### Requirement: createFunctionCallStream 条件判断安全性
`createFunctionCallStream` 函数在判断 delta 是否包含有效内容时，SHALL 正确区分「字段为 null」和「字段不存在（undefined）」，避免将 `undefined` 误判为有效值。

#### Scenario: delta 为 undefined 时不应进入内容处理分支
- **WHEN** `choices[0].delta` 为 `undefined`（MiniMax 汇总 chunk）
- **THEN** 系统 SHALL 跳过该 chunk 的内容/tool_calls 处理逻辑，不进入 `delta.tool_calls !== null || delta.content !== null` 的 if 分支

#### Scenario: tool_calls 和 content 都为 null 时正确跳过
- **WHEN** `choices[0].delta` 存在，但 `tool_calls` 为 `null` 且 `content` 为 `null`
- **THEN** 系统 SHALL 跳过该 chunk 的内容处理，不输出空数据