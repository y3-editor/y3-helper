## Why

#98280 VsCode保存GMP - 支持直接修改的UI能直接运行

当前 Y3 编辑器的物编数据（`editor_table/`）和 UI 数据（`ui/`）以 JSON 格式存储在地图目录中，但游戏运行时需要读取二进制格式的 `.gmp` 文件。之前需要依赖 Python 脚本进行转换，这给开发者带来额外的环境依赖。现在已实现纯 TypeScript 版本的 GMP 保存功能，支持 AI 或开发者直接修改 JSON 文件后同步到 GMP 文件，使修改能立即在游戏中生效。

## What Changes

- **新增 TypeScript 版 GMP 保存工具** (`src/tools/y3SaveGmp.ts`)：完全取代 Python 脚本实现
  - 解析原始 GMP 二进制文件 (`GmpParser`)
  - 构建新的 GMP 二进制文件 (`GmpBuilder`)
  - 支持物编 Section（新版，MD5 哈希索引）和 UI Section（旧版，固定索引）
  - 数据序列化流程：JSON → MessagePack → Zstd 压缩
  - Zstd 单例管理，避免 WASM 重复初始化导致 OOM

- **MCP 工具集成**：通过 `save_gpm` 工具暴露给 AI 调用
  - 支持仅更新物编、仅更新 UI、或同时更新
  - 自动处理空文件夹场景（打包空字典）

- **游戏启动时自动保存**：`gameSessionManager.ts` 在启动游戏前调用 GMP 保存，确保最新修改生效

- **移除 Python 依赖**：不再需要 `python`、`zstd`、`msgpack` 等 Python 库

## Capabilities

### New Capabilities
- `gmp-save`: GMP 文件保存功能 - 将 JSON 格式的物编和 UI 数据打包为二进制 GMP 格式

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

### 代码
- `src/tools/y3SaveGmp.ts`: 核心实现（~1100 行）
- `src/mcp/tools/index.ts`: MCP 工具注册
- `src/mcp/tcpServer.ts`: MCP 请求处理
- `src/mcp/gameSessionManager.ts`: 游戏启动集成

### 依赖
- 新增 npm 包：`@msgpack/msgpack`、`zstd-codec`

### API
- 主入口：`save(mapPath, options?)` 返回 `Promise<SaveResult>`
- 选项：`updatePrefabs`、`updateUI`、`outputPath`

### 支持的物编类型
| Section 名称 | editor_table 子目录 |
|-------------|-------------------|
| editor_unit | editorunit |
| editor_decoration | editordecoration |
| ability_all | abilityall |
| modifier_all | modifierall |
| projectile_all | projectileall |
| technology_all | technologyall |
| store_all | storeall |
| editor_item | editoritem |
| editor_destructible | editordestructible |
| sound_all | soundall |
| state_all | stateall |

### UI 数据结构
- `ui/ui_config.json`: 基础配置
- `ui/prefab/*.json`: 面板定义
- `ui/*.json`: 层定义