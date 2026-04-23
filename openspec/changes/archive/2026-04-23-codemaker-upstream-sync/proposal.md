## Why

Y3Maker 基于 CodeMaker 源码进行开发，包含 webview 前端（来自 `codemaker-web-ui` 仓库）和 extension 扩展逻辑（来自 `codestream-vscode-extension` 仓库）。CodeMaker 在持续迭代，Y3Maker 需要定期从上游同步新功能和修复。

当前的移植方式是手动对比、手动复制，存在以下问题：
- **无法追踪"上次同步到哪个版本"**，每次移植都要重新对比全量代码
- **不知道上游改了什么**，容易漏掉重要更新或引入不需要的功能
- **手动合并容易出错**，覆盖 Y3Maker 自有定制代码的风险很高
- **没有验证机制**，合并后不确定功能是否正确

需要一套工程化的同步工具来解决这个问题。

## What Changes

- **新增同步分析脚本** (`scripts/sync-upstream.ts`)：从两个上游仓库拉取 diff，自动分类变更项（安全区/定制区/新功能/已排除），生成结构化的同步报告
- **新增同步配置体系** (`.codemaker/sync/`)：包含路径映射规则 (`config.json`)、基准版本 (`baseline.json`)、排除清单 (`exclusions.json`)、本地敏感配置 (`config.local.json`, gitignored)
- **新增 AI 引导合并流程**：基于同步报告，AI 逐项展示 diff 和建议，工程师逐项确认后执行合并
- **新增验证机制**：合并完成后自动进行编译检查和消息协议一致性校验
- **每次同步限制最多处理一天的上游提交**，避免一次合并过多变更导致混乱

### 核心流程

1. **Phase 1 - ANALYZE**：脚本自动运行，拉取上游 diff，生成 `last-sync-report.md/json`，不修改任何文件
2. **Phase 2 - MERGE**：AI 引导逐项处理报告中的每个变更，工程师对每项选择采纳/跳过/部分采纳，支持中断后继续
3. **Phase 3 - VERIFY**：编译验证 + 消息协议一致性检查 + 更新基准版本

### 上游基准

- webui (`codemaker-web-ui`): `10be173b` (2026-03-02)
- extension (`codestream-vscode-extension`): `fbf9134f` (2026-03-04)

## Capabilities

### New Capabilities
- `upstream-sync-analyze`: 上游变更分析能力 — 从两个上游仓库获取 diff，按路径映射分类变更项，生成结构化同步报告
- `upstream-sync-merge`: 引导式合并能力 — 基于同步报告逐项展示 diff 和建议，支持采纳/跳过/部分采纳，支持中断恢复
- `upstream-sync-verify`: 合并验证能力 — 编译检查、消息协议一致性校验、基准版本更新
- `upstream-sync-config`: 同步配置管理 — 路径映射、排除清单、基准版本追踪、敏感信息隔离

### Modified Capabilities
(无现有 capability 被修改)

## Impact

- **新增文件**:
  - `scripts/sync-upstream.ts` — 同步分析脚本入口
  - `.codemaker/sync/config.json` — 路径映射和分类规则
  - `.codemaker/sync/config.local.json` — 本地敏感配置 (gitignored)
  - `.codemaker/sync/baseline.json` — 基准版本记录
  - `.codemaker/sync/exclusions.json` — 排除功能清单
  - `.codemaker/sync/last-sync-report.md` — 最近一次同步报告
  - `.codemaker/sync/last-sync-report.json` — 报告的机器可读版本
  - `.codemaker/sync/merge-progress.json` — 合并进度文件
- **修改文件**:
  - `.gitignore` — 添加 `config.local.json` 等敏感文件的忽略规则
  - `package.json` — 添加 `sync:analyze` 等 npm scripts
- **依赖**:
  - 外部仓库: `codemaker-web-ui`, `codestream-vscode-extension` (本地 clone)
  - Node.js 内置: `child_process` (git 命令), `fs`, `path`
  - 无新增 npm 依赖 (使用原生 Node.js + git CLI)