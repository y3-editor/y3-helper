# Design: Lua 静态检查 MCP 工具

## 架构概览

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────────────┐
│  MCP Client     │────▶│  TCPServer           │────▶│  GameSessionManager         │
│  (Claude/AI)    │     │  (read_problems_lua) │     │  .readProblemsLua()         │
└─────────────────┘     └──────────────────────┘     └─────────────┬───────────────┘
                                                                   │
                                                                   ▼
                                                     ┌─────────────────────────────┐
                                                     │  vscode.lm.invokeTool()     │
                                                     │  'vscodeOperator_readProblems'
                                                     └─────────────────────────────┘
```

## 组件设计

### 1. MCP Tool 定义 (tcpServer.ts)

```typescript
{
  name: 'read_problems_lua',
  description: '检查 Lua 文件的诊断问题（错误和警告）',
  inputSchema: {
    type: 'object',
    properties: {
      pathGlob: {
        oneOf: [
          { type: 'string', description: '单个路径过滤模式' },
          { type: 'array', items: { type: 'string' }, description: '多个路径过滤模式列表' }
        ],
        description: '路径过滤模式（glob 格式），会自动添加 **/*.lua 后缀'
      }
    }
  }
}
```

### 2. 业务逻辑 (gameSessionManager.ts)

**函数签名**：
```typescript
async readProblemsLua(params?: { pathGlob?: string | string[] }): Promise<any>
```

**pathGlob 处理逻辑**：
| 输入 | 输出 |
|------|------|
| 无参数 | `**/*.lua` |
| `maps/EntryMap` | `maps/EntryMap/**/*.lua` |
| `maps/EntryMap/script/main.lua` | `maps/EntryMap/script/main.lua` |
| `["src", "lib"]` | `["src/**/*.lua", "lib/**/*.lua"]` |

### 3. 返回数据结构

```typescript
// 成功时
{
  success: true,
  filter: { minSeverity: 'warning', pathGlob: '...' },
  total: number,      // 匹配的问题总数
  returned: number,   // 实际返回数量（最多100）
  items: ProblemItem[]
}

// ProblemItem
{
  file: string,
  severity: 'error' | 'warning',
  message: string,
  source?: string,    // 如 "Lua"
  code?: string,      // 诊断代码
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
}
```

## 依赖关系

- **必需扩展**：`sumneko.vscode-operator` - 提供 `vscodeOperator_readProblems` 工具
- **API 调用**：`vscode.lm.invokeTool()` (VSCode 1.90+)

## 错误处理

当 `vscodeOperator_readProblems` 调用失败时：
```typescript
{
  success: false,
  error: '错误信息',
  message: '调用 vscodeOperator_readProblems 失败，请确保已安装 sumneko.vscode-operator 扩展'
}
```
