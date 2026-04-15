# Specs: Lua 静态检查 MCP 工具

## 功能规格

### MCP Tool: read_problems_lua

**名称**: `read_problems_lua`

**描述**: 检查 Lua 文件的诊断问题（错误和警告）

**输入参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `pathGlob` | `string \| string[]` | 否 | 路径过滤模式，支持 glob 格式。默认检查所有 Lua 文件 |

**输出**:

成功时返回：
```json
{
  "success": true,
  "filter": {
    "minSeverity": "warning",
    "pathGlob": "**/*.lua"
  },
  "total": 5,
  "returned": 5,
  "items": [
    {
      "file": "i:\\project\\maps\\EntryMap\\script\\main.lua",
      "severity": "error",
      "message": "Undefined global 'undefined_var'.",
      "source": "Lua",
      "code": "undefined-global",
      "startLine": 10,
      "startColumn": 5,
      "endLine": 10,
      "endColumn": 18
    }
  ]
}
```

失败时返回：
```json
{
  "success": false,
  "error": "Tool 'vscodeOperator_readProblems' not found",
  "message": "调用 vscodeOperator_readProblems 失败，请确保已安装 sumneko.vscode-operator 扩展"
}
```

## 使用示例

### 1. 检查所有 Lua 文件
```json
{ "name": "read_problems_lua", "arguments": {} }
```

### 2. 检查指定目录
```json
{ "name": "read_problems_lua", "arguments": { "pathGlob": "maps/EntryMap" } }
```

### 3. 检查多个目录
```json
{ "name": "read_problems_lua", "arguments": { "pathGlob": ["maps/EntryMap/script", "src/lib"] } }
```

### 4. 检查具体文件
```json
{ "name": "read_problems_lua", "arguments": { "pathGlob": "maps/EntryMap/script/main.lua" } }
```

## 配置约束

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `maxItems` | 100 | 最多返回 100 条诊断 |
| `minSeverity` | warning | 只返回 warning 和 error 级别 |

## 前置条件

1. 已安装 `sumneko.vscode-operator` 扩展
2. 已安装 Lua Language Server（如 `sumneko.lua`）并正常运行
3. VSCode 版本 >= 1.90（支持 `vscode.lm.invokeTool` API）

## 扩展依赖配置 (package.json)

```json
{
  "extensionDependencies": [
    "sumneko.lua",
    "sumneko.vscode-operator"
  ]
}
```

**说明**：
- `sumneko.lua`：Lua Language Server，提供 Lua 代码的语法检查和诊断
- `sumneko.vscode-operator`：VSCode Operator 扩展，提供 `vscodeOperator_readProblems` 工具用于读取 Problems 面板的诊断信息

当用户安装 y3-helper 扩展时，VSCode 会自动安装这两个依赖扩展。
