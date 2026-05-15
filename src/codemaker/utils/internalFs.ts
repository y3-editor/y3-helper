import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ALLOWED_PREFIX = path.join(os.homedir(), '.codemaker');

function validatePath(filePath: string): boolean {
  const normalized = path.resolve(filePath);
  return normalized === ALLOWED_PREFIX ||
    normalized.startsWith(ALLOWED_PREFIX + path.sep);
}

export interface InternalFsParams {
  action: 'write' | 'append' | 'exists' | 'delete' | 'read' | 'rmdir' | 'copydir';
  path: string;
  content?: string;
  mkdirp?: boolean;
}

export interface InternalFsResult {
  content: string;
  isError: boolean;
}

/**
 * 通用内部文件操作，仅允许 ~/.codemaker/ 下的路径。
 * 供 webview 通过 callIDETool('internal_fs', ...) 调用。
 */
export function internalFs(params: InternalFsParams): InternalFsResult {
  if (!validatePath(params.path)) {
    return { content: 'Path not allowed: must be under ~/.codemaker/', isError: true };
  }

  switch (params.action) {
    case 'write': {
      if (params.mkdirp) {
        fs.mkdirSync(path.dirname(params.path), { recursive: true });
      }
      fs.writeFileSync(params.path, params.content || '');
      return { content: params.path, isError: false };
    }
    case 'append': {
      if (params.mkdirp) {
        fs.mkdirSync(path.dirname(params.path), { recursive: true });
      }
      fs.appendFileSync(params.path, params.content || '');
      return { content: params.path, isError: false };
    }
    case 'exists': {
      return { content: String(fs.existsSync(params.path)), isError: false };
    }
    case 'delete': {
      try {
        fs.unlinkSync(params.path);
      } catch {
        // 文件不存在时静默忽略
      }
      return { content: 'ok', isError: false };
    }
    case 'read': {
      try {
        const data = fs.readFileSync(params.path, 'utf-8');
        return { content: data, isError: false };
      } catch {
        return { content: '', isError: true };
      }
    }
    case 'rmdir': {
      try {
        fs.rmSync(params.path, { recursive: true, force: true });
      } catch {
        // 目录不存在时静默忽略
      }
      return { content: 'ok', isError: false };
    }
    case 'copydir': {
      const dest = params.content || '';
      if (!dest || !validatePath(dest) || !validatePath(params.path)) {
        return { content: 'Path not allowed', isError: true };
      }
      try {
        if (!fs.existsSync(params.path)) {
          return { content: 'Source not found', isError: false };
        }
        fs.cpSync(params.path, dest, { recursive: true });
        return { content: dest, isError: false };
      } catch {
        return { content: 'Copy failed', isError: true };
      }
    }
    default:
      return { content: `Unknown action: ${params.action}`, isError: true };
  }
}
