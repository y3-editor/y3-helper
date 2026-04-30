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
import { createConsumedTokens } from '../../../utils/chat';
import type { Agent, TaskParams } from '../types';
import type { SessionCompressionState } from '../../../types/contextCompression';

// 扩展 LLM 调用用量，包含系统 token 估算
interface ExtendedLLMCallUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  systemTokens?: number;
  skillTokens?: number;
  ruleTokens?: number;
  mcpTokens?: number;
  comporessPromptTokens?: number;
  comporessCompletionTokens?: number;
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
      const compressionSummaries = historyMessages.filter(msg => msg.isCompressionSummary);
      if (compressionSummaries.length > 0) {
        console.log(`[Subagent] ${taskId} Resuming session with ${compressionSummaries.length} compression summaries`);
        compressionSummaries.forEach((summary, index) => {
          console.log(`[Subagent] ${taskId} Compression summary ${index + 1}:`, {
            id: summary.id,
            role: summary.role,
            hasMetadata: !!summary.compressionMetadata,
            contentPreview: typeof summary.content === 'string'
              ? summary.content.substring(0, 100) + '...'
              : 'non-string content',
          });
        });
      }

      if (compressionState?.enabled) {
        console.log(`[Subagent] ${taskId} Resuming session with compression state:`, {
          totalCompressionsCount: compressionState.totalCompressionsCount,
          totalTokensSaved: compressionState.totalTokensSaved,
          hasHistory: compressionState.compressionHistory?.length > 0,
        });
      }

      console.log(`[Subagent] ${taskId} Resumed messages structure:`, {
        totalMessages: historyMessages.length,
        hasCompressionSummary: historyMessages.some(msg => msg.isCompressionSummary),
        messageTypes: historyMessages.map(msg => ({
          role: msg.role,
          isCompressionSummary: msg.isCompressionSummary,
          isCompressed: msg.isCompressed,
          contentLength: typeof msg.content === 'string' ? msg.content.length : 0,
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
    // 创建基础的 consumedTokens 对象
    const consumedTokens = createConsumedTokens();

    // 基础 token 计算
    consumedTokens.input = usage.promptTokens;
    consumedTokens.output = usage.completionTokens;
    consumedTokens.promptTokens = usage.promptTokens;
    consumedTokens.completionTokens = usage.completionTokens;

    // 缓存相关字段对齐（重要：与主 agent 保持一致）
    if (currentModel.includes('claude')) {
      // Claude 模型的缓存处理逻辑，与主 agent 保持一致
      const systemTokens = usage.cacheCreationInputTokens || 0;
      consumedTokens.systemTokens = systemTokens;
      consumedTokens.systemToolTokens = 0; // Subagent 当前没有工具系统prompt
      consumedTokens.readCacheTokens = usage.cacheReadInputTokens || 0;
    } else {
      // 非 Claude 模型的处理
      consumedTokens.systemTokens = 0;
      consumedTokens.systemToolTokens = 0;
      consumedTokens.readCacheTokens = 0;
    }

    // 专项 token 字段
    consumedTokens.skillTokens = usage.skillTokens || 0;
    consumedTokens.ruleTokens = usage.ruleTokens || 0;
    consumedTokens.mcpTokens = usage.mcpTokens || 0;

    // 压缩相关字段
    consumedTokens.comporessPromptTokens = usage.comporessPromptTokens || 0;
    consumedTokens.comporessCompletionTokens = usage.comporessCompletionTokens || 0;

    // 成本计算（包含缓存成本）
    const modelCostInfo = useChatConfig.getState().chatModels?.[currentModel as ChatModel]?.priceInfo;
    if (modelCostInfo) {
      consumedTokens.inputCost =
        (usage.promptTokens / 1000) * (modelCostInfo.promptWeight || 0) +
        (usage.cacheCreationInputTokens / 1000) * (modelCostInfo.cacheWeightFor5min || 0) +
        (usage.cacheReadInputTokens / 1000) * (modelCostInfo.hitCacheWeight || 0);
      consumedTokens.outputCost = (usage.completionTokens / 1000) * (modelCostInfo.completionWeight || 0);
    }

    await updateSession({
      _id: taskId,
      topic: `[Subagent] ${agentName}: ${description}`,
      data: {
        messages,
        consumedTokens,
        model: currentModel as ChatModel,
        compression: compressionState, // 持久化压缩状态
      },
    });
  } catch (err) {
    console.warn(`[Subagent] Failed to sync session ${taskId}:`, err);
  }
}