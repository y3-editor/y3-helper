# fix-anthropic-tools-format-compat

> **优先级：低** | **类型：兼容性修复** | **状态：待实施**

## 问题描述

当用户通过 LinkAPI 中转站使用 `claudecodecheap` 分组时，无法与大模型对话，报错：

```
tools.0: Input tag 'function' found using 'type' does not match any of the expected tags: 
'bash_20250124', 'custom', 'text_editor_20250124', 'text_editor_20250429', 
'text_editor_20250728', 'web_search_20250305'
```

- 使用 `claudecheap` 分组正常（LinkAPI 会自动过滤/转换不兼容的 tools 参数）
- 使用 `claudecodecheap` 分组报错（LinkAPI 不做过滤，原样转发到 Anthropic 原生端点）

## 根因分析

我们的 `ai-provider.mjs` 在 Chat Completions 协议路径下，将 tools 以 OpenAI 标准格式原样发送：

```json
[{ "type": "function", "function": { "name": "read_file", "description": "...", "parameters": {...} } }]
```

但 Anthropic 原生 Messages API 不接受 `type: "function"`，只接受：
- `bash_20250124`、`custom`、`text_editor_20250124` 等 Anthropic 原生类型

某些中转站（如 LinkAPI 的高级分组）不做格式转换，直接透传到 Anthropic，导致此错误。

## 影响范围

- **受影响**：通过不做 tools 格式兼容的中转站连接 Anthropic Claude 模型的用户
- **不受影响**：
  - 直连 OpenAI / 兼容 API 的用户
  - 中转站自身做了 tools 格式过滤/转换的分组（如 `claudecheap`）
  - 使用 Responses API 协议（`wireApi: responses`）的用户

## 推荐方案（方案 D）

在 `resources/codemaker/api-server/ai-provider.mjs` 的 `streamChatCompletion()` 中：

1. **正常发送请求**（tools 保持 OpenAI 格式）
2. **检测错误响应**：当 HTTP 返回 400/422 且错误文本包含 `"expected tags"` 或 `"does not match any of the expected tags"` 时
3. **转换 tools 格式**：将 `type: "function"` 转换为 Anthropic `type: "custom"` 格式：
   ```json
   { "type": "custom", "name": "read_file", "description": "...", "input_schema": {...} }
   ```
4. **重试请求**：使用转换后的 tools 重新发送
5. **缓存结果**：同一 `baseUrl` 记住需要转换，后续请求直接用 Anthropic 格式，避免重复失败

## 涉及文件

- `resources/codemaker/api-server/ai-provider.mjs` — 主要修改点

## 备注

- 2026-03-31 与 LinkAPI 客服确认，`claudecheap` 分组做了过滤兼容，`claudecodecheap` 不做
- 用户可临时通过使用 `claudecheap` 分组规避此问题
