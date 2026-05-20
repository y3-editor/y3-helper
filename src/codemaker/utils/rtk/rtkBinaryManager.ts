/**
 * RTK Binary Manager — 对齐上游 src/utils/rtk/rtkBinaryManager.ts
 *
 * Y3Helper 适配：
 *   - printLog → console.log
 */
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream, existsSync, statSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const S3_BASE_URL = '';

const UPDATE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

const DOWNLOAD_URLS: Record<string, string> = {
  'win32-x64': `${S3_BASE_URL}/rtk-x86_64-pc-windows-msvc.zip`,
  'linux-x64': `${S3_BASE_URL}/rtk-x86_64-unknown-linux-musl.tar.gz`,
  'linux-arm64': `${S3_BASE_URL}/rtk-aarch64-unknown-linux-gnu.tar.gz`,
  'darwin-x64': `${S3_BASE_URL}/rtk-x86_64-apple-darwin.tar.gz`,
  'darwin-arm64': `${S3_BASE_URL}/rtk-aarch64-apple-darwin.tar.gz`,
};

function getPlatformKey(): string | null {
  const platform = os.platform();
  const arch = os.arch();
  const key = `${platform}-${arch}`;
  return DOWNLOAD_URLS[key] ? key : null;
}

function getRtkDir(): string {
  return path.join(os.homedir(), '.codemaker', 'bin');
}

function getRtkBinaryName(): string {
  return os.platform() === 'win32' ? 'rtk.exe' : 'rtk';
}

function getRtkBinaryPath(): string {
  return path.join(getRtkDir(), getRtkBinaryName());
}

function isBinaryOutdated(): boolean {
  const binaryPath = getRtkBinaryPath();
  if (!existsSync(binaryPath)) return true;

  try {
    const stat = statSync(binaryPath);
    const age = Date.now() - stat.mtimeMs;
    return age > UPDATE_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const client = currentUrl.startsWith('https') ? https : http;
      client.get(currentUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const fileStream = createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', (err) => {
          fileStream.close();
          reject(err);
        });
      }).on('error', reject);
    };

    follow(url);
  });
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  const isZip = archivePath.endsWith('.zip');

  if (isZip) {
    const psEscape = (s: string) => s.replace(/'/g, "''");
    const psCommand = `Expand-Archive -Path '${psEscape(archivePath)}' -DestinationPath '${psEscape(destDir)}' -Force`;
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand]);
  } else {
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destDir]);

    const binaryPath = getRtkBinaryPath();
    if (existsSync(binaryPath)) {
      await fs.chmod(binaryPath, 0o755);
    }
  }
}

async function downloadRtkBinary(): Promise<string | null> {
  const platformKey = getPlatformKey();
  if (!platformKey) {
    console.log(`[RTK] Unsupported platform: ${os.platform()}-${os.arch()}`);
    return null;
  }

  const url = DOWNLOAD_URLS[platformKey];
  const rtkDir = getRtkDir();
  const binaryPath = getRtkBinaryPath();

  try {
    await fs.mkdir(rtkDir, { recursive: true });

    const isZip = url.endsWith('.zip');
    const archivePath = path.join(rtkDir, isZip ? 'rtk-download.zip' : 'rtk-download.tar.gz');

    console.log(`[RTK] Downloading from ${url}`);
    await downloadFile(url, archivePath);

    console.log(`[RTK] Extracting archive...`);
    await extractArchive(archivePath, rtkDir);

    await fs.unlink(archivePath).catch(() => {});

    if (existsSync(binaryPath)) {
      const now = new Date();
      await fs.utimes(binaryPath, now, now);
      console.log(`[RTK] Successfully installed RTK to ${binaryPath}`);
      return binaryPath;
    }

    console.log(`[RTK] Binary not found after extraction at ${binaryPath}`);
    return null;
  } catch (error) {
    console.log(`[RTK] Failed to download/extract RTK: ${error}`);
    const isZip = url.endsWith('.zip');
    const archivePath = path.join(rtkDir, isZip ? 'rtk-download.zip' : 'rtk-download.tar.gz');
    await fs.unlink(archivePath).catch((e) => {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.log(`[RTK] Archive cleanup failed: ${e}`);
      }
    });
    return null;
  }
}

export function isRtkBinaryAvailable(): boolean {
  return existsSync(getRtkBinaryPath());
}

export async function ensureRtkBinary(): Promise<string | null> {
  const binaryPath = getRtkBinaryPath();

  if (existsSync(binaryPath) && !isBinaryOutdated()) {
    return binaryPath;
  }

  if (existsSync(binaryPath) && isBinaryOutdated()) {
    console.log(`[RTK] Binary older than 7 days, updating...`);
    downloadRtkBinary().catch((err) => {
      console.log(`[RTK] Background update failed: ${err}`);
    });
    return binaryPath;
  }

  return downloadRtkBinary();
}
