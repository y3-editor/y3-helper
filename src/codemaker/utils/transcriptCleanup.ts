import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.codemaker', 'persisted', 'sessions');
const DEFAULT_MAX_AGE_DAYS = 30;

/**
 * 清理过期的 transcript 文件。
 * 扫描 ~/.codemaker/sessions/ 下所有 session 目录，
 * 删除超过 maxAgeDays 天未修改的 .jsonl 文件，
 * 并清理空目录。
 *
 * 对齐 CC 的 cleanupOldSessionFiles（30 天过期、async、逐层容错）。
 * 应在 extension 启动时异步调用一次。
 */
export async function cleanupOldTranscripts(
  maxAgeDays: number = DEFAULT_MAX_AGE_DAYS,
): Promise<{ removed: number; errors: number }> {
  let removed = 0;
  let errors = 0;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  let workspaceDirs;
  try {
    workspaceDirs = await fs.readdir(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return { removed, errors };
  }

  for (const wsDir of workspaceDirs) {
    if (!wsDir.isDirectory()) continue;
    const wsPath = path.join(SESSIONS_DIR, wsDir.name);

    let sessionDirs;
    try {
      sessionDirs = await fs.readdir(wsPath, { withFileTypes: true });
    } catch {
      errors++;
      continue;
    }

    for (const sessDir of sessionDirs) {
      if (!sessDir.isDirectory()) continue;
      const sessPath = path.join(wsPath, sessDir.name);

      let files;
      try {
        files = await fs.readdir(sessPath, { withFileTypes: true });
      } catch {
        errors++;
        continue;
      }

      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith('.jsonl')) continue;
        const filePath = path.join(sessPath, file.name);
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs < cutoff) {
            await fs.unlink(filePath);
            removed++;
          }
        } catch {
          errors++;
        }
      }

      await tryRmdir(sessPath);
    }

    await tryRmdir(wsPath);
  }

  return { removed, errors };
}

async function tryRmdir(dirPath: string): Promise<void> {
  try {
    await fs.rmdir(dirPath);
  } catch {
    // 非空或不存在，忽略
  }
}
