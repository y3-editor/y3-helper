# Tasks

## Task 1: 重构存储层 — 索引 + 单文件
**模块**: `resources/codemaker/api-server/routes/history.mjs`
**预估**: 1.5h

- [x] 将 `chatHistories` Map 改为 `indexCache` Map（仅存索引条目，不含 messages）
- [x] 实现 `loadIndex()`: 从 `chat_index.json` 加载索引到内存
- [x] 实现 `saveIndex()`: 将 indexCache 写入 `chat_index.json`
- [x] 实现 `loadSessionFile(id)`: 从 `sessions/{id}.json` 读取完整会话
- [x] 实现 `saveSessionFile(id, data)`: 将完整会话写入 `sessions/{id}.json`
- [x] 实现 `deleteSessionFile(id)`: 删除 `sessions/{id}.json`
- [x] 实现 `extractIndexEntry(session)`: 从完整会话提取索引条目（去除 data.messages）

## Task 2: 改造路由处理器
**模块**: `resources/codemaker/api-server/routes/history.mjs`
**预估**: 1h

- [x] GET /chat_histories: 从 indexCache 读取，支持 `_exclude`、`_page`、`_num`、`_sort_by`、`chat_type`、`topic_content` 参数
- [x] GET /chat_histories/:id: 从 `sessions/{id}.json` 按需读取
- [x] POST /chat_histories: 创建索引条目 + 会话文件
- [x] PUT /chat_histories/:id: 更新会话文件 + 同步索引
- [x] PATCH /chat_histories/:id: 同 PUT 逻辑
- [x] DELETE /chat_histories/:id: 删除会话文件 + 移除索引
- [x] hangyan 路由复用新逻辑

## Task 3: 数据迁移
**模块**: `resources/codemaker/api-server/routes/history.mjs`
**预估**: 0.5h

- [x] 实现 `migrateFromLegacy()`: 检测旧 `chat_histories.json` 并迁移
  - 解析旧文件
  - 为每个 session 创建 `sessions/{id}.json`
  - 提取元数据生成 `chat_index.json`
  - 重命名旧文件为 `chat_histories.json.bak`
- [x] 启动时调用迁移逻辑（在 `loadIndex()` 失败时触发）

## Task 4: 测试验证
**预估**: 0.5h

- [x] 验证全新安装（无历史数据）正常工作
- [x] 验证旧数据迁移后历史会话完整保留
- [x] 验证创建/加载/更新/删除会话功能
- [x] 验证分页和排序参数生效
- [x] 验证会话数量多时（50+）列表加载性能
