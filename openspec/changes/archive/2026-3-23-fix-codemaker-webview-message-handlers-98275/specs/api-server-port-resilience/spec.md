# API Server Port Resilience

## Requirements

### REQ-1: 端口冲突自动重试
- API Server 启动时，如果指定端口被占用（`EADDRINUSE`），自动尝试下一个端口
- 从 3001 开始递增，最多尝试 100 个端口（3001~3100）
- 所有端口都不可用时返回明确的错误信息

### REQ-2: 启动确认机制
- 不再使用 `setTimeout(1000)` 盲等
- 监听子进程 stderr 输出，检测 `EADDRINUSE` 错误
- 监听子进程 exit 事件，非零退出码触发重试
- 3 秒超时无错误才认为启动成功

### REQ-3: 端口同步
- API Server 成功启动后，将实际端口通过 `setApiServerPort()` 同步到 WebView
- WebView HTML 中的 iframe URL 使用实际端口

## Acceptance Criteria

- 当 3001 端口被占用时，API Server 能自动在 3002+ 端口启动
- 调试控制台显示 `Port 3001 is in use, trying 3002...` 日志
- WebView iframe 从正确的端口加载前端资源
