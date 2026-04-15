## Context

Y3Maker 的流式响应处理代码位于 `resources/webview_source_code/src/services/useChatStream.ts`，包含 6 个独立的流处理函数，每个函数都从 SSE 事件中解析 `choices[0].delta` 的子字段。

**当前问题**：所有函数都假设 `choices[0].delta` 一定存在，但 MiniMax 模型的流式返回中：
1. 最终汇总 chunk 使用 `choices[0].message` 而非 `choices[0].delta`，导致 `delta` 为 `undefined`
2. 代码中的三目判断 `choices[0]?.delta?.reasoning_content === null ? '' : choices[0].delta.reasoning_content` 在 `delta` 为 `undefined` 时，`undefined === null` 为 `false`，走入 else 分支直接访问 `choices[0].delta.reasoning_content`，触发 TypeError

**影响的 6 个函数**：
- `createStream` (通用流)
- `createDeepseekReasonerStream` (DeepSeek 推理)
- `createClaude37ReasonerStream` (Claude 3.7 思考)
- `createBMStream` (BM 流)
- `createFunctionCallStream` (Y3Maker 主要使用)
- `createGoogleGeminiNetworkStream` (Gemini 流)

## Goals / Non-Goals

**Goals:**
- 修复所有流处理函数中 `delta` 为 `undefined` 时的崩溃问题
- 统一使用防御性的空值处理模式（`?? ''`）替换不安全的三目判断
- 确保 MiniMax 的最终汇总 chunk（含 `message` 字段）不导致崩溃
- 不影响已正常工作的模型（OpenAI、DeepSeek、Claude、Gemini）

**Non-Goals:**
- 不解析 MiniMax 特有的 `reasoning_details`、`audio_content`、`name` 等额外字段
- 不重构整体流处理架构（6 个函数合并为通用处理器等）
- 不修改 `ai-provider.mjs` 服务端的转发逻辑

## Decisions

### Decision 1: 使用 `delta ?? {}` 提前解构，而非逐行加可选链

**选择**: 在每个函数中读取 `choices[0]` 后，立即提取 `delta`：
```typescript
const delta = choices[0]?.delta;
if (!delta) return; // 跳过没有 delta 的 chunk（如 MiniMax 汇总 chunk）
```

**理由**: 
- MiniMax 的汇总 chunk（`choices[0].message`）是完整内容的重复，跳过它不会丢失数据
- 比逐行加 `?.` 更简洁，减少出错概率
- 所有增量数据已在前面的 delta chunk 中处理过

**备选方案**: 逐行添加可选链（`choices[0]?.delta?.content ?? ''`），但需要改 15+ 处，容易遗漏。

### Decision 2: 将三目判断统一替换为 `?? ''`

**选择**: 
```typescript
// Before (unsafe):
const reasoningContent = choices[0]?.delta?.reasoning_content === null ? '' : choices[0].delta.reasoning_content;

// After (safe):
const reasoningContent = delta.reasoning_content ?? '';
```

**理由**: `?? ''` 同时处理 `null` 和 `undefined`，且代码更简洁。对于已有的模型，`reasoning_content` 为 `null` 时返回 `''`、为具体值时返回该值，行为一致。

### Decision 3: `createFunctionCallStream` 中的条件判断修复

**选择**: 修复 L1098-1100 的条件判断：
```typescript
// Before (unsafe):
if (choices[0]?.delta?.tool_calls !== null || choices[0]?.delta?.content !== null)

// After (safe):
const delta = choices[0]?.delta;
if (!delta) return;
if (delta.tool_calls != null || delta.content != null)
```

**理由**: 当 `delta` 为 `undefined` 时，`undefined !== null` 为 `true`，会错误地进入 if 块。使用 `!= null`（宽松等于）同时匹配 `null` 和 `undefined`。

## Risks / Trade-offs

- **[风险] MiniMax 汇总 chunk 被跳过后的 usage 数据** → MiniMax 的 usage 数据在汇总 chunk 中，但 `createFunctionCallStream` 已在 L1070-1087 单独处理 `json.usage`，不受 `delta` 跳过影响
- **[风险] 其他模型是否也有 delta 为空的情况** → OpenAI/DeepSeek/Claude/Gemini 测试中 delta 始终存在，即使是空对象 `{}`，不会触发 `!delta` 跳过
- **[Trade-off] 不解析 MiniMax 汇总 chunk 的 message 字段** → 该 chunk 是增量数据的完整重复，不解析不会丢失信息，但如果未来有模型只在 message 中发送独有数据则需要重新评估