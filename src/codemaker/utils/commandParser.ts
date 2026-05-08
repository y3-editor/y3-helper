import * as path from 'path';
import * as os from 'os';
import { getIgnoreHandler } from '../handlers/ignoreHandler';
import { getWorkspaceRootPath } from './getWorkspaceInfo';

/**
 * 文件访问类命令清单
 * 包含读取类、目录列表类、搜索类、文件信息类命令
 */
const FILE_ACCESS_COMMANDS = new Set([
  // 文件读取类
  'cat', 'type', 'more', 'head', 'tail', 'less', 'code', 'bat',
  // 目录列表类
  'ls', 'dir', 'find', 'tree',
  // 搜索类
  'grep', 'rg', 'findstr', 'ag', 'ack',
  // 文件信息类
  'stat', 'file', 'wc',
]);

/**
 * 带值的短选项映射表
 * 这些选项后面会跟一个值参数，需要跳过
 * key: 命令名, value: 需要跳过下一个参数的短选项集合
 */
const OPTIONS_WITH_VALUE: Record<string, Set<string>> = {
  head: new Set(['-n', '-c']),
  tail: new Set(['-n', '-c']),
  grep: new Set(['-m', '-e', '-f', '--include', '--exclude']),
  rg: new Set(['-g', '-t', '-T', '-m', '-e', '--type']),
  find: new Set(['-name', '-type', '-maxdepth', '-mindepth']),
  wc: new Set([]),
};

/**
 * 将复合命令拆分为独立的子命令
 * 支持的分隔符：&&, ||, ;, |
 * 正确处理引号内的特殊字符（不在引号内拆分）
 */
export function splitCompoundCommand(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    // 处理转义字符：反斜杠后的字符保留原样，不作为分隔符或引号处理
    if (ch === '\\' && i + 1 < command.length) {
      current += ch + command[i + 1];
      i++;
      continue;
    }

    // 跟踪引号状态
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    // 仅在引号外识别分隔符
    if (!inSingleQuote && !inDoubleQuote) {
      // 检查 && 或 ||
      if (
        (ch === '&' && command[i + 1] === '&') ||
        (ch === '|' && command[i + 1] === '|')
      ) {
        parts.push(current);
        current = '';
        i++; // 跳过第二个字符
        continue;
      }
      // 检查单个 | 或 ;
      if (ch === '|' || ch === ';') {
        parts.push(current);
        current = '';
        continue;
      }
    }

    current += ch;
  }

  // 推入最后一段
  parts.push(current);

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * 从单个子命令中提取文件/目录路径参数
 * 跳过选项参数（以 - 或 -- 开头）和引号包裹的模式参数
 */
export function extractPathsFromCommand(
  subCommand: string
): string[] {
  const tokens = tokenize(subCommand);
  if (tokens.length === 0) {
    return [];
  }

  const cmdName = getCommandName(tokens[0]);
  if (!FILE_ACCESS_COMMANDS.has(cmdName)) {
    return [];
  }

  const paths: string[] = [];
  const valueOpts = OPTIONS_WITH_VALUE[cmdName] || new Set();

  let skipNext = false;
  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (skipNext) {
      skipNext = false;
      continue;
    }

    // 跳过长选项 --xxx 或 --xxx=value
    if (token.startsWith('--')) {
      if (valueOpts.has(token.split('=')[0])) {
        // --option=value 形式不需要 skipNext
        if (!token.includes('=')) {
          skipNext = true;
        }
      }
      continue;
    }

    // 跳过短选项 -x
    if (token.startsWith('-')) {
      if (valueOpts.has(token)) {
        skipNext = true;
      }
      continue;
    }

    // 跳过引号包裹的字符串（通常是正则或搜索模式）
    if (isQuotedString(token)) {
      continue;
    }

    // 剩下的视为路径参数
    paths.push(stripQuotes(token));
  }

  return paths;
}

/**
 * 从完整命令中提取所有目标路径
 * 先拆分复合命令，再逐一提取路径
 */
export function extractAllPaths(command: string): string[] {
  const subCommands = splitCompoundCommand(command);
  const allPaths: string[] = [];

  for (const sub of subCommands) {
    const paths = extractPathsFromCommand(sub);
    allPaths.push(...paths);
  }

  return allPaths;
}

/**
 * 检查终端命令是否访问了被 ignore 的路径
 * @returns allowed: 是否允许执行; blockedPaths: 被拦截的路径列表
 */
export function checkTerminalCommandAccess(
  command: string
): { allowed: boolean; blockedPaths: string[] } {
  const paths = extractAllPaths(command);

  if (paths.length === 0) {
    return { allowed: true, blockedPaths: [] };
  }

  const ignoreHandler = getIgnoreHandler();
  if (!ignoreHandler || !ignoreHandler.hasIgnoreConfig()) {
    // 没有 .y3makerignore 配置时，不做任何拦截
    return { allowed: true, blockedPaths: [] };
  }

  const cwd = getWorkspaceRootPath() || path.join(os.homedir(), 'Desktop');
  const workspaceRoot = ignoreHandler.getWorkspaceRoot() || cwd;
  const blockedPaths: string[] = [];

  for (const filePath of paths) {
    const absolutePath = path.resolve(cwd, filePath);
    const relativePath = path
      .relative(workspaceRoot, absolutePath)
      .replace(/\\/g, '/');
    // 工作区外的路径跳过检查
    if (relativePath.startsWith('../')) {
      continue;
    }
    if (ignoreHandler.isIgnored(relativePath)) {
      blockedPaths.push(filePath);
    }
  }

  return {
    allowed: blockedPaths.length === 0,
    blockedPaths,
  };
}

/**
 * 简单分词器，支持引号内容保持完整
 */
function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    // 处理转义字符：反斜杠后的字符保留原样，不作为引号或空格处理
    if (ch === '\\' && i + 1 < command.length) {
      current += ch + command[i + 1];
      i++;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (ch === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * 从 token 中提取命令名（去掉路径前缀）
 * 例如 /usr/bin/cat -> cat, C:\Windows\type -> type
 */
function getCommandName(token: string): string {
  const name = token.split(/[/\\]/).pop() || token;
  // 去掉 .exe 后缀 (Windows)
  return name.replace(/\.exe$/i, '').toLowerCase();
}

/**
 * 判断 token 是否为引号包裹的字符串
 */
function isQuotedString(token: string): boolean {
  return (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  );
}

/**
 * 去掉 token 两端的引号
 */
function stripQuotes(token: string): string {
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  return token;
}
