# 03 - 发布流程（GitHub）

## 1. 概述

GitHub 公开版通过 **GitHub Actions** 实现自动化 CI/CD。共有两条 workflow：

| Workflow 文件 | 触发条件 | 做什么 |
|--------------|---------|--------|
| `build.yml` | 推送到 `main` 分支 | 构建 `.vsix` 并上传为 Artifact（不发布） |
| `publish.yml` | 推送 Tag（如 `v1.2.3`） | 构建 `.vsix`、创建 GitHub Release、发布到 VSCode 市场 |

---

## 2. build.yml — 构建流程（每次推送 main 触发）

```yaml
on:
  push:
    branches:
      - main
    tags-ignore:
      - '*'   # 推送 tag 时不走这条（由 publish.yml 处理）
```

**执行步骤：**

```
推送 main 分支
    │
    ▼
actions/checkout@v4         # 拉取代码
    │
    ▼
setup-node@v3 (node >= 24)  # 安装 Node.js
    │
    ▼
npm install                  # 安装依赖
npm install -g typescript    # 安装全局 tsc
tsc -p ./                    # TypeScript 类型检查（输出到 out/）
    │
    ▼
npm install -g @vscode/vsce  # 安装打包工具
vsce package -o y3-helper-{SHA}.vsix  # 打包（内部调用 webpack --mode production）
    │
    ▼
upload-artifact@v4           # 上传 .vsix 为 GitHub Artifact（可下载）
```

> **注意**：这里的 `tsc -p ./` 只是做类型检查，不是生产构建。实际产物由 `vsce package` 内部调用的 `webpack --mode production` 生成。

---

## 3. publish.yml — 发布流程（推送 Tag 触发）

```yaml
on:
  push:
    tags:
      - '*'   # 任意 tag，如 v1.2.3
```

**执行步骤：**

```
推送 Tag（如 git tag v1.2.3 && git push origin v1.2.3）
    │
    ▼
actions/checkout@v4 (ref: main)   # 拉取 main 分支代码（不是 tag 的代码）
    │
    ▼
setup-node + npm install + tsc    # 同 build.yml
    │
    ▼
vsce package -o y3-helper-{tag}.vsix {tag}
    │  同时：
    │  - git commit -a -m "更新package-lock.json"  # 如有变化则提交 lock 文件
    │  - git pull && git push
    │
    ▼
upload-artifact@v4          # 上传 Artifact
    │
    ▼
softprops/action-gh-release  # 创建 GitHub Release，附加 .vsix 文件
    │
    ▼
vsce publish -i {vsix} -p {VSCODE_TOKEN}  # 发布到 VSCode 插件市场
```

---

## 4. 如何发布新版本

### 第一步：更新版本号

修改 `package.json` 中的 `version` 字段：

```json
{
    "version": "1.22.0"  // 修改为新版本号
}
```

> 版本号遵循语义化版本（SemVer）：`主版本.次版本.补丁版本`

### 第二步：提交并推送到 main

```bash
git add package.json
git commit -m "chore: bump version to 1.22.0"
git push origin main      # 或 git push github main
```

> 推送 main 后 `build.yml` 会自动触发，可在 GitHub Actions 页面确认构建成功。

### 第三步：打 Tag 并推送

```bash
git tag v1.22.0
git push origin v1.22.0   # 或 git push github v1.22.0
```

> 推送 Tag 后 `publish.yml` 自动触发，完成发布。

---

## 5. 所需 Secrets 配置

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中需要配置以下两个密钥：

| Secret 名称 | 用途 | 获取方式 |
|------------|------|---------|
| `VSCODE_TOKEN` | 发布到 VSCode 插件市场 | 在 [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) 创建 PAT |
| `Y3_COMMIT_TOKEN` | 推送 package-lock.json 到仓库 | 在 GitHub 创建有 `repo` 权限的 PAT |

---

## 6. 常见问题

### Q：发布后插件市场没有更新？
检查 `VSCODE_TOKEN` 是否过期，以及 `package.json` 中的 `publisher` 字段是否与市场账号一致（当前为 `sumneko`）。

### Q：build.yml 构建失败，报 TypeScript 错误？
在本地运行 `tsc -p ./` 确认能通过，再推送。常见原因是第三方库类型不兼容，可通过 `tsconfig.json` 的 `skipLibCheck: true` 解决。

### Q：vsce package 失败，提示某些文件丢失？
检查 `.vscodeignore` 文件，确保 `dist/extension.js`、`3rd/` 等必要文件没有被排除。

### Q：内网版如何手动发布到 GitHub？
```bash
# 确保已添加 github remote
git remote add github https://github.com/y3-editor/y3-helper

# 推送代码和 tag
git push github main
git push github v1.22.0
```
