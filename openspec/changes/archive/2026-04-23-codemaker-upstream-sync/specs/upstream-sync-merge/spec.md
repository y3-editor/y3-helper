## ADDED Requirements

### Requirement: 逐项展示变更并引导决策
系统 SHALL 读取 `last-sync-report.json`，按分类顺序逐项展示每个变更项的 diff 和上下文，引导工程师做出决策。

#### Scenario: 展示 SAFE 类变更
- **WHEN** 处理 🟢 SAFE 类变更项
- **THEN** 系统展示上游文件的 diff 内容，以及 Y3 对应文件的当前内容，建议"直接覆盖"，等待工程师确认

#### Scenario: 展示 REVIEW 类变更
- **WHEN** 处理 🟡 REVIEW 类变更项
- **THEN** 系统展示上游 diff、Y3 对应文件的当前内容、以及两者的差异分析，由工程师决定采纳方式

#### Scenario: 展示 NEW 类变更
- **WHEN** 处理 🔴 NEW 类变更项
- **THEN** 系统展示新增功能的描述和代码，询问工程师是否需要此功能

### Requirement: 每个变更项支持四种决策
工程师 SHALL 对每个变更项选择以下操作之一：采纳（覆盖/合并）、跳过（本次不处理）、部分采纳（手动调整）、永久排除（加入排除清单）。

#### Scenario: 采纳变更
- **WHEN** 工程师选择"采纳"
- **THEN** 系统将上游文件的最新内容复制到 Y3 对应路径，记录状态为 `accepted`

#### Scenario: 跳过变更
- **WHEN** 工程师选择"跳过"
- **THEN** 系统不做任何文件修改，记录状态为 `skipped`

#### Scenario: 部分采纳
- **WHEN** 工程师选择"部分采纳"
- **THEN** 系统提示工程师手动编辑文件，记录状态为 `partial` 及备注

#### Scenario: 永久排除
- **WHEN** 工程师选择"永久排除"
- **THEN** 系统将该文件/功能加入 `exclusions.json`，记录状态为 `excluded`，后续同步不再提示

### Requirement: 合并进度可中断恢复
系统 SHALL 在每处理完一个变更项后，将进度写入 `merge-progress.json`。下次启动时从上次中断的位置继续。

#### Scenario: 中断后恢复
- **WHEN** Phase 2 处理到第 5 项时中断，下次重新启动 Phase 2
- **THEN** 系统读取 `merge-progress.json`，跳过已完成的前 4 项，从第 5 项开始继续

#### Scenario: 全部完成
- **WHEN** 所有变更项都已处理
- **THEN** 系统提示"所有变更项已处理完成，可以进入 Phase 3 验证"

### Requirement: Extension 1:N 映射的特殊处理
系统 SHALL 对上游 `webviewProvider/index.ts` 的变更，同时展示 Y3Maker 的 `webviewProvider.ts` 和 `messageHandlers.ts` 两个文件，帮助判断变更应合入哪个文件。

#### Scenario: 上游 webviewProvider 的消息处理逻辑变更
- **WHEN** 上游 `webviewProvider/index.ts` 中某个 case 的处理逻辑发生变更
- **THEN** 系统展示 Y3Maker `messageHandlers.ts` 中对应 case 的当前实现，并建议修改方案