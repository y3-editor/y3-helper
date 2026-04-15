## Context

Y3Helper 之前是开源项目，后因新增 Y3Maker 模块引入网易内部敏感信息而闭源。本次脱敏**仅针对 Y3Maker 模块范围内**的敏感信息，Y3Helper 核心模块（如 `src/tools/version.ts`）已经过之前开源验证，不在本次范围内。

敏感信息分布在以下层面：

1. **WebView 前端源码**：两个 TSX 文件中的 `corp邮箱前缀` 描述和 `gzxiaoming` 内部用户示例
2. **WebView 编译产物**：`resources/codemaker/webview/assets/index-*.js` 中残留的敏感字符串
3. **OpenSpec 文档**：归档 proposal 中的内部 Issue 链接
4. **项目说明文档**：`PR_DESCRIPTION.md` 中的网易内部描述

核心约束：**所有改动不能影响原有功能**。

## Goals / Non-Goals

**Goals:**

- 移除 Y3Maker 模块范围内包含内部系统 URL、企业邮箱等敏感信息的硬编码引用
- 清理 WebView 前端源码和编译产物中的内部信息
- 清理 OpenSpec 文档中的内部 PM 系统链接
- 清理项目说明文档中的内部描述
- 确保脱敏后扩展功能正常运行

**Non-Goals:**

- 不修改任何业务逻辑或功能行为
- 不重构代码架构
- 不处理 Y3Maker 以外的模块脱敏（如有其他模块需要，另开变更）
- 不处理 git 历史中的敏感信息（仅清理当前代码）

## Decisions

### Decision 1: WebView 前端文案处理

**选择：将 `corp邮箱前缀` 替换为通用描述 `用户名`**

两处文案：
- `ChatMaskManageModel.tsx` L1647: `: 获取当前提交者corp邮箱前缀，如 gzxiaoming`
- `ChatPromptManageModel.tsx` L401: `: 获取当前提交者 corp 邮箱前缀，如 gzxiaoming`

替换为：`: 获取当前用户名`

**理由：** `__USER__` 变量的实际功能就是获取用户标识，"用户名"是通用且准确的描述。移除内部邮箱示例不影响功能理解。

### Decision 2: WebView 编译产物处理

**选择：修改源码后重新构建 WebView**

`resources/codemaker/webview/assets/index-*.js` 是编译产物，包含源码中的敏感字符串。直接修改编译产物不可靠且难以维护。

方案：
- 先修改 `resources/webview_source_code/` 中的源码
- 重新执行 WebView 构建流程，生成新的编译产物
- 验证新产物中不再包含敏感字符串

### Decision 3: OpenSpec 文档与项目文档脱敏策略

**选择：移除内部链接但保留文档结构，不动 `openspec/config.yaml`**

- `openspec/config.yaml`：**不修改**。PM 系统链接模板是 OpenSpec 工作流正常运作的一部分，修改会导致后续无法读取正确的易协作路径
- 归档 proposal 中的 Issue 链接：保留 `#98274` 等编号引用但移除完整 URL，或替换为通用格式
- `openspec/changes/archive/2026-04-08-rename-codemaker-to-y3maker/`：保留但脱敏内部链接
- `PR_DESCRIPTION.md`：将"网易内部开发集成合并"改为通用描述

### Decision 4: 脱敏验证方式

**选择：脱敏完成后执行全局关键词扫描验证**

使用 `grep -rn` 搜索以下关键词确认清除完成：
- `corp邮箱`、`gzxiaoming`
- `up1.pm.netease.com`
- `网易内部`

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| WebView 重新构建可能引入差异 | 编译产物 hash 变化，可能影响缓存 | 验证构建后的功能完整性 |
| 遗漏敏感信息 | 开源后泄露内部信息 | 脱敏后执行全局关键词扫描验证 |
| 归档文档中的 Issue 编号失去追溯性 | 内部开发历史断链 | 仅移除 URL，保留编号作为参考 |
