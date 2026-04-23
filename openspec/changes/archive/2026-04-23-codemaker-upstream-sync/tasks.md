## 1. 同步配置体系搭建 (.codemaker/sync/)

- [x] 1.1 创建 `.codemaker/sync/config.json` — 路径映射和分类规则（webui 和 extension 两部分），包含 `mapping`、`file_mapping`、`customized`、`y3_only`、`excluded_upstream` 字段
- [x] 1.2 创建 `.codemaker/sync/exclusions.json` — 初始排除清单，包含所有已知不需要的消息类型和上游目录（基于 explore 阶段的分析结果）
- [x] 1.3 创建 `.codemaker/sync/baseline.json` — 初始基准版本记录（webui: `10be173b` / extension: `fbf9134f`）
- [x] 1.4 创建 `.codemaker/sync/config.local.json` — 本地敏感配置模板（仓库 URL 和本地 clone 路径）
- [x] 1.5 更新 `.gitignore` — 添加 `.codemaker/sync/config.local.json`、`.codemaker/sync/*.diff`、`.codemaker/sync/merge-progress.json` 的忽略规则

## 2. Phase 1 分析脚本 (scripts/sync-upstream.ts) — 核心框架

- [x] 2.1 创建 `scripts/sync-upstream.ts` 入口文件，解析命令行参数（`analyze` / `verify`），加载配置文件
- [x] 2.2 实现 `loadConfig()` — 读取 `config.json` + `config.local.json` + `baseline.json` + `exclusions.json`，首次运行时交互式引导创建 `config.local.json`
- [x] 2.3 实现 `gitHelper` 模块 — 封装 `execSync` 调用 git 命令（`git log`、`git diff`、`git show` 等），处理路径和编码

## 3. Phase 1 分析脚本 — 日期切片和 diff 获取

- [x] 3.1 实现 `findNextSyncTarget()` — 基于 baseline commit 日期，找到下一天内的最后一个 commit；如果该天无提交则自动向后查找
- [x] 3.2 实现 `getDiffFiles()` — 获取 `baseline..target` 之间的变更文件列表（文件路径 + 变更类型: modified/added/deleted/renamed）
- [x] 3.3 实现"已追上 HEAD"检测 — 如果 baseline 就是 HEAD，报告"已是最新版本"

## 4. Phase 1 分析脚本 — 变更分类

- [x] 4.1 实现 `classifyChange()` — 对每个变更文件按优先级 SKIP > SAFE > REVIEW > NEW 进行分类
- [x] 4.2 实现路径映射匹配 — 支持直接文件映射 (`file_mapping`)、目录前缀映射 (`mapping`)、Y3 独有文件排除 (`y3_only`)
- [x] 4.3 实现消息类型变更检测 — 对上游 `webviewProvider/index.ts` 提取 `case 'XXX'` 变更，与 Y3Maker `messageHandlers.ts` 交叉对比
- [x] 4.4 实现"已有等价实现"检测 — 上游新增的 case 如果在 Y3Maker 中已存在则标记为 EXISTS

## 5. Phase 1 分析脚本 — 报告生成

- [x] 5.1 实现 `generateReport()` — 生成 `last-sync-report.json`（结构化数据，含每个变更项的 id、分类、路径、变更类型、状态）
- [x] 5.2 实现 `generateMarkdownReport()` — 生成 `last-sync-report.md`（人类可读报告，含概览统计表和分类列表）
- [x] 5.3 在 `package.json` 中添加 `"sync:analyze": "ts-node scripts/sync-upstream.ts analyze"` npm script

## 6. Phase 2 合并引导（AI Skill 或脚本交互）

- [x] 6.1 实现 `mergeRunner` 模块 — 读取 `last-sync-report.json` 和 `merge-progress.json`（如存在），确定下一个待处理项
- [x] 6.2 实现 SAFE 类变更的处理流程 — 展示上游 diff + Y3 当前文件内容，提供覆盖/跳过选项
- [x] 6.3 实现 REVIEW 类变更的处理流程 — 展示上游 diff + Y3 当前文件内容 + 差异分析，提供采纳/跳过/部分采纳/排除选项
- [x] 6.4 实现 NEW 类变更的处理流程 — 展示新功能描述，提供采纳/跳过/排除选项
- [x] 6.5 实现文件复制/覆盖操作 — 从上游仓库目标 commit 的文件复制到 Y3 对应路径
- [x] 6.6 实现进度持久化 — 每处理一项立即写入 `merge-progress.json`，支持中断恢复
- [x] 6.7 实现 Extension 1:N 映射特殊处理 — 上游 `webviewProvider/index.ts` 变更时同时展示 Y3 的 `webviewProvider.ts` 和 `messageHandlers.ts`

## 7. Phase 3 验证脚本

- [x] 7.1 实现 webview 编译检查 — 执行 `cd resources/webview_source_code && npm run build`，捕获并报告结果
- [x] 7.2 实现 extension 编译检查 — 执行项目根目录的 `npm run compile` 或 tsc 编译，捕获并报告结果
- [x] 7.3 实现消息协议一致性校验 — grep 前端 `postMessage` 调用提取消息类型集合，与后端 `case` 集合交叉对比
- [x] 7.4 实现基准更新 — 验证通过后更新 `baseline.json` 中的 commit hash 和日期
- [x] 7.5 在 `package.json` 中添加 `"sync:verify": "ts-node scripts/sync-upstream.ts verify"` npm script

## 8. 集成测试和文档

- [x] 8.1 端到端测试 — 使用已知的 baseline 和目标 commit 运行完整的 analyze → merge → verify 流程，确认报告正确、合并正确、验证通过
- [x] 8.2 编写 `scripts/README-sync.md` — 使用说明文档，包含首次配置、日常使用流程、常见问题解答
