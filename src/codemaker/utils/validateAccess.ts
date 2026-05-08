import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import ignore, { Ignore } from 'ignore';
import { getDirsToIgnore, PROTECTED_HIDDEN_DIRS } from './analyzeProject';
import { getWorkspaceRootPath } from './getWorkspaceInfo';

function getCwd(): string {
  return getWorkspaceRootPath() || path.join(os.homedir(), 'Desktop');
}

let ignoreInstance: Ignore|null = null;
let gitignoreOnlyInstance: Ignore|null = null;

function loadGitignoreRules(ig: Ignore) {
  const gitignorePath = path.join(getCwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      ig.add(gitignoreContent);
    } catch (error) {
      console.warn('Failed to read .gitignore:', error);
    }
  }
}

function initIgnoreInstance() {
  ignoreInstance = ignore();
  const dirsToIgnore = getDirsToIgnore();
  dirsToIgnore.forEach(dir => (ignoreInstance as Ignore).add(dir));
  loadGitignoreRules(ignoreInstance);
}

function initGitignoreOnlyInstance() {
  gitignoreOnlyInstance = ignore();
  loadGitignoreRules(gitignoreOnlyInstance);
}

interface ValidateAccessOptions {
  /** 是否包含 CodebaseDefaultIgnorePath 配置的规则，默认 true */
  includeDefaultIgnorePath?: boolean;
}

/**
 * Check if a file should be accessible to the LLM
 * @param filePath - Path to check (relative to cwd)
 * @param options - 可选配置
 * @returns true if file is accessible, false if ignored
 */
export function validateAccess(
  filePath: string,
  options?: ValidateAccessOptions
): boolean {
  const includeDefaultIgnorePath = options?.includeDefaultIgnorePath !== false;

  try {
    let ig: Ignore | null;

    if (includeDefaultIgnorePath) {
      if (!ignoreInstance) {
        initIgnoreInstance();
      }
      ig = ignoreInstance;
    } else {
      if (!gitignoreOnlyInstance) {
        initGitignoreOnlyInstance();
      }
      ig = gitignoreOnlyInstance;
    }

    if (ig) {
      // Normalize path to be relative to cwd and use forward slashes
      const cwd = getCwd();
      const absolutePath = path.resolve(cwd, filePath)
      const relativePath = path.relative(cwd, absolutePath).toPosix()

      for (const protectedDir of PROTECTED_HIDDEN_DIRS) {
        if (relativePath.startsWith(`${protectedDir}/`) || relativePath === protectedDir) {
          return true;
        }
      }

      // Ignore expects paths to be path.relative()'d
      return !ig.ignores(relativePath)
    }
    // ig 初始化失败时，允许访问
    return true;
  } catch (_error) {
    return true
  }
}
