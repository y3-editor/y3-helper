/**
 * Tool Result Processor Types
 */

import type { ChatModel } from '../../services/chatModel';
import type { ChatSession } from '../../store/chat';
import type { ChatMessage } from '../../services';

/** 工具结果处理上下文 */
export interface ToolResultProcessContext {
  /** 会话信息 */
  session: ChatSession;
  /** 用户消息（可选） */
  userMessage?: ChatMessage;
  /** 模型信息 */
  model: ChatModel;
  /** 来源标识 */
  source: 'codechat' | 'subagent';
  /** C 文件不限制标识 */
  cUnrestrict?: boolean;
  /** 是否为私有模型 */
  isPrivateModel?: boolean;
  /** 允许公共模型访问 */
  allowPublicModelAccess?: boolean;
  /** 认证扩展信息 */
  authExtends?: Record<string, any>;
}

/** 工具结果处理的原始输入 */
export interface ToolResultInput {
  tool_id: string;
  tool_name: string;
  tool_result: {
    content: string | any[];
    path?: string;
    isError?: boolean;
  };
  extra?: Record<string, any>;
  task_id?: string;
}

/** 工具结果处理输出 */
export interface ToolResultOutput {
  /** 处理后的内容 */
  content: string;
  /** 文件路径（如果有） */
  path?: string;
  /** 是否为错误 */
  isError?: boolean;
  /** 额外信息 */
  extra?: Record<string, any>;
  /** 是否需要异步处理（图片、文档解析） */
  requiresAsyncProcessing?: boolean;
  /** 异步处理类型 */
  asyncType?: 'image' | 'document';
}

/** 工具结果异步处理回调 */
export interface AsyncProcessingCallbacks {
  /** 图片解析回调 */
  onParseImage?: (toolId: string, toolResult: any) => Promise<void>;
  /** 文档解析回调 */
  onParseDoc?: (toolId: string, toolResult: any) => Promise<void>;
}

/** 终端工具结果更新回调 */
export interface TerminalUpdateCallbacks {
  /** 更新终端结果 */
  updateTerminalResult?: (params: {
    messageId?: string;
    terminalId: string;
    terminalStatus: string;
    content: string;
    hasShellIntegration: boolean;
  }) => void;
  /** 更新终端状态 */
  updateTerminals?: (terminalId: string, status: { id: string; status: string }) => void;
}

/** 会话更新回调 */
export interface SessionUpdateCallbacks {
  /** 更新工具调用结果到主会话（仅主 agent 使用） */
  updateToolCallResults?: (results: Record<string, any>, extra?: any) => void;
  /** 同步子会话（仅 subagent 使用） */
  syncSubagentSession?: (taskId: string, messages: any[], model: ChatModel) => Promise<void>;
}