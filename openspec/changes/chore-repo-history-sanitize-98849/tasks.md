## 1. GitHub 仓库重命名

- [ ] 1.1 登录 GitHub，进入 `y3-editor/y3-helper` 仓库 Settings
- [ ] 1.2 在 "Repository name" 中将名称改为 `y3-helper-old`，确认 rename
- [ ] 1.3 立即将 `y3-helper-old` 设为 Private（Settings → Danger Zone → Change visibility）

## 2. 本地准备干净仓库

- [ ] 2.1 在本地创建新的临时目录，例如 `y3-helper-clean`
- [ ] 2.2 将当前最新代码复制到新目录中（**不要复制 `.git` 目录**）
- [ ] 2.3 在新目录中执行 `git init` 初始化仓库
- [ ] 2.4 执行 `git add .` 和 `git commit -m "Initial commit"` 创建唯一提交
- [ ] 2.5 验证 `git log` 只有一条提交记录

## 3. GitHub 创建新仓库并推送

- [ ] 3.1 在 GitHub 上 `y3-editor` organization 下创建新仓库 `y3-helper`（设为 Private）
- [ ] 3.2 本地执行 `git remote add origin https://github.com/y3-editor/y3-helper.git`
- [ ] 3.3 执行 `git branch -M main` 确保分支名为 `main`
- [ ] 3.4 执行 `git push -u origin main` 推送到远端

## 4. 验证

- [ ] 4.1 访问 `https://github.com/y3-editor/y3-helper`，确认只有 1 条 commit
- [ ] 4.2 确认新仓库代码内容与旧仓库最新版本一致
- [ ] 4.3 确认 `y3-helper-old` 仍为 Private 可访问（内部使用）
- [ ] 4.4 确认旧仓库的 Git 历史完整保留在 `y3-helper-old` 中

## 5. 后续处理（由管理员决定）

- [ ] 5.1 按需将新仓库 `y3-helper` 设为 Public
- [ ] 5.2 通知团队成员重新 clone 新仓库
- [ ] 5.3 更新 CI/CD 配置（如有引用仓库名）
