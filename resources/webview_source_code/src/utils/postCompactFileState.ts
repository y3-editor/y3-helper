import { ChatMessage } from '../services';
import { ChatRole } from '../types/chat';
import { callIDETool } from '../PostMessageProvider';

// ============================================================================
// 压缩后最近文件恢复
//
// 压缩后模型丢失之前 Read/Edit/Write 过的文件内容。
// 本模块从被压缩的消息中提取最近操作的文件路径，
// 通过 IDE 扩展重新读取最新内容，注入到压缩摘要中。
// 对齐 Claude Code 的 createPostCompactFileAttachments 逻辑。
// ============================================================================

const POST_COMPACT_MAX_FILES = 5;
const POST_COMPACT_TOTAL_TOKEN_BUDGET = 50_000;
const POST_COMPACT_PER_FILE_TOKEN_LIMIT = 5_000;

const FILE_TOOL_NAMES = new Set([
  'read_file',
  'edit_file',
  'replace_in_file',
  'create_file',
  'write_to_file',
]);

interface FilePathEntry {
  path: string;
  messageIndex: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * 从消息历史中提取最近操作的文件路径（只要路径，不要内容）。
 * 正向遍历，后出现的同路径覆盖先出现的（保留最新位置索引）。
 */
export function extractFilePathsFromMessages(messages: ChatMessage[]): FilePathEntry[] {
  const pathMap = new Map<string, FilePathEntry>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== ChatRole.Assistant || !msg.tool_calls) continue;

    for (const tc of msg.tool_calls) {
      if (!tc.id || !tc.function?.name) continue;
      if (!FILE_TOOL_NAMES.has(tc.function.name)) continue;

      try {
        const args = JSON.parse(tc.function.arguments || '{}');
        if (args.path) {
          pathMap.set(args.path, { path: args.path, messageIndex: i });
        }
      } catch {
        continue;
      }
    }
  }

  return Array.from(pathMap.values());
}

/**
 * 按最近访问时间排序，选择 top N 文件路径。
 */
function selectTopRecentPaths(
  entries: FilePathEntry[],
  maxFiles = POST_COMPACT_MAX_FILES,
): FilePathEntry[] {
  return [...entries]
    .sort((a, b) => b.messageIndex - a.messageIndex)
    .slice(0, maxFiles);
}

/**
 * 从保留消息中收集文件路径（用于去重），复用 extractFilePathsFromMessages
 */
function collectFilePathsFromMessages(messages: ChatMessage[]): Set<string> {
  return new Set(extractFilePathsFromMessages(messages).map((e) => e.path));
}

/**
 * 将文件内容格式化为可注入压缩摘要的文本块
 */
function formatFileAttachmentsBlock(
  files: { path: string; content: string }[],
): string {
  if (files.length === 0) return '';

  const fileBlocks = files
    .map((f) => `<file_content path="${f.path}">\n${f.content}\n</file_content>`)
    .join('\n\n');

  return (
    `\n\n<system-reminder>\n` +
    `The following ${files.length} file(s) were recently accessed before context compression and are provided for reference continuity:\n` +
    `</system-reminder>\n\n` +
    fileBlocks
  );
}

/**
 * 对外入口：从被压缩的消息中提取最近文件路径，通过 IDE 重新读取最新内容，
 * 去重后格式化为注入块。
 *
 * @param compressedMessages 被压缩的原始消息
 * @param uncompressedMessages 压缩后保留的近期消息（用于去重，可选）
 * @returns 格式化后的文件块字符串，为空时返回空字符串
 */
export async function createPostCompactFileBlock(
  compressedMessages: ChatMessage[],
  uncompressedMessages?: ChatMessage[],
): Promise<string> {
  const entries = extractFilePathsFromMessages(compressedMessages);
  if (entries.length === 0) return '';

  // 去重：排除已在保留消息中可见的文件
  const recentPaths = uncompressedMessages?.length
    ? collectFilePathsFromMessages(uncompressedMessages)
    : new Set<string>();

  const deduped = entries.filter((e) => !recentPaths.has(e.path));
  if (deduped.length === 0) return '';

  const selected = selectTopRecentPaths(deduped);

  // 通过 IDE 并行读取所有文件
  const readResults = await Promise.all(
    selected.map(async (entry) => {
      const result = await callIDETool('read_file', { path: entry.path });
      return result?.content ? { path: entry.path, content: result.content } : null;
    }),
  );

  // 按 token 预算过滤，超出单文件预算的改为引用提示（对齐 CC compact_file_reference）
  const files: { path: string; content: string }[] = [];
  let usedTokens = 0;

  for (const result of readResults) {
    if (!result) continue;

    const tokens = estimateTokens(result.content);

    if (tokens > POST_COMPACT_PER_FILE_TOKEN_LIMIT) {
      // 文件过大，不截断内容，改为引用提示，让模型按需重新读取
      const refContent = `Note: ${result.path} was read before the last conversation was summarized, but the contents are too large to include. Use read_file tool if you need to access it.`;
      const refTokens = estimateTokens(refContent);
      if (usedTokens + refTokens <= POST_COMPACT_TOTAL_TOKEN_BUDGET) {
        usedTokens += refTokens;
        files.push({ path: result.path, content: refContent });
      }
      continue;
    }

    if (usedTokens + tokens > POST_COMPACT_TOTAL_TOKEN_BUDGET) continue;

    usedTokens += tokens;
    files.push({ path: result.path, content: result.content });
  }

  return formatFileAttachmentsBlock(files);
}