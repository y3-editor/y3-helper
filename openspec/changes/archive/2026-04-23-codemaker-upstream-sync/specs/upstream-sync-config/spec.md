## ADDED Requirements

### Requirement: 路径映射配置
系统 SHALL 通过 `config.json` 文件定义上游路径到 Y3 路径的映射规则，包含直接映射、目录映射和通配符映射。

#### Scenario: 直接文件映射
- **WHEN** `config.json` 中 `file_mapping` 包含 `"src/utils/file.ts": "src/codemaker/utils/file.ts"`
- **THEN** 上游 `src/utils/file.ts` 的变更映射到 Y3 的 `src/codemaker/utils/file.ts`

#### Scenario: 目录映射
- **WHEN** `config.json` 中 `mapping` 包含 `"src/": "resources/webview_source_code/src/"`
- **THEN** 上游 `src/` 下所有文件的变更，映射到 Y3 的 `resources/webview_source_code/src/` 对应路径

### Requirement: 定制文件列表管理
系统 SHALL 通过 `customized` 列表标记 Y3 有定制修改的文件，这些文件不会被自动归类为 SAFE。

#### Scenario: 定制文件被修改
- **WHEN** 上游修改了 `vite.config.ts` 且该文件在 `customized` 列表中
- **THEN** 该文件归类为 🟡 REVIEW，需要人工对比

### Requirement: 排除清单管理
系统 SHALL 通过 `exclusions.json` 记录明确不需要的上游功能/文件/消息类型，包含排除原因。

#### Scenario: 查看排除原因
- **WHEN** 工程师查看 `exclusions.json`
- **THEN** 每个排除项都有对应的原因说明（如 "Y3Maker用本地凭证，不需要登录流程"）

#### Scenario: 新增排除项
- **WHEN** Phase 2 中工程师对某变更选择"永久排除"
- **THEN** 系统将该项追加到 `exclusions.json`，包含工程师输入的排除原因

### Requirement: 基准版本追踪
系统 SHALL 通过 `baseline.json` 记录两个上游仓库各自的最后同步 commit hash 和日期。

#### Scenario: 首次初始化基准
- **WHEN** `baseline.json` 不存在或为空
- **THEN** 系统提示输入初始 baseline commit，或使用 `config.json` 中预设的初始值

#### Scenario: 基准版本更新
- **WHEN** 一轮同步的 Phase 3 验证通过
- **THEN** `baseline.json` 更新为本轮同步的目标 commit

### Requirement: 敏感信息隔离
系统 SHALL 将仓库 URL 和本地 clone 路径等敏感信息存储在 `config.local.json` 中，该文件通过 `.gitignore` 排除。

#### Scenario: 首次运行引导
- **WHEN** `config.local.json` 不存在，运行同步脚本
- **THEN** 脚本交互式引导创建 `config.local.json`，要求输入两个上游仓库的本地路径

#### Scenario: 敏感文件不被追踪
- **WHEN** `config.local.json` 存在
- **THEN** 该文件被 `.gitignore` 排除，不会被提交到 git 仓库