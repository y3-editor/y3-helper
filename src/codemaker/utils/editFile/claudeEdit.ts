import * as path from 'path';
import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { getWorkspaceRootPath } from '../getWorkspaceInfo';

interface ClaudeEditResult {
  content: string;
  extra: {
    beforeEdit: string;
    finalResult: string;
    taskId: string;
    editSnippet: string;
    isCreateFile?: boolean;
  };
  path: string;
  isError: boolean;
}

interface WriteToolParams {
  file_path: string;
  content: string;
}

interface EditToolParams {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * 校验 file_path 是否在工作区路径下
 * @returns 绝对路径
 */
function validateAndResolveFilePath(filePath: string): string {
  const workspaceRoot = getWorkspaceRootPath();
  if (!workspaceRoot) {
    throw new Error('No workspace root path found. Please open a workspace first.');
  }

  const absolutePath = path.resolve(workspaceRoot, filePath);
  const normalizedAbsolute = path.resolve(absolutePath);
  const normalizedWorkspace = path.resolve(workspaceRoot);

  if (!normalizedAbsolute.startsWith(normalizedWorkspace + path.sep) && normalizedAbsolute !== normalizedWorkspace) {
    throw new Error(
      `File path "${filePath}" is not within the workspace directory "${workspaceRoot}".`
    );
  }

  return absolutePath;
}


export const LEFT_SINGLE_CURLY_QUOTE = '‘'
export const RIGHT_SINGLE_CURLY_QUOTE = '’'
export const LEFT_DOUBLE_CURLY_QUOTE = '“'
export const RIGHT_DOUBLE_CURLY_QUOTE = '”'

/**
 * Normalizes quotes in a string by converting curly quotes to straight quotes
 * @param str The string to normalize
 * @returns The string with all curly quotes replaced by straight quotes
 */
export function normalizeQuotes(str: string): string {
  return str
    .replaceAll(LEFT_SINGLE_CURLY_QUOTE, "'")
    .replaceAll(RIGHT_SINGLE_CURLY_QUOTE, "'")
    .replaceAll(LEFT_DOUBLE_CURLY_QUOTE, '"')
    .replaceAll(RIGHT_DOUBLE_CURLY_QUOTE, '"')
    .replaceAll('"', '"')
}

/**
 * 处理转义字符兼容性，解决模型返回转义字符与实际文件内容不匹配的问题
 * 例如: 模型返回 "[\\\"_common/profile/profile_mng\\\"] = true\\n"
 *      实际文件中是 "[\"_common/profile/profile_mng\"] = true\r\n"
 * @param str 需要处理的字符串
 * @returns 处理后的字符串
 */
export function normalizeEscapeChars(str: string): string {
  return str
    // 处理转义的双引号：\" -> "
    .replaceAll('\\"', '"')
    // 处理转义的单引号：\' -> '
    .replaceAll("\\'", "'")
    // 处理换行符：\\n -> \n
    .replaceAll('\\n', '\n')
    // 处理回车符：\\r -> \r
    .replaceAll('\\r', '\r')
    // 处理制表符：\\t -> \t
    .replaceAll('\\t', '\t')
    // 处理转义的反斜杠：\\\\ -> \\ (最后处理以避免干扰其他转义)
    .replaceAll('\\\\', '\\')
}

/**
 * 增强版字符串查找函数，支持多种兼容性处理
 * 处理模型返回的转义字符与文件内容的不匹配问题
 * @param fileContent 文件内容
 * @param searchString 要查找的字符串（已经过 normalizeEscapeChars 处理）
 * @param rawSearchString 原始 old_string（未经 normalizeEscapeChars 处理）
 * @returns 在文件中找到的实际字符串，如果找不到则返回null
 */
export function findCompatibleString(
  fileContent: string,
  searchString: string,
  rawSearchString?: string,
): string | null {
  // 1. 精确匹配
  if (fileContent.includes(searchString)) {
    return searchString;
  }

  // 2. 处理引号兼容性：规范化引号后匹配
  const normalizedSearch = normalizeQuotes(searchString);
  const normalizedFile = normalizeQuotes(fileContent);

  if (normalizedFile.includes(normalizedSearch)) {
    const idx = normalizedFile.indexOf(normalizedSearch);
    return fileContent.substring(idx, idx + normalizedSearch.length);
  }

  // 3. 使用原始 old_string（未经 normalizeEscapeChars）直接匹配
  //    场景：文件里存储的是字面量 \n（Python/C 代码），AI 传来的 old_string
  //    经 JSON 解析后也是字面量 \n，但 normalizeEscapeChars 错误地把它转成了真实换行
  if (rawSearchString !== undefined && rawSearchString !== searchString) {
    if (fileContent.includes(rawSearchString)) {
      return rawSearchString;
    }

    // 3a. 原始字符串 + 引号规范化
    const normalizedRaw = normalizeQuotes(rawSearchString);
    if (normalizedFile.includes(normalizedRaw)) {
      const idx = normalizedFile.indexOf(normalizedRaw);
      return fileContent.substring(idx, idx + normalizedRaw.length);
    }
  }

  return null;
}


/**
 * 执行单个 write 操作
 */
async function executeSingleWrite(
  filePath: string,
  content: string
): Promise<ClaudeEditResult> {
  let absolutePath = filePath;
  try {
    absolutePath = validateAndResolveFilePath(filePath);
    const fileExist = existsSync(absolutePath);
    const isCreateFile = !fileExist;

    if (typeof content !== 'string' || !content.trim?.()) {
      throw new Error(`invalid content`);
    }

    let originalContent = '';
    if (fileExist) {
      const currentDocument = await vscode.workspace.openTextDocument(absolutePath);
      originalContent = currentDocument.getText();
    }


    const successMessage = isCreateFile
      ? `File created successfully at: ${absolutePath}`
      : `File updated successfully at: ${absolutePath}`;

    return {
      content: successMessage,
      extra: {
        beforeEdit: originalContent,
        finalResult: content,
        taskId: '',
        editSnippet: content,
        isCreateFile,
      },
      path: filePath,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Error writing ${absolutePath}: ${(error as any)?.message || String(error)}`,
      extra: {
        beforeEdit: '',
        finalResult: '',
        taskId: '',
        editSnippet: '',
      },
      path: filePath,
      isError: true,
    };
  }
}

function isOpeningContext(chars: string[], index: number): boolean {
  if (index === 0) {
    return true
  }
  const prev = chars[index - 1]
  return (
    prev === ' ' ||
    prev === '\t' ||
    prev === '\n' ||
    prev === '\r' ||
    prev === '(' ||
    prev === '[' ||
    prev === '{' ||
    prev === '\u2014' || // em dash
    prev === '\u2013' // en dash
  )
}

function applyCurlyDoubleQuotes(str: string): string {
  const chars = [...str]
  const result: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '"') {
      result.push(
        isOpeningContext(chars, i)
          ? LEFT_DOUBLE_CURLY_QUOTE
          : RIGHT_DOUBLE_CURLY_QUOTE,
      )
    } else {
      result.push(chars[i]!)
    }
  }
  return result.join('')
}


export function preserveQuoteStyle(
  oldString: string,
  actualOldString: string,
  newString: string,
): string {
  // If they're the same, no normalization happened
  if (oldString === actualOldString) {
    return newString
  }

  // Detect which curly quote types were in the file
  const hasDoubleQuotes =
    actualOldString.includes(LEFT_DOUBLE_CURLY_QUOTE) ||
    actualOldString.includes(RIGHT_DOUBLE_CURLY_QUOTE)
  const hasSingleQuotes =
    actualOldString.includes(LEFT_SINGLE_CURLY_QUOTE) ||
    actualOldString.includes(RIGHT_SINGLE_CURLY_QUOTE)

  if (!hasDoubleQuotes && !hasSingleQuotes) {
    return newString
  }

  let result = newString

  if (hasDoubleQuotes) {
    result = applyCurlyDoubleQuotes(result)
  }
  if (hasSingleQuotes) {
    result = applyCurlySingleQuotes(result)
  }

  return result
}


function applyCurlySingleQuotes(str: string): string {
  const chars = [...str]
  const result: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "'") {
      // Don't convert apostrophes in contractions (e.g., "don't", "it's")
      // An apostrophe between two letters is a contraction, not a quote
      const prev = i > 0 ? chars[i - 1] : undefined
      const next = i < chars.length - 1 ? chars[i + 1] : undefined
      const prevIsLetter = prev !== undefined && /\p{L}/u.test(prev)
      const nextIsLetter = next !== undefined && /\p{L}/u.test(next)
      if (prevIsLetter && nextIsLetter) {
        // Apostrophe in a contraction — use right single curly quote
        result.push(RIGHT_SINGLE_CURLY_QUOTE)
      } else {
        result.push(
          isOpeningContext(chars, i)
            ? LEFT_SINGLE_CURLY_QUOTE
            : RIGHT_SINGLE_CURLY_QUOTE,
        )
      }
    } else {
      result.push(chars[i]!)
    }
  }
  return result.join('')
}

export function convertLeadingTabsToSpaces(content: string): string {
  // The /gm regex scans every line even on no-match; skip it entirely
  // for the common tab-free case.
  if (!content.includes('\t')) return content
  return content.replace(/^\t+/gm, _ => '  '.repeat(_.length))
}


export function applyEditToFile(
  originalContent: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false,
): string {
  const f = replaceAll
    ? (content: string, search: string, replace: string) =>
      content.replaceAll(search, () => replace)
    : (content: string, search: string, replace: string) =>
      content.replace(search, () => replace)

  if (newString !== '') {
    return f(originalContent, oldString, newString)
  }

  const stripTrailingNewline =
    !oldString.endsWith('\n') && originalContent.includes(oldString + '\n')

  return stripTrailingNewline
    ? f(originalContent, oldString + '\n', newString)
    : f(originalContent, oldString, newString)
}



export function getPatchForEdits({
  originalContent,
  edits,
}: {
  originalContent: string
  edits: any[]
}): string {
  let updatedFile = originalContent
  const appliedNewStrings: string[] = []

  // Apply each edit and check if it actually changes the file
  for (const edit of edits) {
    // Strip trailing newlines from old_string before checking
    const oldStringToCheck = edit.old_string.replace(/\n+$/, '')

    // Check if old_string is a substring of any previously applied new_string
    for (const previousNewString of appliedNewStrings) {
      if (
        oldStringToCheck !== '' &&
        previousNewString.includes(oldStringToCheck)
      ) {
        throw new Error(
          'Cannot edit file: old_string is a substring of a new_string from a previous edit.',
        )
      }
    }

    const previousContent = updatedFile
    updatedFile =
      edit.old_string === ''
        ? edit.new_string
        : applyEditToFile(
          updatedFile,
          edit.old_string,
          edit.new_string,
          edit.replace_all,
        )

    // If this edit didn't change anything, throw an error
    if (updatedFile === previousContent) {
      throw new Error('String not found in file. Failed to apply edit.')
    }

    // Track the new string that was applied
    appliedNewStrings.push(edit.new_string)
  }

  if (updatedFile === originalContent) {
    throw new Error(
      'Original and edited file match exactly. Failed to apply edit.',
    )
  }

  return updatedFile
}


/**
 * 执行单个 edit 操作（基于 old_string -> new_string 替换）
 */
async function executeSingleEdit({
  filePath,
  oldString,
  newString,
  replaceAll = false,
}: {
  filePath: string,
  oldString: string,
  newString: string,
  replaceAll?: boolean
}
): Promise<ClaudeEditResult> {
  let absolutePath = filePath;
  let originalContent = '';
  try {
    absolutePath = validateAndResolveFilePath(filePath);
    const fileExist = existsSync(absolutePath);
    const isCreateFile = !fileExist;

    let beforeEdit = '';
    let lineEndingType = 'LF'; // CRLF 或 LF
    if (fileExist) {
      const currentDocument = await vscode.workspace.openTextDocument(absolutePath);
      originalContent = currentDocument.getText()
      beforeEdit = originalContent
      if (originalContent.includes('\r\n')) {
        lineEndingType = 'CRLF';
        originalContent = originalContent.replace(/\r\n/g, '\n');
      }
    }

    // 处理模型返回的转义字符（如 \\n -> \n）
    const normalizedNewString = normalizeEscapeChars(newString);

    let updatedContent: string;
    if (!originalContent && isCreateFile) {
      // 文件不存在且无内容，直接使用 new_string 作为内容
      updatedContent = normalizedNewString;
    } else {
      const normalizedOldString = normalizeEscapeChars(oldString);
      const actualOldString = findCompatibleString(originalContent, normalizedOldString, oldString) || normalizedOldString

      // Preserve curly quotes in new_string when the file uses them
      const actualNewString = preserveQuoteStyle(
        oldString,
        actualOldString,
        normalizedNewString,
      )

      updatedContent = getPatchForEdits({
        originalContent,
        edits: [
          { old_string: actualOldString, new_string: actualNewString, replace_all: replaceAll },
        ],
      })

      if (lineEndingType === 'CRLF') {
        // Normalize any existing CRLF to LF first so a new_string that already
        // contains \r\n (raw model output) doesn't become \r\r\n after the join.
        updatedContent = updatedContent.split('\n').join('\r\n')
      }
    }


    const successMessage = isCreateFile
      ? `File created successfully at: ${absolutePath}`
      : `File updated successfully at: ${absolutePath}`;

    return {
      content: successMessage,
      extra: {
        beforeEdit: beforeEdit,
        finalResult: updatedContent,
        taskId: '',
        editSnippet: newString,
        isCreateFile,
      },
      path: filePath,
      isError: false,
    };
  } catch (error) {
    return {
      content: `Error editing ${absolutePath}: ${(error as any)?.message || String(error)}`,
      extra: {
        beforeEdit: originalContent,
        finalResult: originalContent,
        taskId: '',
        editSnippet: '',
      },
      path: filePath,
      isError: true,
    };
  }
}


const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let editCount = 0

/**
 * 执行单个 claude write 工具调用
 */
export async function executeClaudeWrite(
  params: WriteToolParams
): Promise<ClaudeEditResult> {
  const { file_path, content } = params;
  await delay(editCount * 1000) // 防止多次调用edit/write时序问题
  editCount++
  const result = await executeSingleWrite(file_path, content);
  editCount--
  return result
}

/**
 * 执行单个 claude edit 工具调用
 */
export async function executeClaudeEdit(
  params: EditToolParams
): Promise<ClaudeEditResult> {
  const { file_path, old_string, new_string, replace_all = false } = params;
  await delay(editCount * 1000) // 防止多次调用edit/write时序问题
  editCount++
  const result = await executeSingleEdit({
    filePath: file_path,
    oldString: old_string,
    newString: new_string,
    replaceAll: replace_all,
  });
  editCount--
  return result
}
