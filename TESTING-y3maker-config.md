# Y3Maker 配置拉取 · 手测步骤

对应改动：`.y3maker` 的四状态判定（managed / foreign / partial / missing）、偏好 `ask` / `always` / `never`、
partial 的三选一弹窗、后台只做增量动作、时间戳备份（同一秒内撞名自动加序号）、先克隆到暂存目录再替换，
以及**弹窗里的选择只对本次生效、不会替你改偏好**。

> 图示：`y3maker-state-matrix.png`。对应关系：本文 A/B/C 组 = 图里入口 A/B/C；本文 D 组 = 图里第 3 节；
> 本文 E/F 组 = 图里第 2、5 节；本文 G 组 = 图里没写、需要你拍板的观察项。

## 0. 先跑这 6 条（冒烟，约 10 分钟）

| 编号 | 一句话 | 覆盖 |
| --- | --- | --- |
| A2 | 偏好 `ask` 时点「取消」，什么都不该发生，也**不该改设置** | 不写设置 |
| A4 | 偏好 `always` 时不再弹窗 | 静默路径 |
| B1 | 删掉 `.y3maker` 后重载窗口，自动补回来 | 后台增量 |
| B6 | 偏好 `never` 时不联网、不显示更新节点 | 不碰的边界 |
| D1 | partial 选「合并」，自己的文件必须还在 | 最危险的一条 |
| E1 | 断网时选「备份并替换」，项目必须原样 | 回滚 |

另外，动作层的逻辑已经有自动化用例（`src/test/suite/y3makerConfig.test.ts`，26 条），跑法：

```powershell
npx tsc -p tsconfig.json && node ./out/test/runTest.js
```

它覆盖状态判定、合并、备份并替换、失败回滚、更新检查门槛和偏好默认值——**夹具自造、离线可重复**。
所以下面这份手工清单的重点是自动化够不到的部分：弹窗按钮与文案、主菜单节点显隐、面板即时刷新、真实工程里的目录占用。
D 组和 E 组的动作逻辑可以当作"自动化已覆盖"的复核，不必再手工造两遍。

## 1. 前置准备

### 1.1 安装待测版本

1. 在 `C:\Users\wb.lixinyan03\Desktop\y3-helper` 下打包（或直接用已生成的）：
   `npx --yes @vscode/vsce package -o y3-helper-2.4.0-y3maker-config-optional.vsix`
2. 安装并强制覆盖：`code --install-extension y3-helper-2.4.0-y3maker-config-optional.vsix --force`
   （若提示找不到 `code` 命令，就用扩展面板右上角 `...` → “从 VSIX 安装…”选这个文件）。
3. `Ctrl+Shift+P` → `Developer: Reload Window`；在扩展面板里确认 “Y3开发助手” 版本是 **2.4.0**。
   注意别让它连上市场版本：装好后再确认一次版本号，避免测的是旧版。

### 1.2 两个测试项目

- **项目 P（已初始化）**：正常能打开、侧边栏“Y3开发助手”有内容、`<项目>/script/y3/.git` 存在的 Y3 工程。
  没现成的话，复制一份现有工程即可。**B/C/D/E/F 组都在 P 上跑。**
- **项目 Q（未初始化）**：复制 P，然后删掉/改名 `<项目>/script/y3`（开启全局脚本时是 `<项目>/global_script/y3`）。
  **只有 A 组需要它。**

> ⚠️ A 组会真的去 clone `y3-lualib`，需要联网；且每次跑完都要把 `script/y3` 再删一次，
> 否则 `initProject` 会直接提示“此项目已经初始化过了！”。

### 1.3 偏好怎么改（注意：扩展自己不会改它）

- 改：`Ctrl+,` → 搜 `CloneY3MakerConfig` → 选 `ask` / `always` / `never`（**用户**页签）。
- 确认写入：`Ctrl+Shift+P` → `Preferences: Open User Settings (JSON)`，找 `"Y3-Helper.CloneY3MakerConfig"`。
- **扩展永远不会替你写这个键**：初始化弹窗里的「拉取」/「取消」只对那一次生效，所以测试 A 组时可以顺便断言
  "选择前后 `Preferences: Open User Settings (JSON)` 里都没有这个键"。
- 如果你在项目的 `.vscode/settings.json` 里也写了同一个键，工作区值会盖住用户值——测试前先确认自己要测的是哪一层。
- 建议基线：测试开始时把用户级这个键**删掉**（恢复默认 `ask`），否则已有的 `never`/`always` 会直接改变后面的现象。

### 1.4 观察点在哪

| 要看什么 | 在哪看 |
| --- | --- |
| 提示 / 弹窗 | VS Code 右下角通知，或屏幕中央的模态框 |
| 静默失败（暂存克隆、状态判定） | 输出面板 → 通道 **Y3开发助手**（英文界面下叫 `CliCli-Helper`；`y3.log.warn` 写在这里） |
| 可见的 clone 任务 | 终端面板 → TERMINAL 里的 task（`拉取 Y3Maker 配置`。只要发生拉取就会出现，和初始化 y3-lualib 一样有 git 实时进度；出错时那段红色报错也在这里，日志里只记简短原因，不再复制 git 原文） |
| 后台有没有 fetch | `<项目>/.y3maker/.git/FETCH_HEAD` 的修改时间 |
| 面板是否即时刷新 | 侧边栏 Y3Maker/CodeMaker 面板的 Skills / Rules 列表 |
| 目录到底变成什么了 | 资源管理器看 `.y3maker`、`.y3maker.staging`、`.y3maker.bak-*` |

### 1.5 怎么把项目摆成四种状态（在项目根目录执行）

```powershell
# missing：目录不存在
Remove-Item -Recurse -Force .y3maker -ErrorAction SilentlyContinue

# partial：有目录、没 .git（模拟面板写过东西 / 初始化半途失败）
Remove-Item -Recurse -Force .y3maker -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force .y3maker | Out-Null
'{ "mcpServers": {} }' | Set-Content -Encoding utf8 .y3maker\mcp_settings.json
New-Item -ItemType Directory -Force .y3maker\skills\my-skill | Out-Null
'我的技能' | Set-Content -Encoding utf8 .y3maker\skills\my-skill\SKILL.md

# managed：正常的我们管理的仓库
Remove-Item -Recurse -Force .y3maker -ErrorAction SilentlyContinue
git clone https://github.com/y3-editor/y3-maker-config.git .y3maker

# foreign：是 git 仓库但不是我们的
Remove-Item -Recurse -Force .y3maker -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force .y3maker | Out-Null
git -C .y3maker init
git -C .y3maker remote add origin https://github.com/your-name/my-own-repo.git

# managed 但落后一个提交（用来触发“Y3Maker 配置需要更新！”）
git -C .y3maker reset --hard HEAD~1

# 随时看状态
git -C .y3maker status --short
```

### 1.6 远端仓库 `y3-maker-config` 到底长什么样（写断言时按这个来）

顶层（`main` 分支，约 327 个被跟踪文件，数字会随远端更新变化）：

| 顶层条目 | 说明 |
| --- | --- |
| `mcp_settings.json`、`spec-config.json`、`.gitattributes`、`.gitignore` | 文件 |
| `knowledge/`（约 35 个）、`templates/`（约 93 个）、`skills/`（约 181 个） | 最大的三个目录 |
| `rules/`（7 个 `.mdc`，如 `mcp-rules.mdc`）、`memory/`（4 个）、`docs/`（1 个）、`tools/`（2 个） | 其余目录 |

写断言时优先挑这些稳定存在的路径：`mcp_settings.json`、`rules/mcp-rules.mdc`、`knowledge/README.md`、`skills/README.md`。

## 2. A 组 · 初始化入口

入口：命令面板 `初始化开发环境`（等同侧边栏“初始化Y3库”节点）。在**项目 Q** 上跑。

> 流程固定顺序：选仓库来源（中文界面才有）→ 克隆 y3-lualib → **[本功能的弹窗]** → 重载窗口。
> 所以每组用例都可能顺带触发 B 组行为，注意看重载之后发生了什么。

### A1 · 偏好 `ask` → 点「拉取」
1. 项目 Q 摆成 `missing`，偏好设 `ask`。
2. 跑初始化，等 y3-lualib 克隆完。
3. 弹出 `要拉取 Y3Maker 配置吗？`，说明文字应是“会在项目根目录创建 .y3maker，用来存放规则、技能和 MCP 配置。想让以后的项目不再问，可在设置里改 CloneY3MakerConfig。”，按钮是 `拉取` / `取消`（`取消` 由 VS Code 自动补，代码里没有这一项，所以**不应该出现两个取消**）。
4. 点 `拉取`。
- **预期**：出现“正在拉取 Y3Maker 配置...”进度；结束后弹 `Y3Maker 配置拉取完成。`；
  **设置不该被动过**（`Preferences: Open User Settings (JSON)` 里仍然没有 `Y3-Helper.CloneY3MakerConfig`，除非你之前手工设过）；
  `.y3maker` 存在且 `git -C .y3maker status` 干净；
  项目根目录**没有** `.y3maker.bak-*`（没有东西可备份）。

### A2 · 偏好 `ask` → 点「取消」
1. 重复 A1 到弹窗出现，点 `取消`。
- **预期**：弹 `已跳过 Y3Maker 配置。可点主菜单的“Y3Maker 配置未初始化”拉取，或在设置里改 CloneY3MakerConfig。`；
  **设置不该被动过**（弹窗里的选择只对这一次生效）；**不创建** `.y3maker`；初始化继续正常完成、窗口重载。

### A2b · 重复一次初始化，确认“不被记住”
1. 接着 A2，再跑一次初始化（记得先删掉 `script/y3`）。
- **预期**：**仍然会弹** `要拉取 Y3Maker 配置吗？`（说明上次的取消没有被记成长期偏好）。

### A3 · 偏好 `ask` → 直接关掉弹窗（Esc / 右上角 ×）
1. 重复 A1 到弹窗出现，直接关掉。
- **预期**：现象与 A2 完全一致（不拉取、不改设置、提示同一句）；不创建 `.y3maker`；
  重载后主菜单出现 `Y3Maker 配置未初始化（点击拉取）`。

### A4 · 偏好 `always`
1. 项目 Q 摆成 `missing`，偏好设 `always`，跑初始化。
- **预期**：**不弹**“要拉取 Y3Maker 配置吗？”，克隆完直接就把 `.y3maker` 拉好；无跳过提示。

### A5 · 偏好 `never`
1. 项目 Q 摆成 `missing`，偏好设 `never`，跑初始化。
- **预期**：**不弹**任何 Y3Maker 弹窗；直接出现那条“已跳过…”提示；不创建 `.y3maker`。

### A6 · 偏好 `always` + 目录已是 partial
1. 先手工把项目 Q 摆成 `partial`（1.5 的脚本），偏好设 `always`，跑初始化。
- **预期**：`always` **不能**绕过危险动作——仍然弹出 `.y3maker 已存在，但不是 git 仓库。要怎么处理？`，
  且说明里列出目录现有的条目（应能看到 `mcp_settings.json`、`skills/`），按钮为 `合并` / `备份并替换` / `取消`。
2. 选 `取消`。
- **预期**：什么都不做，`.y3maker` 原样；初始化继续完成。

### A7 · 初始化收尾
1. 用 A1 或 A4 把一个项目完整跑通。
- **预期**：窗口自动重载；重载后**不应该**再出现任何弹窗，也不该再 clone（因为 `.y3maker` 已经是 managed）；
  主菜单里两个 Y3Maker 节点（未初始化 / 需要更新）都不显示。

## 3. B 组 · 每次打开项目（后台）

每条都：摆好状态 → 设好偏好 → `Developer: Reload Window` → 观察。

### B1 · `always` + `missing` → 自动补回
1. 项目 P 摆成 `missing`，偏好 `always`，重载窗口。
- **预期**：终端里能看到 `克隆 Y3Maker 配置` 任务并成功；`.y3maker` 出现且是 managed（`Test-Path .y3maker\rules\mcp-rules.mdc` 为 `True`）；
  Y3Maker 面板的 Skills/Rules 随之刷新（不需要再手动重载）。

### B2 · `always` + `partial` → 不碰
1. 摆成 `partial`（放一个 `skills/my-skill/SKILL.md`），偏好 `always`，重载。
- **预期**：**没有**任何 git 任务、**没有**弹窗；`.y3maker/skills/my-skill/SKILL.md` 内容原样（没被搬走）；
  主菜单出现 `Y3Maker 配置待处理（点击）`，悬停提示“点击可选合并或备份并替换”。

### B3 · `always` + `foreign` → 不碰
1. 摆成 `foreign`，偏好 `always`，重载。
- **预期**：无动作、无弹窗、无备份目录；主菜单里**不显示**任何 Y3Maker 条目
  （foreign 既不是 missing 也不是 partial）。

### B4 · `always` + `managed` → 只检查更新
1. 摆成 `managed`（且不落后），偏好 `always`，重载。
- **预期**：`.y3maker/.git/FETCH_HEAD` 的时间被更新（说明 fetch 执行了）；没有“需要更新”节点。
2. 再摆成“落后一个提交”，重载。
- **预期**：主菜单出现 `Y3Maker 配置需要更新！`，描述里显示短的 hash 变化。

### B5 · `ask` / `never` + `missing` → 什么都不做
1. 摆成 `missing`，偏好分别设 `ask`、`never`，各重载一次。
- **预期**：两次都**不** clone；`.y3maker` 仍然不存在；主菜单出现 `Y3Maker 配置未初始化（点击拉取）`。

### B6 · `never` + `managed` → 不联网
1. 摆成 `managed`，记录 `.y3maker\.git\FETCH_HEAD` 的修改时间，偏好设 `never`，重载。
- **预期**：`FETCH_HEAD` 时间**没变**（没 fetch）；主菜单没有“需要更新”节点；
  即使远端有更新也不会提示。

## 4. C 组 · 主菜单节点

### C1 · `partial` 时的节点
- **前置**：`partial`，偏好任意（含 `always`）。
- **预期**：节点文字 `Y3Maker 配置待处理（点击）`。

### C2 · `missing` 时的节点
- **前置**：`missing` + `y3/.git` 存在；偏好 `ask` 或 `never`。
- **预期**：节点文字 `Y3Maker 配置未初始化（点击拉取）`，悬停“点击把 Y3Maker 配置拉到项目里”。
- **再加一步**：把偏好改成 `always` 并重载，节点应消失（后台会自动补，不需要入口）。

### C3 · `missing` → 点节点
1. 点 `Y3Maker 配置未初始化（点击拉取）`。
- **预期**：先弹 **`从哪里拉取 Y3Maker 配置？`**（按钮 `Github（可能需要代理）` / `Gitee（国内镜像）` / `取消`，
  说明里有 Gitee 拉不到大文件的提醒）——**不再根据 y3 仓库的 remote 自动决定**；
  选 Github 或 Gitee 之后才开始拉取（终端里出现 `拉取 Y3Maker 配置` 任务）；成功提示 `Y3Maker 配置拉取完成。`；
  节点随后消失；项目根目录没有 `.y3maker.bak-*`。

### C3b · 在来源弹窗里选「取消」
1. 重复 C3，在 `从哪里拉取 Y3Maker 配置？` 里点 `取消`（或按 Esc）。
- **预期**：什么都不做——不 clone、不改偏好、不创建 `.y3maker`、节点照旧显示。

### C4 · `partial` → 点节点
1. `partial` 里放 1~2 个文件，点 `Y3Maker 配置待处理（点击）`。
- **预期**：**先**弹 `从哪里拉取 Y3Maker 配置？`（选 `取消` 就到此为止），
  选好来源后**再**弹 `.y3maker 已存在，但不是 git 仓库。要怎么处理？`，说明第一行是 `里面现有 N 项：…`（最多列 6 个名字）。
  也就是 partial 状态下会连着问两个：先"从哪拉"，再"怎么处理"。
2. 把 `.y3maker` 清空成一个空目录，再点一次。
- **预期**：说明第一行变成 `目录是空的`。

### C5 · `managed` / `foreign` 时不显示节点
- **预期**：两种情况主菜单里都没有 Y3Maker 节点。

### C6 · 点节点不改偏好
1. 偏好设 `ask`，`missing` 状态下点节点拉取成功。
- **预期**：设置里仍然是 `ask`（点击不会写成 `always`）。

## 5. D 组 · partial 的两个动作

### D1 · 合并：保留自己的文件、补齐缺的
1. 摆成 `partial`：放 `skills/my-skill/SKILL.md`（内容 `我的技能`），并把 `mcp_settings.json` 内容改成 `{ "mine": true }`。
2. 点节点 → 选 `合并`。
- **预期**：提示 `已合并：补上了缺少的文件，你的文件没动。`
- **预期（保留）**：`mcp_settings.json` 仍然是 `{ "mine": true }`；`skills/my-skill/SKILL.md` 仍然是 `我的技能`。
- **预期（补齐）**：因为本地已经有 `skills/` 和 `mcp_settings.json` 这两个顶层条目，它们**整目录跳过**；
  新出现的是本地没有的顶层条目：`rules/`、`knowledge/`、`templates/`、`tools/`、`memory/`、`docs/`、
  `spec-config.json`、`.gitattributes`、`.gitignore`。
- ⚠️ **这就是当前“合并”的粒度：只按顶层补齐**，所以本地一旦存在 `skills/`，远端的 181 个技能文件**不会**被合并进来。
  见第 8 节 G5。

### D1b · 合并：本地只有 `mcp_settings.json`
1. 摆成 `partial`，但只放一个 `mcp_settings.json`（不要建 `skills/`），然后选 `合并`。
- **预期**：除了保留 `mcp_settings.json`，远端的 `skills/`、`rules/` 等顶层目录这次会被补进来；
  `Test-Path .y3maker\skills\README.md`、`Test-Path .y3maker\rules\mcp-rules.mdc` 都为 `True`。

### D2 · 合并后的 git 状态
1. 接着 D1 执行：
   `git -C .y3maker remote -v` / `git -C .y3maker branch -vv` / `git -C .y3maker status --short` / `git -C .y3maker log --oneline -1`
- **预期**：origin 指向 `y3-maker-config`；当前分支 `main` 且 upstream 是 `origin/main`；
  HEAD 与 `origin/main` 同一个提交；`status` 里能看到：
  ` M mcp_settings.json`（被跟踪文件被改，显示为**本地修改**）、
  `?? skills/my-skill/`（远端没有的文件显示为**未跟踪**）。

### D2b · 合并后能 pull 吗
1. 接着 D2，直接跑 `git -C .y3maker pull`。
- **预期**：能连通并正常返回（没有分叉时输出 `Already up to date.`）；
  说明合并后的目录确实是一个可用的 git 仓库，而不是只在磁盘上补了文件。

### D3 · 面板即时刷新
1. 执行 D1 时让 Y3Maker 面板保持可见。
- **预期**：动作结束后 Skills / Rules 列表立即更新，无需重载窗口；输出面板里没有目录被占用的报错。

### D4 · 备份并替换
1. 摆成 `partial`，点节点 → 选 `备份并替换`。
- **预期**：提示 `拉取成功，原内容已备份到 .y3maker.bak-<时间戳>`；
  该备份目录里能找到你原来的 `skills/`、`mcp_settings.json`；
  新的 `.y3maker` 是干净的一份（`git -C .y3maker status` 无输出、origin 指向 `y3-maker-config`）；
  项目根目录没有残留 `.y3maker.staging`。
- **具体断言**：`Test-Path .y3maker\skills\README.md`、`Test-Path .y3maker\rules\mcp-rules.mdc`、
  `Test-Path .y3maker\knowledge\README.md` 都为 `True`；
  `(git -C .y3maker ls-files | Measure-Object).Count` 与远端一致（当前约 327）。

### D5 · 备份不互相覆盖
1. 连续做两次“备份并替换”（第二次前先在 `.y3maker` 里改个文件，让它有内容）。
- **预期**：出现**两个**不同的 `.y3maker.bak-<时间戳>` 目录，第一次的备份内容仍在。

### D6 · 合并之后能正常更新
1. 接 D1，让远端有一个新提交（直接把 `.y3maker` 里的 HEAD 往回 reset 一个提交模拟落后）：
   `git -C .y3maker reset --hard HEAD~1`，然后重载窗口。
- **预期**：主菜单出现“Y3Maker 配置需要更新！”；点它执行 pull。
  （若因本地修改导致冲突，走下面 F2 的流程——这是预期内的。）

## 6. E 组 · 异常与回滚

### E1 · 断网 + 备份并替换 → 项目必须原样（**最重要**）
1. 摆成 `partial`（放一个 `skills/my-skill/SKILL.md`），断开网络（或把系统代理指向一个黑洞端口）。
2. 点节点 → 选 `备份并替换`。
- **预期**：弹 `拉取 Y3Maker 配置失败，请检查网络或 git 环境。`；
  `.y3maker` 里的文件**原封不动**；**没有**生成 `.y3maker.bak-*`；**没有**残留 `.y3maker.staging`；
  输出面板 `Y3开发助手` 里有克隆失败的 warn 日志。

### E2 · 断网 + 合并 → 同样原样
1. 断网，点节点 → 选 `合并`。
- **预期**：同 E1（不生成备份是正常的，因为合并本来不备份）。

### E3 · 残留的 `.y3maker.staging`
1. 手工建一个 `.y3maker.staging`，里面随便放个文件；然后正常执行一次（合并或备份并替换）。
- **预期**：动作开始前这个残留目录被清掉；结束后不残留。

### E4 · 备份目录撞名（已修，做复核即可）
1. 在**同一秒内**连续触发两次“备份并替换”（手工很难点这么快，可借脚本连点两次节点；自动化用例已覆盖这条）。
- **预期**：第二次的备份目录自动加序号（`.y3maker.bak-<时间戳>-2`），**两个备份都在**，内容各自独立——
  不会再出现"后一次覆盖前一次备份"。
- 旧版本（2026-09-23 之前打的包）在这里会撞名覆盖，如果你手上还有旧包可以对照。

### E5 · 备份搬移中途失败
1. 摆成 `partial`，用一个外部程序（或资源管理器）占住其中一个文件，然后执行“备份并替换”。
- **预期**：弹失败提示；**可能**出现“原目录里少了文件、备份目录里多了一部分”的半搬移状态——
  这是当前实现已知的弱点（备份本身不是原子的），需要手工把文件从 `.y3maker.bak-*` 搬回去。请务必记录实际现象。

### E6 · foreign / partial 时强行触发“更新配置”命令

> 这两条内部命令不在命令面板里，需要临时绑一个快捷键来强行调用（测完记得删）：
> `Ctrl+Shift+P` → `Preferences: Open Keyboard Shortcuts (JSON)`，加：
> `{ "key": "ctrl+alt+u", "command": "y3-helper.updateY3MakerConfig" }` 和
> `{ "key": "ctrl+alt+l", "command": "y3-helper.cloneY3MakerConfig" }`

1. 摆成 `managed` 且落后一个提交，重载 → 确认“Y3Maker 配置需要更新！”节点出现（说明节点本身是好的）。
2. 切成 `foreign` 并重载 → 按 `Ctrl+Alt+U`。
- **预期**：**没有**任何进度提示、**没有**弹窗、`.y3maker` 完全没被动过
  （`git -C .y3maker log --oneline -1` 没变、`status` 没变）；节点也不显示。
3. 摆成 `partial`，按 `Ctrl+Alt+L` → 应正常弹出三选一（说明这个快捷键确实能调起命令，上面那次静默返回是真的被拦住了）。
- **预期**：弹窗正常出现；选 `取消` 什么都不做。

### E7 · 远端有 LFS 资产、而托管方不给下（真实踩到过的坑）
> **2026-09-23 起这条已经无法复现**：远端把那个大文件删了、`.gitattributes` 也去掉了（HEAD `b9253889`），
> 现在仓库里最大的 zip 只有 12,471 字节。保留这一条是为了记住当时的现象与修法，不用再手工跑。

- 当时的现象：Gitee 镜像的 LFS 拒绝下载 128.29 MB 的 `roguelike-survival/editor_decoration.zip`
  （`LFS only supported repository in paid or trial enterprise`），git 报 `smudge filter lfs failed` 并返回非 0；
  旧构建直接判失败（"拉取 Y3Maker 配置失败"），现在会**容忍**这种非致命失败（终端里能看到红色报错，
  输出面板里留一句 `拉取 y3-maker-config 已成功，但 LFS 资产没下下来（会用占位文件代替）…`）。
- 这条容忍逻辑对应的自动化用例：`远端资产是 LFS 占位指针时，拉取仍然成功`（夹具模拟，不依赖真仓库）。

## 7. F 组 · 回归（不能被这次改动破坏）

### F1 · 正常的配置更新流程（`managed`）
1. 摆成“落后一个提交”，重载 → 主菜单点 `Y3Maker 配置需要更新！`。
- **预期**：进度提示后弹 `Y3Maker 配置已更新成功！`；“需要更新”节点消失；`git -C .y3maker log --oneline -1` 已是最新。

### F2 · 更新冲突
1. 在 `.y3maker` 里改一个远端也会改的文件，再让远端前进（或本地 reset 造成分叉），触发更新。
  最简单的造法：`git -C .y3maker reset --hard HEAD~1`（落后一个提交），再改一个该提交动过的文件（例如 `mcp_settings.json`）。
- **预期**：弹 `Y3Maker 配置更新时发生冲突，请选择处理方式：`，按钮 `使用远端版本` / `自行解决`。
  选前者 → `Y3Maker 配置已强制更新到远端版本！`；选后者 → 提示到终端手动处理。
- ⚠️ 这里只验证“老流程没被破坏”。注意 `performUpdate` 对**任何**失败都当成冲突，而且“使用远端版本”会
  `reset --hard` 丢掉本地改动——见第 8 节 G6，那是既有行为，本次没改。

### F3 · 全局脚本开与关
1. 分别在做用全局脚本和不用全局脚本的项目里各跑一次 B1。
- **预期**：判断基准始终是 `y3/.git`（用全局脚本时即 `global_script/y3/.git`）；两种形态下行为一致。

### F4 · 英文界面
1. 把 `Y3-Helper.Language` 设为 `en`，重载，再触发一次“初始化 → ask 弹窗”和“partial 弹窗”。
- **预期**：弹窗标题/按钮/说明都是英文（`Pull the Y3Maker config?`、`Pull`、`Not now`、`Merge`、`Back up and replace`、`Later`）；
  这两个弹窗里不应出现中英混排。
- 说明：更新冲突那几条老文案本来就没进英文语言包，不在本次检查范围内（本次只覆盖上面两个弹窗相关的新文案）。

### F5 · 面板与 MCP 健康
1. 先做一次“备份并替换”（得到一份完整的远端配置），再打开 Y3Maker 面板看 Skills / Rules 列表，
   并触发一次 MCP 重连（面板里刷新或重启连接）。
- **预期**：Skills 列表能列出远端自带的技能（例如 `eca-json-builder`），Rules 列表能列出 `rules/*.mdc`；
  没有重复条目、没有“文件被占用 / EPERM”之类的报错；替换后的 `mcp_settings.json` 能被读出来。
- **再测一次退化场景**：把 `.y3maker` 删掉并保持 `ask` 偏好重载。
- **预期**：面板 Skills 列表为空但**不报错**，主菜单显示未初始化节点（静默降级）。

## 8. G 组 · 观察项（需要你判断，不一定是 bug）

| 编号 | 现象 | 需要你决定的问题 |
| --- | --- | --- |
| G1 | 偏好 `never` + `managed`：因为不 fetch，主菜单不会出现“需要更新”，也没有别的手动更新入口 | 要不要给一个“即使 never 也能手动更新一次”的入口？ |
| G2 | 机器上没装 git（或 git 不在 PATH）时，带 `.git` 的目录会被判成 `foreign`，提示文案会误导 | 要不要在判定失败时换一条更准确的提示？ |
| G3 | 备份目录只增不删，长期会攒出多个 `.y3maker.bak-*` | 要不要限制保留代数（例如只留最近 3 个）？ |
| G4 | 合并后本地差异会一直显示为“本地修改”，以后 pull 可能需要处理冲突（走 F2 流程） | 能否接受；还是希望合并时把冲突文件也一并交给用户挑？ |
| G5 | 合并只按**顶层条目**补齐：本地一旦有 `skills/`，远端那 181 个技能文件就完全不会合并进来（`rules/`、`knowledge/` 同理） | 这符合你要的“合并”吗？还是要改成逐文件补齐（缺什么补什么、同名保留本地）？ |
| G6 | 更新（`managed` 那条老链路）对**任何**失败都弹“发生冲突”对话框；且“使用远端版本”会 `reset --hard` 直接丢掉本地改动 | 要不要区分真冲突与其他失败，并在丢弃前提一次确认/先备份？ |
| G7 | ~~`y3-maker-config` 用 Git LFS 存了一个 128.3 MB 的地形模板 zip，Gitee 镜像拉不到~~ | **已修复（2026-09-23）**：远端删掉了那个 zip、`.gitattributes` 里的 LFS 路由也去掉了，HEAD `b9253889`，两个镜像同步；仓库里剩下最大的 zip 是 12,471 字节。客户端这边：手动拉取由用户自己选来源（Github / Gitee / 取消，弹窗里不再带 Gitee 提醒）、保留"容忍非致命克隆失败"的兜底 |
| G8 | 历史提交里仍是 LFS 指针 | 只影响 checkout 到旧提交（新 clone 只取 HEAD，不受影响），不用处理 |

## 9. 收尾

```powershell
# 清掉测试残留（在项目根目录）
Remove-Item -Recurse -Force .y3maker.bak-* -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .y3maker.staging -ErrorAction SilentlyContinue
# 偏好还原
# 用户设置里删掉 "Y3-Helper.CloneY3MakerConfig"，或改回 "ask"
```

## 10. 记录表

| 编号 | 结果 | 实际现象 / 截图 | 备注 |
| --- | --- | --- | --- |
| A1 |  |  |  |
| A2 |  |  |  |
| A2b |  |  |  |
| A3 |  |  |  |
| A4 |  |  |  |
| A5 |  |  |  |
| A6 |  |  |  |
| A7 |  |  |  |
| B1 |  |  |  |
| B2 |  |  |  |
| B3 |  |  |  |
| B4 |  |  |  |
| B5 |  |  |  |
| B6 |  |  |  |
| C1 |  |  |  |
| C2 |  |  |  |
| C3 |  |  |  |
| C3b |  |  |  |
| C4 |  |  |  |
| C5 |  |  |  |
| C6 |  |  |  |
| D1 |  |  |  |
| D1b |  |  |  |
| D2 |  |  |  |
| D2b |  |  |  |
| D3 |  |  |  |
| D4 |  |  |  |
| D5 |  |  |  |
| D6 |  |  |  |
| E1 |  |  |  |
| E2 |  |  |  |
| E3 |  |  |  |
| E4 |  |  |  |
| E5 |  |  |  |
| E6 |  |  |  |
| F1 |  |  |  |
| F2 |  |  |  |
| F3 |  |  |  |
| F4 |  |  |  |
| F5 |  |  |  |
| G1~G6 |  |  |  |
