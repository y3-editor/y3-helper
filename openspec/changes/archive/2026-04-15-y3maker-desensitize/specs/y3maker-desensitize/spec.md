## ADDED Requirements

### Requirement: WebView 前端源码脱敏

Y3Maker WebView 前端源码中的内部企业邮箱描述和示例用户名 SHALL 被替换为通用描述，不得包含任何内部系统特定的标识信息。

#### Scenario: ChatMaskManageModel 文案脱敏

- **WHEN** 查看 `ChatMaskManageModel.tsx` 中 `__USER__` 变量的说明文案
- **THEN** 文案 SHALL 显示为 `: 获取当前用户名`，不得包含 `corp邮箱前缀` 或 `gzxiaoming` 等内部信息

#### Scenario: ChatPromptManageModel 文案脱敏

- **WHEN** 查看 `ChatPromptManageModel.tsx` 中 `__USER__` 变量的说明文案
- **THEN** 文案 SHALL 显示为 `: 获取当前用户名`，不得包含 `corp邮箱前缀` 或 `gzxiaoming` 等内部信息

#### Scenario: 脱敏后功能不受影响

- **WHEN** 用户在 Y3Maker 中使用 `__USER__` 变量
- **THEN** 变量的实际取值逻辑 SHALL 保持不变，仅变更 UI 文案描述

### Requirement: WebView 编译产物重新构建

修改 WebView 前端源码后，编译产物 SHALL 被重新构建，确保编译后的 JavaScript 文件中不残留任何脱敏前的敏感字符串。

#### Scenario: 编译产物不含敏感字符串

- **WHEN** WebView 源码修改完成并重新构建
- **THEN** `resources/codemaker/webview/assets/` 下的所有 `.js` 文件中 SHALL 不包含 `corp邮箱`、`gzxiaoming` 等敏感字符串

#### Scenario: 编译产物功能完整

- **WHEN** 重新构建后的 WebView 编译产物被加载
- **THEN** Y3Maker 的所有前端功能 SHALL 正常运行，与脱敏前行为一致

### Requirement: OpenSpec 归档文档脱敏

OpenSpec 归档 proposal 文档中的内部 PM 系统链接 SHALL 被移除或替换，但保留 Issue 编号作为参考。

#### Scenario: 归档 proposal 中的 Issue 链接脱敏

- **WHEN** 查看 `openspec/changes/archive/*/proposal.md` 中的 Issue 引用
- **THEN** 完整的 `https://up1.pm.netease.com/v6/issues/XXXXX` URL SHALL 被移除，仅保留 `#XXXXX` 编号引用

#### Scenario: 品牌迁移历史文档脱敏

- **WHEN** 查看 `openspec/changes/archive/2026-04-08-rename-codemaker-to-y3maker/` 目录下的文档
- **THEN** 所有内部 PM 系统链接 SHALL 被移除或替换

#### Scenario: OpenSpec 配置不受影响

- **WHEN** 脱敏完成后使用 OpenSpec 工作流
- **THEN** `openspec/config.yaml` SHALL 保持不变，PM 系统链接模板功能正常

### Requirement: 项目说明文档脱敏

`PR_DESCRIPTION.md` 中的内部团队相关描述 SHALL 被替换为通用的开源项目描述。

#### Scenario: PR 文档标题脱敏

- **WHEN** 查看 `PR_DESCRIPTION.md` 标题
- **THEN** SHALL 不包含"网易内部"等企业特定描述

#### Scenario: PR 文档内容脱敏

- **WHEN** 查看 `PR_DESCRIPTION.md` 正文
- **THEN** SHALL 不包含"网易内部团队"等内部组织描述，改为通用的开源贡献说明

### Requirement: 脱敏验证

脱敏完成后 SHALL 执行全局关键词扫描，验证 Y3Maker 模块范围内不再包含已识别的敏感信息。

#### Scenario: 关键词扫描通过

- **WHEN** 对 Y3Maker 相关目录（`src/codemaker/`、`resources/webview_source_code/`、`resources/codemaker/`、`openspec/changes/`）执行关键词扫描
- **THEN** SHALL 不匹配到 `corp邮箱`、`gzxiaoming`、`网易内部` 等敏感关键词

#### Scenario: 非脱敏范围不受影响

- **WHEN** 对 Y3Helper 核心模块（如 `src/tools/`）执行关键词扫描
- **THEN** 即使存在已知的敏感信息（如 `version.ts` 中的 CDN 地址），SHALL 不做任何修改，因为这些已经过之前开源验证
