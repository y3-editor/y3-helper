## Context

Y3Maker 从 CodeMaker 的两个上游仓库移植代码：
- **codemaker-web-ui** → `resources/webview_source_code/`（前端 React 源码，本地编译）
- **codestream-vscode-extension** → `src/codemaker/`（VSCode 扩展逻辑，选择性移植）

当前移植现状：
- Webview 前端基本 1:1 复制，仅有 `stubs/`（桩替代内部监控库）和构建配置是 Y3 定制
- Extension 部分大幅重写：上游 ~111 个消息 case，Y3 实现了 ~63 个，裁剪了 ~48 个
- 上游无 server 部分需要同步（Y3 自写 `apiServer.ts`）
- Y3Helper 是外放仓库，配置中的内部仓库 URL 等信息不能入库

约束：
- 每次同步最多处理一天的上游提交
- 所有文件变更都需要人工确认（保守策略），不做自动覆盖
- 同步工具本身的代码和配置需要区分敏感/非敏感

## Goals / Non-Goals

**Goals:**
- 精确追踪"上次同步到哪个上游版本"，支持增量同步
- 自动分析上游变更并分类（安全区/定制区/新功能/已排除）
- 生成结构化的同步报告，供人工审阅和 AI 引导合并
- 合并过程支持中断恢复（不需要一次性处理完所有变更）
- 合并完成后自动验证编译正确性和消息协议一致性
- 敏感信息（仓库 URL、本地路径）不入库

**Non-Goals:**
- 不做全自动合并（所有变更都需人工确认）
- 不处理 server 端同步（api-server 是 Y3 完全自写）
- 不做上游仓库的 git 操作（不 push、不 merge，只读取 diff）
- 不做运行时功能测试（仅做编译检查和协议一致性校验）

## Decisions

### D1: 使用 Node.js 脚本 + git CLI（而非 git subtree/submodule）

**选择**: 独立的 `scripts/sync-upstream.ts` 脚本，通过 `child_process.execSync` 调用 git 命令

**原因**:
- git subtree/submodule 要求上游代码按原始目录结构保留，但 Y3Maker 对 extension 部分做了大幅重组（上游 `src/provider/webviewProvider/index.ts` 拆成了 `webviewProvider.ts` + `messageHandlers.ts`）
- 脚本方式灵活，可以处理复杂的路径映射和分类逻辑
- 脚本可以生成人类可读的报告

**替代方案**: git subtree — 放弃，因为目录结构不对应，会导致更多冲突而非更少

### D2: 两阶段分离（分析 vs 合并）

**选择**: Phase 1 (ANALYZE) 只读不写，输出报告；Phase 2 (MERGE) 基于报告逐项合并

**原因**:
- 分析和合并的关注点不同：分析是确定性的（git diff），合并需要判断
- 分离后可以先审阅报告，再决定何时开始合并
- 合并可以中断恢复，不需要重新分析

### D3: "一天限额"通过 git log 按日期切片实现

**选择**: 分析时用 `git log --after=<baseline_date> --before=<baseline_date + 1day>` 获取目标 commit 范围

**原因**:
- 一天的提交量可控，通常 1-10 个 commit
- 按自然日切片直观易理解
- 如果某天提交量特别大，仍然全部处理（粒度是"天"不是"commit 数"）

**实现细节**:
```
baseline date: 2026-03-02
→ 找 03-02 ~ 03-03 之间的最后一个 commit 作为目标
→ diff: baseline_commit..target_commit
→ 合并完成后更新 baseline 为 target_commit
→ 下次运行: 找 03-03 ~ 03-04 之间的 commit
→ 如此循环直到追上 HEAD
```

### D4: 文件分类规则

**选择**: 四级分类体系

| 分类 | 判定条件 | 处理方式 |
|------|---------|---------|
| 🟢 SAFE | 有直接路径映射 且 不在 customized 列表中 | Phase 2 展示 diff，建议覆盖，人工确认 |
| 🟡 REVIEW | 在 customized 列表中 或 在 upstream_watch 列表中 | Phase 2 展示双向 diff，AI 分析差异，人工决策 |
| 🔴 NEW | 上游新增的文件/目录/消息类型，不在任何映射或排除列表中 | Phase 2 展示功能描述，询问是否采纳 |
| ⚪ SKIP | 在 exclusions 列表中 或 在 excluded_upstream 列表中 | 自动跳过，仅在报告中列出 |

**分类优先级**: SKIP > SAFE > REVIEW > NEW（先检查排除列表，再检查映射）

### D5: 消息类型变更的特殊检测

**选择**: 对上游 `webviewProvider/index.ts` 的 diff，提取新增/修改/删除的 `case 'XXX'` 语句，与 Y3Maker 的 `messageHandlers.ts` 交叉对比

**原因**:
- 消息类型是前后端协议的核心，新增消息类型意味着新功能
- 可以精确判断"Y3 已有" vs "需要新增" vs "已排除"
- 这个检测结果直接影响 🔴 NEW 分类

### D6: 敏感信息分层

**选择**: 
- `config.json`（入库）: 只含路径映射规则，不含 URL
- `config.local.json`（gitignored）: 含仓库 URL 和本地 clone 路径
- 首次运行时，如果 `config.local.json` 不存在，脚本交互式引导创建

### D7: 合并进度追踪

**选择**: `merge-progress.json` 文件，记录每个变更项的处理状态

**结构**:
```jsonc
{
  "report_id": "2026-04-22T16:30:00",    // 关联哪份报告
  "target_date": "2026-03-03",           // 这轮同步的目标日期
  "total": 15,
  "completed": 7,
  "items": {
    "1": { "status": "accepted", "action": "copy", "note": "" },
    "2": { "status": "skipped", "note": "不需要此功能" },
    "3": { "status": "partial", "note": "只合并了新增字段" },
    // ...
  }
}
```

## Risks / Trade-offs

### [R1: 路径映射可能不完整] → 持续维护 config.json

初始的路径映射可能遗漏部分文件。新增文件会被归类为 🔴 NEW，在合并时需要人工判断是否需要添加映射。

**缓解**: 每次同步后如果发现新的映射关系，更新 config.json。

### [R2: "一天限额"可能导致追赶缓慢] → 可批量跳过

从 3/2 到现在约 50 天，如果有些天没有提交，脚本自动跳到下一个有提交的日期。对于明确不需要的整天提交，可以直接跳过。

**缓解**: 提供 `--skip-to-date` 参数快速跳过多天。

### [R3: Extension 的复杂映射关系] → 重点关注 webviewProvider 和 messageHandlers

上游的 `webviewProvider/index.ts` 是一个 3000+ 行的巨型文件，Y3Maker 拆成了 `webviewProvider.ts` + `messageHandlers.ts`。这种 1:N 映射在 diff 对比时需要特殊处理。

**缓解**: 对这类文件，Phase 2 时 AI 需要同时展示 Y3 的两个文件内容，判断上游的变更应该合入哪个文件。

### [R4: 前端依赖版本差异] → package.json 需人工对比

上游 `package.json` 的依赖可能与 Y3Maker 的 `webview_source_code/package.json` 不完全一致。自动覆盖可能引入兼容性问题。

**缓解**: `package.json` 始终归类为 🟡 REVIEW，展示 diff 由人工决策。