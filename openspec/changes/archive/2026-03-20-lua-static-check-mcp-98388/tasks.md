# Tasks: Lua 静态检查 MCP 工具

## 已完成任务

### Task 1: 实现 readProblemsLua 函数 ✅

**文件**: `src/mcp/gameSessionManager.ts`

**变更内容**:
- 新增 `readProblemsLua(params?: { pathGlob?: string | string[] })` 方法
- 调用 `vscode.lm.invokeTool('vscodeOperator_readProblems', ...)` 获取诊断
- 实现 pathGlob 自动追加 `**/*.lua` 后缀逻辑
- 解析 `LanguageModelToolResult` 返回的文本内容

**关键代码片段**:
```typescript
async readProblemsLua(params?: { pathGlob?: string | string[] }): Promise<any> {
    const maxItems = 100;
    const minSeverity = 'warning';
    
    // 构建 pathGlob
    let finalPathGlob: string | string[];
    const userPathGlob = params?.pathGlob;
    
    if (userPathGlob) {
        if (Array.isArray(userPathGlob)) {
            finalPathGlob = userPathGlob.map(p => {
                if (p.endsWith('.lua')) return p;
                return p.endsWith('/') ? `${p}**/*.lua` : `${p}/**/*.lua`;
            });
        } else {
            if (userPathGlob.endsWith('.lua')) {
                finalPathGlob = userPathGlob;
            } else {
                finalPathGlob = userPathGlob.endsWith('/') 
                    ? `${userPathGlob}**/*.lua` 
                    : `${userPathGlob}/**/*.lua`;
            }
        }
    } else {
        finalPathGlob = '**/*.lua';
    }

    const result = await vscode.lm.invokeTool(
        'vscodeOperator_readProblems',
        {
            toolInvocationToken: undefined,
            input: { maxItems, minSeverity, pathGlob: finalPathGlob }
        }
    );
    // ... 解析返回结果
}
```

---

### Task 2: 注册 MCP Tool ✅

**文件**: `src/mcp/tcpServer.ts`

**变更内容**:
- 在 `tools/list` 响应中添加 `read_problems_lua` 工具定义
- 在 `tools/call` 处理中添加 `read_problems_lua` case
- 定义支持 `string | string[]` 的 `pathGlob` 参数 schema

**关键代码片段**:
```typescript
// tools/list 中的定义
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
                description: '路径过滤模式，会自动添加 **/*.lua 后缀'
            }
        }
    } 
}

// tools/call 中的处理
case 'read_problems_lua':
    result = await this.sessionManager.readProblemsLua(toolArgs);
    break;
```

---

---

### Task 3: 添加扩展依赖声明 ✅

**文件**: `package.json`

**变更内容**:
- 添加 `extensionDependencies` 字段，声明对 `sumneko.lua` 和 `sumneko.vscode-operator` 的依赖

**关键代码片段**:
```json
{
  "extensionDependencies": [
    "sumneko.lua",
    "sumneko.vscode-operator"
  ]
}
```

**作用**：
- 当用户安装 y3-helper 时，VSCode 会自动安装这两个依赖扩展
- 确保 `vscodeOperator_readProblems` 工具可用

---

## 实现状态

| 任务 | 状态 | 文件 |
|------|------|------|
| readProblemsLua 函数实现 | ✅ 完成 | gameSessionManager.ts |
| MCP Tool 注册 | ✅ 完成 | tcpServer.ts |
| 扩展依赖声明 | ✅ 完成 | package.json |
| 参数解析 | ✅ 完成 | 两个文件 |
| 错误处理 | ✅ 完成 | gameSessionManager.ts |
