/**
 * 上下文压缩逻辑
 *
 * 提供上下文压缩分析和执行功能。
 * 复用全局 compressionService 实现。
 */

import type { ChatMessage, Tool } from '../utils';
import { compressionService } from '../../../services/compressionService';
import { useChatConfig } from '../../../store/chat-config';
import { ChatModel } from '../../../services/chatModel';
import type { CompressionContext } from '../../../types/contextCompression';

// ============================================================
// 类型定义（兼容层，保持对外接口稳定）
// ============================================================

export interface CompressionAnalysis {
  shouldCompress: boolean;
  percentageUsed: number;
  estimatedTokens: number;
  maxTokens: number;
}

export interface CompressionResult {
  success: boolean;
  compressedResult?: {
    id: string;
    role: string;
    content: string;
    isCompressionSummary: boolean;
  };
  tokensBeforeCompression?: number;
  tokensAfterCompression?: number;
  error?: string;
}

// ============================================================
// 上下文压缩功能
// ============================================================

/**
 * 检查并执行上下文压缩。
 * 返回压缩后的消息数组（如果发生压缩）或原数组（如果未压缩）。
 */
export async function checkAndCompress(
  messages: ChatMessage[],
  model: string,
  sessionId: string,
  _maxTokens: number,
  tools: Tool[],
): Promise<{
  messages: ChatMessage[];
  compressed: boolean;
  tokensBefore?: number;
  tokensAfter?: number;
}> {
  try {
    const codebaseModelMaxTokens = useChatConfig.getState().codebaseModelMaxTokens;
    const chatModel = model as ChatModel;

    // 分析上下文使用情况
    const analysis = await compressionService.analyzeContext(
      messages,
      chatModel,
      codebaseModelMaxTokens,
      tools,
    );

    if (!analysis.shouldCompress || messages.length <= 4) {
      return { messages, compressed: false };
    }

    console.log(
      `[Subagent] ${sessionId} triggering context compression, ` +
        `usage: ${(analysis.percentageUsed * 100).toFixed(1)}%`,
    );

    // 构造压缩上下文
    const compressionContext: CompressionContext = {
      messages,
      model: chatModel,
      sessionId,
    };

    // 执行压缩
    const compressionResult = await compressionService.performCompression(
      compressionContext,
    );

    if (compressionResult.success && compressionResult.compressedResult) {
      const compressedMessages = compressionService.applyCompression(
        messages,
        compressionResult,
      );

      return {
        messages: compressedMessages,
        compressed: true,
        tokensBefore: compressionResult.tokensBeforeCompression,
        tokensAfter: compressionResult.tokensAfterCompression,
      };
    } else {
      console.warn(
        `[Subagent] ${sessionId} compression failed:`,
        compressionResult.error,
      );
      return { messages, compressed: false };
    }
  } catch (err) {
    // 压缩失败不影响主循环继续执行
    console.warn(`[Subagent] ${sessionId} compression check failed:`, err);
    return { messages, compressed: false };
  }
}