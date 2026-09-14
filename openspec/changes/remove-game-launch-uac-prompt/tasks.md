## 1. 协议与构建脚手架

- [x] 1.1 新增 `src/launchAgent/protocol.ts`：定义双端消息类型（`launch` / `ping` / `shutdown` / `ready` / `launched` / `exit` / `error` / `pong`）与 JSON Lines 编解码函数，两端共用
- [x] 1.2 修改 `webpack.config.js`：新增 `target: 'node'` 构建项，入口 `src/launchAgent/agent.ts`，输出 `dist/launchAgent.js`；该构建项不声明 `vscode` 为 external，因此代理误引 `vscode` 会在构建期报错
- [x] 1.3 冒烟验证运行时可行性：用 `ELECTRON_RUN_AS_NODE=1 <Code.exe> dist/launchAgent.js` 启动代理，确认能作为普通 node 脚本运行（已通过自测脚本验证）

## 2. 代理侧实现（src/launchAgent/agent.ts）

- [x] 2.1 解析启动参数（`--pipe`、`--token`、`--allow-dir`、`--grace`、`--lock`），以 client 身份连接命名管道
- [x] 2.2 实现握手：连接成功后发送 `ready`（含 token），token 不匹配时扩展侧立即断开
- [x] 2.3 实现按 `\n` 分帧的 JSON Lines 读取器，未知消息类型忽略不报错
- [x] 2.4 实现 `launch` 白名单校验：文件名必须为 `Game_x64h.exe`，且路径规范化后位于 `--allow-dir` 之下，否则回 `error`
- [x] 2.5 实现进程创建：`spawn(exe, args, { cwd, detached: true, stdio: 'ignore' })`，`args` 数组直传，不设置 job object，保证代理退出不杀游戏
- [x] 2.6 实现 `launched` / `exit` / `error` 回传，按请求 `id` 关联，支持多个请求并发进行
- [x] 2.7 实现生命周期：管道断开后进入 grace period 等待重连（重试间隔 2s），超时则退出；收到 `shutdown` 立即退出；响应 `ping`
- [x] 2.8 实现存活标记：握手成功后写入 `--lock` 指定文件，退出时删除，供扩展侧判断是否需要等待重连

## 3. 扩展侧管理（src/launchAgent/manager.ts）

- [x] 3.1 实现 `LaunchAgentManager`，构造函数接收 `vscode.ExtensionContext`，从 `globalState` 读取/生成握手 token
- [x] 3.2 实现按工作区派生的固定管道名 `\\.\pipe\y3-helper-agent-<hash>` 的 server 创建与连接接受逻辑
- [x] 3.3 实现提权拉起：生成自提权脚本 `launchAgent-launcher.ps1`（提权分支内设置 `$env:ELECTRON_RUN_AS_NODE='1'`，再用 `Start-Process -PassThru -Wait` 启动代理），Node 侧只用 `powershell -File <脚本>` 调用，不拼命令字符串、不依赖环境变量继承
- [x] 3.4 实现启动前置复用：先等待既有代理重连（依据存活标记），失败再拉起；已连接的代理直接复用
- [x] 3.5 实现握手超时（15s）与等待重连超时（2.5s），超时或 UAC 被拒时抛错交由上层兜底
- [x] 3.6 实现请求表：进程创建成功（`launched`）返回 0，`error` 返回非 0，超时（20s）返回非 0；`exit` 仅用于日志
- [x] 3.7 实现管道断开检测：断开后清理未决请求，下次启动重新尝试拉起
- [x] 3.8 在 `src/extension.ts` 的 `deactivate()` 中关闭管道连接（不主动结束代理，以便重载窗口后复用）
- [x] 3.9 代理以 `--log` 落文件日志（提权进程 stdout 不可见），便于排查「代理是否真的起来了 / 连上了」

## 4. 启动链路接入与兜底

- [x] 4.1 新增 `src/launchAgent/runElevated.ts`：对外暴露与 `runShell` 同形签名 `(title, exe, args, cwd) => Promise<number | undefined>`
- [x] 4.2 修改 `src/launchGame.ts:136`：启动游戏改走 `runElevated`，保留 `code !== 0` 的错误提示逻辑
- [x] 4.3 修改 `src/launchEditor.ts:55`：打开编辑器改走 `runElevated`
- [x] 4.4 实现兜底：非 Windows、代理未初始化或拉起/连接失败时回退到 `runShell`，并通过 `tools.log` 记录失败原因
- [x] 4.5 实现按 `id` 分发的并发处理，多开模式多进程启动互不干扰（已通过自测脚本并发验证）

## 5. 验证

- [x] 5.1 首次启动游戏：只弹一次 UAC，游戏正常启动
- [x] 5.2 同一会话内连续启动多次：不再弹 UAC
- [ ] 5.3 多开模式启动：多个游戏进程正常创建
- [ ] 5.4 「重新加载窗口」后启动：复用代理，不再弹 UAC
- [ ] 5.5 关闭 VSCode：已启动的游戏进程继续运行，代理在 grace period 后退出
- [ ] 5.6 非管理员账号或 UAC 被拒：自动回退到现状路径，功能可用
- [x] 5.7 构造非白名单 exe 与越界路径的 `launch` 请求：代理返回 `error`，不创建进程（已通过自测脚本验证）
- [x] 5.8 游戏控制台窗口（`--console` / `--luaconsole`）在新启动方式下正常
- [x] 5.9 代理退出后已启动的进程仍然存活（已通过自测脚本验证；`spawn` 必须带 `detached: true`）

> 5.3 ~ 5.6 未单独验证（多开模式、重载窗口复用、关闭 VSCode、非管理员回退）。对应机制已由自测脚本覆盖，后续使用中留意即可。

自动化自测覆盖（临时脚本，未入库）：
- `y3-agent-selftest.js`：握手 token、进程创建回传 pid、退出码回传、白名单拒绝、越界路径拒绝、存活标记写入与清理、断连后 grace period 自退；同一脚本可用 `AGENT_LAUNCHER` 换成 `Code.exe` 验证 `ELECTRON_RUN_AS_NODE` 运行时。
- `y3-agent-selftest2.js`：宿主重启后 2s 内自动重连、收到 `shutdown` 立即退出。
- `y3-agent-selftest3.js`：`Start-Process` 参数引号处理（含空格路径）。
- `y3-agent-selftest4.js`：跨完整性级别全链路（launcher → 提权分支 → Code.exe 当 node → 管道握手 → 启动进程 → 退出码）。`NO_ELEVATE=1` 时只跳过 UAC。
- `y3-agent-selftest5.js`：子进程在代理退出后仍然存活。
