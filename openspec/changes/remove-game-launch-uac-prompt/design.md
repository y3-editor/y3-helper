## Context

### 为什么不能沿用现有启动方式

| 方案 | 结果 |
|---|---|
| `vscode.tasks.executeTask` 直接启动 exe（现状，`src/runShell.ts:3`） | 中完整性 → 每次弹 UAC |
| `child_process.spawn` | 同样中完整性，且 spawn 不会触发提权 |
| `Start-Process -Verb RunAs <exe>` | 仍有 UAC，且拿不到退出码/stdio |
| **常驻提权代理 + 代理由其启动游戏** | 仅首次弹 UAC ✅ |

### 关键技术约束

1. **提权进程拿不到调用者的 stdio**
   `ShellExecuteEx(runas)` 由 AppInfo 服务（consent 流程）创建目标进程，**不继承调用者句柄**。因此「扩展开子进程并独占其 stdin/stdout」在提权场景下不可实现。

   → 管道方向必须反转为：**扩展当 server，代理当 client**。语义上等价于一条扩展独占的双工管道。

2. **代理运行时复用 VSCode 自带 Electron 的 node**
   使用 `process.execPath`（即 `Code.exe`）+ 环境变量 `ELECTRON_RUN_AS_NODE=1`，即可把 VSCode 自带的 Electron 当 node 用来跑 `dist/launchAgent.js`。

   附带收益：UAC 弹窗的签名主体是 Microsoft。

   提权启动踩过两个坑（已踩平，勿回退）：

   - **环境变量不会继承**：`-Verb RunAs` 经 `ShellExecuteEx` → AppInfo 服务创建进程，提权进程的环境变量由系统重建，拿不到调用者 `spawn` 时设置的 `ELECTRON_RUN_AS_NODE`。实测提权后的 `Code.exe` 会当普通 Electron 启动并去激活已有窗口（表现为 VSCode 窗口抢焦点），代理脚本完全不执行。
     → 改为：生成一个自提权脚本 `launchAgent-launcher.ps1`，提权后的分支**在自己进程内**设置 `$env:ELECTRON_RUN_AS_NODE='1'`，再用 `Start-Process -PassThru -Wait` 启动代理。
   - **不能拼命令字符串**：Node 把参数交给 `powershell.exe -Command "<长命令>"` 时会再做一层引号转义，而 PowerShell 不认反斜杠转义，嵌套引号会被破坏，提权出来的 powershell 拿到的参数是错的。
     → 改为：把所有参数作为 PowerShell 字面量写进 `.ps1`，Node 只用 `-File <脚本>` 调用它（不存在嵌套引号）。
   - `& $exe @rest` 不要用：对 GUI 子系统程序 PowerShell 会走 shell 启动，同样丢环境变量。用 `Start-Process`。

3. **代理必须是独立的纯 Node 进程**
   不能 import `vscode` 模块。webpack 需要为它单开一个 `target: 'node'` 的入口。

4. **游戏进程不能进入 job object，且必须 `detached`**
   代理会在管道断开 30 秒后自杀，而关掉 VSCode 后游戏必须继续跑，所以：
   - 不得使用 `KILL_ON_JOB_CLOSE` 之类的绑定。
   - `spawn` 必须带 `detached: true`。实测（`y3-agent-selftest5`）：不带 `detached` 时，游戏会挂在代理的控制台上 —— 代理退出、控制台销毁，游戏被连带终止；加上 `detached` 后游戏独立存活 ✓。
   - 代价：`DETACHED_PROCESS` 下游戏不再继承控制台。`--console` / `--luaconsole` 依赖游戏自己 `AllocConsole`，需人工确认（任务 5.8）。

## Goals / Non-Goals

**Goals**
- 一个 VSCode 会话内，UAC 最多弹一次
- 代理不可用时功能不退化，回退到现状
- 不引入可被滥用的本机提权通道

**Non-Goals**
- 完全消除首次 UAC（除非改为「管理员安装时注册计划任务」方案，本次不做）
- 把游戏 stdout 拉回 VSCode（无消费方）
- 支持非 `Game_x64h.exe` 的任意程序提权启动

## Decisions

### D1: 进程拓扑

```
Extension Host (中完整性)                    Launch Agent (高完整性 / node)
  │
  ├─ 创建命名管道 server（名字由工作区路径派生）
  │    \\.\pipe\y3-helper-agent-<hash>
  │    DACL: 进程 token 默认 ACL（当前用户 + SYSTEM + Administrators）
  │
  ├─ powershell -File <globalStorage>/launchAgent-launcher.ps1
  │    └─ 脚本用 Start-Process -Verb RunAs 再启动自己（-Elevated 分支） ──► 首次一次 UAC
  │         └─ 在提权进程内设置 $env:ELECTRON_RUN_AS_NODE=1
  │            └─ Start-Process -PassThru -Wait 启动代理
  │                                                  │
  │  ◄──── {type:'ready', token} ────────────────────┤ 连接管道 + token 握手
  │                                                  │
  ├──── {id, type:'launch', exe, args[], cwd} ──────►│ 白名单校验 → CreateProcess
  │  ◄──── {type:'launched', id, pid} ───────────────┤
  │  ◄──── {type:'exit', id, code} ──────────────────┤
  │                                                  │
  └─ 管道断开（宿主退出）───────────────────────────►│ grace period 30s
                                                     │ 超时 → 退出
```

### D2: 通信协议（JSON Lines，UTF-8，以 `\n` 分帧）

扩展 → 代理：
| type | 字段 | 说明 |
|---|---|---|
| `launch` | `id`, `exe`, `args: string[]`, `cwd` | 启动请求；`id` 为扩展侧生成的请求号 |
| `ping` | — | 保活探测 |
| `shutdown` | — | 请求正常退出 |

代理 → 扩展：
| type | 字段 | 说明 |
|---|---|---|
| `ready` | `token` | 握手；token 不匹配则扩展立即断开该连接 |
| `launched` | `id`, `pid` | 进程已创建 |
| `exit` | `id`, `code` | 进程退出及退出码 |
| `error` | `id?`, `message` | 校验失败或启动失败 |
| `pong` | — | 保活响应 |

`id` 由扩展侧单调递增，代理对同一 `id` 至多回一次 `launched`/`error`。

### D3: 复用与重连

- 管道名由工作区路径派生（`\\.\pipe\y3-helper-agent-<hash>`），同一窗口重载后名字不变；握手 token 存于 `context.globalState`。
- 代理在握手成功后写入存活标记文件（`globalStorage` 下的 `launchAgent-<hash>.lock`），退出时删除；扩展侧仅在标记存在时才等待重连，避免新会话首次启动白等。
- 代理断线后每 2s 重试连接，扩展侧等待 2.5s；「重新加载窗口」会重建扩展宿主 → 管道断开 → 代理重连成功 → 不再弹 UAC（实测约 2s 内完成重连）。
- `deactivate()` 只关闭管道连接，**不主动结束代理**，否则重载窗口后又会弹一次 UAC；代理靠 grace period 自行退出。

### D4: 安全边界

命名管道等价于一条本机提权通道，因此：

- **白名单**：代理只允许启动文件名匹配 `Game_x64h.exe` 且路径位于扩展传入的编辑器目录下的可执行文件。其他一律拒绝并返回 `error`。
- **不经过 shell**：`args` 数组直接传给 `CreateProcess`，不存在字符串拼接，无注入面。
- **不做通用命令执行**：协议里没有任何「随便跑个命令」的消息类型。
- **token 校验**：握手 token 为 128-bit 随机数，不匹配立即断开（防同用户下的管道抢占）。

### D5: 失败兜底

`runElevated` 在以下任一情况回退到现有 `runShell`（保持现状弹窗，功能不退化）：

- PowerShell 进程启动失败（被策略拦截、无 PowerShell）
- 代理连接或握手超时（默认 15s，覆盖用户慢慢点 UAC 的场景）
- 用户在 UAC 弹窗选择「否」

### D6: 结果语义与 stdout

- 结果：扩展侧在收到 `launched`（进程创建成功）时返回 0，`error` 或超时时返回非 0。这与原路径的实际语义一致 —— `runShell` 跑的是 `cmd.exe`，而 Windows 上 `cmd` 不会等待 GUI 程序，因此原来也是在进程创建后立刻返回；`src/launchGame.ts:150` 的 `code !== 0` 判断继续有效。
- `exit` 消息仅用于日志（回传游戏退出码），不参与启动结果。
- stdout：不再回传。原路径下输出仅显示在 VSCode 任务终端里，无代码消费；游戏的实际日志通道是 `ConsoleServer`（`src/console/server.ts:44` 的 127.0.0.1 TCP），不受影响。代价是游戏控制台窗口不再由 VSCode 终端承载，需手工确认（见任务 5.8）。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| EDR/杀软对「提权 node + 命名管道」误报 | 保留兜底路径；必要时后续改为计划任务方案 |
| 非管理员账号无法创建代理 | 直接走兜底路径，行为与现状一致 |
| 代理残留进程 | grace period（30s）超时自杀；`deactivate` 只断连接，残留时间上限即 grace period |
| 代理崩溃导致后续启动全部走兜底 | `LaunchAgentManager` 检测管道断开后，下次启动重新尝试拉起代理 |
| 多开模式并发请求 | 协议以 `id` 关联，代理侧并发处理，`exit` 按 `id` 分发 |
| 同一工作区开两个 VSCode 窗口 | 管道名冲突导致第二个窗口 `listen` 失败 → 该窗口走兜底路径 |
