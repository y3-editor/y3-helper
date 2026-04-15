## Why

Y3Maker（CodeMaker）在使用 MiniMax 模型（MiniMax-M2.5-highspeed / MiniMax-M2.7-highspeed）时，流式响应解析崩溃，报错 `Cannot read properties of undefined (reading 'reasoning_content')`。

根本原因是代码中 6 个流处理函数（`createStream`、`createDeepseekReasonerStream`、`createClaude37ReasonerStream`、`createBMStream`、`createFunctionCallStream`、`createGoogleGeminiNetworkStream`）在访问 `choices[0].delta` 的子属性时，未做充分的空值保护。MiniMax 模型的流式返回中，最终汇总 chunk 使用 `message` 而非 `delta`，导致 `delta` 为 undefined 时直接崩溃。

## What Changes

- 修复 `useChatStream.ts` 中所有流处理函数对 `choices[0].delta` 的不安全访问，改用可选链 + 空值合并（`??`）
- 修复 `createFunctionCallStream` 中 `!json.choices && json.data` 的误判逻辑（MiniMax 最终 chunk 同时包含 `choices` 和额外字段，不应被当作错误）
- 修复 `undefined !== null → true` 的逻辑陷阱，将三目判断统一替换为 `?? ''` 模式

## Capabilities

### New Capabilities

（无新增功能）

### Modified Capabilities

- `codemaker-integration`: 流式响应解析逻辑需要增强对非标准 delta 格式的兼容性

## Impact

- **受影响文件**: `resources/webview_source_code/src/services/useChatStream.ts`（6 个流处理函数，约 15 处代码修改）
- **影响范围**: 所有通过 Y3Maker 进行 AI 对话的流式响应处理
- **兼容性**: 修复后兼容 OpenAI、DeepSeek、Claude、Gemini、MiniMax 等所有模型的流式返回格式
- **风险**: 低 — 仅增加空值保护，不改变正常模型的处理逻辑