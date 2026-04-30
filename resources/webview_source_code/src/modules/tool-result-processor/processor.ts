/**
 * Enhanced Tool Result Processor
 *
 * 统一的工具结果处理器，支持同步和异步处理，
 * 提供与 CodeChat.tsx 相同的处理能力。
 */

import type {
  ToolResultInput,
  ToolResultOutput,
  ToolResultProcessContext,
  AsyncProcessingCallbacks,
  TerminalUpdateCallbacks,
  SessionUpdateCallbacks,
} from './types';
import {
  handleReadFile,
  handleEditFile,
  handleRetrieveTool,
  handleMCPTool,
  handleGenericTool,
} from './handlers';
import {
  isTerminalTool,
  isFileEditTool,
  isRetrieveTool,
  isMCPTool,
} from './utils';
import { ETerminalStatus } from '../../routes/CodeChat/ChatMessagesList/TermialPanel';

export class EnhancedToolResultProcessor {
  private asyncCallbacks?: AsyncProcessingCallbacks;
  private terminalCallbacks?: TerminalUpdateCallbacks;
  private sessionCallbacks?: SessionUpdateCallbacks;

  constructor(
    asyncCallbacks?: AsyncProcessingCallbacks,
    terminalCallbacks?: TerminalUpdateCallbacks,
    sessionCallbacks?: SessionUpdateCallbacks
  ) {
    this.asyncCallbacks = asyncCallbacks;
    this.terminalCallbacks = terminalCallbacks;
    this.sessionCallbacks = sessionCallbacks;
  }

  /**
   * 处理工具调用结果
   *
   * @param input 工具结果输入
   * @param context 处理上下文
   * @returns 处理结果，如果需要异步处理则返回 null
   */
  async process(
    input: ToolResultInput,
    context: ToolResultProcessContext
  ): Promise<ToolResultOutput | null> {
    const { tool_name, tool_id, tool_result, extra } = input;

    // 1. 终端工具特殊处理
    if (isTerminalTool(tool_name)) {
      if (this.terminalCallbacks?.updateTerminalResult) {
        this.terminalCallbacks.updateTerminalResult({
          messageId: extra?.messageId,
          terminalId: tool_id,
          terminalStatus: extra?.terminalStatus || ETerminalStatus.FAILED,
          content: tool_result.content as string,
          hasShellIntegration: extra?.hasShellIntegration || false,
        });
      }
      if (this.terminalCallbacks?.updateTerminals) {
        this.terminalCallbacks.updateTerminals(tool_id, {
          id: tool_id,
          status: extra?.terminalStatusForJetbrains || extra?.status || '',
        });
      }
      return {
        content: tool_result.content as string,
        path: tool_result.path,
        isError: tool_result.isError,
        extra,
      };
    }

    // 2. 按工具类型分发处理
    let result: ToolResultOutput;

    if (tool_name === 'read_file') {
      result = await handleReadFile(input, context);
    } else if (isFileEditTool(tool_name)) {
      result = handleEditFile(input, context);
    } else if (isRetrieveTool(tool_name)) {
      result = handleRetrieveTool(input, context);
    } else if (isMCPTool(tool_name)) {
      result = handleMCPTool(input);
    } else {
      result = handleGenericTool(input, context);
    }

    // 3. 异步处理检查
    if (result.requiresAsyncProcessing) {
      if (result.asyncType === 'image' && this.asyncCallbacks?.onParseImage) {
        await this.asyncCallbacks.onParseImage(tool_id, input.tool_result);
        return null; // 异步处理，返回 null
      }
      if (result.asyncType === 'document' && this.asyncCallbacks?.onParseDoc) {
        await this.asyncCallbacks.onParseDoc(tool_id, input.tool_result);
        return null; // 异步处理，返回 null
      }

      // 如果需要异步处理但没有对应的回调
      console.warn(`[ToolProcessor][Warning] Async processing required but no callback available:`, {
        toolId: tool_id,
        asyncType: result.asyncType,
      });
    }

    // 4. 会话更新（根据上下文选择不同的更新方式）
    if (context.source === 'codechat' && this.sessionCallbacks?.updateToolCallResults) {
      // 主 agent：更新主会话
      this.sessionCallbacks.updateToolCallResults({
        [tool_id]: {
          path: result.path || '',
          content: result.content,
          isError: result.isError,
          extra: result.extra,
        },
      }, extra);
    } else if (context.source === 'subagent' && this.sessionCallbacks?.syncSubagentSession) {
      // Subagent：同步子会话（需要在调用方处理）
      // 这里不直接调用，而是返回结果让 executor 处理
    }

    return result;
  }

  /**
   * 设置异步处理回调
   */
  setAsyncCallbacks(callbacks: AsyncProcessingCallbacks) {
    this.asyncCallbacks = callbacks;
  }

  /**
   * 设置终端更新回调
   */
  setTerminalCallbacks(callbacks: TerminalUpdateCallbacks) {
    this.terminalCallbacks = callbacks;
  }

  /**
   * 设置会话更新回调
   */
  setSessionCallbacks(callbacks: SessionUpdateCallbacks) {
    this.sessionCallbacks = callbacks;
  }
}

/**
 * 创建用于主 agent 的处理器实例
 */
export function createMainAgentProcessor(
  asyncCallbacks: AsyncProcessingCallbacks,
  terminalCallbacks: TerminalUpdateCallbacks,
  sessionCallbacks: SessionUpdateCallbacks
): EnhancedToolResultProcessor {
  return new EnhancedToolResultProcessor(
    asyncCallbacks,
    terminalCallbacks,
    sessionCallbacks
  );
}

/**
 * 创建用于 subagent 的处理器实例
 */
export function createSubagentProcessor(
  asyncCallbacks?: AsyncProcessingCallbacks,
  terminalCallbacks?: TerminalUpdateCallbacks
): EnhancedToolResultProcessor {
  return new EnhancedToolResultProcessor(
    asyncCallbacks,
    terminalCallbacks
    // subagent 不使用主会话的 sessionCallbacks
  );
}