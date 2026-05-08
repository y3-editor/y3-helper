import { ToolCall } from '../services';

/**
 * 创建流式工具调用解析器（工厂函数）。
 *
 * 返回的 parse 函数可在每次 onMessage 回调中调用，
 * 内部通过闭包维护增量解析状态，支持跨多次调用。
 *
 * @returns parse(toolCall, toolcallParsedIndex) => { codeContent, nextParsedIndex }
 *   - codeContent: 解析出的代码块字符串（无内容时为空字符串）
 *   - nextParsedIndex: 更新后的 toolcallParsedIndex，调用方需回写
 */
export function createToolCallStreamParser() {
  // write 工具解析状态
  let parsedWriteFilePath = '';
  let parsedWriteContent = '';
  let inWriteFilePath = false;
  let inWriteContent = false;

  // edit 工具解析状态
  let parsedEditFilePath = '';
  let parsedEditNewString = '';
  let inEditFilePath = false;
  let inEditOldString = false;
  let inEditNewString = false;

  // 公共增量缓冲
  let parsedArgumentStr = '';

  return function parse(
    toolCall: ToolCall,
    toolcallParsedIndex: number,
  ): { codeContent: string; nextParsedIndex: number } {
    const name = toolCall.function?.name;
    const argumentStr = toolCall.function?.arguments || '';

    if (name === 'write') {
      // 解析 write 工具: file_path + content
      for (let i = toolcallParsedIndex; i < argumentStr.length; i++) {
        parsedArgumentStr += argumentStr[i];
        toolcallParsedIndex++;
        if (parsedArgumentStr.endsWith('"file_path": "')) {
          inWriteFilePath = true;
        } else if (inWriteFilePath) {
          parsedWriteFilePath += argumentStr[i];
          if (parsedArgumentStr.endsWith('", "content": "')) {
            inWriteFilePath = false;
            inWriteContent = true;
            parsedWriteFilePath = parsedWriteFilePath.slice(0, -15);
          }
        } else if (inWriteContent) {
          parsedWriteContent += argumentStr[i];
        }
      }
      let codeContent = '';
      if (parsedWriteFilePath && parsedWriteContent) {
        codeContent = `\n\n\`\`\`\n${parsedWriteContent.replace(/\\n/g, '\n')}\n\`\`\``;
      }
      return { codeContent, nextParsedIndex: toolcallParsedIndex };
    }

    if (name === 'edit') {
      // 解析 edit 工具: file_path + old_string + new_string
      for (let i = toolcallParsedIndex; i < argumentStr.length; i++) {
        parsedArgumentStr += argumentStr[i];
        toolcallParsedIndex++;
        if (parsedArgumentStr.endsWith('"file_path": "')) {
          inEditFilePath = true;
        } else if (inEditFilePath) {
          parsedEditFilePath += argumentStr[i];
          if (parsedArgumentStr.endsWith('", "old_string": "')) {
            inEditFilePath = false;
            inEditOldString = true;
            parsedEditFilePath = parsedEditFilePath.slice(0, -18);
          }
        } else if (inEditOldString) {
          if (parsedArgumentStr.endsWith('", "new_string": "')) {
            inEditOldString = false;
            inEditNewString = true;
          }
        } else if (inEditNewString) {
          parsedEditNewString += argumentStr[i];
        }
      }
      let codeContent = '';
      if (parsedEditFilePath && parsedEditNewString) {
        codeContent = `\n\n\`\`\`\n${parsedEditNewString.replace(/\\n/g, '\n')}\n\`\`\``;
      }
      return { codeContent, nextParsedIndex: toolcallParsedIndex };
    }

    // 不支持的工具名称，返回空
    return { codeContent: '', nextParsedIndex: toolcallParsedIndex };
  };
}
