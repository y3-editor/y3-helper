import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/**
 * 须与 codemaker-web-ui `src/utils/toolResultPersistenceConstants.ts` 保持完全一致（prompt cache 前缀稳定）。
 */
export const PERSISTED_TOOL_OUTPUT_MARKER = '<persisted-output>';
const PERSISTED_TOOL_OUTPUT_CLOSING_MARKER = '</persisted-output>';

/** 对齐 Claude Code `PREVIEW_SIZE_BYTES` 语义（字符近似） */
export const TOOL_RESULT_PREVIEW_MAX_CHARS = 2000;

/** 对齐 Claude Code `DEFAULT_MAX_RESULT_SIZE_CHARS`（50k）量级 */
export const TOOL_RESULT_PERSIST_THRESHOLD_CHARS = 50_000;

/** 对齐 Claude Code 默认清理策略：超过该时间的落盘文件删除（30 天） */
const TOOL_RESULTS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const TOOL_RESULTS_CLEANUP_START_DELAY_MS = 8000;
const TOOL_RESULTS_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const TOOL_RESULTS_DIR_NAME = 'tool-results';

function getBaseDir(): string {
  return path.join(os.homedir(), '.codemaker', 'persisted');
}

let toolResultsCleanupStartTimer: NodeJS.Timeout | null = null;
let toolResultsCleanupIntervalTimer: NodeJS.Timeout | null = null;

function normalizeSessionId(sessionId?: string): string {
  const id = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!id) return 'default';
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    return 'default';
  }
  return id;
}

/**
 * 路径: ~/.codemaker/<sessionId>/tool-results/
 */
export function getToolResultsDir(sessionId?: string): string {
  return path.join(
    getBaseDir(),
    normalizeSessionId(sessionId),
    TOOL_RESULTS_DIR_NAME,
  );
}

function getPositiveIntegerConfig(
  key: string,
  fallback: number,
  min: number = 1,
): number {
  const configuration = vscode.workspace.getConfiguration('Y3Maker', undefined);
  const raw = configuration.get<number>(key, fallback);
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const normalized = Math.floor(n);
  return normalized >= min ? normalized : fallback;
}

function getToolResultPersistThresholdChars(): number {
  return getPositiveIntegerConfig(
    'ToolResultPersistThresholdChars',
    TOOL_RESULT_PERSIST_THRESHOLD_CHARS,
    1000,
  );
}

function getToolResultPreviewMaxChars(): number {
  return getPositiveIntegerConfig(
    'ToolResultPreviewMaxChars',
    TOOL_RESULT_PREVIEW_MAX_CHARS,
    100,
  );
}

function getToolResultsMaxAgeMs(): number {
  const maxAgeDays = getPositiveIntegerConfig(
    'ToolResultCleanupMaxAgeDays',
    Math.floor(TOOL_RESULTS_MAX_AGE_MS / (24 * 60 * 60 * 1000)),
    1,
  );
  return maxAgeDays * 24 * 60 * 60 * 1000;
}

/**
 * 从可能的 JSON content block 数组中提取纯文本。
 * 输入可能是：
 * - 纯文本字符串：直接返回
 * - JSON 序列化的 content block 数组：如 [{"type":"text","text":"..."}]
 *   提取所有 text block 的 text 字段，用换行符连接
 */
function extractTextFromContentBlocks(content: string): string {
  if (content.length === 0) return content;
  if (content[0] !== '[') return content;
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return content;
    const texts = parsed
      .filter((block: any) => block && block.type === 'text' && typeof block.text === 'string')
      .map((block: any) => block.text);
    return texts.length > 0 ? texts.join('\n') : content;
  } catch {
    // 不是合法 JSON，原样返回
    return content;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function buildPersistedToolMessage(
  absoluteFilePath: string,
  fullContent: string,
  previewMaxChars: number,
  preview: string,
  hasMore: boolean,
): string {
  // 对齐 CC buildLargeToolResultMessage: 用文件大小而非字符数
  const contentBytes = Buffer.byteLength(fullContent, 'utf8');
  const previewBytes = previewMaxChars; // 近似值，previewMaxChars ≈ previewBytes
  let msg = `${PERSISTED_TOOL_OUTPUT_MARKER}\n`;
  msg += `Output too large (${formatFileSize(contentBytes)}). Full output saved to: ${absoluteFilePath}\n`;
  msg += `Use read_file to view the full output.\n\n`;
  msg += `Preview (first ${formatFileSize(previewBytes)}):\n${preview}`;
  if (hasMore) msg += '\n...\n';
  msg += `\n${PERSISTED_TOOL_OUTPUT_CLOSING_MARKER}`;
  return msg;
}

function generatePreview(
  content: string,
  maxChars: number,
): { preview: string; hasMore: boolean } {
  if (content.length <= maxChars) {
    return { preview: content, hasMore: false };
  }
  const truncated = content.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf('\n');
  const cut = lastNewline > maxChars * 0.5 ? lastNewline : maxChars;
  return { preview: content.slice(0, cut), hasMore: true };
}

/**
 * 删除会话对应的 tool-results 目录（~/.codemaker/<sessionId>/ 子树）。
 * 会话删除时调用，清理落盘的工具结果文件。
 */
export async function cleanSessionFiles(sessionId?: string): Promise<void> {
  const normalized = normalizeSessionId(sessionId);
  if (normalized === 'default') return; // 拒绝清理 default 目录，防止非法 id 误删

  const sessionDir = path.join(getBaseDir(), normalized);
  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    console.log(`[persistToolResult] cleaned session dir: ${sessionDir}`);
  } catch (e) {
    console.log(`[persistToolResult] cleanSessionFiles failed: ${String(e)}`);
  }
}

/**
 * 将 tool output 落盘为文件，并返回确定性引用文本。
 * 幂等：同一 toolId + sessionId → 同一文件路径 → 同一引用文本。
 * 失败返回 null，调用方沿用原始 content。
 *
 * @param options.toolId - 工具调用 ID，用作文件名
 * @param options.sessionId - 会话 ID，用于目录隔离
 * @param options.content - 要落盘的内容
 * @param options.isError - 是否为错误结果（错误结果不落盘）
 * @param options.skipThresholdCheck - 跳过字符阈值检查（prune 场景按 token 预算决策，不限字符长度）
 */
export async function persistToolResultToDisk(options: {
  toolId: string;
  sessionId?: string;
  content: string;
  isError?: boolean;
  skipThresholdCheck?: boolean;
}): Promise<{
  content: string;
  persistedFilePath: string;
  persistedFileSize: number;
} | null> {
  const { toolId, sessionId, content, isError = false, skipThresholdCheck = false } = options;
  // 对齐 CC: content 可能是 JSON 序列化的 content block 数组（如 [{"type":"text","text":"..."}]）
  // 需要提取纯文本再落盘，否则 \n 是字面量而不是换行符
  let fullContent = extractTextFromContentBlocks(content);
  const persistThresholdChars = getToolResultPersistThresholdChars();
  const previewMaxChars = getToolResultPreviewMaxChars();

  if (isError || typeof fullContent !== 'string') return null;
  if (fullContent.length === 0) return null;
  // 已是落盘引用的内容不再二次落盘（避免 read_file 读取落盘文件后再次触发落盘）
  if (fullContent.startsWith(PERSISTED_TOOL_OUTPUT_MARKER)) return null;
  if (!skipThresholdCheck && fullContent.length <= persistThresholdChars) return null;

  const dir = getToolResultsDir(sessionId);
  const filePath = path.join(dir, `${toolId}.txt`);

  try {
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.writeFile(filePath, fullContent, { encoding: 'utf8', flag: 'wx' });
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code !== 'EEXIST') throw e;
      // 文件已存在（幂等），读取以生成一致的 preview
      fullContent = await fs.readFile(filePath, 'utf8');
    }
  } catch (e) {
    console.log(`[persistToolResult] write/read failed: ${String(e)}`);
    return null;
  }

  const { preview, hasMore } = generatePreview(
    fullContent,
    previewMaxChars,
  );
  const message = buildPersistedToolMessage(
    filePath,
    fullContent,
    previewMaxChars,
    preview,
    hasMore,
  );
  return {
    content: message,
    persistedFilePath: filePath,
    persistedFileSize: Buffer.byteLength(fullContent, 'utf8'),
  };
}

/**
 * 超长工具结果落盘的兼容包装，供 toolCall.ts 使用。
 * 内部委托给 persistToolResultToDisk，返回值包含 extra 字段以保持向后兼容。
 * 新代码应直接使用 persistToolResultToDisk。
 */
export async function maybePersistToolResultToDisk(options: {
  toolId: string;
  sessionId?: string;
  content: string;
  isError: boolean;
}): Promise<{
  content: string;
  extra: {
    toolResultPersisted: boolean;
    persistedFilePath: string;
    persistedFileSize: number;
  };
} | null> {
  const result = await persistToolResultToDisk({
    toolId: options.toolId,
    sessionId: options.sessionId,
    content: options.content,
    isError: options.isError,
  });
  if (!result) return null;
  return {
    content: result.content,
    extra: {
      toolResultPersisted: true,
      persistedFilePath: result.persistedFilePath,
      persistedFileSize: result.persistedFileSize,
    },
  };
}

/**
 * 删除 tool-results 下过期的 .txt（默认 30 天，可通过配置覆盖）。
 */
export async function cleanupOldToolResultFiles(
  maxAgeMs?: number,
): Promise<void> {
  const effectiveMaxAgeMs = maxAgeMs ?? getToolResultsMaxAgeMs();
  const baseDir = getBaseDir();
  const dirs: string[] = [];
  try {
    const sessionDirs = await fs.readdir(baseDir, { withFileTypes: true });
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) continue;
      const toolResultsDir = path.join(
        baseDir,
        sessionDir.name,
        TOOL_RESULTS_DIR_NAME,
      );
      try {
        const st = await fs.stat(toolResultsDir);
        if (st.isDirectory()) dirs.push(toolResultsDir);
      } catch {
        /* ignore */
      }
    }
  } catch {
    // ~/.codemaker 目录不存在
    return;
  }

  if (!dirs.length) return;
  const cutoff = Date.now() - effectiveMaxAgeMs;
  for (const dir of dirs) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith('.txt')) continue;
      const fp = path.join(dir, name);
      try {
        const st = await fs.stat(fp);
        if (st.mtimeMs < cutoff) {
          await fs.unlink(fp);
          console.log(`[persistToolResult] cleaned old file: ${fp}`);
        }
      } catch {
        /* ignore */
      }
    }
    // 文件清理后尝试删除空目录（非空时 rmdir 抛 ENOTEMPTY，忽略即可）
    try {
      await fs.rmdir(dir);
      await fs.rmdir(path.dirname(dir));
    } catch {
      /* ignore */
    }
  }
}

/** 扩展激活后延迟执行，避免阻塞启动 */
export function scheduleToolResultsCleanup(): void {
  if (toolResultsCleanupStartTimer || toolResultsCleanupIntervalTimer) return;

  toolResultsCleanupStartTimer = setTimeout(() => {
    toolResultsCleanupStartTimer = null;
    void cleanupOldToolResultFiles();

    toolResultsCleanupIntervalTimer = setInterval(() => {
      void cleanupOldToolResultFiles();
    }, TOOL_RESULTS_CLEANUP_INTERVAL_MS);
    toolResultsCleanupIntervalTimer.unref?.();
  }, TOOL_RESULTS_CLEANUP_START_DELAY_MS);
  toolResultsCleanupStartTimer.unref?.();
}

export function disposeToolResultsCleanup(): void {
  if (toolResultsCleanupStartTimer) {
    clearTimeout(toolResultsCleanupStartTimer);
    toolResultsCleanupStartTimer = null;
  }
  if (toolResultsCleanupIntervalTimer) {
    clearInterval(toolResultsCleanupIntervalTimer);
    toolResultsCleanupIntervalTimer = null;
  }
}

// ── 一键清理功能 ──

const SESSIONS_DIR_NAME = 'sessions';
const SKIP_DIRS = new Set(['default', SESSIONS_DIR_NAME]);

/**
 * 递归统计目录内所有文件的总字节数和文件数。
 */
async function getDirStats(dirPath: string): Promise<{ totalBytes: number; fileCount: number }> {
  let totalBytes = 0;
  let fileCount = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          totalBytes += stat.size;
          fileCount++;
        } catch { /* ignore */ }
      } else if (entry.isDirectory()) {
        const sub = await getDirStats(fullPath);
        totalBytes += sub.totalBytes;
        fileCount += sub.fileCount;
      }
    }
  } catch { /* ignore */ }
  return { totalBytes, fileCount };
}

/**
 * 清理失效落盘文件：逐个查询会话是否存在于服务端，不存在则删除本地文件。
 * 同时清理 tool-results 目录和 sessions 下的 transcript 目录。
 *
 * 安全机制：连续 error >= 3 且 error 占比 > 50% 时中止（网络异常保护）。
 */
export async function cleanupInvalidPersistedFiles(): Promise<{
  checked: number;
  removedFiles: number;
  freedBytes: number;
  errors: number;
  aborted: boolean;
}> {
  // Y3Helper: 上游通过查询服务端历史会话校验本地文件有效性，
  // Y3 不依赖后端 chatHistory，按时间过期清理（cleanupOldToolResultFiles + transcriptCleanup）即可。
  // 此函数保留 stub，避免调用方报错。
  const checkChatSessionExists = async (_sessionId: string): Promise<'exists' | 'not_found' | 'error'> => 'exists';

  const baseDir = getBaseDir();
  let checked = 0;
  let removedFiles = 0;
  let freedBytes = 0;
  let errors = 0;
  let aborted = false;

  // 收集 sessionId 目录（~/.codemaker/<sessionId>/）
  let topEntries: import('fs').Dirent<string>[];
  try {
    topEntries = await fs.readdir(baseDir, { withFileTypes: true, encoding: 'utf-8' }) as import('fs').Dirent<string>[];
  } catch {
    return { checked, removedFiles, freedBytes, errors, aborted };
  }

  const sessionIds = topEntries
    .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
    .map(e => e.name);

  // 逐个查询
  for (const sessionId of sessionIds) {
    const result = await checkChatSessionExists(sessionId);
    checked++;

    if (result === 'error') {
      errors++;
      // 安全机制：error 太多则中止
      if (errors >= 3 && errors / checked > 0.5) {
        aborted = true;
        break;
      }
      continue;
    }

    if (result === 'exists') continue;

    // not_found → 清理 tool-results 目录
    const sessionDir = path.join(baseDir, sessionId);
    const stats = await getDirStats(sessionDir);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
      removedFiles += stats.fileCount;
      freedBytes += stats.totalBytes;
      console.log(`[cleanupInvalid] removed session dir: ${sessionDir} (${formatFileSize(stats.totalBytes)})`);
    } catch {
      errors++;
    }

    // 同时清理 sessions 下匹配的 transcript 目录
    const sessionsDir = path.join(baseDir, SESSIONS_DIR_NAME);
    try {
      const workspaceDirs = await fs.readdir(sessionsDir, { withFileTypes: true });
      for (const wsDir of workspaceDirs) {
        if (!wsDir.isDirectory()) continue;
        const transcriptDir = path.join(sessionsDir, wsDir.name, sessionId);
        try {
          const tStats = await getDirStats(transcriptDir);
          if (tStats.fileCount > 0) {
            await fs.rm(transcriptDir, { recursive: true, force: true });
            removedFiles += tStats.fileCount;
            freedBytes += tStats.totalBytes;
            console.log(`[cleanupInvalid] removed transcript dir: ${transcriptDir}`);
          }
        } catch { /* transcript dir doesn't exist, skip */ }
      }
    } catch { /* sessions dir doesn't exist, skip */ }
  }

  return { checked, removedFiles, freedBytes, errors, aborted };
}

/**
 * 清理所有落盘文件：删除所有 tool-results 和 transcript 文件。
 */
export async function cleanupAllPersistedFiles(): Promise<{
  removedFiles: number;
  freedBytes: number;
  errors: number;
}> {
  const baseDir = getBaseDir();
  let removedFiles = 0;
  let freedBytes = 0;
  let errors = 0;

  // 1. 清理 tool-results 目录（~/.codemaker/<sessionId>/）
  try {
    const topEntries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of topEntries) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
      const sessionDir = path.join(baseDir, entry.name);
      try {
        const stats = await getDirStats(sessionDir);
        await fs.rm(sessionDir, { recursive: true, force: true });
        removedFiles += stats.fileCount;
        freedBytes += stats.totalBytes;
      } catch {
        errors++;
      }
    }
  } catch { /* baseDir doesn't exist */ }

  // 2. 清理 transcript 目录（~/.codemaker/sessions/*/）
  const sessionsDir = path.join(baseDir, SESSIONS_DIR_NAME);
  try {
    const workspaceDirs = await fs.readdir(sessionsDir, { withFileTypes: true });
    for (const wsDir of workspaceDirs) {
      if (!wsDir.isDirectory()) continue;
      const wsPath = path.join(sessionsDir, wsDir.name);
      try {
        const sessionDirs = await fs.readdir(wsPath, { withFileTypes: true });
        for (const sessDir of sessionDirs) {
          if (!sessDir.isDirectory()) continue;
          const sessPath = path.join(wsPath, sessDir.name);
          try {
            const stats = await getDirStats(sessPath);
            await fs.rm(sessPath, { recursive: true, force: true });
            removedFiles += stats.fileCount;
            freedBytes += stats.totalBytes;
          } catch {
            errors++;
          }
        }
      } catch { /* ignore */ }
      // 清理空的 workspace 目录
      try { await fs.rmdir(wsPath); } catch { /* non-empty */ }
    }
  } catch { /* sessions dir doesn't exist */ }

  return { removedFiles, freedBytes, errors };
}
