# Design: CodeMaker Session 存储优化

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│  Webview 前端（不变）                                            │
│  GET /chat_histories?_exclude=data&_page=1&_num=10              │
│  GET /chat_histories/:id                                        │
│  PUT /chat_histories/:id                                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  history.mjs (改动集中在这里)                                     │
│                                                                  │
│  内存层：                                                        │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  indexCache: Map<id, IndexEntry>                      │      │
│  │  IndexEntry = { _id, topic, chat_type, chat_repo,     │      │
│  │                 metadata, message_count }              │      │
│  │  不含 data.messages，内存占用极小                       │      │
│  └───────────────────────────────────────────────────────┘      │
│                                                                  │
│  文件层：                                                        │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  chat_index.json          ← indexCache 的持久化        │      │
│  │  sessions/{id}.json       ← 完整会话数据（含 messages）│      │
│  └───────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

## 数据结构

### IndexEntry（索引条目，常驻内存）

```javascript
{
  _id: "13",
  topic: "功能缺失",
  chat_type: "codebase",
  chat_repo: "y3-helper",
  message_count: 57,          // 冗余字段，方便列表展示
  metadata: {
    create_time: "2026-04-03T10:34:22.000Z",
    update_time: "2026-04-03T10:34:22.000Z",
    creator: "demo-user"
  }
}
```

### chat_index.json（索引文件）

```json
{
  "nextId": 14,
  "sessions": [
    { "_id": "13", "topic": "功能缺失", "chat_type": "codebase", ... },
    { "_id": "1", "topic": "中转故障", "chat_type": "codebase", ... }
  ]
}
```

### sessions/{id}.json（单会话文件）

```json
{
  "_id": "13",
  "topic": "功能缺失",
  "chat_type": "codebase",
  "chat_repo": "y3-helper",
  "metadata": { ... },
  "data": {
    "messages": [ ... ],
    "model": "claude-sonnet-4-6"
  }
}
```

## API 行为变化

### GET /chat_histories

| 参数 | 当前行为 | 优化后行为 |
|------|---------|-----------|
| `_exclude=data` | 忽略，返回完整数据 | 不返回 `data` 字段 |
| `_page` / `_num` | 忽略，返回全部 | 服务端分页 |
| `_sort_by` | 忽略 | 按指定字段排序（默认 `update_time` 倒序） |
| `chat_type` | 忽略 | 服务端过滤 |
| `topic_content` | 忽略 | 服务端模糊搜索 |

数据来源：**仅从 indexCache 读取**，不需要读任何会话文件。

### GET /chat_histories/:id

数据来源：从 `sessions/{id}.json` 文件读取完整会话数据。读取后**不缓存到内存**（用完即弃，避免内存膨胀）。

### PUT /chat_histories/:id

写入行为：
1. 写入 `sessions/{id}.json`（完整会话数据）
2. 更新 indexCache 中对应条目的元数据（topic、update_time、message_count）
3. 写入 `chat_index.json`

### POST /chat_histories

1. 生成新 ID
2. 创建 IndexEntry 加入 indexCache
3. 创建 `sessions/{id}.json`
4. 更新 `chat_index.json`

### DELETE /chat_histories/:id

1. 从 indexCache 删除
2. 删除 `sessions/{id}.json`
3. 更新 `chat_index.json`

## 数据迁移策略

```
启动时:
  ├── 检测 chat_index.json 是否存在
  │   ├── 存在 → 正常加载索引到 indexCache
  │   └── 不存在 → 检测 chat_histories.json（旧格式）
  │       ├── 存在 → 执行迁移
  │       │   1. 解析旧文件
  │       │   2. 为每个 session 创建 sessions/{id}.json
  │       │   3. 提取元数据生成 chat_index.json
  │       │   4. 重命名旧文件为 chat_histories.json.bak
  │       └── 不存在 → 全新状态，创建空索引
```

## 设计决策

### D1: 会话内容不缓存到内存

**决策**：GET /:id 读取文件后直接返回，不在内存中缓存 data.messages。

**理由**：
- 避免内存膨胀（回到旧方案的问题）
- 本地文件 I/O 足够快（几十 ms 级别）
- 保持简单，避免缓存一致性问题

### D2: 索引文件整体写入

**决策**：每次索引变更时，整体写入 `chat_index.json`。

**理由**：
- 索引文件体积很小（每条目约 200 字节，100 个会话也才 20KB）
- 整体写入比增量更新更简单可靠
- 避免并发写入导致的文件损坏

### D3: 保留 hangyan 路由前缀兼容

**决策**：hangyan 前缀的路由同样适用新存储逻辑，共享同一个 indexCache。

**理由**：保持向后兼容。
