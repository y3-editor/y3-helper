import { ChatMessage } from '../../services';
import {
  CompressionResult,
  CompressionContext,
  CompressedResult,
  CompressionMetadata,
  DEFAULT_COMPRESSION_CONFIG,
  COMPRESSION_CONSTANTS,
  SessionStatus,
} from '../../types/contextCompression';
import {
  analyzeTokenUsageWithTools,
  calculateLatestTokenUsage,
  trimMessagesByTokenLimit,
} from '../../utils/tokenCalculator';
import { Tool, useWorkspaceStore, SpecFramework } from '../../store/workspace';
import {
  generateCompressionPrompt,
  replaceSkillPlaceholders,
} from '../../utils/compressionPrompt';
import { GPTResponse } from '../chat';
import { UserEvent } from '../../types/report';
import { ChatRole } from '../../types/chat';
import userReporter from '../../utils/report';
import { logger as webToolsLogger } from '@dep305/codemaker-web-tools';
import { truncateMessagesIfNeeded } from '../../utils/truncateMessages';
import { useChatConfig } from '../../store/chat-config';
import { ChatModel } from '../chatModel';
import { createPostCompactFileBlock } from '../../utils/postCompactFileState';
import { writeTranscript } from '../../utils/transcript';
import { IMultiAttachment, useChatStore } from '../../store/chat';
import { useSubagentStore } from '../../modules/subagent';
import { buildCodebaseChatPayload } from '../buildCodebaseChatPayload';
import { computeEffectiveRules } from '../../utils/computeEffectiveRules';
import { inferCodebaseCacheEnable } from '../../utils/inferCodebaseCacheEnable';
import { runCompactionAgent } from '../compactionAgent';
import { setCompressSessionStatus } from './sessionStatus';
import { clearPruneState } from './pruneState';
import { pruneToolOutputs } from './pruneCore';

const updateCompressedTokens = (response: GPTResponse) => {
  const session = useChatStore.getState().currentSession();
  if (!session) return;
  const usage = response?.usage as
    | (GPTResponse['usage'] & {
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      })
    | undefined;

  const cacheCreation = usage?.cache_creation_input_tokens || 0;
  const cacheRead = usage?.cache_read_input_tokens || 0;

  useChatStore.getState().updateConsumedTokens({
    curSession: session,
    comporessPromptTokens: usage?.prompt_tokens || 0,
    comporessCompletionTokens: usage?.completion_tokens || 0,
    cacheCreationInputTokens: cacheCreation,
    cacheReadInputTokens: cacheRead,
  });

  if (cacheCreation || cacheRead) {
    console.log(
      `[CompressionService] cache usage: read=${cacheRead}, creation=${cacheCreation}, prompt=${usage?.prompt_tokens || 0}`,
    );
  }
};

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
    pendingSavedTokens = 0,
  ) {
    const { currentUsage, maxLimit } = await analyzeTokenUsageWithTools(
      messages.filter((msg) => !msg.isCompressed),
      tools,
      model,
      codebaseModelMaxTokens,
    );

    const adjustedUsage = Math.max(0, currentUsage - pendingSavedTokens);

    const warningLevel = maxLimit * this.DEFAULT_THRESHOLDS.warningThreshold;
    const errorLevel = maxLimit * this.DEFAULT_THRESHOLDS.errorThreshold;
    const compressionLevel = maxLimit * this.DEFAULT_THRESHOLDS.compressionThreshold;

    const percentageUsed = maxLimit > 0 ? adjustedUsage / maxLimit : 0;

    return {
      currentTokenUsage: adjustedUsage,
      maxTokenLimit: maxLimit,
      compressionTriggerThreshold: compressionLevel,
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
    additionalInstructions?: string,
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
      let preserveRecentCount =
        context.preserveRecentCount || COMPRESSION_CONSTANTS.PRESERVE_RECENT_MESSAGES;
      // 判断最后一条message是否为AI message 的 tool call，或user, 如果是，则少保留一条
      if (
        messages.length > 0 &&
        messages.length - preserveRecentCount >= 0 &&
        ((messages[messages.length - preserveRecentCount - 1].role === ChatRole.Assistant &&
          messages[messages.length - preserveRecentCount - 1].tool_calls?.length) ||
          messages[messages.length - preserveRecentCount - 1].role === ChatRole.User)
      ) {
        preserveRecentCount -= 1;
      }
      let messagesToCompress: ChatMessage[];
      if (!preserveRecentCount) {
        messagesToCompress = messages;
      } else if (preserveRecentCount > 0) {
        messagesToCompress = messages.slice(0, -preserveRecentCount);
      } else {
        messagesToCompress = messages.slice(0, preserveRecentCount);
      }

      if (messagesToCompress.length < COMPRESSION_CONSTANTS.MIN_MESSAGES_TO_COMPRESS) {
        console.warn('[CompressionService] Not enough messages to compress');
      }

      // 检测 spec 工作流模式，追加工作流保留指令
      const workflowMode = useChatStore.getState().codebaseChatMode;
      let instructions = additionalInstructions || '';
      if (workflowMode && workflowMode !== 'vibe') {
        let modeName: string;
        if (workflowMode === 'openspec') {
          const version = useWorkspaceStore
            .getState()
            .getFrameworkSpecInfo(SpecFramework.OpenSpec)?.version;
          modeName = version === '1.x' ? 'OpenSpec OPSX (1.x)' : 'OpenSpec (0.23)';
        } else {
          modeName = 'SpecKit';
        }
        instructions += `\nThis conversation is in ${modeName} workflow mode. You MUST include the active workflow mode, current phase (e.g., explore, apply, propose, continue), the active change name if any, and phase-specific constraints (e.g., explore mode STRICTLY prohibits code implementation — thinking and reading only; apply mode must follow the task list from change artifacts) in your summary. This is CRITICAL for maintaining workflow continuity after compression.`;
      }

      // Generate compression prompt
      const compressionPrompt = generateCompressionPrompt(instructions || undefined);
      const compressionPromptMessage: ChatMessage = {
        id: 'compression_prompt',
        role: ChatRole.User,
        content: compressionPrompt,
      };

      // 对 messagesToCompress 按 token 限额裁剪 —— compressionPrompt 不参与裁剪,
      // 它会作为 extraTailUserMessage 在 buildCodebaseChatPayload 阶段拼到末尾,
      // 拿到 cache breakpoint。
      const filteredMessages = await trimMessagesByTokenLimit(
        messagesToCompress,
        DEFAULT_COMPRESSION_CONFIG.maxTokens,
      );

      // 取主对话同款 payload 构造所需的 store 状态(一次性,压缩过程中不变)
      const chatConfigState = useChatConfig.getState();
      const chatModels = chatConfigState.chatModels;
      const codebaseModelMaxTokens = chatConfigState.codebaseModelMaxTokens;
      const mainModel = model || chatConfigState.config.model;
      const chatModelConfig = chatModels[mainModel];
      const cacheEnable = inferCodebaseCacheEnable(
        mainModel,
        chatModels,
        codebaseModelMaxTokens,
      );

      const enableSubagent = chatConfigState.enableSubagent;
      const agents = useSubagentStore.getState().agents;
      const currentSession = useChatStore.getState().currentSession();
      const codebaseChatMode = useChatStore.getState().codebaseChatMode;
      const activeChangeId = useChatStore.getState().activeChangeId;
      const activeFeatureId = useChatStore.getState().activeFeatureId;

      // 从最近一条 user message 反推 attachs(那一轮发请求时的快照,保证与主对话 effectiveRules 一致)
      const lastUserMessage = [...(currentSession?.data?.messages || [])]
        .reverse()
        .find((msg) => msg.role === ChatRole.User);
      const lastAttachs =
        (lastUserMessage?._originalRequestData?.attachs as IMultiAttachment) ||
        undefined;
      const effectiveRules = computeEffectiveRules(lastAttachs);

      if (!currentSession) {
        throw new Error('No current session for compression');
      }
      if (!chatModelConfig) {
        throw new Error(`chatModelConfig not found for model: ${mainModel}`);
      }

      const requestCompression = async (payload: ChatMessage[]) => {
        const { data } = await buildCodebaseChatPayload({
          sendMessages: payload,
          containUserMessage: true,
          newTruncateStart: -1,
          cacheEnable,
          model: mainModel,
          chatModels,
          codeChatApiKey: undefined,
          isReAct: false,
          effectiveRules,
          agentTaskDirective: undefined,
          enableSubagent,
          agents,
          session: currentSession,
          enablePlanMode: currentSession.data?.enablePlanMode,
          todoList: currentSession.data?.todoList,
          codebaseChatMode,
          activeChangeId,
          activeFeatureId,
          extraTailUserMessage: compressionPromptMessage,
        });

        return runCompactionAgent(chatModelConfig, data);
      };

      const extractSummaryText = (response: Awaited<ReturnType<typeof requestCompression>>) =>
        response?.choices?.[0]?.message?.content ?? '';

      const runCompressionWithFallback = async () => {
        // 第 1 次：全量消息压缩
        let response = await requestCompression(filteredMessages);
        updateCompressedTokens(response);
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

        // 第 2 次：裁剪旧 tool output 后重试（保持消息条数不变，减少 token 量）
        const enableToolResultOffload =
          useChatConfig.getState().toolResultOffloadSupported &&
          useChatConfig.getState().enableToolResultOffload;
        let prunedMessages = filteredMessages;
        if (enableToolResultOffload) {
          const pruneResult = await pruneToolOutputs(filteredMessages);
          prunedMessages = pruneResult.messages;
        }
        if (prunedMessages !== filteredMessages) {
          response = await requestCompression(prunedMessages);
          updateCompressedTokens(response);
          summary = extractSummaryText(response);

          if (summary.trim()) {
            return { response, summary };
          }

          userReporter.report({
            event: UserEvent.CODE_CHAT_COMPRESS_EMPTY_PRUNE,
          });
          webToolsLogger.hub.withScope((scope) => {
            scope.setExtra('compressionResponse', response);
            webToolsLogger.captureException(UserEvent.CODE_CHAT_COMPRESS_EMPTY_PRUNE);
          });
        }

        // 第 3 次：裁剪消息条数后重试
        const { sendMessages: fallbackMessages } = truncateMessagesIfNeeded({
          messages: prunedMessages,
          model: mainModel,
          codebaseModelMaxTokens,
        });

        if (fallbackMessages.length === 0) {
          return { response, summary };
        }

        response = await requestCompression(fallbackMessages);
        updateCompressedTokens(response);
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
        summaryText = await replaceSkillPlaceholders(rawSummaryText, messages, context.sessionId);
      } catch (error) {
        console.warn('[CompressionService] replaceSkillPlaceholders failed:', error);
        summaryText = rawSummaryText;
      }

      // Strip <analysis> drafting scratchpad — improves summary quality during
      // generation but has no informational value in the final context.
      summaryText = summaryText.replace(/<analysis>[\s\S]*?<\/analysis>/, '');
      // Extract <summary> content if present
      const summaryMatch = summaryText.match(/<summary>([\s\S]*?)<\/summary>/);
      if (summaryMatch) {
        summaryText = summaryText.replace(
          /<summary>[\s\S]*?<\/summary>/,
          `Summary:\n${(summaryMatch[1] || '').trim()}`,
        );
      }
      summaryText = summaryText.replace(/\n\n+/g, '\n\n').trim();

      // Calculate compressed token count
      const compressedTokenCount =
        compressionResponse.usage?.completion_tokens_details?.text_tokens ||
        compressionResponse.usage?.completion_tokens ||
        compressionResponse.usage?.total_tokens ||
        0;

      // Create compression metadata
      const metadata: CompressionMetadata = {
        originalMessageCount: messagesToCompress.length,
        compressedAt: Date.now(),
        tokensSaved: originalTokenCount - compressedTokenCount,
        compressionRatio: originalTokenCount / compressedTokenCount,
        originalTokenCount,
        compressedTokenCount,
      };

      // Create compressed message（只含 wrapper + summary，后续由 buildPostCompactContent 追加）
      const compressedResult: CompressedResult = {
        id: `compressed_${Date.now()}`,
        role: ChatRole.User,
        content: `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\n${summaryText}`,
        isCompressionSummary: true,
        compressionMetadata: metadata,
      };
      await setCompressSessionStatus(context.sessionId, SessionStatus.COMPRESSED);
      clearPruneState(context.sessionId);

      let uncompressedMessages: ChatMessage[];
      if (!preserveRecentCount) {
        uncompressedMessages = [];
      } else if (preserveRecentCount > 0) {
        uncompressedMessages = messages.slice(-preserveRecentCount);
      } else {
        uncompressedMessages = messages.slice(preserveRecentCount);
      }

      return {
        success: true,
        compressedResult,
        originalMessageCount: messagesToCompress.length,
        tokensBeforeCompression: originalTokenCount,
        tokensAfterCompression: compressedTokenCount,
        preserveRecentCount,
        compressedMessages: messagesToCompress,
        uncompressedMessages,
      };
    } catch (error) {
      await setCompressSessionStatus(context.sessionId, SessionStatus.FAILED);
      console.error('Compression failed:', error);

      userReporter.report({
        event: UserEvent.CODE_CHAT_COMPRESS_FAILED,
      });
      webToolsLogger.captureException(
        error instanceof Error ? error : UserEvent.CODE_CHAT_COMPRESS_FAILED,
      );
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
   * 构建压缩摘要的后续内容，按 CC 顺序拼装：
   *   文件恢复 → transcript 路径 → recentMessagesPreserved → continuation 指令
   * 纯返回值，不修改入参。所有 I/O 操作失败不影响主流程。
   */
  async buildPostCompactContent(
    sessionId: string,
    compressedMessages: ChatMessage[],
    uncompressedMessages: ChatMessage[] | undefined,
  ): Promise<string> {
    let extra = '';
    const enableToolResultOffload =
      useChatConfig.getState().toolResultOffloadSupported &&
      useChatConfig.getState().enableToolResultOffload;

    // 1. 压缩后最近文件恢复（依赖 IDE 文件读取，受开关控制）
    if (enableToolResultOffload) {
      try {
        const fileBlock = await createPostCompactFileBlock(
          compressedMessages,
          uncompressedMessages,
        );
        if (fileBlock) {
          extra += fileBlock;
        }
      } catch (e) {
        console.warn('[buildPostCompactContent] file block failed:', e);
      }
    }

    // 2. transcript 路径提示（依赖 IDE 文件写入，受开关控制）
    if (enableToolResultOffload) {
      try {
        const transcriptPath = await writeTranscript(sessionId, compressedMessages);
        if (transcriptPath) {
          extra +=
            `\n\nIf you need specific details from before compaction ` +
            `(like exact code snippets, error messages, or content you generated), ` +
            `read the full transcript at: ${transcriptPath}`;
        }
      } catch (e) {
        console.warn('[buildPostCompactContent] transcript failed:', e);
      }
    }

    // 3. 保留消息提示
    if (uncompressedMessages && uncompressedMessages.length > 0) {
      extra += `\n\nRecent messages are preserved verbatim.`;
    }

    // 4. continuation 指令（对齐 CC getCompactUserSummaryMessage）
    extra +=
      `\n\nContinue the conversation from where it left off without asking the user any further questions. ` +
      `Resume directly — do not acknowledge the summary, do not recap what was happening, ` +
      `do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.`;

    return extra;
  }

  /**
   * Apply compression result to message array
   */
  applyCompression(
    originalMessages: ChatMessage[],
    compressionResult: CompressionResult,
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
      // 所有消息都已压缩，追加新的压缩结果到最后
      return [...originalMessages, compressionResult.compressedResult];
    } else {
      // 计算实际保留的消息数量，使用 CompressionResult 中的信息
      const actualPreserveCount = compressionResult.preserveRecentCount || 0;

      // 如果所有消息都未压缩，需要根据实际的保留数量来分割
      const effectivePreserveCount =
        unCompressedCount === originalMessages.length ? actualPreserveCount : unCompressedCount;

      if (effectivePreserveCount === 0) {
        // 没有保留消息，压缩summary放在最后
        return [...originalMessages, compressionResult.compressedResult];
      } else {
        // 有保留消息，压缩summary放在被压缩内容和保留内容之间
        const compressedMessages = originalMessages.slice(0, -effectivePreserveCount);
        const recentMessages = originalMessages.slice(-effectivePreserveCount);

        return [...compressedMessages, compressionResult.compressedResult, ...recentMessages];
      }
    }
  }
}

export const compressionService = new CompressionService();