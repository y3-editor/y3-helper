/**
 * 会话管理函数
 *
 * 创建、恢复、同步子代理后端会话。
 */

import { ChatMessage } from '../../../services';
import {
  createSession as createChatSession,
  getSessionData,
  updateSession,
} from '../../../services/chat';
import { ChatModel } from '../../../services/chatModel';
import { useChatConfig } from '../../../store/chat-config';
import {
  calculateConsumedTokensUpdate,
  createInitialConsumedTokens,
  type TokenIncrement,
  type ModelPriceInfo,
} from '../../../utils/consumedTokensCalculator';
import type { Agent, TaskParams } from '../types';
import type { SessionCompressionState } from '../../../types/contextCompression';

// 扩展 LLM 调用用量，包含系统 token 估算
interface ExtendedLLMCallUsage extends TokenIncrement {
  totalTokens: number;
}

// ============================================================
// 会话管理函数
// ============================================================

/**
 * 创建新的子代理后端会话，返回 taskId。
 */
export async function createNewSession(
  agent: Agent,
  params: TaskParams,
  parentSessionId: string,
  currentModel: string,
): Promise<string> {
  const subSession = await createChatSession({
    topic: `[Subagent] ${agent.name}: ${params.description}`,
    chat_type: 'codebase',
    agent_type: 'sub_agent',
    parent_session_id: parentSessionId,
    data: {
      messages: [],
      model: currentModel,
    },
  });
  return subSession._id;
}

/**
 * 尝试从后端恢复历史会话。
 * 返回历史消息数组，如果恢复失败则返回 null。
 */
export async function resumeSession(
  taskId: string,
): Promise<ChatMessage[] | null> {
  try {
    const sessionData = await getSessionData(taskId);
    const historyMessages = sessionData?.data?.messages;
    const compressionState = sessionData?.data?.compression;

    if (historyMessages && historyMessages.length > 0) {
      // 验证压缩相关字段是否正确恢复
      const compressionSummaries = historyMessages.filter(
        (msg) => msg.isCompressionSummary,
      );
      if (compressionSummaries.length > 0) {
        console.log(
          `[Subagent] ${taskId} Resuming session with ${compressionSummaries.length} compression summaries`,
        );
        compressionSummaries.forEach((summary, index) => {
          console.log(
            `[Subagent] ${taskId} Compression summary ${index + 1}:`,
            {
              id: summary.id,
              role: summary.role,
              hasMetadata: !!summary.compressionMetadata,
              contentPreview:
                typeof summary.content === 'string'
                  ? summary.content.substring(0, 100) + '...'
                  : 'non-string content',
            },
          );
        });
      }

      if (compressionState?.enabled) {
        console.log(
          `[Subagent] ${taskId} Resuming session with compression state:`,
          {
            totalCompressionsCount: compressionState.totalCompressionsCount,
            totalTokensSaved: compressionState.totalTokensSaved,
            hasHistory: compressionState.compressionHistory?.length > 0,
          },
        );
      }

      console.log(`[Subagent] ${taskId} Resumed messages structure:`, {
        totalMessages: historyMessages.length,
        hasCompressionSummary: historyMessages.some(
          (msg) => msg.isCompressionSummary,
        ),
        messageTypes: historyMessages.map((msg) => ({
          role: msg.role,
          isCompressionSummary: msg.isCompressionSummary,
          isCompressed: msg.isCompressed,
          contentLength:
            typeof msg.content === 'string' ? msg.content.length : 0,
        })),
      });

      return historyMessages;
    }
    return null;
  } catch (err) {
    console.warn(`[Subagent] Failed to resume session ${taskId}:`, err);
    return null;
  }
}

/**
 * 同步会话状态到后端。
 */
export async function syncSession(
  taskId: string,
  agentName: string,
  description: string,
  messages: ChatMessage[],
  currentModel: string,
  usage: ExtendedLLMCallUsage,
  compressionState?: SessionCompressionState,
): Promise<void> {
  try {
    // 获取已有的 consumedTokens 对象，如果不存在则创建新的
    const existingSessionData = await getSessionData(taskId);
    const existingConsumedTokens = existingSessionData?.data?.consumedTokens;
    const currentTokens =
      existingConsumedTokens || createInitialConsumedTokens();

    // 获取模型价格信息
    const modelPriceInfo: ModelPriceInfo | undefined =
      useChatConfig.getState().chatModels?.[currentModel as ChatModel]
        ?.priceInfo;

    // 使用统一的计算逻辑
    const result = calculateConsumedTokensUpdate(
      currentTokens,
      usage, // ExtendedLLMCallUsage 已经继承了 TokenIncrement
      currentModel,
      modelPriceInfo,
    );

    await updateSession({
      _id: taskId,
      topic: `[Subagent] ${agentName}: ${description}`,
      data: {
        messages,
        consumedTokens: result.consumedTokens,
        model: currentModel as ChatModel,
        compression: compressionState, // 持久化压缩状态
      },
    });
  } catch (err) {
    console.warn(`[Subagent] Failed to sync session ${taskId}:`, err);
  }
}