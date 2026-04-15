/**
 * 历史记录路由 - 处理聊天历史相关的 API 端点
 * 
 * 存储结构（索引 + 单会话文件）：
 *   globalStorage/
 *   ├── chat_index.json           ← 索引文件（元数据，不含 messages）
 *   └── sessions/                 ← 每个会话单独一个文件
 *       ├── 1.json
 *       ├── 2.json
 *       └── ...
 * 
 * 旧格式兼容：启动时自动检测 chat_histories.json 并迁移到新格式
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, renameSync } from 'fs';
import { join } from 'path';

// ============================================================
// 存储配置
// ============================================================

const storagePath = process.env.CHAT_HISTORY_PATH || '';
const indexFilePath = storagePath ? join(storagePath, 'chat_index.json') : '';
const sessionsDir = storagePath ? join(storagePath, 'sessions') : '';
const legacyFilePath = storagePath ? join(storagePath, 'chat_histories.json') : '';

// 内存中仅保留索引（不含 messages）
const indexCache = new Map();
let nextId = 1;

// ============================================================
// 索引操作
// ============================================================

/**
 * 从完整会话数据中提取索引条目（去除 data.messages）
 */
function extractIndexEntry(session) {
  return {
    _id: session._id,
    _schema_version: session._schema_version || 1,
    topic: session.topic || '',
    chat_type: session.chat_type || 'codebase',
    chat_repo: session.chat_repo || '',
    message_count: session.data?.messages?.length || 0,
    metadata: {
      create_time: session.metadata?.create_time || new Date().toISOString(),
      update_time: session.metadata?.update_time || new Date().toISOString(),
      creator: session.metadata?.creator || 'demo-user',
    },
  };
}

/**
 * 从 chat_index.json 加载索引到内存
 */
function loadIndex() {
  if (!indexFilePath) { return false; }
  try {
    if (!existsSync(indexFilePath)) { return false; }
    const raw = readFileSync(indexFilePath, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.sessions) {
      for (const entry of data.sessions) {
        indexCache.set(entry._id, entry);
      }
      nextId = data.nextId || (indexCache.size + 1);
      console.log(`[History] 从索引文件加载了 ${indexCache.size} 个会话`);
      return true;
    }
  } catch (err) {
    console.error('[History] 加载索引文件失败:', err.message);
  }
  return false;
}

/**
 * 将 indexCache 写入 chat_index.json
 */
function saveIndex() {
  if (!indexFilePath) { return; }
  try {
    if (storagePath && !existsSync(storagePath)) {
      mkdirSync(storagePath, { recursive: true });
    }
    const data = {
      nextId,
      sessions: Array.from(indexCache.values()),
    };
    writeFileSync(indexFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[History] 保存索引文件失败:', err.message);
  }
}

// ============================================================
// 单会话文件操作
// ============================================================

/**
 * 确保 sessions 目录存在
 */
function ensureSessionsDir() {
  if (sessionsDir && !existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
}

/**
 * 从 sessions/{id}.json 读取完整会话数据
 */
function loadSessionFile(id) {
  if (!sessionsDir) { return null; }
  const filePath = join(sessionsDir, `${id}.json`);
  try {
    if (!existsSync(filePath)) { return null; }
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[History] 读取会话文件 ${id}.json 失败:`, err.message);
    return null;
  }
}

/**
 * 将完整会话数据写入 sessions/{id}.json
 */
function saveSessionFile(id, session) {
  if (!sessionsDir) { return; }
  try {
    ensureSessionsDir();
    const filePath = join(sessionsDir, `${id}.json`);
    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[History] 保存会话文件 ${id}.json 失败:`, err.message);
  }
}

/**
 * 删除 sessions/{id}.json
 */
function deleteSessionFile(id) {
  if (!sessionsDir) { return; }
  const filePath = join(sessionsDir, `${id}.json`);
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[History] 删除会话文件 ${id}.json 失败:`, err.message);
  }
}

// ============================================================
// 数据迁移（旧格式 → 新格式）
// ============================================================

/**
 * 检测旧格式 chat_histories.json 并迁移到新格式
 */
function migrateFromLegacy() {
  if (!legacyFilePath || !existsSync(legacyFilePath)) { return false; }
  
  console.log('[History] 检测到旧格式 chat_histories.json，开始迁移...');
  try {
    const raw = readFileSync(legacyFilePath, 'utf-8');
    const data = JSON.parse(raw);
    
    if (!data || !data.histories) {
      console.warn('[History] 旧文件格式异常，跳过迁移');
      return false;
    }

    ensureSessionsDir();

    for (const session of data.histories) {
      // 添加 schema_version
      session._schema_version = 1;
      
      // 写入单会话文件
      saveSessionFile(session._id, session);
      
      // 提取索引条目
      const entry = extractIndexEntry(session);
      indexCache.set(session._id, entry);
    }

    nextId = data.nextId || (indexCache.size + 1);

    // 保存索引文件
    saveIndex();

    // 重命名旧文件为 .bak
    const backupPath = legacyFilePath + '.bak';
    renameSync(legacyFilePath, backupPath);

    console.log(`[History] 迁移完成：${indexCache.size} 个会话，旧文件已备份为 chat_histories.json.bak`);
    return true;
  } catch (err) {
    console.error('[History] 迁移失败:', err.message);
    return false;
  }
}

// ============================================================
// 启动初始化
// ============================================================

// 优先加载新格式索引，失败则尝试迁移旧格式
if (!loadIndex()) {
  migrateFromLegacy();
}

// ============================================================
// 会话创建与更新
// ============================================================

function makeSession(overrides = {}) {
  const id = String(nextId++);
  const now = new Date().toISOString();
  return {
    _schema_version: 1,
    _id: id,
    topic: '',
    chat_type: 'codebase',
    chat_repo: '',
    metadata: {
      create_time: now,
      update_time: now,
      creator: 'demo-user',
    },
    data: {
      messages: [],
      model: 'gpt-4o',
    },
    ...overrides,
  };
}

// ============================================================
// 查询参数处理
// ============================================================

/**
 * 解析 URL 中的查询参数
 */
function parseQueryParams(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

/**
 * 对索引列表应用过滤、排序、分页
 */
function queryIndexEntries(params) {
  let items = Array.from(indexCache.values());

  // 按 chat_type 过滤
  if (params.chat_type) {
    items = items.filter(item => item.chat_type === params.chat_type);
  }

  // 按 chat_repo 过滤
  if (params.chat_repo) {
    items = items.filter(item => item.chat_repo === params.chat_repo);
  }

  // 按 topic_content 模糊搜索
  if (params.topic_content) {
    const keyword = params.topic_content.toLowerCase();
    items = items.filter(item => (item.topic || '').toLowerCase().includes(keyword));
  }

  const total = items.length;

  // 排序（默认按 update_time 倒序）
  const sortBy = params._sort_by || '-metadata.update_time';
  const desc = sortBy.startsWith('-');
  const sortField = sortBy.replace(/^-/, '');
  
  items.sort((a, b) => {
    let valA, valB;
    if (sortField.startsWith('metadata.')) {
      const field = sortField.replace('metadata.', '');
      valA = a.metadata?.[field] || '';
      valB = b.metadata?.[field] || '';
    } else {
      valA = a[sortField] || '';
      valB = b[sortField] || '';
    }
    const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
    return desc ? -cmp : cmp;
  });

  // 分页
  const page = parseInt(params._page) || 1;
  const num = parseInt(params._num) || 0; // 0 表示不分页
  if (num > 0) {
    const start = (page - 1) * num;
    items = items.slice(start, start + num);
  }

  return { items, total };
}

// ============================================================
// 路由注册
// ============================================================

/**
 * 注册历史记录路由
 * @param {Map} routes - 路由映射
 */
export function registerHistoryRoutes(routes) {

  // GET /proxy/gpt/u5_chat/chat_histories - 获取会话列表
  routes.set('GET:/proxy/gpt/u5_chat/chat_histories', (req, res) => {
    const params = parseQueryParams(req);
    const { items, total } = queryIndexEntries(params);

    // 如果没有 _exclude=data，需要为每个 item 附带完整数据
    // 但前端通常会传 _exclude=data，此时只返回索引信息
    let resultItems;
    if (params._exclude && params._exclude.includes('data')) {
      resultItems = items;
    } else {
      // 兼容：如果前端没传 _exclude，返回完整数据
      resultItems = items.map(entry => {
        const session = loadSessionFile(entry._id);
        return session || entry;
      });
    }

    console.log(`[History] GET all - 返回 ${resultItems.length}/${total} 个会话`);
    sendJson(res, { items: resultItems, total });
  });

  // POST /proxy/gpt/u5_chat/chat_histories - 创建新会话
  routes.set('POST:/proxy/gpt/u5_chat/chat_histories', (req, res, body) => {
    const session = makeSession({
      topic: body.topic || '',
      chat_type: body.chat_type || 'codebase',
      chat_repo: body.chat_repo || '',
      data: body.data || { messages: [], model: 'gpt-4o' },
    });

    // 保存会话文件
    saveSessionFile(session._id, session);
    // 更新索引
    indexCache.set(session._id, extractIndexEntry(session));
    saveIndex();

    console.log(`[History] POST - 创建会话 ${session._id}`);
    sendJson(res, session);
  });

  // GET /proxy/gpt/u5_chat/chat_histories/:id - 获取单个会话（含完整消息）
  routes.set('GET:/proxy/gpt/u5_chat/chat_histories/:id', (req, res) => {
    const id = req.params?.id;
    let session = loadSessionFile(id);

    if (!session) {
      // 不存在则创建
      session = makeSession({ _id: id });
      saveSessionFile(id, session);
      indexCache.set(id, extractIndexEntry(session));
      saveIndex();
    }

    console.log(`[History] GET /${id} - messages: ${session.data?.messages?.length || 0}`);
    sendJson(res, session);
  });

  // PUT /proxy/gpt/u5_chat/chat_histories/:id - 更新会话
  routes.set('PUT:/proxy/gpt/u5_chat/chat_histories/:id', (req, res, body) => {
    const id = req.params?.id;

    // 读取现有会话（或创建新的）
    let existing = loadSessionFile(id);
    if (!existing) {
      existing = makeSession({ _id: id });
    }

    const updated = {
      ...existing,
      ...body,
      _id: existing._id,     // ID 不可覆盖
      _schema_version: 1,
      metadata: {
        ...existing.metadata,
        ...(body.metadata || {}),
        update_time: new Date().toISOString(),
      },
    };

    // 保存会话文件
    saveSessionFile(id, updated);
    // 更新索引
    indexCache.set(id, extractIndexEntry(updated));
    saveIndex();

    console.log(`[History] PUT /${id} - messages: ${updated.data?.messages?.length || 0}`);
    sendJson(res, updated);
  });

  // PATCH /proxy/gpt/u5_chat/chat_histories/:id - 部分更新会话
  routes.set('PATCH:/proxy/gpt/u5_chat/chat_histories/:id', (req, res, body) => {
    const id = req.params?.id;

    let existing = loadSessionFile(id);
    if (!existing) {
      existing = makeSession({ _id: id });
    }

    const updated = {
      ...existing,
      ...body,
      _id: existing._id,
      _schema_version: 1,
      metadata: {
        ...existing.metadata,
        ...(body.metadata || {}),
        update_time: new Date().toISOString(),
      },
    };

    saveSessionFile(id, updated);
    indexCache.set(id, extractIndexEntry(updated));
    saveIndex();

    sendJson(res, updated);
  });

  // DELETE /proxy/gpt/u5_chat/chat_histories/:id - 删除会话
  routes.set('DELETE:/proxy/gpt/u5_chat/chat_histories/:id', (req, res) => {
    const id = req.params?.id;
    indexCache.delete(id);
    deleteSessionFile(id);
    saveIndex();

    console.log(`[History] DELETE /${id}`);
    sendJson(res, { code: 0, message: 'Deleted' });
  });

  // ============================================================
  // Hangyan 前缀路由（复用逻辑）
  // ============================================================

  routes.set('GET:/proxy/gpt/hangyan/u5_chat/chat_histories', (req, res) => {
    const params = parseQueryParams(req);
    const { items, total } = queryIndexEntries(params);

    let resultItems;
    if (params._exclude && params._exclude.includes('data')) {
      resultItems = items;
    } else {
      resultItems = items.map(entry => {
        const session = loadSessionFile(entry._id);
        return session || entry;
      });
    }

    sendJson(res, { items: resultItems, total });
  });

  routes.set('POST:/proxy/gpt/hangyan/u5_chat/chat_histories', (req, res, body) => {
    const session = makeSession({
      topic: body.topic || '',
      chat_type: body.chat_type || 'codebase',
      chat_repo: body.chat_repo || '',
      data: body.data || { messages: [], model: 'gpt-4o' },
    });

    saveSessionFile(session._id, session);
    indexCache.set(session._id, extractIndexEntry(session));
    saveIndex();

    sendJson(res, session);
  });
}

// ============================================================
// 导出函数（供外部模块使用）
// ============================================================

/**
 * 根据 ID 获取或创建会话
 */
export function getOrCreateSession(id) {
  let session = loadSessionFile(id);
  if (!session) {
    session = makeSession({ _id: id });
    saveSessionFile(id, session);
    indexCache.set(id, extractIndexEntry(session));
    saveIndex();
  }
  return session;
}

/**
 * 更新会话
 */
export function updateSession(id, updates) {
  let existing = loadSessionFile(id);
  if (!existing) {
    existing = makeSession({ _id: id });
  }

  const updated = {
    ...existing,
    ...updates,
    _id: existing._id,
    _schema_version: 1,
    metadata: {
      ...existing.metadata,
      ...(updates.metadata || {}),
      update_time: new Date().toISOString(),
    },
  };

  saveSessionFile(id, updated);
  indexCache.set(id, extractIndexEntry(updated));
  saveIndex();

  return updated;
}

// ============================================================
// 工具函数
// ============================================================

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}