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
# 或指定跳过到某天：
npm run sync:analyze -- --skip-to-date 2026-04-01
```

- 从两个上游仓库 fetch 最新代码
- 找到 baseline 后下一天的提交（一天限额）
- 计算 diff 并分类每个变更文件
- 为 SAFE/REVIEW 项提取完整 diff 和上游文件内容
- 生成报告：`.codemaker/sync/last-sync-report.md` 和 `.json`
- **不修改任何 Y3Helper 代码**

### Phase 2: MERGE（合并） — AI 在对话中驱动

**不再使用命令行**。在 AI 对话中说：

> "帮我合并上游同步报告"
> "读取同步报告开始合并"

AI 会：
1. 读取 `.codemaker/sync/last-sync-report.json`（含完整 diff）
2. **SAFE 项**：AI 直接用 `upstream_content` 覆盖 Y3 文件
3. **REVIEW 项**：AI 读取 diff + Y3 当前文件，智能合并（保留 Y3 定制，采纳上游改动），然后让你 review
4. **NEW 项**：AI 判断是否与 Y3 相关，给出建议，你确认后执行
5. **复杂冲突**：AI 标记出来，你用 git merge 工具手动处理

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
# 1. 分析下一天的变更
npm run sync:analyze

# 2. 查看报告
# 打开 .codemaker/sync/last-sync-report.md

# 3. 在 AI 对话中合并
# 说："帮我合并上游同步报告"

# 4. 验证 + 更新基准
npm run sync:verify

# 5. 重复 1-4 直到追上最新版本
```

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