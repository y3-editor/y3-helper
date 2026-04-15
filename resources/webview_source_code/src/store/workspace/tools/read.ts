import { diffLines } from "diff";

/**
 * 读取文件Tool
 */
interface IReadFileToolParams {
  hasCodeTable: boolean;
}

export const exceedsMaxLines = 1600

export const getV1ReadFileTool = (data: IReadFileToolParams) => {
  const { hasCodeTable } = data;
  return {
    type: 'function',
    function: {
      name: 'read_file',
      description: hasCodeTable
        ? 'Read the contents of a file at the specified path. This tool can be used to analyze code, view text files, or extract information from configuration files. You must provide a path to a file that actually exists; do not fabricate file paths. Note that this tool may not be suitable for very large or binary files as it returns the raw content as a string. You can use this tool at most twice in the same round of questioning. If both attempts at `read_file` don\'t find highly relevant code, please use the `retrieve_code` tool. If you find that a file is too long and gets truncated, you can inform the user "The current file is large and has been truncated, please use @ to actively reference the file" to have the user provide you with the complete file.'
        : 'Read the contents of a file at the specified path. This tool can be used to analyze code, view text files, or extract information from configuration files. You must provide a path to a file that actually exists; do not fabricate file paths. Note that this tool may not be suitable for very large or binary files as it returns the raw content as a string. If you find that a file is too long and gets truncated, you can inform the user "The current file is large and has been truncated, please use @ to actively reference the file" to have the user provide you with the complete file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Path of the file to be read. You must provide a path to a file that actually exists; do not fabricate file paths.',
          },
        },
        required: ['path'],
      },
    },
  }
}

export const getV2ReadFileTool = (data: IReadFileToolParams) => {
  const { hasCodeTable } = data;
  return   {
    type: 'function',
    function: {
      name: 'read_file',
      description: hasCodeTable
        ? `Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.\n\nUsage:\n- The file_path parameter must be an absolute path, not a relative path\n- By default, it reads up to ${exceedsMaxLines} lines starting from the beginning of the file\n- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters\n- Any lines longer than ${exceedsMaxLines} characters will be truncated\n- Results are returned using cat -n format, with line numbers starting at 1\n- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful. \n- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.\n- You can use this tool at most twice in the same round of questioning.\n- If both attempts at read_file don't find highly relevant code, please use the retrieve_code tool`
        : `Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine. If the User provides a path to a file assume that path is valid. It is okay to read a file that does not exist; an error will be returned.\n\nUsage:\n- The file_path parameter must be an absolute path, not a relative path\n- By default, it reads up to ${exceedsMaxLines} lines starting from the beginning of the file\n- You can optionally specify a line offset and limit (especially handy for long files), but it's recommended to read the whole file by not providing these parameters\n- Any lines longer than ${exceedsMaxLines} characters will be truncated\n- Results are returned using cat -n format, with line numbers starting at 1\n- You have the capability to call multiple tools in a single response. It is always better to speculatively read multiple files as a batch that are potentially useful. \n- If you read a file that exists but has empty contents you will receive a system reminder warning in place of file contents.\n- You can use this tool at most twice in the same round of questioning.`,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'The absolute path to the file to read. You must provide a path to a file that actually exists; do not fabricate file paths.',
          },
          offset: {
            type: "number",
            description: "The line number to start reading from. Only provide if the file is too large to read at once"
          },
          limit: {
            type: "number",
            description: `The number of lines to read. Only provide if the file is too large to read at once. it should be less than ${exceedsMaxLines} limit.`
          }
        },
        required: ['path'],
      }
    },
  }
}

/**
 * @name 大文本文件的Prombt
 */
export const getLargeFilePrombt = (path: string, content: string) => {
  // ${content.length} chars,
  return `the ${path} file is too large: ${(content?.split('\n')?.length || 0)} lines. Using segmented read.`
}

/**
 * @name 获取文本更新的diff
 */
export function getDiffPatchOfContent(
  editBeforeSnippet: string,
  editAfterSnippet: string,
) {

  const changes = diffLines(editBeforeSnippet, editAfterSnippet);
  let lineNumber = 1;
  let content = ''
  for (const change of changes) {
    const count = change.count || 0
    if (change.added || change.removed) {
      const lines = change.value.split('\n');
      lines.forEach((line, index) => {
        if (change.added) {
          content += `+ ${lineNumber + (index)}:${line}\n`;
        } else if (change.removed) {
          content += `- ${lineNumber + (index)}:${line}\n`;
        }
      })
    }
    lineNumber += count
  }
  // console.log('==content==', content)
  return content
}

export const getV1ReadFileZHTool = (data: IReadFileToolParams) => {
  const { hasCodeTable } = data;
  return ({
    type: 'function',
    function: {
      name: 'read_file',
      description: hasCodeTable
        ? '读取指定路径下文件的内容。此工具可以分析代码、查看文本文件或从配置文件中提取信息。你必须提供实际存在的文件路径，禁止编造文件路径。请注意，此工具可能不适用于非常大的文件或二进制文件，因为它会以字符串形式返回原始内容。同一轮问题中你最多使用两次此工具，如果两次 `read_file` 都没有找到相关度高的代码，请使用 `retrieve_code` 工具。如果发现文件太长被截断，可以告知用户“当前文件较大被截断，请通过@主动引用文件”，让用户主动给你提供完整文件。'
        : '读取指定路径下文件的内容。此工具可以分析代码、查看文本文件或从配置文件中提取信息。你必须提供实际存在的文件路径，禁止编造文件路径。请注意，此工具可能不适用于非常大的文件或二进制文件，因为它会以字符串形式返回原始内容。如果发现文件太长被截断，可以告知用户“当前文件较大被截断，请通过@主动引用文件”，让用户主动给你提供完整文件。',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              '需要读取的文件的路径，你必须提供实际存在的文件路径，禁止编造文件路径。',
          },
        },
        required: ['path'],
      },
    },
  })
}

export const getV2ReadFileToolZHTool = (data: IReadFileToolParams) => {
  const { hasCodeTable } = data;
  return ({
    "type": "function",
    "function": {
        "name": "read_file",
        "description": hasCodeTable
        ? "从本地文件系统读取文件。您可以通过此工具直接访问任何文件。\n假设此工具能够读取计算机上的所有文件。如果用户提供了文件路径，请假设该路径是有效的。读取不存在的文件是可以的；系统将返回错误。\n\n使用说明：\n- file_path 参数必须是绝对路径，而非相对路径\n- 默认情况下，从文件开头开始读取，最多读取 ${exceedsMaxLines} 行\n- 您可以选择指定行偏移量和限制（对于长文件特别有用），但建议不提供这些参数以读取整个文件\n- 任何超过 ${exceedsMaxLines} 个字符的行将被截断\n- 结果以 cat -n 格式返回，行号从 1 开始\n- 您能够在单次响应中调用多个工具。最好将可能相关的多个文件批量读取\n- 如果您读取存在但内容为空的文件，将在文件内容位置收到系统提醒警告\n- 在同一轮提问中，此工具最多可使用两次\n- 如果两次 read_file 尝试均未找到高度相关的代码，请使用 retrieve_code 工具"
        : "从本地文件系统读取文件。您可以通过此工具直接访问任何文件。\n假设此工具能够读取计算机上的所有文件。如果用户提供了文件路径，请假设该路径是有效的。读取不存在的文件是可以的；系统将返回错误。\n\n使用说明：\n- file_path 参数必须是绝对路径，而非相对路径\n- 默认情况下，从文件开头开始读取，最多读取 ${exceedsMaxLines} 行\n- 您可以选择指定行偏移量和限制（对于长文件特别有用），但建议不提供这些参数以读取整个文件\n- 任何超过 ${exceedsMaxLines} 个字符的行将被截断\n- 结果以 cat -n 格式返回，行号从 1 开始\n- 您能够在单次响应中调用多个工具。最好将可能相关的多个文件批量读取\n- 如果您读取存在但内容为空的文件，将在文件内容位置收到系统提醒警告\n- 在同一轮提问中，此工具最多可使用两次",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "要读取文件的绝对路径。必须提供实际存在的文件路径；请勿虚构文件路径。"
                },
                "offset": {
                    "type": "number",
                    "description": "开始读取的行号。仅在文件过大无法一次性读取时提供"
                },
                "limit": {
                    "type": "number",
                    "description": "要读取的行数。仅在文件过大无法一次性读取时提供。应小于 ${exceedsMaxLines} 的限制"
                }
            },
            "required": ["path"]
        }
    }
  })
}

