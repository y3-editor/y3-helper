## Why

`Game_x64h.exe`（`src/env.ts:468`）的 manifest 声明需要管理员权限。当前「启动游戏」「打开编辑器」都通过 `runShell`（`src/runShell.ts:3`）用 `vscode.tasks.executeTask` 启动，扩展宿主处于中完整性级别，每次都会触发 UAC 弹窗要求手动确认。

游戏开发过程中一个 VSCode 会话内会反复启动游戏几十次，每次都手动确认一遍严重影响体验。

UAC 只在「中完整性 → 高完整性」跨越时弹窗。若先启动一个高完整性的常驻代理，再由代理去创建游戏进程，则子进程直接继承高完整性 token，不再弹窗。本变更实现该方案，把 UAC 确认从「每次启动」降为「每个 VSCode 会话一次」。

## What Changes

- **新增常驻提权代理（Launch Agent）**：一个独立的纯 Node 脚本，由扩展通过 `Start-Process -Verb RunAs` 提权拉起一次，常驻复用
  - 复用 VSCode 自带 Electron 的 node 运行时（`process.execPath` + `ELECTRON_RUN_AS_NODE=1`），不新增任何二进制
  - 副作用收益：UAC 弹窗显示的是 Microsoft 签名主体，而非「未知发布者」

- **命名管道通信**：扩展侧创建命名管道 server，代理作为 client 连接
  - 提权进程无法继承调用者的 stdio 句柄（`ShellExecuteEx(runas)` 由 AppInfo 服务创建进程），因此管道方向必须反转
  - 管道名 + 握手 token 随机生成，token 存入 `globalState` 以支持重连

- **启动请求白名单**：代理只允许启动白名单内的 `Game_x64h.exe`，参数以数组直传 `CreateProcess`，不经过 shell 解释，不提供任意命令执行能力

- **启动链路改造**：`GameLauncher.launch`（`src/launchGame.ts:136`）与 `EditorLauncher.launch`（`src/launchEditor.ts:55`）改为优先走代理，代理不可用时回退现有 `runShell` 路径

- **退出码回传**：代理回传被启动进程的 exit code，替代 `runShell` 的 `onDidEndTaskProcess` 等待逻辑

## Capabilities

### New Capabilities
- `game-launch-agent`: 提权代理的启动、复用、管道协议、白名单校验与生命周期管理

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

### 代码
- 新增 `src/launchAgent/manager.ts`: 扩展侧代理管理（启动、连接、请求、重连、兜底）
- 新增 `src/launchAgent/agent.ts`: 代理侧实现（管道、白名单、`CreateProcess`、退出码），**不得 import `vscode`**
- 新增 `src/launchAgent/protocol.ts`: 双端共享的消息类型定义
- 新增 `src/launchAgent/runElevated.ts`: 提权启动入口，对上层提供与 `runShell` 同形的 `(title, exe, args, cwd) => Promise<number|undefined>` 接口
- 修改 `src/launchGame.ts:136`: 启动游戏改走新入口
- 修改 `src/launchEditor.ts:55`: 打开编辑器改走新入口
- 修改 `webpack.config.js:74`: 新增 node target 入口，产出 `dist/launchAgent.js`

### 行为变化
- 游戏进程的 stdout 不再进入 VSCode 任务终端（原本未被任何代码消费；游戏日志走 `ConsoleServer` 的 TCP 通道）
- 多开模式一次提交多个启动请求，代理需支持并发处理并分别回传 pid/exit

### 依赖
- 无新增 npm 依赖（Node 内置 `net` 支持 Windows 命名管道；提权调用走 `powershell.exe`）

### 风险
- 提权 node + 命名管道的形态可能被部分 EDR/杀软误报，需要保留兜底路径
- 非管理员账号（UAC 需输入管理员凭据）无法自动创建代理，走兜底路径保持现状
