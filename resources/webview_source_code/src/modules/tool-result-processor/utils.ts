/**
 * Tool Result Processor Utilities
 */

import { isImageFileByPath, truncateContent, getErrorMessage } from '../../utils';
import { EParsedDocsStatus } from '../../utils/chatAttachParseHandler';
import { getFilePrompt, maxTruncatedLine, getDiffPatchOfContent } from '../../store/workspace/tools/read';
import { ChatMessageContent } from '../../services';
import { compressImage } from '../../components/ImageUpload/ImageUpload';
import type { ToolResultInput, ToolResultOutput } from './types';

/** 检查是否为图片文件且需要异步处理 */
export function requiresImageProcessing(input: ToolResultInput): boolean {
  const isReadFile = input.tool_name === 'read_file';
  const hasPath = !!input.tool_result.path;
  const isImagePath = hasPath && isImageFileByPath(input.tool_result.path || "");

  return isReadFile && hasPath && isImagePath;
}

/** 检查是否为文档且需要异步处理 */
export function requiresDocProcessing(input: ToolResultInput): boolean {
  return input.tool_name === 'read_file' &&
         input.extra?.parseDocStatus === EParsedDocsStatus.NotParsed;
}

/** 检查是否为终端命令工具 */
export function isTerminalTool(toolName: string): boolean {
  return toolName === 'run_terminal_cmd';
}

/** 检查是否为文件编辑工具 */
export function isFileEditTool(toolName: string): boolean {
  return ['edit_file', 'reapply', 'replace_in_file'].includes(toolName);
}

/** 检查是否为检索工具 */
export function isRetrieveTool(toolName: string): boolean {
  return ['retrieve_code', 'retrieve_knowledge'].includes(toolName);
}

/** 检查是否为 MCP 工具 */
export function isMCPTool(toolName: string): boolean {
  return toolName === 'use_mcp_tool';
}

/** 检查是否需要安全限制（.c/.h 文件） */
export function requiresSecurityRestriction(
  toolName: string,
  path: string | undefined,
  source: string,
  cUnrestrict = false,
  isPrivateModel = false
): boolean {
  if (toolName !== 'read_file' || source !== 'codechat') return false;

  const fileExt = path ? path.split('.').pop() : '';
  return (fileExt === 'c' || fileExt === 'h') && !cUnrestrict && !isPrivateModel;
}

/** 应用安全限制 */
export function applySecurityRestriction(input: ToolResultInput): ToolResultOutput {
  return {
    content: '(出于安全考虑，当前文件不允许读取)',
    path: input.tool_result.path || '',
    isError: input.tool_result.isError,
  };
}

/** 处理 read_file 大文件 */
export function processReadFileLargeContent(content: string, path: string): ToolResultOutput {
  const lines = content.split('\n');
  if (lines.length > maxTruncatedLine + 10) {
    return {
      content: getFilePrompt(path, content),
      path,
      isError: false,
    };
  }

  return {
    content: truncateContent(content),
    path,
    isError: false,
  };
}

/** 处理编辑工具结果 */
export function processEditFileResult(input: ToolResultInput): ToolResultOutput {
  const { tool_result, extra } = input;

  if (tool_result.isError) {
    return {
      content: tool_result.content as string,
      path: tool_result.path || '',
      isError: true,
    };
  }

  const finalResult = extra?.finalResult || '';
  const beforeEdit = extra?.beforeEdit || '';
  const isLargeFile = (finalResult?.split('\n')?.length || 0) > maxTruncatedLine;

  return {
    content: isLargeFile ? getDiffPatchOfContent(beforeEdit, finalResult) : finalResult,
    path: tool_result.path || '',
    isError: false,
    extra: { isLargeFile },
  };
}

/** 处理 retrieve 工具空结果 */
export function processRetrieveEmptyResult(input: ToolResultInput): ToolResultOutput {
  return {
    content: '未查询到相关信息',
    path: input.tool_result.path || '',
    isError: input.tool_result.isError,
  };
}

/** 处理 MCP 工具内容截断 */
export function processMCPToolResult(input: ToolResultInput): ToolResultOutput {
  let content = input.tool_result.content;

  if (Array.isArray(content)) {
    // 只有列表才会返回 MCP 结果内容
    content.forEach((contentItem: { type: 'text'; text: string }) => {
      if (contentItem.type === 'text') {
        contentItem.text = truncateContent(contentItem.text, 60000);
      }
    });
  } else if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (e) {
      // 保持原样
    }
  }

  return {
    content: Array.isArray(content) ? JSON.stringify(content) : content as string,
    path: input.tool_result.path || '',
    isError: input.tool_result.isError,
  };
}

/** 应用通用内容截断 */
export function applyGeneralTruncation(input: ToolResultInput): ToolResultOutput {
  const content = input.tool_result.content as string;

  if (content && content.length > 100000 && !isRetrieveTool(input.tool_name)) {
    return {
      content: `${content.slice(0, 100000)}\n\n(Truncated due to content size limit)`,
      path: input.tool_result.path || '',
      isError: input.tool_result.isError,
      extra: input.extra,
    };
  }

  return {
    content,
    path: input.tool_result.path || '',
    isError: input.tool_result.isError,
    extra: input.extra,
  };
}

/** 同步处理图片 buffer 转 base64 URL */
export async function processImageBufferSync(input: ToolResultInput): Promise<ToolResultOutput> {
  const { tool_result } = input;
  const { path, content, isError } = tool_result;

  if (isError) {
    return {
      content: content as string,
      path: path || '',
      isError: true,
    };
  }

  // 确保 path 不为空
  if (!path) {
    return {
      content: 'No file path provided',
      path: '',
      isError: true,
    };
  }

  try {
    // 检查 content 格式
    if (!content || typeof content !== 'object' || !('data' in content)) {
      throw new Error(`Invalid buffer format. Expected {data: Uint8Array}, got: ${typeof content}`);
    }

    const fileName = path.split(/[/\\]/).pop() || path;

    // 确保 data 是可以转换为 Uint8Array 的格式
    const data = (content as any).data;
    if (!data) {
      throw new Error('No data property found in content');
    }

    // 更安全的类型转换，确保返回标准的 Uint8Array
    let uint8Array: Uint8Array;
    if (data instanceof Uint8Array) {
      // 创建一个新的标准 Uint8Array，避免 SharedArrayBuffer 问题
      uint8Array = new Uint8Array(data);
    } else if (data instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(data);
    } else if (Array.isArray(data) || (data.length !== undefined && typeof data.length === 'number')) {
      uint8Array = new Uint8Array(data);
    } else {
      throw new Error(`Unsupported data format: ${typeof data}`);
    }

    // 确保创建一个完全兼容的 Uint8Array 用于 Blob
    const blobCompatibleArray = new Uint8Array(uint8Array);
    const blob = new Blob([blobCompatibleArray], { type: 'application/octet-stream' });
    const file = new File([blob], fileName, {
      type: 'application/octet-stream',
      lastModified: Date.now(),
    });

    const smallFile = await compressImage(file);

    // 同步转换为 base64
    return new Promise<ToolResultOutput>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const base64 = reader.result as string;

          const imageContent = JSON.stringify([{
            type: ChatMessageContent.ImageUrl,
            image_url: {
              url: base64,
            },
          }]);

          resolve({
            content: imageContent,
            path,
            isError: false,
          });
        } catch (error) {
          console.error(`[ToolProcessor] Failed to process image:`, error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error(`[ToolProcessor] FileReader error:`, error);
        reject(new Error(getErrorMessage(error)));
      };

      reader.readAsDataURL(smallFile);
    });

  } catch (error) {
    console.error(`[ToolProcessor] Image processing error:`, error);
    return {
      content: getErrorMessage(error),
      path,
      isError: true,
    };
  }
}