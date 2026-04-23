## ADDED Requirements

### Requirement: 按日期切片获取上游 diff
系统 SHALL 读取 `baseline.json` 中记录的上次同步 commit，然后在上游仓库中找到 baseline 日期后一天内的最后一个 commit，计算两个 commit 之间的 diff。

#### Scenario: 正常获取一天的 diff
- **WHEN** baseline 为 commit `abc123` (日期 2026-03-02)
- **THEN** 系统在上游仓库找到 03-02 ~ 03-03 之间的最后一个 commit（如 `def456`），计算 `abc123..def456` 的 diff

#### Scenario: 目标日期无提交
- **WHEN** baseline 日期后一天内没有任何提交
- **THEN** 系统自动向后查找，直到找到有提交的日期，使用该日期范围内的最后一个 commit

#### Scenario: 已追上最新版本
- **WHEN** baseline commit 就是上游 HEAD
- **THEN** 系统报告"已是最新版本，无需同步"

### Requirement: 变更文件分类
系统 SHALL 对 diff 中的每个变更文件，按以下优先级分类：SKIP > SAFE > REVIEW > NEW

#### Scenario: 排除列表中的文件
- **WHEN** 变更文件路径匹配 `config.json` 中的 `excluded_upstream` 或 `exclusions.json` 中的条目
- **THEN** 该文件被分类为 ⚪ SKIP

#### Scenario: 有直接映射且非定制的文件
- **WHEN** 变更文件有明确的路径映射关系（在 `mapping` 或 `file_mapping` 中）且不在 `customized` 列表中
- **THEN** 该文件被分类为 🟢 SAFE

#### Scenario: 定制区域内的文件
- **WHEN** 变更文件在 `customized` 或 `upstream_watch` 列表中
- **THEN** 该文件被分类为 🟡 REVIEW

#### Scenario: 未知文件
- **WHEN** 变更文件不匹配任何映射、排除或监控规则
- **THEN** 该文件被分类为 🔴 NEW

### Requirement: 消息类型变更检测
系统 SHALL 在分析 extension 仓库的 diff 时，提取上游 `webviewProvider/index.ts` 中新增、修改和删除的 `case 'XXX'` 语句，并与 Y3Maker 的 `messageHandlers.ts` 中已有的 case 进行交叉对比。

#### Scenario: 上游新增了 Y3 已有的 case
- **WHEN** 上游新增 case `FOO` 且 Y3Maker 已有 case `FOO`
- **THEN** 该消息类型标记为 ⏭️ EXISTS

#### Scenario: 上游新增了 Y3 没有的 case
- **WHEN** 上游新增 case `BAR` 且 Y3Maker 没有 case `BAR` 且 `BAR` 不在排除列表中
- **THEN** 该消息类型标记为 🔴 NEW

#### Scenario: 上游新增了已排除的 case
- **WHEN** 上游新增 case `BAZ` 且 `BAZ` 在 `exclusions.json` 的 `excluded_message_types` 中
- **THEN** 该消息类型标记为 ⚪ SKIP

### Requirement: 生成结构化同步报告
系统 SHALL 生成两份报告：`last-sync-report.md`（人类可读）和 `last-sync-report.json`（机器可读），包含所有变更项及其分类。

#### Scenario: 报告内容完整
- **WHEN** 分析完成
- **THEN** 报告包含：概览统计表、SAFE 列表（含上游路径和 Y3 路径）、REVIEW 列表（含原因）、NEW 列表（含功能描述）、SKIP 列表（含排除原因）

#### Scenario: 报告不修改任何文件
- **WHEN** Phase 1 ANALYZE 运行
- **THEN** 除了报告文件本身，Y3Helper 仓库中没有任何文件被修改

### Requirement: 同时处理两个上游仓库
系统 SHALL 同时分析 webui 和 extension 两个上游仓库的变更，合并到同一份报告中。

#### Scenario: 两个仓库都有变更
- **WHEN** 目标日期内 webui 有 3 个文件变更，extension 有 5 个文件变更
- **THEN** 报告中包含全部 8 个变更项，按仓库分组显示