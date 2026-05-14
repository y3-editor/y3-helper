/**
 * RTK Rewriter (non-Windows) — 对齐上游 src/utils/rtk/rtkRewriter.ts
 *
 * Rewrite command via `rtk rewrite` subprocess.
 */
import { execFile } from 'child_process';

const REWRITE_TIMEOUT_MS = 5000;

export async function rewriteCommandViaRtk(
  command: string,
  rtkPath: string,
): Promise<string> {
  if (command.includes('git diff')) {
    console.log(`[RTK] skip rewrite for git diff | "${command}"`);
    return command;
  }

  if (command.startsWith('rtk ') || command === 'rtk') {
    console.log(
      `[RTK] command starts with 'rtk ' — direct path replacement (skip rewrite) | "${command}"`,
    );
    return replaceRtkWithAbsolutePath(command, rtkPath);
  }

  try {
    const result = await execRtkRewrite(rtkPath, command);

    console.log(
      `[RTK] rewrite exit=${result.exitCode} | original="${command}" | result="${result.stdout.trim() || '(passthrough)'}"`,
    );

    if ((result.exitCode === 0 || result.exitCode === 3) && result.stdout.trim()) {
      const rewritten = replaceRtkWithAbsolutePath(result.stdout.trim(), rtkPath);
      console.log(`[RTK] final command: "${rewritten}"`);
      return rewritten;
    }

    return command;
  } catch (error) {
    console.log(`[RTK] rewrite subprocess failed: ${error} | using original command`);
    return command;
  }
}

function execRtkRewrite(
  rtkPath: string,
  command: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      rtkPath,
      ['rewrite', command],
      { timeout: REWRITE_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`rtk rewrite timed out after ${REWRITE_TIMEOUT_MS}ms`));
          return;
        }

        const exitCode = error?.code
          ? (typeof error.code === 'number' ? error.code : 1)
          : 0;

        resolve({
          exitCode,
          stdout: stdout || '',
          stderr: stderr || '',
        });
      },
    );

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function replaceRtkWithAbsolutePath(command: string, rtkPath: string): string {
  const quotedPath = rtkPath.includes(' ') ? `"${rtkPath}"` : rtkPath;

  return command.replace(
    /(^|&&|\|\||[;|])\s*rtk /g,
    (_match, separator: string) =>
      separator === '' ? `${quotedPath} ` : `${separator} ${quotedPath} `,
  );
}
