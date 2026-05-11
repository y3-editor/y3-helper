/**
 * 会话管理函数
 *
 * 创建、恢复、同步子代理后端会话。
 */

import { nanoid } from 'nanoid';
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
  type TokenIncrement,
  type ModelPriceInfo,
} from '../../../utils/consumedTokensCalculator';
import type { Agent, TaskParams, SubagentSession } from '../types';
import type { SessionCompressionState } from '../../../types/contextCompression';
import type { ConsumedTokens } from '../../../utils/consumedTokensCalculator';
import { useSubagentStore } from '../state/store';
import { ChatRole } from '../../../types/chat';

// 扩展 LLM 调用用量，包含系统 token 估算
interface ExtendedLLMCallUsage extends TokenIncrement {
  totalTokens: number;
}

// ============================================================
// 会话管理函数
// ============================================================

/**
 * 从后端加载会话数据并缓存到 Store。
 * 封装 store 的 loadSubagentSession 方法，便于外部调用。
 */
export async function loadAndCacheSession(taskId: string): Promise<SubagentSession | null> {
  return useSubagentStore.getState().loadSubagentSession(taskId);
}

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

  const taskId = subSession._id;

  // ✅ 立即写入 store 缓存，包含初始的 user message
  // 关键：session.messages 需要包含初始的用户输入，否则压缩时会丢失上下文
  useSubagentStore.getState().updateSubagentSession(taskId, {
    _id: taskId,
    agentName: agent.name,
    description: params.description,
    status: 'pending',
    messages: [
      {
        id: nanoid(),
        role: ChatRole.User,
        content: params.prompt,
        createdAt: Date.now(),
      } as ChatMessage,
    ],
    parentSessionId,
    model: currentModel as ChatModel,
  });

  return taskId;
}

/**
 * 尝试从后端恢复历史会话。
 * 返回历史消息数组，如果恢复失败则返回 null。
 */
export async function resumeSession(
  taskId: string,
): Promise<{ messages: ChatMessage[]; compressionState?: SessionCompressionState } | null> {
  try {
    // ✅ 先尝试从 store 缓存读取
    const cachedSession = useSubagentStore.getState().getSubagentSession(taskId);
    if (cachedSession && cachedSession.messages.length > 0) {
      return {
        messages: cachedSession.messages,
        compressionState: cachedSession.compression,
      };
    }

    // 缓存未命中，从后端加载
    const sessionData = await getSessionData(taskId);
    const historyMessages = sessionData?.data?.messages;
    const compressionState = sessionData?.data?.compression;

    if (historyMessages && historyMessages.length > 0) {
      // ✅ 写入 store 缓存
      useSubagentStore.getState().updateSubagentSession(taskId, {
        messages: historyMessages,
        compression: compressionState,
        metadata: sessionData.metadata,
      });

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

      return { messages: historyMessages, compressionState };
    }
    return null;
  } catch (err) {
    console.warn(`[Subagent] Failed to resume session ${taskId}:`, err);
    return null;
  }
}

/**
 * 同步会话状态到后端。
 *
 * @param localConsumedTokens - 本地维护的累积 token 统计（由调用方传入）
 * @returns 更新后的 consumedTokens 对象，供下次调用使用
 */
export async function syncSession(
  taskId: string,
  agentName: string,
  description: string,
  messages: ChatMessage[],
  currentModel: string,
  usage: ExtendedLLMCallUsage,
  localConsumedTokens: ConsumedTokens,
  compressionState?: SessionCompressionState,
): Promise<ConsumedTokens> {
  try {
    // 获取模型价格信息
    const modelPriceInfo: ModelPriceInfo | undefined =
      useChatConfig.getState().chatModels?.[currentModel as ChatModel]
        ?.priceInfo;

    // 使用统一的计算逻辑，基于本地传入的 tokens
    const result = calculateConsumedTokensUpdate(
      localConsumedTokens, // 使用传入的本地状态
      usage, // ExtendedLLMCallUsage 已经继承了 TokenIncrement
      currentModel,
      modelPriceInfo,
    );

    // // 从 store 获取当前 session 的 status 和 error 状态
    // const session = useSubagentStore.getState().getSubagentSession(taskId);

    await updateSession({
      _id: taskId,
      topic: `[Subagent] ${agentName}: ${description}`,
      data: {
        messages,
        consumedTokens: result.consumedTokens,
        model: currentModel as ChatModel,
        compression: compressionState, // 持久化压缩状态
        // status: session?.status, // 同步 status 到后端
        // error: session?.error, // 同步 error 到后端
      },
    });

    // 返回更新后的 tokens 给调用方，供下次调用使用
    return result.consumedTokens;
  } catch (err) {
    console.warn(`[Subagent] Failed to sync session ${taskId}:`, err);
    // 失败时返回原值，避免中断执行
    return localConsumedTokens;
  }
}