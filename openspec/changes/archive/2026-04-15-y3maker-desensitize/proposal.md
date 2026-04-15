## Why

[#98849](https://up1.pm.netease.com/v6/issues/98849)

Y3Helper 之前是开源项目，后来因为新增 Y3Maker 模块引入了网易内部敏感信息而闭源。现在需要对 Y3Maker 模块范围内的敏感信息进行脱敏，使项目能够再次开源。**之前 Y3Helper 核心模块的代码已经过开源验证，不在本次脱敏范围内。** 所有改动**不影响原有功能**。

## What Changes

- **脱敏 WebView 前端代码中的企业邮箱引用**：`ChatMaskManageModel.tsx` 和 `ChatPromptManageModel.tsx` 中的 `corp邮箱前缀` 说明和 `gzxiaoming` 等内部用户示例需替换为通用描述
- **重新构建 WebView 编译产物**：`resources/codemaker/webview/assets/index-*.js` 中包含源码编译后的敏感字符串，需在修改源码后重新构建
- **清理 OpenSpec 归档文档中的内部链接**：所有归档 proposal 中的 `up1.pm.netease.com` Issue 链接
- **清理项目说明文档**：`PR_DESCRIPTION.md` 中的"网易内部开发集成合并"等描述
- **清理品牌迁移历史文档**：`openspec/changes/archive/2026-04-08-rename-codemaker-to-y3maker/` 中包含完整的内部品牌决策过程

## Capabilities

### New Capabilities

- `y3maker-desensitize`: 定义 Y3Maker 模块及关联代码的脱敏规则和范围，包括源代码、配置文件、文档、WebView 前端代码和编译产物中的敏感信息识别与替换策略

### Modified Capabilities

_(无现有 spec 级别的行为变更。本次变更仅涉及敏感信息的移除/替换，不改变任何功能需求。)_

## Impact

### 受影响的代码文件

| 模块 | 文件 | 影响说明 |
|------|------|---------|
| WebView 源码 | `resources/webview_source_code/src/routes/CodeChat/ChatMaskSelector/ChatMaskManageModel.tsx` | corp 邮箱描述脱敏 |
| WebView 源码 | `resources/webview_source_code/src/routes/CodeChat/ChatTypeAhead/Prompt/ChatPromptManageModel.tsx` | corp 邮箱描述脱敏 |
| WebView 编译产物 | `resources/codemaker/webview/assets/index-*.js` | 需重新构建以清除敏感字符串 |
| 项目文档 | `PR_DESCRIPTION.md` | 网易内部描述 |
| 归档文档 | `openspec/changes/archive/*/proposal.md` (7个文件) | 内部 Issue 链接 |
| 归档文档 | `openspec/changes/archive/2026-04-08-rename-codemaker-to-y3maker/` | 完整的品牌迁移历史 |

### 范围边界

- **仅限 Y3Maker 模块范围**：Y3Helper 核心模块（如 `src/tools/version.ts`）已经过之前开源验证，不在本次脱敏范围内
- **不影响原有功能**：所有脱敏操作仅限于字符串/文本替换，不改变代码逻辑
- WebView 编译产物修改后需验证前端功能正常
