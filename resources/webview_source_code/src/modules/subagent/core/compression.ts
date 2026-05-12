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
import type {
  CompressionContext,
  SessionCompressionState,
} from '../../../types/contextCompression';
import { debugWarn } from '../../../utils/debugLog';
import { serializeCodebaseMessages } from '../../../utils/validateBeforeChat';
import { trace, SpanStatusCode, type Span } from '../../../telemetry/otel';
import { TRACING_DEFAULT_TRACER } from '../../../telemetry/const';
import { applyAssociationAttributes } from '../../../telemetry/otel';
import {
  GEN_AI_OPERATION_NAME,
  GEN_AI_AGENT_NAME,
  GEN_AI_CONVERSATION_ID,
  AGENT_BUILTIN,
  GenAiOperationName,
} from '../../../telemetry/attributes';
import type { SubagentSpanContext } from '../types';
import { useSubagentStore } from '../state/store';

const MODULE = 'Subagent/Compression';

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
 *
 * 设计决策：与主 agent 保持一致
 * - 使用 store 中的 session.messages（不包含 system prompt）
 * - 不对包含 cache marks 的消息进行压缩判断
 * - 只分析存储到后端的原始消息
 *
 * @param sessionMessages - 从 store 中获取的 session.messages（不含 system prompt）
 * @param model - 模型名称
 * @param sessionId - 会话 ID
 * @param _maxTokens - 最大 token 数（未使用，保留用于兼容性）
 * @param tools - 工具列表
 * @param compressionState - 压缩状态
 * @param subagentSpanContext - OTEL span 上下文
 * @param abortSignal - 中止信号，用于检查是否需要中止压缩
 * @returns 压缩结果，包含压缩后的消息数组和是否压缩的标志
 */
// [Debug] 设为 true 可强制触发压缩，跳过阈值检查（调试用，勿提交）
const DEBUG_FORCE_COMPRESS = false;

export async function checkAndCompress(
  sessionMessages: ChatMessage[],
  model: ChatModel,
  sessionId: string,
  _maxTokens: number,
  tools: Tool[],
  compressionState: SessionCompressionState,
  subagentSpanContext?: SubagentSpanContext,
  abortSignal?: AbortSignal,
): Promise<{
  messages: ChatMessage[];
  compressed: boolean;
  tokensBefore?: number;
  tokensAfter?: number;
  /** 被压缩的消息 id 集合，用于调用方标记 isCompressed */
  compressedMessageIds?: Set<string>;
}> {
  try {
    // ============================================================
    // 1. 检查是否已中止（在压缩分析前）
    // ============================================================
    if (abortSignal?.aborted) {
      debugWarn(MODULE, 'Compression aborted before analysis', { sessionId });
      return { messages: sessionMessages, compressed: false };
    }
    const codebaseModelMaxTokens =
      useChatConfig.getState().codebaseModelMaxTokens;
    const chatModel = model as ChatModel;
    // const codebaseModelMaxTokens = {
    //   'claude-haiku-4-5-20251001': 15000,
    // } as Record<string, number>;
    // const chatModel = 'claude-haiku-4-5-20251001' as ChatModel;

    // 关键：只分析 session.messages（不含 system prompt，不含 cache marks）
    // 这与主 agent 的 analyzeContext 逻辑保持一致：
    // session.data.messages.filter(msg => !msg.isCompressed)
    const readyToAnalyze = sessionMessages.filter((msg) => !msg.isCompressed);

    // 分析上下文使用情况
    // 传入已节省的 token 数，避免重复计算压缩效果
    const analysis = await compressionService.analyzeContext(
      readyToAnalyze,
      chatModel,
      codebaseModelMaxTokens,
      tools,
      compressionState.totalTokensSaved,
    );

    if (
      (!analysis.shouldCompress || readyToAnalyze.length <= 4) &&
      !DEBUG_FORCE_COMPRESS
    ) {
      return { messages: sessionMessages, compressed: false };
    }

    // ============================================================
    // 2. 检查是否已中止（在执行压缩前）
    // ============================================================
    if (abortSignal?.aborted) {
      debugWarn(MODULE, 'Compression aborted before execution', { sessionId });
      return { messages: sessionMessages, compressed: false };
    }

    // 创建 OTEL compression span
    // Design D3: ContextCompression → invoke_agent compact.agent
    let compressionSpan: Span | undefined;
    if (subagentSpanContext) {
      const tracer = trace.getTracer(TRACING_DEFAULT_TRACER);
      compressionSpan = tracer.startSpan(
        'compact.agent',
        undefined,
        subagentSpanContext.taskContext,
      );

      // OTel GenAI spec: invoke_agent required attributes
      compressionSpan.setAttribute(
        GEN_AI_OPERATION_NAME,
        GenAiOperationName.InvokeAgent,
      );
      compressionSpan.setAttribute(GEN_AI_AGENT_NAME, 'compact.agent');
      compressionSpan.setAttribute(AGENT_BUILTIN, true);
      compressionSpan.setAttribute(GEN_AI_CONVERSATION_ID, sessionId);

      // Keep for Phoenix/openinference compatibility
      compressionSpan.setAttribute('openinference.span.kind', 'CHAIN');
      // Business attributes
      compressionSpan.setAttribute('compression.session_id', sessionId);

      if (subagentSpanContext.association) {
        applyAssociationAttributes(
          compressionSpan,
          subagentSpanContext.association,
        );
      }
    }

    const readyToCompress = sessionMessages.filter((msg) => !msg.isCompressed);

    // 构造压缩上下文（与主 agent 的 triggerCompression 逻辑一致）
    // 关键：使用 serializeCodebaseMessages 序列化，不添加 cache marks
    const compressionContext: CompressionContext = {
      messages: await serializeCodebaseMessages(
        // ChatModel.Gemini3Flash,
        {
          model,
          sendMessages: readyToCompress,
        }
      ),
      model,
      sessionId,
    };

    // ============================================================
    // 执行压缩（支持中止）
    // ============================================================

    // 设置压缩进行状态
    useSubagentStore.getState().updateCompressionStatus(sessionId, true);

    // 注意：compressionService.performCompression 本身不支持 abortSignal，
    // 我们通过 Promise.race 实现中止检测
    const compressionResult = await (async () => {
      if (!abortSignal) {
        // 没有 abortSignal，直接执行
        return compressionService.performCompression(compressionContext);
      }

      // 有 abortSignal，使用 Promise.race 监听中止
      const compressionPromise = compressionService.performCompression(compressionContext);

      const abortPromise = new Promise<never>((_, reject) => {
        if (abortSignal.aborted) {
          reject(new Error('Compression aborted'));
          return;
        }
        abortSignal.addEventListener('abort', () => {
          reject(new Error('Compression aborted'));
        }, { once: true });
      });

      return Promise.race([compressionPromise, abortPromise]);
    })();

    // ============================================================
    // 3. 检查是否已中止（压缩完成后）
    // ============================================================
    if (abortSignal?.aborted) {
      // 重置压缩状态
      useSubagentStore.getState().updateCompressionStatus(sessionId, false);

      // 记录中止状态到 span
      if (compressionSpan) {
        compressionSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Compression aborted',
        });
        compressionSpan.end();
      }

      return { messages: sessionMessages, compressed: false };
    }

    if (compressionResult.success && compressionResult.compressedResult) {
      // 应用压缩结果到 session.messages
      const compressedMessages = compressionService.applyCompression(
        sessionMessages,
        compressionResult,
      );

      // 计算被压缩的消息 id 集合（与主 agent markMessagesAsCompressed 逻辑一致）
      // uncompressedMessages 是压缩后保留的消息，不在其中的就是被压缩的消息
      const compressedMessageIds = new Set<string>();
      if (compressionResult.uncompressedMessages) {
        const uncompressedIds = new Set(
          compressionResult.uncompressedMessages.map(
            (m) => `${m.id}-${m.role}`,
          ),
        );
        for (const msg of readyToCompress) {
          if (!uncompressedIds.has(`${msg.id}-${msg.role}`)) {
            compressedMessageIds.add(`${msg.id}-${msg.role}`);
          }
        }
      }

      // 重置压缩状态（成功）
      useSubagentStore.getState().updateCompressionStatus(sessionId, false);

      // 记录成功指标到 span
      if (compressionSpan) {
        if (compressionResult.originalMessageCount !== undefined) {
          compressionSpan.setAttribute(
            'compression.original_message_count',
            compressionResult.originalMessageCount,
          );
        }
        const tokensSaved =
          (compressionResult.tokensBeforeCompression || 0) -
          (compressionResult.tokensAfterCompression || 0);
        compressionSpan.setAttribute('compression.tokens_saved', tokensSaved);

        if (
          compressionResult.tokensBeforeCompression &&
          compressionResult.tokensAfterCompression
        ) {
          compressionSpan.setAttribute(
            'compression.ratio',
            compressionResult.tokensAfterCompression /
            compressionResult.tokensBeforeCompression,
          );
        }
        compressionSpan.setStatus({ code: SpanStatusCode.OK });
        compressionSpan.end();
      }

      return {
        messages: compressedMessages,
        compressed: true,
        tokensBefore: compressionResult.tokensBeforeCompression,
        tokensAfter: compressionResult.tokensAfterCompression,
        compressedMessageIds,
      };
    } else {
      debugWarn(MODULE, 'Compression failed', {
        sessionId,
        error: compressionResult.error,
      });

      // 重置压缩状态（失败）
      useSubagentStore.getState().updateCompressionStatus(sessionId, false);

      // 记录失败状态到 span
      if (compressionSpan) {
        compressionSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: compressionResult.error || 'Compression failed',
        });
        compressionSpan.end();
      }

      return { messages: sessionMessages, compressed: false };
    }
  } catch (err) {
    // 压缩失败不影响主循环继续执行
    const errorMessage = err instanceof Error ? err.message : String(err);

    // 重置压缩状态（异常）
    useSubagentStore.getState().updateCompressionStatus(sessionId, false);

    // 检查是否是中止导致的错误
    if (errorMessage.includes('aborted') || abortSignal?.aborted) {
      debugWarn(MODULE, 'Compression aborted by signal', {
        sessionId,
        error: errorMessage,
      });
    } else {
      debugWarn(MODULE, 'Compression check threw error', {
        sessionId,
        err: errorMessage,
      });
    }

    // 返回原始 session.messages
    return { messages: sessionMessages, compressed: false };
  }
}
