## Context

Y3 游戏编辑器使用 `.gmp` 二进制格式存储地图数据，包含多个 Section（物编、UI、元数据等）。开发者在 VSCode 中编辑的是 JSON 格式的源文件：

- `editor_table/<type>/` - 物编数据（单位、技能、物品等）
- `ui/` - UI 数据（面板、层、配置）

**当前状态**：已完成 TypeScript 版本实现（`src/tools/y3SaveGmp.ts`），取代之前的 Python 脚本依赖。

**约束**：
- 必须兼容 Y3 编辑器的 GMP 二进制格式（版本 5）
- Section 索引使用 MD5 哈希算法，与编辑器保持一致
- WASM 版 zstd 压缩需要单例管理以避免内存泄漏

## Goals / Non-Goals

**Goals:**
- 提供纯 TypeScript 实现的 GMP 保存功能，消除 Python 环境依赖
- 支持物编和 UI 数据的独立或联合更新
- 作为 MCP 工具暴露给 AI，实现自动化工作流
- 游戏启动时自动同步最新修改

**Non-Goals:**
- 不实现 GMP 解包到 JSON 的反向转换（仅保存方向）
- 不支持编辑器特有的其他 Section 类型（如 `desc`、`tech_data` 等）
- 不实现增量更新（每次全量重建所有物编 Section）

## Decisions

### 1. 序列化流程：JSON → MessagePack → Zstd

**选择**：JSON 字符串 → MessagePack 编码 → Zstd 压缩

**理由**：
- 与 Y3 编辑器原生格式完全兼容
- MessagePack 提供紧凑的二进制序列化
- Zstd 压缩比高，且有 WASM 实现可用

**替代方案**：
- 直接 JSON → Zstd：不兼容编辑器格式
- 使用 Node.js 原生 zstd 绑定：需要编译原生模块，增加部署复杂度

### 2. Zstd WASM 单例管理

**选择**：使用单例模式管理 `ZstdCodec` 实例

```typescript
let zstdSimpleInstance: ZstdSimple | null = null;
let zstdInitPromise: Promise<ZstdSimple> | null = null;

async function getZstdSimple(): Promise<ZstdSimple> {
    if (zstdSimpleInstance) return zstdSimpleInstance;
    if (zstdInitPromise) return zstdInitPromise;
    // 初始化...
}
```

**理由**：
- 每次 `ZstdCodec.run()` 都会初始化新的 WASM 实例
- 多次初始化导致内存累积，最终 OOM
- 单例复用同一实例，避免内存泄漏

### 3. Section 索引计算

**选择**：使用 MD5 哈希生成 16 位索引

```typescript
function genSectionIdx(secName: string, currIndexes: Set<number>): number {
    const hash = crypto.createHash('md5').update(secName, 'utf-8').digest();
    let bigPart = (hash[hash.length - 4] ^ hash[hash.length - 2]) & 0xFF;
    let smallPart = (hash[hash.length - 3] ^ hash[hash.length - 1]) & 0xFF;
    let idx = (bigPart << 8) | smallPart;
    // 冲突处理...
}
```

**理由**：完全复刻 Y3 编辑器的 `map_section_prop_new.py` 实现，确保索引一致

### 4. 空文件夹处理策略

**选择**：即使文件夹为空，也打包空字典 `{}`

**理由**：
- 保持流程统一，不需要区分"有数据"和"无数据"场景
- 避免因缺少某个 Section 导致游戏加载异常
- 简化错误处理逻辑

### 5. 文件结构

**选择**：单文件实现 (`src/tools/y3SaveGmp.ts`)

**理由**：
- 功能内聚，便于维护
- 减少模块间依赖
- 方便作为独立工具复用

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| WASM zstd 初始化失败 | 错误日志 + 不阻塞游戏启动 |
| JSON 解析失败（格式错误） | 跳过单个文件，继续处理其他文件 |
| GMP 文件被占用 | 备份原文件到 `.bak`，失败时可恢复 |
| 内存占用过高（大量物编） | 逐个 Section 处理，处理后释放引用 |
| Section 索引冲突 | 使用与编辑器一致的冲突处理算法（idx + 1） |

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      save(mapPath, options)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        GmpParser                             │
│  - 解析原始 .gmp 文件                                        │
│  - 提取 header（UUID, version, stamps）                      │
│  - 分离各 Section（保留非物编/UI 的 Section）                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│ buildPrefabSections     │     │    buildUISection       │
│ - 读取 editor_table/    │     │ - 读取 ui/ 目录         │
│ - 11 个物编 Section     │     │ - 合并 prefab + layer   │
│ - JSON → msgpack → zstd │     │ - JSON → msgpack → zstd │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        GmpBuilder                            │
│  - 复制原始 header                                           │
│  - 合并原始 Section + 新物编 Section + 新 UI Section         │
│  - 构建二进制输出                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      .gmp 文件输出                           │
│  - 备份原文件 (.bak)                                         │
│  - 写入新 GMP 数据                                           │
└─────────────────────────────────────────────────────────────┘
```

## 集成点

### MCP 工具注册

```typescript
// src/mcp/tools/index.ts
{
    name: 'save_gmp',
    description: '保存物编和UI数据到GMP文件',
    inputSchema: {
        mapPath: { type: 'string' },
        updatePrefabs: { type: 'boolean', default: true },
        updateUI: { type: 'boolean', default: true }
    }
}
```

### 游戏启动集成

```typescript
// src/mcp/gameSessionManager.ts
private async saveGmpBeforeLaunch(): Promise<void> {
    const mapPath = env.env.triggerMapUri ?? env.env.mapUri;
    await saveGmp(mapPath.fsPath, { updatePrefabs: true, updateUI: true });
}
```
