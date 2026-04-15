## Why

[#98849](https://up1.pm.netease.com/v6/issues/98849)

Y3Helper 项目（https://github.com/y3-editor/y3-helper）已完成代码脱敏，但 Git 历史提交记录中仍保留了包含敏感信息的文件快照。攻击者可以通过浏览历史 commit 的 diff 查看到已删除的敏感内容。需要通过重建仓库的方式彻底清除历史记录中的敏感信息。

## What Changes

- **GitHub 仓库重命名**：将 `y3-editor/y3-helper` 重命名为 `y3-editor/y3-helper-old`，保留内部团队使用
- **创建全新仓库**：以当前最新脱敏代码为唯一初始提交，创建新的 `y3-editor/y3-helper` 仓库
- **权限设置**：新旧仓库均设为 Private，由管理员按需调整可见性

## Capabilities

### New Capabilities

_(无新增功能模块，本次变更为基础设施运维操作)_

### Modified Capabilities

_(无功能变更。仅对 Git 仓库进行历史清洗，不改变任何代码逻辑。)_

## Impact

### 影响范围

| 对象 | 影响说明 |
|------|---------|
| GitHub 仓库 URL | 不变，仍为 `https://github.com/y3-editor/y3-helper` |
| Git 提交历史 | 新仓库仅有 1 条 Initial commit，历史 commit 全部清除 |
| Issues / PRs | 不保留（当前无需保留） |
| Stars / Watchers | 不保留 |
| GitHub Actions | 不保留（当前无需保留） |
| 已有 fork / clone | 需重新 clone |
| 旧仓库 `y3-helper-old` | Private 保留，内部团队可继续访问完整历史 |

### 风险

- rename 和 create 之间存在短暂窗口期，URL 会 404（预计几分钟内完成）
- 外部已 clone 的用户需要重新 clone（因历史不兼容，`git pull` 会报错）
