## Why

Y3Helper 集成的 CodeMaker 在移植时跳过了 Skills 系统的后端实现。当前 `GET_SKILLS` 消息处理器返回空数组，`CREATE_SKILL_TEMPLATE` / `INSTALL_BUILTIN_SKILL` 消息被静默忽略，`use_skill` 工具返回"不支持"错误。导致前端工具栏中看不到 Skills 区域（参考截图：只有 Plan Mode、代码 Apply、执行 CMD、需求澄清工具、MCP Server，缺少 Skills）。源码版 CodeMaker 支持自定义 Skill 系统（`.codemaker/skills/` 目录下的 skill 文件），需要补齐这部分功能。

## What Changes

- **实现 `GET_SKILLS` 消息处理**：从 `.codemaker/skills/` 目录读取 skill 文件，解析后返回给前端（参照已有的 `GET_RULES` 实现模式）
- **实现 `CREATE_SKILL_TEMPLATE` 消息处理**：在 `.codemaker/skills/` 目录下创建 skill 模板文件
- **实现 `INSTALL_BUILTIN_SKILL` 消息处理**：安装内置 skill 到项目
- **实现 `use_skill` 工具**：读取指定 skill 的内容并返回给 AI，替代当前的"不支持"错误响应
- **支持 skill 的 CRUD 操作**：新增、更新、删除 skill 文件，同步状态到前端

## Capabilities

### New Capabilities
- `skill-management`: Skills 文件的读写管理（GET_SKILLS、CREATE_SKILL_TEMPLATE、INSTALL_BUILTIN_SKILL 消息处理，以及 skill 文件的增删改查）
- `skill-tool-execution`: `use_skill` 工具的实际执行逻辑（加载 skill 内容并返回指令给 AI）

### Modified Capabilities
- `codemaker-integration`: 工具栏需要展示 Skills 区域，补齐前端已有但后端未实现的消息通道

## Impact

- **代码影响**：`src/codemaker/messageHandlers.ts`（Skills 消息处理）、`src/codemaker/webviewProvider.ts`（use_skill 工具实现）
- **文件系统**：新增 `.codemaker/skills/` 目录的读写操作
- **前端影响**：无需修改前端代码（WebView 已有 Skills UI，只需后端返回正确数据）
- **依赖**：无新增外部依赖
