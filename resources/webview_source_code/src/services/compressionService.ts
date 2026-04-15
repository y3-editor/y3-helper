import { ChatMessage } from '../services';
import {
  CompressionResult,
  CompressionContext,
  CompressedResult,
  CompressionMetadata,
  DEFAULT_COMPRESSION_CONFIG,
  COMPRESSION_CONSTANTS,
  SessionStatus
} from '../types/contextCompression';
import { analyzeTokenUsageWithTools, calculateLatestTokenUsage, trimMessagesByTokenLimit } from '../utils/tokenCalculator';
import { Tool, useWorkspaceStore } from '../store/workspace';
import { generateCompressionPrompt } from '../utils/compressionPrompt';
import { fetchCompressResponse } from '../services/chat';
import { UserEvent } from '../types/report';
import { ChatRole } from '../types/chat';
import userReporter from '../utils/report';
import { logger as webToolsLogger } from '@dep305/codemaker-web-tools';
import { serializeCodebaseMessages } from '../utils/validateBeforeChat';
import { truncateMessagesIfNeeded } from '../utils/truncateMessages';
import { useChatConfig } from '../store/chat-config';
import { ChatModel } from './chatModel';
import { getSessionById, syncSessionHistory } from '../hooks/useCurrentSession';
import { replaceSkillPlaceholders } from '../utils/compressionPrompt';

const compressStatusListeners = new Set<(sessionId: string, status: SessionStatus) => void>();

const COMPRESS_TIMEOUT_MS = 2 * 60 * 1000;
const FAILED_COOLDOWN_MS = 5 * 60 * 1000; // FAILED 状态冷却时间，过后自动重置为 INITIAL

export const getCompressSessionStatus = async (sessionId: string) => {
  const sessionData = await getSessionById(sessionId);
  const compression = sessionData?.data?.compression;
  const status = compression?.compressSessionStatus || SessionStatus.INITIAL;

  // 检测僵死状态：如果是 COMPRESSING 但超时了，自动重置为 FAILED
  if (status === SessionStatus.COMPRESSING && compression?.statusChangedTime) {
    const elapsed = Date.now() - compression.statusChangedTime;
    if (elapsed > COMPRESS_TIMEOUT_MS) {
      console.warn(`压缩状态超时 (${Math.round(elapsed / 1000)}s)，重置为 FAILED`);
      await setCompressSessionStatus(sessionId, SessionStatus.FAILED);
      return SessionStatus.FAILED;
    }
  }

  // FAILED 状态冷却后自动重置为 INITIAL，允许重试
  if (status === SessionStatus.FAILED && compression?.statusChangedTime) {
    const elapsed = Date.now() - compression.statusChangedTime;
    if (elapsed > FAILED_COOLDOWN_MS) {
      console.info(`FAILED 状态冷却结束 (${Math.round(elapsed / 1000)}s)，重置为 INITIAL`);
      await setCompressSessionStatus(sessionId, SessionStatus.INITIAL);
      return SessionStatus.INITIAL;
    }
  }

  return status;
}

export const getPrevCompressSessionStatus = async (sessionId: string) => {
  const sessionData = await getSessionById(sessionId);
  return sessionData?.data?.compression?.prevCompressSessionStatus || SessionStatus.INITIAL;
}

export const setCompressSessionStatus = async (sessionId: string, status: SessionStatus) => {
  const sessionData = await getSessionById(sessionId);
  const prevStatus = sessionData?.data?.compression?.compressSessionStatus || SessionStatus.INITIAL;

  const result = syncSessionHistory(sessionId, {
    data: {
      compression: {
        compressSessionStatus: status,
        prevCompressSessionStatus: prevStatus,
        statusChangedTime: Date.now(),
      }
    }
  })

  compressStatusListeners.forEach(listener => listener(sessionId, status));

  return result;
}

export const subscribeCompressStatus = (
  listener: (sessionId: string, status: SessionStatus) => void
): (() => void) => {
  compressStatusListeners.add(listener);
  return () => {
    compressStatusListeners.delete(listener);
  };
}

/**
 * Context compression service - handles the business logic of compression
 */
export class CompressionService {
  private readonly DEFAULT_THRESHOLDS = DEFAULT_COMPRESSION_CONFIG.thresholds;

  /**
   * Analyze current context usage and return threshold status
   */
  async analyzeContext(
    messages: ChatMessage[],
    model: ChatModel,
    codebaseModelMaxTokens: Record<ChatModel, number>,
    tools: Tool[] = useWorkspaceStore.getState().getCodebaseChatTools(),
    pendingSavedTokens = 0
  ) {
    const {
      currentUsage,
      maxLimit,
    } = await analyzeTokenUsageWithTools(messages.filter(msg => !msg.isCompressed), tools, model, codebaseModelMaxTokens);

    const adjustedUsage = Math.max(0, currentUsage - pendingSavedTokens);

    const warningLevel = maxLimit * this.DEFAULT_THRESHOLDS.warningThreshold;
    const errorLevel = maxLimit * this.DEFAULT_THRESHOLDS.errorThreshold;
    const compressionLevel = maxLimit * this.DEFAULT_THRESHOLDS.compressionThreshold;

    const percentageUsed = maxLimit > 0 ? (adjustedUsage / maxLimit) : 0;

    return {
      currentTokenUsage: adjustedUsage,
      maxTokenLimit: maxLimit,
      percentageUsed,
      isAboveWarningThreshold: adjustedUsage >= warningLevel,
      isAboveErrorThreshold: adjustedUsage >= errorLevel,
      isAboveCompressionThreshold: adjustedUsage >= compressionLevel,
      shouldCompress: adjustedUsage >= compressionLevel,
    };
  }

  /**
   * Execute compression process
   */
  async performCompression(
    context: CompressionContext,
    additionalInstructions?: string
  ): Promise<CompressionResult> {
    userReporter.report({
      event: UserEvent.CODE_CHAT_COMPRESS,
    });

    const { messages, model } = context;

    await setCompressSessionStatus(context.sessionId, SessionStatus.COMPRESSING);
    try {
      // Calculate original token count
      const originalTokenCount = calculateLatestTokenUsage(messages);

      // Preserve recent messages (last preserveRecentCount messages to maintain context)
      let preserveRecentCount = context.preserveRecentCount || COMPRESSION_CONSTANTS.PRESERVE_RECENT_MESSAGES;
      // 判断最后一条message是否为AI message 的 tool call，或user, 如果是，则少保留一条
      if (messages.length > 0
        && messages.length - preserveRecentCount >= 0
        && (
          (messages[messages.length - preserveRecentCount - 1].role === ChatRole.Assistant
            && (messages[messages.length - preserveRecentCount - 1]).tool_calls?.length) ||
          messages[messages.length - preserveRecentCount - 1].role === ChatRole.User)
      ) {
        preserveRecentCount -= 1;
      }
      const messagesToCompress = preserveRecentCount
        ? preserveRecentCount > 0 ? messages.slice(0, -preserveRecentCount) : messages.slice(0, preserveRecentCount)
        : messages;

      if (messagesToCompress.length < COMPRESSION_CONSTANTS.MIN_MESSAGES_TO_COMPRESS) {
        console.warn('[CompressionService] Not enough messages to compress');
      }

      // Generate compression prompt
      const compressionPrompt = generateCompressionPrompt(additionalInstructions);

      // Prepare messages for LLM call
      const compressionMessages = [
        ...messagesToCompress,
        {
          id: 'compression_prompt',
          role: ChatRole.User,
          content: compressionPrompt,
        }
      ];

      const filteredMessages = await trimMessagesByTokenLimit(
        compressionMessages,
        DEFAULT_COMPRESSION_CONFIG.maxTokens,
      );

      const requestCompression = async (payload: ChatMessage[]) =>
        fetchCompressResponse({
          messages: await serializeCodebaseMessages(
            model || DEFAULT_COMPRESSION_CONFIG.compressionModel,
            payload,
          ),
          model: model || DEFAULT_COMPRESSION_CONFIG.compressionModel,
          max_tokens: DEFAULT_COMPRESSION_CONFIG.maxOutputTokens, // Compression output limit
          vertexai: {
            thinking_config: {
              thinking_budget: 128,
            },
          },
        });

      const extractSummaryText = (response: Awaited<ReturnType<typeof requestCompression>>) =>
        response?.choices?.[0]?.message?.content ?? '';

      const runCompressionWithFallback = async () => {
        let response = await requestCompression(filteredMessages);
        let summary = extractSummaryText(response);

        if (summary.trim()) {
          return { response, summary };
        }

        userReporter.report({
          event: UserEvent.CODE_CHAT_COMPRESS_EMPTY,
        });
        webToolsLogger.hub.withScope((scope) => {
          scope.setExtra('compressionResponse', response);
          webToolsLogger.captureException(UserEvent.CODE_CHAT_COMPRESS_EMPTY);
        });

        const codebaseModelMaxTokens = useChatConfig.getState().codebaseModelMaxTokens;
        const compressionModel = model || DEFAULT_COMPRESSION_CONFIG.compressionModel;

        const { sendMessages: fallbackMessages } = truncateMessagesIfNeeded({
          messages: filteredMessages,
          model: compressionModel,
          codebaseModelMaxTokens
        });

        if (fallbackMessages.length === 0) {
          return { response, summary };
        }

        response = await requestCompression(fallbackMessages);
        summary = extractSummaryText(response);

        if (summary.trim()) {
          return { response, summary };
        }

        userReporter.report({
          event: UserEvent.CODE_CHAT_COMPRESS_EMPTY_RETRY,
        });
        webToolsLogger.hub.withScope((scope) => {
          scope.setExtra('compressionResponse', response);
          webToolsLogger.captureException(UserEvent.CODE_CHAT_COMPRESS_EMPTY_RETRY);
        });

        return { response, summary };
      };

      const { response: compressionResponse, summary: rawSummaryText } =
        await runCompressionWithFallback();

      if (!rawSummaryText || rawSummaryText.trim() === '') {
        throw new Error('Failed to generate compression summary');
      }

      let summaryText = '';
      try {
        summaryText = await replaceSkillPlaceholders(rawSummaryText, messages);
      } catch (error) {
        console.warn('[CompressionService] replaceSkillPlaceholders failed:', error);
        summaryText = rawSummaryText;
      }

      // Calculate compressed token count
      const compressedTokenCount = compressionResponse.usage?.completion_tokens_details.text_tokens
        || compressionResponse.usage?.completion_tokens
        || compressionResponse.usage?.total_tokens
        || 0;

      // Create compression metadata
      const metadata: CompressionMetadata = {
        originalMessageCount: messagesToCompress.length,
        compressedAt: Date.now(),
        tokensSaved: originalTokenCount - compressedTokenCount,
        compressionRatio: originalTokenCount / compressedTokenCount,
        originalTokenCount,
        compressedTokenCount,
      };

      // Create compressed message
      const compressedResult: CompressedResult = {
        id: `compressed_${Date.now()}`,
        role: ChatRole.User,
        content: `
<system-reminder>
Context has been compressed using structured 8-section algorithm. All essential information has been preserved for seamless continuation.
</system-reminder>

### Compression Summary:
${summaryText}
        `,
        isCompressionSummary: true,
        compressionMetadata: metadata,
      };

      await setCompressSessionStatus(context.sessionId, SessionStatus.COMPRESSED);
      return {
        success: true,
        compressedResult,
        originalMessageCount: messagesToCompress.length,
        tokensBeforeCompression: originalTokenCount,
        tokensAfterCompression: compressedTokenCount,
        preserveRecentCount,
        compressedMessages: messagesToCompress,
        uncompressedMessages: preserveRecentCount
          ? preserveRecentCount > 0 ? messages.slice(-preserveRecentCount) : messages.slice(preserveRecentCount)
          : [],
      };

    } catch (error) {
      await setCompressSessionStatus(context.sessionId, SessionStatus.FAILED);
      console.error('Compression failed:', error);

      userReporter.report({
        event: UserEvent.CODE_CHAT_COMPRESS_FAILED,
      });
      webToolsLogger.captureException(error instanceof Error ? error : UserEvent.CODE_CHAT_COMPRESS_FAILED);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compression error',
        originalMessageCount: messages.length,
        tokensBeforeCompression: calculateLatestTokenUsage(messages),
        tokensAfterCompression: 0,
      };
    }
  }

  /**
   * Apply compression result to message array
   */
  applyCompression(
    originalMessages: ChatMessage[],
    compressionResult: CompressionResult
  ): ChatMessage[] {
    if (!compressionResult.success || !compressionResult.compressedResult) {
      return originalMessages; // Return original if compression failed
    }

    let unCompressedCount = 0;

    for (let i = originalMessages.length - 1; i >= 0; i--) {
      if (!originalMessages[i].isCompressed) {
        unCompressedCount++;
      } else {
        break;
      }
    }

    if (unCompressedCount === 0) {
      return [
        ...originalMessages,
        compressionResult.compressedResult,
      ]
    } else {
      const compressedMessages = originalMessages.slice(0, -unCompressedCount);

      // Keep recent messages
      const recentMessages = originalMessages.slice(-unCompressedCount);

      // Replace compressed portion with summary + recent messages
      return [
        ...compressedMessages,
        compressionResult.compressedResult,
        ...recentMessages,
      ];

    }
  }
}

export const compressionService = new CompressionService();
