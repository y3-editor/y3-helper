## Why

当前 Y3Helper 集成的 CodeMaker 本地 api-server 使用单文件 `chat_histories.json` 存储所有会话数据（包括完整消息内容）。随着用户使用时间增长，这个文件会不断膨胀，导致：

1. **启动慢**：每次启动需解析整个大文件到内存
2. **保存慢**：每次保存一条消息都要序列化写入整个文件
3. **内存浪费**：所有会话（含完整消息）常驻内存
4. **列表接口低效**：GET 列表返回所有消息内容，前端只需要 topic/时间等元数据

前端代码（来自 CodeMaker 源码）已经实现了 `_exclude`、`_page`、`_num`、`_sort_by` 等查询参数，但本地 api-server 全部忽略了这些参数。

Issue: #98702

## What Changes

将 `history.mjs` 的存储方案从"单文件全量内存"改为"索引文件 + 单会话文件"结构，对齐 CodeMaker 云端服务的设计理念：

- **存储结构**：从单个 `chat_histories.json` 拆分为 `chat_index.json`（索引）+ `sessions/{id}.json`（单会话文件）
- **按需加载**：内存中仅保留索引（元数据），会话消息内容按需从文件读取
- **支持查询参数**：实现 `_exclude=data`、`_page`、`_num`、`_sort_by`、`chat_type` 等前端已在发送的参数
- **按需保存**：保存时只写被修改的单个会话文件 + 更新索引
- **数据迁移**：启动时自动检测旧格式并迁移到新格式

### 存储结构变化

```
# 旧结构
globalStorage/
└── chat_histories.json       ← 一个文件包含所有会话+所有消息

# 新结构
globalStorage/
├── chat_index.json           ← 索引文件（元数据、topic、时间，不含 messages）
└── sessions/                 ← 每个会话单独一个文件
    ├── 1.json
    ├── 2.json
    └── ...
```

## Capabilities

### New Capabilities
- `session-file-storage`: 索引 + 单文件存储方案，支持按需加载和按需保存
- `query-params-support`: 实现 `_exclude`、`_page`、`_num`、`_sort_by`、`chat_type` 查询参数
- `data-migration`: 旧格式 → 新格式自动迁移

### Modified Capabilities
- `codemaker-integration`: api-server 的 history 路由实现变更，API 接口不变

## Impact

- 改动范围仅限 `resources/codemaker/api-server/routes/history.mjs` 一个文件
- API 接口完全不变，前端代码零修改
- 需要处理旧数据迁移兼容
- `apiServer.ts` 的 `CHAT_HISTORY_PATH` 环境变量继续有效，指向同一个目录

## Future Considerations

### 一键上传对话记录

本次存储重构的一个重要后续需求是：让 Y3Helper 用户可以**一键上传当前对话记录**给我们（用于问题排查、使用分析等）。

新的"索引 + 单文件"架构天然适配这个需求：

- 已知 `sessionId`，直接读取 `sessions/{id}.json` 即为完整的、自包含的对话文件
- Extension 层可直接通过 `globalStoragePath + '/sessions/' + sessionId + '.json'` 读取，无需经过 api-server
- 单文件体积可控，不会误传整个历史库
- 上传前可方便地对单文件做脱敏处理

**建议**：在单会话文件中加入 `_schema_version` 字段，方便收集服务器根据版本号解析数据，应对未来格式变更。
