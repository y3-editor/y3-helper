import * as childProcess from "child_process";
import * as path from "path";
import * as readline from "readline";
import * as vscode from 'vscode';
import os from "os";
import { fileExistsAtPath } from "./file";
import { validateAccess } from "./validateAccess";
import { getDirsToIgnore, PROTECTED_HIDDEN_DIRS } from "./analyzeProject";
import { getIgnoreHandler } from '../handlers/ignoreHandler';
import { getWorkspaceRootPath } from './getWorkspaceInfo';

/*
This file provides functionality to perform regex searches on files using ripgrep.

The search results include:
- Relative file paths (with line number of first match)
- 2 lines of context before and after each match
- Matches formatted with pipe characters for easy reading

Usage example:

rel/path/to/app.ts
│----
│function processData(data: any) {
│  // Some processing logic here
│  // TODO: Implement error handling
│  return processedData;
│}
│----

rel/path/to/helper.ts
│----
│  let result = 0;
│  for (let i = 0; i < input; i++) {
│    // TODO: Optimize this function for performance
│    result += Math.pow(i, 2);
│  }
│----
*/

/**
 * 获取用户配置的 grep 搜索编码，默认为 utf8
 */
function getGrepEncoding(): string {
  const encoding = vscode.workspace.getConfiguration('CodeMaker').get<string>('GrepEncoding', 'utf8');
  return encoding || 'utf8';
}

function getCwd(): string {
  return getWorkspaceRootPath() || path.join(os.homedir(), 'Desktop');
}

interface SearchResult {
  filePath: string
  line: number
  column: number
  match: string
  offset: number
  beforeContext: string[]
  afterContext: string[]
}

const MAX_RESULTS = 300;
const IS_WINDOWS = /^win/.test(process.platform);

async function execRipgrep(args: string[]): Promise<string> {
  const binName = IS_WINDOWS ? 'rg.exe' : 'rg';
  const binPath: string = await getBinaryLocation(binName);

  return new Promise((resolve, reject) => {
    const rgProcess = childProcess.spawn(binPath, args)
    // cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
    const rl = readline.createInterface({
      input: rgProcess.stdout,
      crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
    })

    let output = ""
    let lineCount = 0
    const maxLines = MAX_RESULTS * 5 // limiting ripgrep output with max lines since there's no other way to limit results. it's okay that we're outputting as json, since we're parsing it line by line and ignore anything that's not part of a match. This assumes each result is at most 5 lines.

    rl.on("line", (line) => {
      if (lineCount < maxLines) {
        output += line + "\n"
        lineCount++
      } else {
        rl.close()
        rgProcess.kill()
      }
    })

    let errorOutput = ""
    rgProcess.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })
    rl.on("close", () => {
      if (errorOutput) {
        reject(new Error(`ripgrep process error: ${errorOutput}`))
      } else {
        resolve(output)
      }
    })
    rgProcess.on("error", (error) => {
      reject(new Error(`ripgrep process error: ${error.message}`))
    })
  })
}

/**
 * 将 getDirsToIgnore 返回的 glob 模式转换为 ripgrep 的 --glob 参数
 * globby 格式: "**\\node_modules\\**" 或 "!**\\inner\\testIgnore.ts"
 * ripgrep 格式: "!**\/node_modules/**" 或 "**\/inner/testIgnore.ts"
 */
function convertToRipgrepGlobs(dirsToIgnore: string[]): string[] {
  const result: string[] = [];

  for (const pattern of dirsToIgnore) {
    // 统一将反斜杠转换为正斜杠
    let normalized = pattern.replace(/\\/g, '/').trim();

    if (!normalized) continue;

    // 处理否定模式 (以 ! 开头的是"不忽略"的模式)
    if (normalized.startsWith('!')) {
      // 否定模式：!**\inner\testIgnore.ts -> **/inner/testIgnore.ts (移除 ! 使其被包含)
      result.push(normalized.slice(1));
    } else {
      // 普通忽略模式：**\node_modules\** -> !**/node_modules/** (添加 ! 使其被排除)
      result.push(`!${normalized}`);
    }
  }

  return result;
}

/**
 * 判断搜索路径是否是工作区根目录（或其父目录）
 * 只有在根目录搜索时才需要补扫 PROTECTED_HIDDEN_DIRS
 */
function shouldScanProtectedDirs(searchPath: string, cwd: string): boolean {
  const normalizedSearchPath = path.normalize(searchPath).toLowerCase();
  const normalizedCwd = path.normalize(cwd).toLowerCase();

  // 搜索路径是根目录本身，或者搜索路径是根目录的父目录
  return normalizedSearchPath === normalizedCwd ||
    normalizedCwd.startsWith(normalizedSearchPath + path.sep);
}

/**
 * 解析 ripgrep JSON 输出为 SearchResult 数组
 */
function parseRipgrepOutput(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  let currentResult: Partial<SearchResult> | null = null;

  output.split("\n").forEach((line) => {
    if (line) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          if (currentResult) {
            results.push(currentResult as SearchResult);
          }
          currentResult = {
            filePath: parsed.data.path.text,
            line: parsed.data.line_number,
            column: parsed.data.submatches[0].start,
            offset: parsed.data.absolute_offset || 0,
            match: parsed.data.lines.text,
            beforeContext: [],
            afterContext: [],
          };
        }
      } catch (error) {
        console.error("Error parsing ripgrep output:", error);
      }
    }
  });

  if (currentResult) {
    results.push(currentResult as SearchResult);
  }

  return results;
}

export async function grepSearchFiles(options: {
  path: string,
  regex: string,
  filePattern: string,
  caseSensitive?: boolean,
  isPrivateModel?: boolean
}) {
  const { path: searchPath, regex, filePattern, caseSensitive = false, isPrivateModel } = options

  // 参数校验：searchPath 不能为空
  if (!searchPath) {
    return '搜索路径不能为空';
  }

  const cwd = getCwd();

  // .y3makerignore 前处理拦截：检查搜索路径本身是否被忽略（私有模型跳过）
  const ignoreHandler = getIgnoreHandler();
  if (ignoreHandler && !isPrivateModel) {
    const wsRoot = ignoreHandler.getWorkspaceRoot() || cwd;
    const relSearchPath = path.relative(wsRoot, searchPath).replace(/\\/g, '/');
    // 对于目录路径，需要加尾部斜杠让 ignore 库正确匹配目录模式
    const relSearchPathDir = relSearchPath && !relSearchPath.endsWith('/')
      ? relSearchPath + '/'
      : relSearchPath;
    if (relSearchPath && ignoreHandler.isIgnored(relSearchPathDir)) {
      const matchedRule =
        ignoreHandler.getMatchedRule(relSearchPathDir);
      const ruleHint = matchedRule
        ? `（命中规则: ${matchedRule}）`
        : '';
      return `该搜索路径由于 .y3makerignore 规则限制无法访问: ${relSearchPath}${ruleHint}`;
    }
  }

  // 获取忽略规则
  const dirsToIgnore = getDirsToIgnore();
  const ripgrepGlobs = convertToRipgrepGlobs(dirsToIgnore);

  // 获取用户配置的编码
  const grepEncoding = getGrepEncoding();

  // 构建主搜索参数（排除所有隐藏目录）
  const mainArgs = ["--json", "--encoding", grepEncoding, "-e", regex, "--glob", filePattern || "*", "--glob", '!.*/**', "--context", "1"];
  // 添加用户配置的忽略规则
  for (const glob of ripgrepGlobs) {
    mainArgs.push("--glob", glob);
  }
  mainArgs.push(searchPath);

  try {
    // 执行主搜索
    const mainOutput = await execRipgrep(mainArgs);
    let results = parseRipgrepOutput(mainOutput);

    // 仅当搜索路径包含根目录时，补扫 PROTECTED_HIDDEN_DIRS
    if (shouldScanProtectedDirs(searchPath, cwd)) {
      const filteredRipgrepGlobs = ripgrepGlobs.filter(glob => !glob.includes('/.*/'));

      for (const protectedDir of PROTECTED_HIDDEN_DIRS) {
        const protectedPath = path.join(cwd, protectedDir);
        // 检查目录是否存在，避免无效扫描
        if (await fileExistsAtPath(protectedPath)) {
          const protectedArgs = ["--json", "--encoding", grepEncoding, "-e", regex, "--glob", filePattern || "*", "--context", "1"];
          for (const glob of filteredRipgrepGlobs) {
            protectedArgs.push("--glob", glob);
          }
          protectedArgs.push(protectedPath);

          try {
            const protectedOutput = await execRipgrep(protectedArgs);
            const protectedResults = parseRipgrepOutput(protectedOutput);
            results = results.concat(protectedResults);
          } catch {
            // 忽略单个受保护目录的搜索错误
          }
        }
      }
    }

    // 过滤忽略的文件
    let filteredResults = results.filter((result) => validateAccess(result.filePath));

    // .y3makerignore 后处理过滤：移除匹配忽略规则的搜索结果（私有模型跳过）
    if (ignoreHandler && !isPrivateModel) {
      const wsRoot = ignoreHandler.getWorkspaceRoot() || cwd;
      filteredResults = filteredResults.filter((result) => {
        const relPath = path.relative(wsRoot, result.filePath).replace(/\\/g, '/');
        return !ignoreHandler.isIgnored(relPath);
      });
    }

    return formatResults(filteredResults, cwd);
  } catch (error) {
    throw (error);
  }
}

const MAX_RIPGREP_MB = 0.25
const MAX_BYTE_SIZE = MAX_RIPGREP_MB * 1024 * 1024 // 0.25MB in bytes

function formatResults(results: SearchResult[], cwd: string): string {
  const groupedResults: { [key: string]: SearchResult[] } = {}

  let output = ""
  if (results.length >= MAX_RESULTS) {
    output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
  } else {
    output += `Found ${results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`}.\n\n`
  }

  // Group results by file name
  results.slice(0, MAX_RESULTS).forEach((result) => {
    const relativeFilePath = path.relative(cwd, result.filePath)
    if (!groupedResults[relativeFilePath]) {
      groupedResults[relativeFilePath] = []
    }
    groupedResults[relativeFilePath].push(result)
  })

  // Track byte size
  let byteSize = Buffer.byteLength(output, "utf8")
  let wasLimitReached = false

  for (const [filePath, fileResults] of Object.entries(groupedResults)) {
    // Check if adding this file's path would exceed the byte limit
    const filePathString = `${filePath.toPosix()}\n`
    const filePathBytes = Buffer.byteLength(filePathString, "utf8")

    if (byteSize + filePathBytes >= MAX_BYTE_SIZE) {
      wasLimitReached = true
      break
    }

    output += filePathString
    byteSize += filePathBytes

    for (let resultIndex = 0; resultIndex < fileResults.length; resultIndex++) {
      const result = fileResults[resultIndex]
      const allLines = [...result.beforeContext, result.match, ...result.afterContext]

      // Calculate bytes in all lines for this result
      let resultBytes = 0
      const resultLines: string[] = []

      for (const line of allLines) {
        const trimmedLine = line?.trimEnd() ?? ""
        const lineString = `line ${result.line}:${trimmedLine}\n`
        const lineBytes = Buffer.byteLength(lineString, "utf8")

        // Check if adding this line would exceed the byte limit
        if (byteSize + resultBytes + lineBytes >= MAX_BYTE_SIZE) {
          wasLimitReached = true
          break
        }

        resultLines.push(lineString)
        resultBytes += lineBytes
      }

      // If we hit the limit in the middle of processing lines, break out of the result loop
      if (wasLimitReached) {
        break
      }

      // Add all lines for this result to the output
      resultLines.forEach((line) => {
        output += line
      })
      byteSize += resultBytes

      // Add separator between results if needed
      if (resultIndex < fileResults.length - 1) {
        const separatorString = ''
        const separatorBytes = Buffer.byteLength(separatorString, "utf8")

        if (byteSize + separatorBytes >= MAX_BYTE_SIZE) {
          wasLimitReached = true
          break
        }

        output += separatorString
        byteSize += separatorBytes
      }

      // Check if we've hit the byte limit
      if (byteSize >= MAX_BYTE_SIZE) {
        wasLimitReached = true
        break
      }
    }

    // If we hit the limit, break out of the file loop
    if (wasLimitReached) {
      break
    }

    const closingString = "\n\n"
    const closingBytes = Buffer.byteLength(closingString, "utf8")

    if (byteSize + closingBytes >= MAX_BYTE_SIZE) {
      wasLimitReached = true
      break
    }

    output += closingString
    byteSize += closingBytes
  }

  // Add a message if we hit the byte limit
  if (wasLimitReached) {
    const truncationMessage = `\n[Results truncated due to exceeding the ${MAX_RIPGREP_MB}MB size limit. Please use a more specific search pattern.]`
    // Only add the message if it fits within the limit
    if (byteSize + Buffer.byteLength(truncationMessage, "utf8") < MAX_BYTE_SIZE) {
      output += truncationMessage
    }
  }

  return output.trim()
}

async function getBinaryLocation(name: string): Promise<string> {
  // The only binary currently supported is the rg binary from the VSCode installation.
  if (!name.startsWith("rg")) {
    throw new Error(`Binary '${name}' is not supported`)
  }

  const checkPath = async (pkgFolder: string) => {
    const fullPathResult = path.resolve(vscode.env.appRoot, path.join(pkgFolder, name))
    const fullPath = fullPathResult;
    return (await fileExistsAtPath(fullPath)) ? fullPath : undefined
  }

  const binPath =
    (await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
    (await checkPath("node_modules/vscode-ripgrep/bin")) ||
    (await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
    (await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
  if (!binPath) {
    throw new Error("Could not find ripgrep binary")
  }
  return binPath
}

export default async function grepSearch(options: {
  relPath: string,
  regex: string,
  filePattern: string,
  caseSensitive?: boolean,
  isPrivateModel?: boolean
}) {
  let displayPath = '';

  try {
    const { relPath, regex, filePattern, caseSensitive = false, isPrivateModel } = options

    // 参数校验：relPath 不能为空（模型调用时遗漏参数）
    if (!relPath) {
      return {
        path: '',
        content: '搜索缺少必要参数：relPath 为空，请检查调用参数',
        isError: true
      };
    }

    // Resolve the absolute path based on multi-workspace configuration
    const cwd = getCwd();
    const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(cwd, relPath);
    displayPath = absolutePath;
    if (filePattern) {
      displayPath = path.join(absolutePath, `(${filePattern})`);
    }
    const result = await grepSearchFiles({
      path: absolutePath,
      regex,
      filePattern,
      caseSensitive,
      isPrivateModel
    })
    return {
      path: displayPath,
      content: result,
      isError: false
    }
  } catch (err) {
    const getErrorMessage = (e: any) => (e instanceof Error ? e.message : String(e));
    return {
      content: `Error calling ripgrep: ${getErrorMessage(err)}`,
      path: displayPath,
      isError: true
    }
  }
}
