# CodeMaker 上游同步工具

将 CodeMaker 源码的更新持续同步到 Y3Maker (Y3Helper) 中。

## 架构

```
CodeMaker 上游仓库                          Y3Helper
┌─────────────────────┐                    ┌─────────────────────┐
│ codemaker-web-ui    │ ──→ webview src ──→ │ resources/          │
│ (前端 React)        │                    │   webview_source_   │
│                     │                    │   code/src/         │
├─────────────────────┤                    ├─────────────────────┤
│ codestream-vscode-  │ ──→ extension  ──→ │ src/codemaker/      │
│ extension           │                    │                     │
│ (VSCode 扩展)       │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

## 三阶段流程

### Phase 1: ANALYZE（分析） — 自己在终端跑
```bash
npm run sync:analyze
# 指定仓库（不指定时自动选优先级高的）：
npm run sync:analyze -- --repo webui
npm run sync:analyze -- --repo extension
# 跳过到某天：
npm run sync:analyze -- --skip-to-date 2026-04-01
```

- **单仓库模式**：每次只分析一个仓库的变更（webui 优先于 extension）
- 同一天两个仓库都处理完才能推进到下一天
- 从上游仓库 fetch 最新代码
- 找到 baseline 后下一天的提交（一天限额）
- 计算 diff 并分类每个变更文件
- 为 SAFE/REVIEW 项提取完整 diff 和上游文件内容
- 生成报告：`.codemaker/sync/last-sync-report.md` 和 `.json`
- **不修改任何 Y3Helper 代码**

### Phase 2: MERGE（合并） — AI 在对话中驱动

**不再使用命令行**。在 AI 对话中说：

> "帮我合并上游同步报告"
> "读取同步报告开始合并"

> [!IMPORTANT]
> **AI 必须先执行 `npm run sync:analyze`，不能直接读取旧的 `last-sync-report.json` 来分析！**
> 报告文件在合并完成后不会自动清理，下次对话时可能读到过时数据。
> 正确流程：先跑 analyze → 确认报告内容是最新的 → 再开始合并。

AI 会：
1. **先执行 `npm run sync:analyze`**，确保报告是基于最新 baseline 生成的
2. 读取 `.codemaker/sync/last-sync-report.json`（含完整 diff）
3. **SAFE 项**：AI 直接用 `upstream_content` 覆盖 Y3 文件
4. **REVIEW 项**：见下方 [REVIEW 项合并规则](#review-项合并规则)
5. **NEW 项**：AI 判断是否与 Y3 相关，给出建议，你确认后执行
6. **复杂冲突**：AI 标记出来，你用 git merge 工具手动处理

#### REVIEW 项合并规则

> [!CRITICAL]
> **REVIEW ≠ 跳过！REVIEW = 需要人工审查的智能合并。**

REVIEW 项表示 Y3 对该文件有定制修改，**但上游的新改动仍然需要合并进来**。正确处理方式：

1. **读取上游 diff**：理解上游改了什么（新功能、bug 修复、新增枚举值等）
2. **读取 Y3 当前文件**：理解 Y3 定制了哪些部分
3. **逐项判断每个 diff hunk**：
   - 上游改动与 Y3 定制部分无关 → **直接合并**
   - 上游改动与 Y3 定制部分冲突 → **手动调和**（保留 Y3 定制逻辑，适配上游的新接口/参数）
   - 上游引入了 Y3 不存在的模块依赖 → **替换为 Y3 的等价实现或内联**
   - 上游新增了枚举值/类型 → **通常应该合并**（Y3 的定制枚举也要保留）
4. **绝对不能因为文件有定制就整个跳过**，否则会永久落后于上游

#### 删除文件/目录的规则

> [!CRITICAL]
> **不要因为编译报错就直接删除整个目录！**

如果上游同步进来的文件导致编译错误（缺少依赖模块），正确处理方式：

1. **检查该目录是否被其他已同步文件引用**（如 import 关系）
2. 如果有引用 → **保留被引用的工具文件**（如 `utils.ts`），排除独立的页面组件
3. 如果确实完全不需要 → 加入 `exclusions.json` 的 `excluded_upstream_dirs`
4. 同时检查引用方，做好适配（内联、stub、或条件 import）

### Phase 3: VERIFY（验证） — 自己在终端跑
```bash
npm run sync:verify
```

- 编译检查（webview + extension）
- 消息协议一致性校验
- 验证通过后自动更新 baseline

## 首次配置

1. 确保已 clone 两个上游仓库到本地
2. 创建 `.codemaker/sync/config.local.json`（已 gitignored）：
```json
{
  "webui": {
    "repoUrl": "ssh://git@...",
    "localPath": "H:/codemaker/codemaker-web-ui",
    "branch": "develop"
  },
  "extension": {
    "repoUrl": "ssh://git@...",
    "localPath": "H:/codemaker/codestream-vscode-extension",
    "branch": "develop"
  }
}
```
3. `baseline.json` 已配置好初始基准版本

## 日常使用

```bash
# 1. 分析（自动选一个仓库，webui 优先）
npm run sync:analyze

# 2. 在 AI 对话中合并该仓库的变更
# 说："帮我合并上游同步报告"

# 3. 验证 + 更新基准
npm run sync:verify

# 4. 再次 analyze 处理同一天的另一个仓库（如有）
npm run sync:analyze

# 5. 合并 + 验证另一个仓库

# 6. 重复直到追上最新版本
```

> **同一天约束**：两个仓库的提交可能无关联，分开处理更清晰。
> 如果发现某个仓库的变更依赖另一个仓库的内容，先合并被依赖方。

## 文件变更分类

| 分类 | 含义 | 处理方式 |
|------|------|---------|
| 🟢 SAFE | 有映射且 Y3 未修改 | AI 直接覆盖 |
| 🟡 REVIEW | Y3 有定制修改 | AI 智能合并 + 你 review |
| 🔴 NEW | 上游新增,Y3 没有 | AI 给建议,你决定 |
| ⚪ SKIP | 在排除列表中 | 自动跳过 |

## 配置文件说明

| 文件 | 入库 | 用途 |
|------|------|------|
| `config.json` | ✅ | 路径映射和分类规则 |
| `config.local.json` | ❌ | 仓库 URL 和本地路径（敏感） |
| `baseline.json` | ✅ | 上次同步的 commit |
| `exclusions.json` | ✅ | 排除功能清单 |
| `last-sync-report.*` | ✅ | 最近一次分析报告（含完整 diff） |

## FAQ

**Q: 一天没有提交怎么办？**
A: 脚本自动跳到下一个有提交的日期。

**Q: 某个功能确定不需要？**
A: 告诉 AI "永久排除这个文件"，AI 会更新 exclusions.json。

**Q: 怎么快速跳过很多天？**
A: `npm run sync:analyze -- --skip-to-date 2026-04-15` 直接跳到指定日期。

**Q: AI 合并的结果不对怎么办？**
A: 用 git 撤销 AI 的改动，然后自己用 git merge 工具处理。

**Q: 遇到复杂冲突怎么办？**
A: AI 会标记复杂项，你用 VS Code 或其他 git merge 工具手动处理。