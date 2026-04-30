# useToolCall Hook 使用指南

## 概述

`useToolCall` 是一个统一的工具调用管理Hook，整合了所有与工具调用相关的逻辑，包括状态管理、处理逻辑、环境检查、MCP工具处理等。

## 目录结构

```
hooks/
├── useToolCall.ts              # 主入口文件
└── useToolCall/
    ├── types.ts               # 类型定义
    ├── classification.ts      # 工具分类和环境检查
    ├── mcpInfo.ts            # MCP工具信息处理
    ├── tips.ts               # 自动配置提示文本
    ├── state.ts              # 状态管理
    ├── handlers.ts           # 处理逻辑
    ├── title.ts              # 标题生成
    └── notification.ts       # 通知管理
```

## 基本使用

```typescript
import { useToolCall } from '../../../hooks/useToolCall';

function ToolCallComponent({ message, isShare, isLatest }) {
  const {
    // 状态
    toolResponse,
    toolResponseDisabled,
    handleSelectionChange,

    // 处理
    handleToolCall,
    getBtnLabel,

    // 显示
    toolCallTitle,
    shouldShowHeader,

    // 配置
    autoConfigItems,

    // 便捷访问
    toolTypes,
    environment,
  } = useToolCall(message, isShare, isLatest);

  // 使用返回的数据...
}
```

## 返回值说明

### 状态管理
- `toolResponse`: 工具响应状态
- `unselectedResults`: 未选择的结果集合
- `toolResponseDisabled`: 工具响应是否禁用
- `hasToolCallError`: 是否有工具调用错误
- `pathList`: 路径列表
- `setToolResponse`: 设置工具响应状态
- `handleSelectionChange`: 处理选择变化

### 处理逻辑
- `handleToolCall`: 主工具调用处理函数
- `execCommandTool`: 执行命令工具
- `getBtnLabel`: 获取按钮标签

### 显示相关
- `toolCallTitle`: 工具调用标题
- `shouldShowHeader`: 是否应该显示头部

### 配置相关
- `autoConfigItems`: 自动配置项列表
- `updateFunctions`: 各种更新函数

### 分类信息
- `classification`: 完整的工具分类结果
- `mcpToolInfo`: MCP工具信息（如果有）
- `tips`: 所有配置提示文本

### 便捷访问
- `toolTypes`: 工具类型检查对象
  - `hasEditFileTool`
  - `hasTerminalTool`
  - `hasMCPTool`
  - `hasMakePlanTool`
  - 等...
- `environment`: 环境检查对象
  - `repoNotMatch`
  - `isVsCodeIDE`
  - `enableTerminal`
  - 等...

### 通知管理
- `hasNotifiedRef`: 通知状态引用

## 工具类型支持

Hook 自动识别和处理以下工具类型：
- **编辑工具**: `edit_file`, `reapply`, `replace_in_file`
- **终端工具**: `run_terminal_cmd`
- **MCP工具**: `use_mcp_tool`, `access_mcp_resource`
- **计划工具**: `make_plan`, `write_todo`
- **文件工具**: `read_file`, `list_files_*`, 等
- **问答工具**: `ask_user_question`
- **技能工具**: `use_skill`
- **任务工具**: `task`

## 自动配置项

Hook会根据工具类型自动生成相应的自动配置项：
- **仓库自动读取**: 文件相关工具时显示
- **代码自动应用**: 编辑文件工具时显示
- **命令自动执行**: 终端工具时显示
- **Plan自动执行**: Todo工具时显示
- **MCP自动调用**: MCP工具时显示

## 环境检查

Hook会自动检查以下环境条件：
- 仓库匹配状态
- IDE类型（VSCode/JetBrains）
- 终端启用状态
- 危险命令检测

## 扩展说明

如果需要添加新的工具类型或功能：

1. 在 `types.ts` 中添加新的类型定义
2. 在 `classification.ts` 中添加工具类型识别
3. 在相应的子模块中添加处理逻辑
4. 在主文件 `useToolCall.ts` 中整合新功能

## 注意事项

1. 所有子模块都通过主入口文件暴露，不要直接导入子模块
2. 类型定义统一在 `types.ts` 中维护
3. 每个子模块职责单一，便于维护和测试
4. 主入口文件负责协调各个子模块的数据流