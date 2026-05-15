import { ChatMessage } from '../services';
import { ChatRole } from '../types/chat';
import { callIDETool } from '../PostMessageProvider';
import { useWorkspaceStore } from '../store/workspace';

// ============================================================================
// 本地 JSONL Transcript 系统
//
// 每次压缩创建一个独立的 .jsonl 文件，只存当次被压缩的消息。
// 压缩摘要中注入该文件路径，形成递归链：
//   Compress2_summary → transcript_2.jsonl
//     内含 Compress1_summary → transcript_1.jsonl
//       内含 Compress0_summary → transcript_0.jsonl
// 模型可沿链逐层回溯完整对话历史。
// ============================================================================

const MAX_SANITIZED_LENGTH = 200;

// ----------------------------------------------------------------------------
// 路径计算
// ----------------------------------------------------------------------------

/**
 * 对齐 CC 的 sanitizePath：非字母数字替换为 -，超长截断 + hash。
 */
function sanitizePath(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9]/g, '-');
  if (sanitized.length <= MAX_SANITIZED_LENGTH) {
    return sanitized;
  }
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) >>> 0;
  }
  return `${sanitized.slice(0, MAX_SANITIZED_LENGTH)}-${hash.toString(36)}`;
}

function getSessionTranscriptDir(sessionId: string): string {
  const { homePath, workspace } = useWorkspaceStore.getState().workspaceInfo;
  if (!homePath || !workspace) return '';
  // 统一正斜杠，避免 Windows 下 homePath 反斜杠与手写正斜杠混用
  const home = homePath.replace(/\\/g, '/');
  return `${home}/.codemaker/persisted/sessions/${sanitizePath(workspace)}/${sessionId}`;
}

// ----------------------------------------------------------------------------
// 消息序列化
// ----------------------------------------------------------------------------

/** 序列化到 JSONL 时保留的字段（白名单） */
const INCLUDED_KEYS = new Set([
  'id',
  'role',
  'content',
  'tool_calls',
  'tool_call_id',
  'tool_result',
  'createdAt',
  'reasoning_content',
  'thinking_signature',
  'redacted_thinking',
  'name',
]);

function mapRole(role: ChatRole): string {
  switch (role) {
    case ChatRole.User: return 'user';
    case ChatRole.Assistant: return 'assistant';
    case ChatRole.Tool: return 'tool';
    default: return 'user';
  }
}

/**
 * 序列化单条消息为 JSONL 行。
 * 保留旧 compress summary 中的 transcript 引用（链式追溯的关键）。
 */
function serializeMessage(msg: ChatMessage): string {
  const entry: Record<string, unknown> = {
    type: mapRole(msg.role),
  };

  for (const [key, value] of Object.entries(msg)) {
    if (!INCLUDED_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (key === 'role') {
      entry.role = mapRole(value as ChatRole);
      continue;
    }
    entry[key] = value;
  }

  if (!entry.createdAt) {
    entry.createdAt = Date.now();
  }

  return JSON.stringify(entry) + '\n';
}

/**
 * 序列化 compact_boundary 标记。
 */
function serializeBoundary(messagesSummarized: number): string {
  return JSON.stringify({
    type: 'system',
    subtype: 'compact_boundary',
    content: 'Conversation compacted',
    timestamp: Date.now(),
    compactMetadata: {
      trigger: 'auto',
      messagesSummarized,
    },
  }) + '\n';
}

// ----------------------------------------------------------------------------
// 对外接口
// ----------------------------------------------------------------------------

/**
 * 将本次被压缩的消息写入独立的 transcript 文件。
 * 每次压缩创建一个新文件，文件名基于时间戳。
 * 旧 compress summary 中的 transcript 引用保留（形成递归链）。
 *
 * @param sessionId 会话 ID
 * @param messages 本次被压缩的消息（含旧 compress summary 及其链式引用）
 * @returns 写入的文件绝对路径，失败返回 null
 */
export async function writeTranscript(
  sessionId: string,
  messages: ChatMessage[],
): Promise<string | null> {
  const dir = getSessionTranscriptDir(sessionId);
  if (!dir || messages.length === 0) return null;

  const filePath = `${dir}/${Date.now()}.jsonl`;
  const content =
    messages.map(serializeMessage).join('') +
    serializeBoundary(messages.length);

  const result = await callIDETool('internal_fs', {
    action: 'write',
    path: filePath,
    content,
    mkdirp: true,
  }, 10000);

  return result?.isError === false ? filePath : null;
}

/**
 * 删除会话的所有 transcript 文件（fire-and-forget）。
 */
export function deleteTranscript(sessionId: string): void {
  const dir = getSessionTranscriptDir(sessionId);
  if (!dir) return;

  void callIDETool('internal_fs', {
    action: 'rmdir',
    path: dir,
  }, 3000);
}

/**
 * 分支/复制会话时迁移 transcript 引用。
 * 1. 复制源 session 的 transcript 目录到新 session 目录
 * 2. 替换消息中 compress summary 的 transcript 路径引用
 *
 * @param messages 新会话的消息数组（会被就地修改）
 * @param sourceSessionId 源会话 ID
 * @param targetSessionId 新会话 ID
 */
export async function migrateTranscriptRefs(
  messages: ChatMessage[],
  sourceSessionId: string,
  targetSessionId: string,
): Promise<void> {
  const sourceDir = getSessionTranscriptDir(sourceSessionId);
  const targetDir = getSessionTranscriptDir(targetSessionId);
  if (!sourceDir || !targetDir || sourceSessionId === targetSessionId) return;

  // 复制 transcript 文件目录
  await callIDETool('internal_fs', {
    action: 'copydir',
    path: sourceDir,
    content: targetDir,
  }, 10000);

  // 替换 compress summary 中的旧路径为新路径
  for (const msg of messages) {
    if (!msg.isCompressionSummary || typeof msg.content !== 'string') continue;
    if (!msg.content.includes(sourceDir)) continue;
    msg.content = msg.content.split(sourceDir).join(targetDir);
  }
}