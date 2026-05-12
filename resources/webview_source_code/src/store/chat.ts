import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { customAlphabet } from 'nanoid';
import {
  ChatMessage,
  ChatPromptBody,
  ChatMessageAttachType,
  CodeBaseSearchResult,
  ChatMessageContentUnion,
  ChatMessageContent,
  ChatMessageContentText,
  MultipleAttach,
} from '../services';
import {
  ChatHistoryGetterParams,
  createSession,
  getHistories,
  getSessionData,
  removeSession,
  updateSession,
  updateSessionTopic,
  patchSession,
  fetchGptResponse,
} from '../services/chat';
import { useConfigStore } from './config';
import {
  FeedbackPool,
  ControllerPool,
  StreamError,
  requestChatStream,
  requestBMChatStream,
  requestPluginStream,
  requestNetworkChatStream,
  requestCodebaseChatStream,
  requestMultipleBMChatStream,
  requestBMKnowledgeAugmentationStream,
  requestDeepseekReasonerChatStream,
  requestClaude37ChatStream,
  requestDSCodebaseChatStream,
  toolCallNames
} from '../services/useChatStream';
import userReporter, { PrePromptEvent } from '../utils/report';
import { BroadcastActions, SubscribeActions } from '../PostMessageProvider';
// import { mutateService } from '../hooks/useService';
import { Docset, DocsetType, Docsets } from '../services/docsets';
import { useMaskStore, DEFAULT_MASKS, IS_PROGRAMMING_MODE } from './mask';
import { useExtensionStore } from './extension';
import {
  subagentCoordinator,
  useSubagentStore,
  TaskResult,
  formatTaskResult,
  TaskStatus,
  taskEventBus,
  emitTaskRegistered,
  taskCoordinator,
  pendingEventQueue,
  useTaskCompletionStore,
  TaskCompletionStatus,
  useToolConfirmationStore,
} from '../modules/subagent';
import { AttachType } from '../store/attaches';
import { getCodeSearchDataNew, SearchResultNew } from '../services/search';
import { concatenatePrompt } from '../utils/search';
import useSearchResultStore from '../store/searchResult';
import { cloneDeep, findLastIndex, isArray, get as lodashGet } from 'lodash';
import {
  useChatConfig,
  GptBackendService,
  CHAT_MIN_TOKENS,
  CHAT_MAX_TOKENS,
  getAIGWModel,
  getModelSupplyChannel,
  ChatModelSupplyChannel,
} from './chat-config';
import { usePluginApp } from './plugin-app';
import {
  PluginAction,
  PluginAppRunner,
  PluginAppRunnerParams,
  PluginRecieveData,
} from '../services/plugin';
import { useEditorFileState } from './editor';
import {
  alphabeticalCompare,
  bmExtractAndReplaceSources,
  filterDocsetsFn,
  handleStreamError,
  isCommandSafe,
  getErrorMessage,
  specialErrorPatterns,
} from '../utils';
import { AsyncLock } from '../utils/asyncLock';
import { truncateSessionTopic } from '../utils/common';
import getEnvironmentDetails from '../utils/getEnvironmentDetail';
import { Prompt, PromptCategoryType } from '../services/prompt';
import {
  getEffectiveRules,
  Rule,
  useWorkspaceStore,
  ChangeInfo,
  SpecKitFeatureInfo,
  SpecInfo,
  SpecFramework,
} from './workspace';
import { usePromptApp } from './promp-app';
import {
  CFG_PROMPT,
  CLASS_PROMPT,
  ER_PROMPT,
  MINDMAP_PROMPT,
  SEQUENCE_PROMPT,
} from '../utils/prompt';
import { generateTraceId } from '../utils/trace';
import { logger as webToolsLogger, hub as webToolsHub } from '@dep305/codemaker-web-tools';
import { parseMentions } from '../utils/chatMention';
import {
  checkThinkingSignatureValid,
  // clearContextWithUnrelatedProperties, // 已导出但暂未在Y3中使用
  convertDeepseekMessages,
  reuseDuplicateFileRead,
  serializeCodebaseMessages,
  stripImagesForUnsupportedModel
} from '../utils/validateBeforeChat';
import { injectTodoListToLastUserMessage, processWriteTodoDenied } from './workspace/tools/todo';
import { useMCPStore } from './mcp';
import { useMcpPromptApp } from './mcp-prompt';
import { useSkillPromptApp } from './skills/skill-prompt';
import { useChatApplyStore } from './chatApply';
import { terminalCmdFunction } from '../routes/CodeChat/ChatMessagesList/TermialPanel';
import { getLocalStorage } from '../utils/storage';
import { formatUserDeniedResult } from '../utils/toolResultFormatter';
import { formatResultContent, getReportEventByToolName } from '../utils/toolCall';
import type { ExtendedPlanData, PlanStatus } from '../types/plan';
import type { TodoList } from './workspace/tools/todo';
import { onMessageToolCallResponse } from '../utils/chatToolCallHandler';
import { UserEvent } from '../types/report';
import { ChatRole } from '../types/chat';
import { getPlanContextTruncationInstruction } from './workspace/planModePrompts';
// import mockMessages from './mockMessages.json';
import { Tool as PlanTool, processMakePlanDenied, report as planReport } from '../store/workspace/tools/plan'
import { Tool as TodoTool } from '../store/workspace/tools/todo'
import addCacheMarksToMessages, { addCacheMarksToTools } from '../utils/addCacheMarksToMessages';
import EventBus, { EBusEvent } from '../utils/eventbus';
import { debugSuccess } from '../utils/debugLog';
import {
  AgentTaskDirective,
  buildAgentListingReminder,
  wrapSystemReminder,
  generateSubagentConstraintText,
} from '../modules/subagent/utils/messages';
import { truncatedMessageWithSlideWindow, truncateMessagesIfNeeded } from '../utils/truncateMessages';
import { SessionStatus, type CompressionContext, type CompressionHistory, type SessionCompressionState } from '../types/contextCompression';
import {
  compressionService,
  getCompressSessionStatus,
  setCompressSessionStatus,
  pruneToolOutputs,
} from '../services/compressionService';
import { parseAtMentionedCodeBaseByAttach } from '../utils/codebaseChat';
import { getImageUrlFromAttachs } from '../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
import { getParsedAttachs, parseFileController } from '../utils/chatAttachParseHandler';
import { ChatModel } from '../services/chatModel';
import { BAI_CHUAN, ParseImgType } from '../services/chatModel';
import { UnionType } from '../routes/CodeChat/ChatTypeAhead/Prompt/type';
import { BUILT_IN_PROMPTS, BUILT_IN_PROMPTS_SPECKIT, specPromptMap } from '../services/builtInPrompts';

import {
  calculateConsumedTokensUpdate,
  createInitialConsumedTokens,
  type ConsumedTokens,
  type TokenIncrement,
  type ModelPriceInfo,
  type TokenCompressionContext
} from '../utils/consumedTokensCalculator';
import { estimateSystemPromptTokens, estimateTokens } from '../utils/tokenEstimate';
import { PromptLinkMgr } from './workspace/pomptLinkMgr';
import {
  ExecutionContext,
  createMainAgentContext,
  createSubagentContext,
  AutoExecutePermissions,
} from '../types/executionContext';
import { getExecutionStrategy } from '../services/toolExecution/ToolExecutionStrategy';

const sessionUpdateLock = new AsyncLock();

const CODE_BACKTICKS = '```';
export const DEFAULT_TOPIC = '';
const ABORT_ERROR_NAME = 'AbortError';
export const REQUEST_TIMEOUT_NAME = 'RequestTimeout';

// 设置会话项目数量的最大阈值为 60。超过这个数量，系统会显示一个界面提示
// 以提醒用户会话太长可能会影响性能或用户体验。
export const MAX_SHOW_TIP_NUM = 60;

export const MAX_CHAT_RETRY_NUM = 3;

// 记录有提及知识库的会话
export const mentionKnowledgeMap: Map<string, boolean> = new Map()

// 追踪由 onNewSession 本地创建、尚未出现在服务端列表接口中的会话 ID。
// 用于在 revalidateChatSessions 中区分"刚创建待同步"与"已被其他端删除"的会话。
// 会话一旦出现在服务端列表中即被移除；模块级变量无需持久化，页面刷新后自然清空。
const pendingSyncSessionIds = new Set<string>();

// 追踪每个会话当前正在进行的 syncHistory 调用数量（引用计数）。
// 当 syncHistory 正在将本地数据写入服务端时，loadSessionData 不应用服务端数据覆盖本地，
// 否则会导致消息回滚。计数归零后自动从 Map 中移除，恢复正常的多端同步行为。
const pendingSyncCounts = new Map<string, number>();

const SUMMARY_SESSION_PROMPT = `使用四到五个字直接返回上一段话的简要主题，你的回复必须遵守以下原则：
1. 不要解释
2. 不要使用语气词
3. 不要有多余文本
4. 特别注意不要带标点符号
5. 如果没有主题，请直接返回"闲聊"`;

export type ChatType = 'default' | 'codebase';

let submitTimestamp = 0

/**
 * 仓库智聊的开发模式
 * - vibe: Vibe Coding，自由对话式迭代
 * - openspec: OpenSpec 规范驱动开发
 * - speckit: Speckit 规范驱动开发
 */
export type CodebaseChatMode = 'vibe' | 'openspec' | 'speckit';


export interface ChatSession {
  _id: string;
  topic: string;
  user: string;
  chat_type?: ChatType;
  chat_repo?: string;
  chat_workspace?: string;
  message_count: number | null;
  data?: {
    messages: ChatMessage[];
    /** Token 消耗统计，使用统一的 ConsumedTokens 类型 */
    consumedTokens: ConsumedTokens
    model?: ChatModel;
    attaches?: (Docsets | IMultiAttachment)
    plan?: string;
    planData?: ExtendedPlanData;
    todoList?: TodoList;
    report_plan_count?: number;
    compression?: SessionCompressionState;
    planModeState?: PlanStatus;
    enablePlanMode?: boolean;
    /** 仓库智聊的开发模式，仅当 chat_type === 'codebase' 时有效 */
    codebase_chat_mode?: CodebaseChatMode;
    /** 关联的 OpenSpec activeChange ID，用于 Spec Coding 模式 */
    activeChangeId?: string;
    /** 关联的 SpecKit activeFeature ID，用于 Spec Coding 模式 */
    activeFeatureId?: string;
  };
  /** 是否被收藏 */
  is_favorite?: boolean;
  metadata: {
    creator: string;
    editor: string;
    create_time: string;
    update_time: string;
  };
}

interface ChatStore {
  // 当前的 chat 类型
  chatType: ChatType;
  // loading 状态
  loading: () => boolean;
  // 正在 loading 加载数据的队列
  loadingQueue: Set<string>;
  // 历史会话集
  sessions: Map<string, ChatSession>;
  // 当前会话的 id
  currentSessionId: string | null;
  // 获取最新用户发送的信息
  getRecentUserMessageFromCurrentSession: () => ChatMessage | undefined;
  // 获取当前会话
  currentSession: () => ChatSession | undefined;
  // 创建新会话
  onNewSession: (message?: ChatMessage[], options?: { chat_source?: string, raw_user?: string }) => Promise<void>;
  // 更新当前会话
  updateCurrentSession: (updater: (session: ChatSession) => void) => void;
  // 删除会话
  removeSession: (id: string) => Promise<void>;
  // 选择会话
  selectSession: (id: string, callback?: () => void) => Promise<void>;
  // 清空会话
  clearSession: () => Promise<void>;
  // 删除会话中某条问答（包括问和答）
  removeQA: (id: string, lastId?: string) => void;
  // 根据配置获取当前会话下的历史消息
  getHistoryMessages: () => ChatMessage[];
  // 加载历史会话集
  revalidateChatSessions: (
    data: ChatSession[],
    chatType: ChatType,
  ) => Promise<void>;
  // 历史会话数据同步到数据库
  syncHistory: () => void;
  // 更新消费token信息
  updateConsumedTokens: (options: {
    curSession: ChatSession;
    model?: ChatModel;
    promptTokens?: number;
    completionTokens?: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
    systemTokens?: number;
    comporessPromptTokens?: number;
    comporessCompletionTokens?: number;
    skillTokens?: number;
    ruleTokens?: number;
    mcpTokens?: number;
  }) => void;
  // 加载 session data
  loadSessionData: (
    id: string,
    config?: { callback?: () => void }
  ) => Promise<void>;
  // 更新 topic
  updateTopic: (id: string, topic: string) => Promise<void>;
  // 总结会话，生成 topic，并且更新 topic
  generateAndUpdateSessionTopic: () => Promise<void>;
  // 最后一次消息的 prompt
  lastMessagePrompt?: Prompt;
  updateLastMessagePrompt: (prompt: Prompt | undefined) => void;
  // 最后一次消息的 search record id（仅BM问答使用）
  lastMessageSearchRecordId?: string;
  updateLastMessageSearchRecordId: (recordId: string | undefined) => void;
  // 更新模型和模型类型
  updateModel: (model: ChatModel) => void;
  // 切换 chat 类型
  setChatType: (type: ChatType) => void;

  // 仓库智聊的开发模式（undefined 表示新会话未选择）
  codebaseChatMode: CodebaseChatMode | undefined;
  // 设置仓库智聊的开发模式
  setCodebaseChatMode: (mode: CodebaseChatMode | undefined) => void;

  // 当前会话关联的 OpenSpec activeChange ID
  activeChangeId: string | undefined;
  // 设置当前会话关联的 OpenSpec activeChange ID
  setActiveChangeId: (changeId: string | undefined) => void;

  // 当前会话关联的 SpecKit activeFeature ID
  activeFeatureId: string | undefined;
  // 设置当前会话关联的 SpecKit activeFeature ID
  setActiveFeatureId: (featureId: string | undefined) => void;

  // Spec 导航栏折叠状态
  isSpecNavCollapsed: boolean;
  // 设置 Spec 导航栏折叠状态
  setSpecNavCollapsed: (collapsed: boolean) => void;

  //处于报错状态
  isError: boolean;
  // 更新报错状态
  setError: (isError: boolean) => void;
  applyingInfo: {
    codeBlockId: string;
  } | null;
  updateApplyingInfo: (
    info: ChatStore['applyingInfo'] | null,
  ) => void;
  // 压缩相关方法
  analyzeContext: (sessionId: string) => Promise<{
    tokenUsage: number;
    shouldCompress: boolean;
    thresholds: {
      isAboveWarningThreshold: boolean;
      isAboveErrorThreshold: boolean;
      isAboveAutoCompactThreshold: boolean;
      percentLeft: number;
    };
  }>;
  triggerCompression: (sessionId: string) => Promise<boolean>;
  markMessagesAsCompressed: (sessionId: string, compressedMessages: ChatMessage[]) => void;
  // 基于收藏会话复制消息到新会话，继续对话
  forkFavoriteSession: (sourceSessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chatType: 'codebase',
      codebaseChatMode: 'vibe',
      activeChangeId: undefined,
      activeFeatureId: undefined,
      isSpecNavCollapsed: false,
      loadingQueue: new Set(),
      isError: false,
      setError: (isError) => {
        set({ isError });
      },
      sessions: new Map(),
      currentSessionId: null,
      revalidateChatSessions: async (
        data: ChatSession[],
        chatType: ChatType,
      ) => {
        const { isStreaming, isProcessing, isTerminalProcessing, isApplying, isSearching } = useChatStreamStore.getState()
        // 流式过程中，不校验会话有效性
        if (isStreaming || isProcessing || isTerminalProcessing || isApplying || isSearching) return
        const filterData = data.filter(
          (item) => item.chat_type === chatType && !item.is_favorite,
        );
        let currentSessionId = get().currentSessionId;
        const currentSessions = get().sessions;

        // 已出现在服务端列表中的会话，从 pending 集合中移除
        for (const session of filterData) {
          pendingSyncSessionIds.delete(session._id);
        }

        // 无本地缓存的 session id，则取历史会话数据最新的 session 作为 currentSessionId
        // 无历史会话记录，则默认创建一个新的会话
        if (!filterData.length) {
          // 若服务端无数据但当前会话刚创建尚未同步，则跳过，避免重复创建
          if (currentSessionId && pendingSyncSessionIds.has(currentSessionId)) {
            return;
          }

          // 有 currentSessionId 时，先尝试精准查询验证
          // 列表只返回最近 20 条，空列表不代表该会话已被删除
          if (currentSessionId) {
            try {
              const sessionDetail = await getSessionData(currentSessionId);
              const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
              if (
                sessionDetail?._id &&
                sessionDetail.chat_type === chatType &&
                (!sessionDetail.chat_repo ||
                  sessionDetail.chat_repo === workspaceInfo.repoName)
              ) {
                // 会话仍存在于服务端且匹配当前工作区，使用这个会话
                const nextSessions = new Map(get().sessions);
                nextSessions.set(currentSessionId, sessionDetail);
                await get().loadSessionData(currentSessionId);
                set(() => ({
                  sessions: nextSessions,
                  currentSessionId: currentSessionId,
                }));
                return;
              }
            } catch (error) {
              console.warn(`[revalidateChatSessions] Failed to get session ${currentSessionId}:`, error);
            }
          }

          get().onNewSession();
        } else {
          const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
          if (chatType === 'codebase' && workspaceInfo.repoName) {
            // 如果是仓库聊天，看看是否有对应仓库的历史会话，有的话跳转，没有的话直接创建一个新会话
            let targetSession = filterData.find(
              (item) =>
                currentSessionId && (item._id === currentSessionId) && (!item.chat_repo || item.chat_repo === workspaceInfo.repoName)
            );
            // 当前会话可能刚创建尚未出现在服务端列表中，从本地 pending 状态查找
            if (!targetSession && currentSessionId && pendingSyncSessionIds.has(currentSessionId)) {
              const localSession = currentSessions.get(currentSessionId);
              if (localSession?.chat_type === chatType && (!localSession.chat_repo || localSession.chat_repo === workspaceInfo.repoName)) {
                targetSession = localSession;
              }
            }

            // 如果在过滤后的列表中找不到，但 currentSessionId 存在
            // 先尝试精准查询验证，避免因列表只返回最近 20 条而误判
            if (!targetSession && currentSessionId) {
              try {
                const sessionDetail = await getSessionData(currentSessionId);
                if (
                  sessionDetail?._id &&
                  sessionDetail.chat_type === chatType &&
                  (!sessionDetail.chat_repo ||
                    sessionDetail.chat_repo === workspaceInfo.repoName)
                ) {
                  // 会话仍存在且匹配当前仓库，使用这个会话
                  targetSession = sessionDetail;
                }
              } catch (error) {
                console.warn(`[revalidateChatSessions] Failed to get session ${currentSessionId}:`, error);
              }
            }

            if (!targetSession) {
              // 如果有当前 session，那么就启用 attach 的缓存
              targetSession = filterData.find(
                (item) => !item.chat_repo || item.chat_repo === workspaceInfo.repoName,
              );
            }
            if (targetSession) {
              currentSessionId = targetSession._id;
            } else {
              get().onNewSession();
            }
          }
          const nextSessions = new Map();
          for (const session of filterData) {
            nextSessions.set(
              session._id,
              currentSessions.get(session._id) || session,
            );
          }
          // 仅保留处于 pending 状态的本地新建会话，已被其他端删除的会话不做保留
          if (currentSessionId && !nextSessions.has(currentSessionId) && pendingSyncSessionIds.has(currentSessionId)) {
            const localSession = currentSessions.get(currentSessionId);
            if (localSession?.chat_type === chatType) {
              nextSessions.set(currentSessionId, localSession);
            }
          }
          // 判断缓存的 session id 是否还存在数据库
          // 由于列表只拉取最近 20 条，找不到不代表被删除，需精准查询确认
          if (!currentSessionId || !nextSessions.has(currentSessionId)) {
            if (currentSessionId) {
              try {
                const sessionDetail = await getSessionData(currentSessionId);
                if (
                  sessionDetail?._id &&
                  sessionDetail.chat_type === chatType
                ) {
                  // 会话仍存在于服务端，保持选中，放入本地 sessions
                  nextSessions.set(currentSessionId, sessionDetail);
                } else {
                  currentSessionId = filterData[0]._id;
                }
              } catch {
                // 查询失败（如 404）说明会话已被删除，降级到最新会话
                currentSessionId = filterData[0]._id;
              }
            } else {
              currentSessionId = filterData[0]._id;
            }
          }
          get().loadSessionData(currentSessionId);
          set(() => ({
            sessions: nextSessions,
            currentSessionId: currentSessionId,
          }));
        }
      },

      onNewSession: async (messages, options) => {
        const chatType = get().chatType;
        const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
        const chatConfig = useChatConfig.getState();

        // 根据聊天类型获取缓存的模型
        const cachedModel = chatType === 'codebase'
          ? chatConfig.codebaseChatModel
          : chatConfig.normalChatModel;

        const sessionParams: {
          topic: string;
          chat_type: ChatType;
          data: { messages: ChatMessage[], enablePlanMode?: boolean, model?: ChatModel, codebase_chat_mode?: CodebaseChatMode };
          chat_repo?: string;
        } = {
          ...(options || {}),
          topic: DEFAULT_TOPIC,
          chat_type: chatType,
          data: {
            messages: messages ? messages : [],
            enablePlanMode: (!!get()?.currentSession()?.data?.enablePlanMode || false),
            model: cachedModel,  // 使用缓存的模型
          },
        };

        if (chatType === 'codebase') {
          if (workspaceInfo?.repoName) {
            sessionParams.chat_repo = workspaceInfo.repoName;
          }
          sessionParams.data.codebase_chat_mode = chatType === 'codebase' ? get().codebaseChatMode : undefined;
          set({
            codebaseChatMode: chatType === 'codebase' ? get().codebaseChatMode : undefined,
            activeChangeId: undefined,
            activeFeatureId: undefined,
          });
        }

        useChatApplyStore.getState().clearChatApplyInfo();
        const newSession = await createSession(sessionParams);
        pendingSyncSessionIds.add(newSession._id);
        const nextSessions = new Map(get().sessions);
        nextSessions.set(newSession._id, newSession);
        set(() => ({
          currentSessionId: newSession._id,
          sessions: nextSessions,
        }));

        // 新建 codebase 会话时触发引导
        if (chatType === 'codebase') {
        }
        // mutateService(requestChatSessions);
      },

      forkFavoriteSession: async (sourceSessionId: string) => {
        const sessions = get().sessions;
        const sourceSession = sessions.get(sourceSessionId);
        if (!sourceSession) return;

        const chatType = get().chatType;
        const messages = cloneDeep(sourceSession.data?.messages || []);

        // 创建新的远端会话
        const newSession = await createSession({
          topic: sourceSession.topic || DEFAULT_TOPIC,
          chat_type: chatType,
          data: {
            messages,
            model: sourceSession.data?.model,
          },
        });

        // 更新本地 sessions 并切换
        const nextSessions = new Map(get().sessions);
        nextSessions.set(newSession._id, {
          ...newSession,
          data: {
            ...newSession.data!,
            messages,
            consumedTokens: sourceSession.data?.consumedTokens || {
              input: 0,
              output: 0,
              inputCost: 0,
              outputCost: 0,
              systemTokens: 0,
              systemToolTokens: 0,
              promptTokens: 0,
              completionTokens: 0,
              cacheCreationInputTokens: 0,
              comporessPromptTokens: 0,
              comporessCompletionTokens: 0,
              readCacheTokens: 0,
              skillTokens: 0,
              ruleTokens: 0,
              mcpTokens: 0,
            },
          },
        });
        set({
          sessions: nextSessions,
          currentSessionId: newSession._id,
        });
      },

      loadSessionData: async (
        id: string,
        config?: { callback?: () => void }
      ) => {
        const _loadingQueue = get().loadingQueue;
        // session 未加载时需要 loading，后续的 revalidate 无须 loading
        const _session = get().sessions.get(id);
        const needLoading = !_session?.data;
        if (needLoading) {
          set(() => ({
            loadingQueue: new Set(_loadingQueue).add(id),
          }));
        }
        const chatType = get().chatType

        const resumeAttaches = (cloudAttachs: IMultiAttachment | Docsets) => {
          const { attachs, update } = useChatAttach.getState()
          if (chatType !== 'codebase') {
            if (cloudAttachs?.attachType === AttachType.Docset) {
              const docsets = (cloudAttachs as Docsets)?.docsets || []
              if (docsets.length) {
                update({
                  attachType: AttachType.Docset,
                  docsets: docsets
                })
              }
            }
            const filterAttachs = ((attachs as IMultiAttachment)?.dataSource || [])
              ?.filter(i => (
                i.attachType === AttachType.File && (i as FileItem)?.isCurrent ||
                i.attachType === AttachType.ImageUrl
              ))
            if (filterAttachs.length) {
              update({
                attachType: AttachType.MultiAttachment,
                dataSource: filterAttachs
              })
            } else {
              update(undefined)
            }
            return
          }
          if (attachs?.attachType === AttachType.MultiAttachment) {
            const localSource = ((attachs as IMultiAttachment)?.dataSource || [])
            const cloudSource = ((attachs as IMultiAttachment)?.dataSource || []).filter(i => [AttachType.CodeBase, AttachType.Docset].includes(i?.attachType))
            const newSource = localSource
              ?.filter(local => (
                local.attachType === AttachType.File && (local as FileItem)?.isCurrent ||
                local.attachType === AttachType.ImageUrl ||
                cloudSource.some(cloud => local.attachType === AttachType.File && local.attachType === AttachType.File && (local as FileItem)?.path !== (cloud as FileItem)?.path) ||
                cloudSource.some(cloud => local.attachType === AttachType.CodeBase && local.attachType === AttachType.CodeBase && (local as CodeBase)?.collection !== (cloud as CodeBase)?.collection) ||
                cloudSource.some(cloud => local.attachType === AttachType.Docset && local.attachType === AttachType.Docset && (local as Docset)?._id !== (cloud as Docset)?._id)
              ))
            update({
              attachType: AttachType.MultiAttachment,
              dataSource: [...newSource]
            })
          } else if (cloudAttachs?.attachType === AttachType.MultiAttachment) {
            update(cloudAttachs)
          } else {
            update(undefined)
          }
        }

        const { isStreaming, isSearching, isApplying, isTerminalProcessing, isProcessing } = useChatStreamStore.getState()
        const isPending = !isStreaming && !isSearching && !isApplying && !isTerminalProcessing && !isProcessing

        if (isPending) {
          try {
            const data = await getSessionData(id);
            EventBus.instance.dispatch(EBusEvent.Fetch_Session_Result, true)
            const nextSessions = new Map(get().sessions);
            nextSessions.set(id, data);
            const attaches = data.data?.attaches
            resumeAttaches(attaches as IMultiAttachment)
            // 避免流式过程中更新 session 导致消息丢失
            // 避免 syncHistory 正在写入时用服务端旧数据覆盖本地新数据导致消息回滚
            if (!pendingSyncCounts.has(id)) {
              // 兜底：如果本地消息数多于服务端，说明本地有尚未同步的新消息，
              // 不用服务端旧数据覆盖，避免 PUT 失败后 GET 导致消息回滚
              const localSession = get().sessions.get(id);
              const localMsgLen = localSession?.data?.messages?.length || 0;
              const remoteMsgLen = data?.data?.messages?.length || 0;
              if (remoteMsgLen >= localMsgLen) {
                set(() => ({ sessions: nextSessions }));
              }
            }
            // TODO: 恢复会话的 codebaseChatMode、activeChangeId 和 activeFeatureId（新会话忽略，临时解决竞态问题）
            if (get().chatType === 'codebase' && data.data?.messages.length) {
              set({
                codebaseChatMode: data.data?.codebase_chat_mode,
                activeChangeId: data.data?.activeChangeId,
                activeFeatureId: data.data?.activeFeatureId,
              });
            }
          } catch (error: any) {
            // 会话不存在（404）或其他错误，清空当前会话 ID 并创建新会话
            console.warn(`[Debug] loadSessionData failed for session ${id}:`, error?.response?.status || error?.message);
            if (error?.response?.status === 404 && isPending) {
              console.log(`[Debug] Session ${id} not found, creating new session`);
              get().onNewSession();
            } else {
              // set(() => ({ currentSessionId: null }));
              EventBus.instance.dispatch(EBusEvent.Fetch_Session_Result, false)
            }
          }
        }

        if (needLoading) {
          const _nextLoadingQueue = get().loadingQueue;
          _nextLoadingQueue.delete(id);
          set(() => ({
            loadingQueue: _nextLoadingQueue,
          }));
        }
        config?.callback?.();
      },

      loading: () => {
        const currentSessionId = get().currentSessionId;
        if (!currentSessionId) {
          return false;
        }
        return get().loadingQueue.has(currentSessionId);
      },

      currentSession: () => {
        const currentSessionId = get().currentSessionId;
        const sessions = get().sessions;
        if (!sessions.size || !currentSessionId) {
          return;
        }
        const session = sessions.get(currentSessionId);

        // 安全检查：确保 session 有正确的数据结构
        if (session && (!session.data || !Array.isArray(session.data.messages))) {
          const safeConsumedTokens = createInitialConsumedTokens();
          if (session.data) {
            session.data.messages = Array.isArray(session.data.messages)
              ? session.data.messages
              : [];
            if (!session.data.consumedTokens ||
              typeof session.data.consumedTokens.input !== 'number') {
              session.data.consumedTokens = safeConsumedTokens;
            }
          } else {
            session.data = { messages: [], consumedTokens: safeConsumedTokens };
          }
        }

        return session;
      },
      getRecentUserMessageFromCurrentSession: () => {
        const session = get().currentSession()
        if (!session) return
        const messages = session?.data?.messages
        if (messages) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === ChatRole.User) {
              return message
            }
          }
        }
      },
      updateCurrentSession(updater) {
        const sessions = get().sessions;
        const currentSession = get().currentSession();
        if (!currentSession) {
          return;
        }
        updater(currentSession);
        // ✅ 创建新 Map 引用，确保 Zustand 能检测到变化（修复并发更新 tool_result 的问题）
        set(() => ({ sessions: new Map(sessions) }));
      },

      removeSession: async (id: string) => {
        const sessions = get().sessions;
        const chatType = useChatStore.getState().chatType;

        // 清理被删除 session 的 subagent 状态
        useSubagentStore.getState().clearSessionStatuses(id);

        try {
          await removeSession(id);
        } catch (error) {
          throw new Error(`Failed to remove history: ${error}`);
        }
        const nextSessions = new Map(sessions);
        nextSessions.delete(id);

        // 如果没有会话了，直接创建新会话
        if (nextSessions.size === 0) {
          set({ sessions: nextSessions });
          return get().onNewSession();
        }

        if (chatType === 'codebase') {
          // 仓库智聊特殊处理。找出当前仓库的所有会话，假如还存在，则跳到最新的会话中，如果没有当前仓库的会话，则新建一个
          const currentRepo =
            useWorkspaceStore.getState().workspaceInfo?.repoName;
          const currentRepoSessions = Array.from(nextSessions.values()).filter(
            (session) =>
              session.chat_type === 'codebase' &&
              session.chat_repo === currentRepo,
          );

          // 如果当前仓库没有会话，创建新会话
          if (currentRepoSessions.length === 0) {
            set({ sessions: nextSessions });
            return get().onNewSession();
          }

          // 找到并设置最新的会话
          const latestSession = currentRepoSessions.sort((a, b) =>
            alphabeticalCompare(b.metadata.create_time, a.metadata.create_time),
          )[0];

          set({
            sessions: nextSessions,
            currentSessionId: latestSession._id,
          });
          get().loadSessionData(latestSession._id);
        } else {
          const sortedSessions = Array.from(nextSessions.values()).sort(
            (a, b) =>
              alphabeticalCompare(
                b.metadata.create_time,
                a.metadata.create_time,
              ),
          );

          const newCurrentId = sortedSessions[0]._id;
          set({
            sessions: nextSessions,
            currentSessionId: newCurrentId,
          });

          // 加载新的会话数据
          get().loadSessionData(newCurrentId);
        }
      },

      async selectSession(id: string, callback?: () => void) {
        try {
          const oldSessionId = get().currentSessionId;

          await get().loadSessionData(id, { callback: callback });
          // 检查加载后 currentSessionId 是否被清空（说明加载失败）
          if (get().currentSessionId === null) {
            throw new Error('Session not found');
          }
          useChatApplyStore.getState().clearChatApplyInfo();
          set({
            currentSessionId: id,
          });

          // 清理旧 session 的 subagent 状态，避免跨 session 污染
          if (oldSessionId && oldSessionId !== id) {
            useSubagentStore.getState().clearSessionStatuses(oldSessionId);
          }
        } catch (error) {
          // 确保错误能够传递给调用者
          console.warn(`[Debug] selectSession failed for session ${id}`);
          throw error;
        }
      },

      clearSession: async () => {
        const session = get().currentSession();
        if (!session) {
          return;
        }
        useChatApplyStore.getState().clearChatApplyInfo();

        // 清理当前 session 的 subagent 状态
        useSubagentStore.getState().clearSessionStatuses(session._id);

        const newSession = {
          ...session,
          chat_repo: '',
          data: {
            ...session.data,
            messages: [],
            consumedTokens: session.data?.consumedTokens || createInitialConsumedTokens(),
          },
        };
        try {
          await patchSession(newSession);
          set((state) => ({
            sessions: new Map(state.sessions).set(session._id, newSession),
          }));
        } catch (error) {
          console.error(error);
        }
      },

      removeQA: async (id: string, lastId?: string) => {
        const session = get().currentSession();
        if (!session) {
          return;
        }
        const sessionData = session.data;
        const messages = sessionData?.messages || [];
        let filteredMessages = [...messages];
        if (lastId && lastId !== id) {
          const removeStart = messages.findIndex((i) => i.id === id);
          const removeEnd = messages.findIndex((i) => i.id === lastId);
          if (removeStart >= 0 && removeEnd >= 0) {
            filteredMessages.splice(removeStart, removeEnd - removeStart + 1);
          }
        } else {
          filteredMessages = messages.filter((i) => !i.id?.includes(id));
        }
        const latestData = {
          ...session,
          data: {
            ...sessionData,
            consumedTokens: Object.assign(
              createInitialConsumedTokens(),
              sessionData?.consumedTokens || {},
            ),
            messages: filteredMessages,
          },
        };
        try {
          await updateSession(latestData);
          set((state) => ({
            sessions: new Map(state.sessions).set(session._id, latestData),
          }));
        } catch (error) {
          console.error(error);
        }
      },
      getHistoryMessages: () => {
        const currentSession = get().currentSession();
        if (!currentSession) {
          return [];
        }
        const messages = currentSession?.data?.messages || [];
        const len = messages.length;
        const config = useConfigStore.getState().config;
        return messages.slice(
          Math.max(len - config.historyMessageCount * 2, 0),
        );
      },
      updateConsumedTokens: (options: {
        curSession: ChatSession;
        model?: ChatModel;
        promptTokens?: number;
        completionTokens?: number;
        cacheCreationInputTokens?: number;
        cacheReadInputTokens?: number;
        systemTokens?: number;
        comporessPromptTokens?: number;
        comporessCompletionTokens?: number;
        skillTokens?: number;
        ruleTokens?: number;
        mcpTokens?: number;
      }) => {
        const { curSession, model, ...tokenIncrement } = options;

        if (!curSession.data) {
          console.warn('[updateConsumedTokens] Session data not found, skipping token update');
          return;
        }

        if (!curSession.data.consumedTokens) {
          curSession.data.consumedTokens = createInitialConsumedTokens();
        }

        let modelPriceInfo: ModelPriceInfo | undefined;
        if (model) {
          const chatConfig = useChatConfig.getState();
          modelPriceInfo = chatConfig.chatModels?.[model]?.priceInfo;
        }

        let compressionContext: TokenCompressionContext | undefined;
        if (curSession.data.compression?.pendingSavedTokens) {
          compressionContext = {
            pendingSavedTokens: curSession.data.compression.pendingSavedTokens,
            messagesCountAtCompression: curSession.data.compression.messagesCountAtCompression || 0,
            currentMessagesCount: curSession.data.messages.length,
          };
        }

        try {
          const result = calculateConsumedTokensUpdate(
            curSession.data.consumedTokens,
            tokenIncrement as TokenIncrement,
            model,
            modelPriceInfo,
            compressionContext
          );

          curSession.data.consumedTokens = result.consumedTokens;

          // 保存 consumedTokens 快照到最后一条消息，用于计算每轮增量
          const ct = result.consumedTokens;
          if (ct) {
            const snapshot =
              (ct.input || 0) +
              (ct.output || 0) +
              (ct.comporessPromptTokens || 0) +
              (ct.comporessCompletionTokens || 0) +
              (ct.systemTokens || 0) +
              (ct.systemToolTokens || 0) +
              (ct.readCacheTokens || 0) +
              (ct.skillTokens || 0) +
              (ct.ruleTokens || 0) +
              (ct.mcpTokens || 0);
            const lastMsg =
              curSession.data.messages[curSession.data.messages.length - 1];
            if (lastMsg) {
              lastMsg.consumedTokensTotal = snapshot;
              lastMsg.consumedTokensSnapshot = { ...ct };
            }
          }

          if (result.compressionUpdate && curSession.data.compression) {
            curSession.data.compression.pendingSavedTokens = result.compressionUpdate.pendingSavedTokens;
            curSession.data.compression.messagesCountAtCompression = result.compressionUpdate.messagesCountAtCompression;
          }
        } catch (error) {
          console.error('[updateConsumedTokens] Token update failed:', {
            sessionId: curSession._id?.substring(0, 8),
            model,
            error,
          });
          throw error;
        }
      },

      updateTopic: async (id, topic) => {
        if (!topic || !id) return;
        let currentSession = get().sessions.get(id);
        if (!currentSession) return;
        currentSession = {
          ...currentSession,
          topic,
        };
        const sessions = get().sessions;
        const newSessions = new Map(sessions);
        newSessions.set(id, currentSession);
        try {
          await updateSessionTopic(id, topic);
          // 更新成功后才更改新的 sessions
          set(() => ({ sessions: newSessions }));
        } catch (error) {
          console.error(error);
        }
      },

      generateAndUpdateSessionTopic: async () => {
        try {
          const currentSession = get().currentSession();
          if (currentSession?.topic) {
            return;
          }
          const newMessages = cloneDeep(currentSession)?.data?.messages.slice(
            0,
            1,
          );
          if (!newMessages || !newMessages.length) return;
          newMessages[0].content = getContentString(newMessages[0].content);
          const message = {
            id: nanoid(),
            role: ChatRole.User,
            content: SUMMARY_SESSION_PROMPT,
          };
          newMessages.push(message);

          const chatConfig = useChatConfig.getState().config;
          const model = getAIGWModel(chatConfig.model);
          const codeChatApiKey = useConfigStore.getState().config.codeChatApiKey;
          const codeChatApiBaseUrl = useConfigStore.getState().config.codeChatApiBaseUrl;
          const params: any = {
            ...chatConfig,
            max_tokens: 2048,
            temperature: 0.7,
            messages: newMessages || [],
            model,
          };
          if (codeChatApiKey) {
            params.app_key = codeChatApiKey;
          }
          if (codeChatApiBaseUrl) {
            params.base_url = codeChatApiBaseUrl;
          }

          const data = await fetchGptResponse(
            UserEvent.CODE_CHAT_PROMPT_CUSTOM,
            params,
          );
          const topic =
            data?.choices[0]?.message?.content ||
            newMessages?.[0]?.content?.slice?.(0, 10) ||
            '';
          const finalTopic = truncateSessionTopic(topic);
          get().updateCurrentSession((session) => {
            session.topic = finalTopic;
          });
          get().syncHistory();

          // 通知插件端更新面板标题
          if (finalTopic) {
            window.parent.postMessage(
              {
                type: BroadcastActions.UPDATE_PANEL_TITLE,
                data: { title: finalTopic },
              },
              '*',
            );
          }
        } catch (error) {
          console.error('error');
        }
      },

      async syncHistory() {
        const session = get().currentSession();
        // fix: 网络异常或资源加载异常时，防止空上下文同步导致会话被清空
        if (!session?.data?.messages?.length) {
          return;
        }
        const latestData = {
          _id: session._id,
          topic: session.topic,
          data: session.data,
          chat_repo: session.chat_repo,
          chat_workspace: session.chat_workspace,
        };
        // 仓库智聊去掉无用的缓存内容
        if (session.chat_type === 'codebase' && latestData.data?.messages) {
          const lastAssistantIndex = findLastIndex(latestData.data?.messages, (item) => item.role === ChatRole.Assistant);
          latestData.data.messages.forEach((message, index) => {
            if (message.codeContent) {
              delete message.codeContent;
            }
            if (index !== lastAssistantIndex) {
              delete message.finalResult;
            }
          })
          latestData.data.codebase_chat_mode = get().codebaseChatMode;
        }
        const sessionId = session._id;
        pendingSyncCounts.set(sessionId, (pendingSyncCounts.get(sessionId) || 0) + 1);
        try {
          await updateSession(latestData);
        } catch (error) {
          console.error(error);
        } finally {
          const count = (pendingSyncCounts.get(sessionId) || 0) - 1;
          if (count <= 0) {
            pendingSyncCounts.delete(sessionId);
          } else {
            pendingSyncCounts.set(sessionId, count);
          }
        }
      },
      updateLastMessagePrompt(prompt: Prompt | undefined) {
        set(() => ({
          lastMessagePrompt: prompt,
        }));
      },
      updateLastMessageSearchRecordId(recordId: string | undefined) {
        set(() => ({
          lastMessageSearchRecordId: recordId,
        }));
      },
      updateModel(model: ChatModel) {
        get().updateCurrentSession((session) => {
          if (session.data) {
            session.data.model = model;
          }
          return session;
        });
      },
      setChatType(type: ChatType) {
        set(() => ({
          chatType: type ? 'codebase' : 'codebase',
        }));
      },
      setCodebaseChatMode(newMode: CodebaseChatMode | undefined) {
        let mode: CodebaseChatMode = 'vibe';
        if (newMode) {
          mode = 'vibe';
        }
        set(() => ({
          codebaseChatMode: mode
        }));
        // 同步更新当前会话的 codebase_chat_mode（存储在 session.data 下）
        const currentSession = get().currentSession();
        if (currentSession && get().chatType === 'codebase') {
          get().updateCurrentSession((session) => {
            if (session.data) {
              session.data.codebase_chat_mode = mode;
            }
          });
        }
      },
      setActiveChangeId(changeId: string | undefined) {
        // 更新 state（触发组件重渲染）
        set({ activeChangeId: changeId });
        // 同步更新当前会话的 session.data（持久化）
        const currentSession = get().currentSession();
        if (currentSession) {
          get().updateCurrentSession((session) => {
            if (session.data) {
              session.data.activeChangeId = changeId;
            }
          });
          get().syncHistory();
        }
      },
      setActiveFeatureId(featureId: string | undefined) {
        // 更新 state（触发组件重渲染）
        set({ activeFeatureId: featureId });
        // 同步更新当前会话的 session.data（持久化）
        const currentSession = get().currentSession();
        if (currentSession) {
          get().updateCurrentSession((session) => {
            if (session.data) {
              session.data.activeFeatureId = featureId;
            }
          });
          get().syncHistory();
        }
      },
      setSpecNavCollapsed(collapsed: boolean) {
        set({ isSpecNavCollapsed: collapsed });
      },
      applyingInfo: null,
      updateApplyingInfo(info: ChatStore['applyingInfo'] | null) {
        set(() => ({
          applyingInfo: info,
        }));
      },
      analyzeContext: async (sessionId: string) => {
        const session = get().sessions.get(sessionId);
        if (!session?.data?.messages) {
          return {
            tokenUsage: 0,
            shouldCompress: false,
            thresholds: {
              isAboveWarningThreshold: false,
              isAboveErrorThreshold: false,
              isAboveAutoCompactThreshold: false,
              percentLeft: 100,
            },
          };
        }

        const chatConfig = useChatConfig.getState().config;
        const codebaseModelMaxTokens = useChatConfig.getState().codebaseModelMaxTokens;

        const pendingSavedTokens = session.data.compression?.pendingSavedTokens || 0;

        const analysis = await compressionService.analyzeContext(
          session.data.messages,
          chatConfig.model,
          codebaseModelMaxTokens,
          undefined,
          pendingSavedTokens
        );

        return {
          tokenUsage: analysis.currentTokenUsage,
          shouldCompress: analysis.shouldCompress,
          thresholds: {
            isAboveWarningThreshold: analysis.isAboveWarningThreshold,
            isAboveErrorThreshold: analysis.isAboveErrorThreshold,
            isAboveAutoCompactThreshold: analysis.isAboveCompressionThreshold,
            percentLeft: Math.max(0, Math.round((1 - analysis.percentageUsed) * 100)),
          },
        };
      },

      triggerCompression: async (sessionId) => {
        try {
          const currentStatus = await getCompressSessionStatus(sessionId);
          if (currentStatus === SessionStatus.COMPRESSING) {
            console.log('[Debug] 已有压缩进行中，跳过本次调用');
            return false;
          }

          await setCompressSessionStatus(sessionId, SessionStatus.COMPRESSING);

          const session = get().sessions.get(sessionId);
          if (!session?.data?.messages) {
            return false;
          }

          const readyToCompress = session.data.messages.filter(msg => !msg.isCompressed)
          const compressionContext: CompressionContext = {
            messages: await serializeCodebaseMessages({
              model: ChatModel.Gemini3Flash,
              sendMessages: readyToCompress,
            }),
            sessionId: sessionId,
          };

          const compressionResult = await compressionService.performCompression(
            compressionContext
          );



          if (compressionResult.success && compressionResult.compressedMessages) {
            let compressedMessages: ChatMessage[] = []
            if (compressionResult.uncompressedMessages) {
              compressedMessages = readyToCompress.filter(
                msg => compressionResult
                  .uncompressedMessages
                  ?.findIndex(
                    uncompressedMsg => `${uncompressedMsg.id}-${uncompressedMsg.role}` === `${msg.id}-${msg.role}`) === -1
              )
            }

            get().markMessagesAsCompressed(
              sessionId,
              compressedMessages
            );


            get().updateCurrentSession((session) => {
              if (session.data) {
                compressedMessages = compressionService.applyCompression(
                  session.data.messages,
                  compressionResult
                );
                session.data.messages = compressedMessages;

                if (!session.data.compression) {
                  session.data.compression = {
                    enabled: true,
                    compressionHistory: [],
                    totalTokensSaved: 0,
                    totalCompressionsCount: 0,
                  };
                }

                const newHistory: CompressionHistory = {
                  timestamp: Date.now(),
                  originalMessageCount: compressionResult.originalMessageCount,
                  tokensSaved: compressionResult.tokensBeforeCompression -
                    compressionResult.tokensAfterCompression,
                  compressionRatio: compressionResult.tokensBeforeCompression /
                    compressionResult.tokensAfterCompression,
                };

                if (!session.data.compression.compressionHistory) {
                  session.data.compression.compressionHistory = []
                }
                if (!session.data.compression.totalTokensSaved) {
                  session.data.compression.totalTokensSaved = 0
                }
                if (!session.data.compression.totalCompressionsCount) {
                  session.data.compression.totalCompressionsCount = 0
                }
                session.data.compression.compressionHistory.push(newHistory);
                session.data.compression.totalTokensSaved += newHistory.tokensSaved;
                session.data.compression.totalCompressionsCount += 1;
                session.data.compression.pendingSavedTokens = newHistory.tokensSaved;
                session.data.compression.messagesCountAtCompression = compressedMessages.length;
              }
            });

            get().syncHistory();
            return true;
          }
          return false;
        } catch (error) {
          console.error('压缩失败:', error);
          return false;
        }
      },

      markMessagesAsCompressed: (sessionId, compressedMessages) => {
        const session = get().sessions.get(sessionId);
        if (!session?.data?.messages) return;

        get().updateCurrentSession((session) => {
          if (session.data?.messages) {
            let maxIdx = 0
            for (const msg of compressedMessages) {
              const index = session.data.messages.findIndex(m => `${m.id}-${m.role}` === `${msg.id}-${msg.role}`);
              if (index !== -1) {
                session.data.messages[index].isCompressed = true;
                session.data.messages[index].isOutdatedTokens = true;
                maxIdx = Math.max(maxIdx, index);
              }
            }

            for (let i = maxIdx + 1; i < session.data.messages.length; i++) {
              session.data.messages[i].isOutdatedTokens = true;
            }
          }
        });
      },
    }),
    {
      name: (() => {
        // 为每个面板创建独立的存储键名
        const urlParams = new URLSearchParams(window.location.search);
        const panelId = urlParams.get('panelId');
        return panelId ? `codemaker-chat-store-panel-${panelId}` : 'codemaker-chat-store';
      })(),
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        chatType: state.chatType,
      }),
    },
  ),
);

interface ChatStreamPrePromptCodeBlock {
  content: string;
  language: string;
  path: string;
  startLine?: number;
  endLine?: number;
  holding?: boolean;
  textEditorSelection?: boolean;
  /** 代码块序号，按发送顺序分配 */
  sequenceNumber?: number;
  /** 创建时间戳，用于排序 */
  createdAt?: number;
}

export interface ToolCallResult {
  content: string;
  isError: boolean;
  path: string;
}

export enum ERetryType {
  Timeout = 'Timeout',
  AccessLimit = 'AccessLimit',
}

export const retryLabels = {
  [ERetryType.Timeout]: '请求超时',
  [ERetryType.AccessLimit]: '模型限流',
}

/**
 * 讲下设计思路，为什么不使用 useHooks 来处理，而是全局管理这个状态。
 * 1. 切换 tab 等用户操作时，若还处于流传输中，需要提醒用户。
 * 2. 处理 postMessage 的一些操作，统一管理。
 * 3. 等等
 */
export type ChatStreamState = {
  isStreaming: boolean;
  isSearching: boolean;
  isProcessing: boolean;
  isMCPProcessing: boolean;
  isApplying: boolean;
  isTerminalProcessing: boolean;
  isAutoApproved: boolean; // 标记是否是自动授权触发的流
  message: ChatMessage;
  resetMessage: () => void;
  searchMessage?: CodeBaseSearchResult[];
  prePromptCodeBlock: ChatStreamPrePromptCodeBlock[] | null;
  runnerTask?: {
    id?: string;
    task?: PluginAppRunner;
  };
  loadingMessage: string;
  setIsStreaming: (isStreaming: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setIsMCPProcessing: (isMCPProcessing: boolean) => void;
  setIsApplying: (isApplying: boolean) => void;
  setIsTerminalProcessing: (isTerminalProcessing: boolean) => void;
  setIsAutoApproved: (isAutoApproved: boolean) => void;
  showFeedback: boolean;
  setShowFeedback: (state: boolean) => void;
  retryTimmer: NodeJS.Timeout | undefined;
  retryType: keyof typeof ERetryType;
  setRetryType: (retryType: keyof typeof ERetryType) => void;
  streamRetryCount: number;
  setStreamRetryCount: (count: number) => void;
  retryChatStream: (retryId: string, retryType: keyof typeof ERetryType) => void
};

type ChatStreamActions = {
  onUserSubmit: (
    content: string,
    options: {
      event?: PrePromptEvent | string;
      isMCPToolResponse?: boolean;
      mcpServerUsed?: string;
      skipUserMessage?: boolean;
      specPrompt?: Prompt;
      agentTaskDirective?: AgentTaskDirective;
    },
    originPrompt?: string,
    toolResponse?: {
      [propName: string]: boolean;
    },
    unselectedResults?: Set<string>,
  ) => void;
  onStop: () => void;
  onUpdatePrePromptCodeBlock: (data: ChatStreamPrePromptCodeBlock) => void;
  onUpdateSelectionPrePromptCodeBlock: (
    data: ChatStreamPrePromptCodeBlock,
  ) => void;
  onRemovePrePromptCodeBlock: (index?: number) => void;
  onUpdateHoldingValue: (index?: number, newHoldingValue?: boolean) => void;
  reset: () => void;
  getPrePromptByCodeBlock: () => string;
  setLoadingMessage: (msg: string) => void
  // 插件 app 逻辑
  onPluginAppSubmit: (messages: ChatMessage[]) => void;
  onPluginAppStop: () => void;
  onPluginAppDone: (data: PluginRecieveData) => void;
  onUserResubmit: () => void;
  // // 更新 toolCall 结果
  // updateToolCallResults: (result: { [propName: string]: string }) => void;
  // // 清空 toolCall 结果
  // clearToolCallResults: () => void;
  updateToolCallResults: (result: {
    [propName: string]: { path: string; content: string, isError?: boolean, extra?: Record<string, any>, isTruncated?: boolean };
  }, extra?: any, executionContext?: ExecutionContext, options?: { skipSync?: boolean; skipAutoExecute?: boolean }) => void;
  /**
   * 更新 task 工具结果（原子操作，使用锁保护）。
   * 整合工具结果更新和消息持久化，确保原子性和正确的插入顺序。
   * 使用 AsyncLock 防止并发更新导致的竞态条件。
   */
  updateTaskToolResult: (params: {
    toolCallId: string;
    taskResult: TaskResult;
    sessionId: string;
  }) => Promise<void>;
  /**
   * 找到 Tool 消息的正确插入位置
   * 确保 Tool 消息紧跟在对应的 Assistant 消息后面
   */
  findCorrectToolMessageIndex: (
    messages: ChatMessage[],
    toolCallId: string,
  ) => number;
  // 新增的执行上下文相关方法
  inferExecutionContext: (
    session: ChatSession,
    lastMessage: ChatMessage,
  ) => ExecutionContext;
  buildAutoExecuteResponse: (
    lastMessage: ChatMessage,
  ) => Record<string, boolean>;
  handleAutoExecute: (
    lastMessage: ChatMessage,
    context: ExecutionContext,
    hasActiveTaskTools: boolean,
  ) => void;
  handleMCPTools: (lastMessage: ChatMessage) => void;
};

export const DEFAULT_ASSISTANT_MESSAGE = {
  id: '',
  role: ChatRole.Assistant,
  content: '',
  attachs: [],
  reasoning_content: '',
};
let lastMessageId = '';
export const useChatStreamStore = create(
  immer<ChatStreamState & ChatStreamActions>((set, get) => ({
    isStreaming: false,
    isSearching: false,
    isProcessing: false,
    isMCPProcessing: false,
    isApplying: false,
    isTerminalProcessing: false,
    isAutoApproved: false,
    toolCallResults: {},
    showFeedback: false,
    streamRetryCount: 0,
    retryTimmer: undefined,
    retryType: ERetryType.Timeout,
    setRetryType: (retryType: keyof typeof ERetryType) => {
      set(() => ({
        retryType,
      }))
    },
    setStreamRetryCount: (count) => {
      set(() => ({
        streamRetryCount: count,
      }))
    },
    retryChatStream: (retryId: string, retryKey: keyof typeof ERetryType) => {
      const retryCount = get().streamRetryCount + 1
      if (get().retryTimmer) {
        clearTimeout(get().retryTimmer)
      }
      get().reset()
      get().setRetryType(retryKey)
      if (retryCount <= MAX_CHAT_RETRY_NUM) {
        get().setIsProcessing(true)
        get().setStreamRetryCount(retryCount)
        requestAnimationFrame(() => {
          get().retryTimmer = setTimeout(() => {
            get().onUserResubmit()
          }, retryCount * 1000 * 15)
        })
      } else {
        get().setStreamRetryCount(0)
        useChatStore.getState().setError(false);
        // 错误信息：模型请求超时(重试三次失败)，请切换模型或稍后重新发送
        useChatStore.getState().updateCurrentSession((session) => {
          return (
            session.data?.messages.push({
              ...DEFAULT_ASSISTANT_MESSAGE,
              id: retryId,
              content: `${retryLabels[retryKey]}(重试三次失败)，请切换模型或稍后重试`,
              group_tokens: 8,
            })
          )
        });
        useChatStore.getState().syncHistory();
        get().reset();
      }
    },
    setShowFeedback: (state) => {
      set(() => ({
        showFeedback: state,
      }))
    },
    setIsStreaming: (isStreaming) => {
      set(() => ({
        isStreaming,
      }))
    },
    setIsTerminalProcessing: (isTerminalProcessing) => {
      set(() => ({
        isTerminalProcessing,
      }))
    },
    setIsProcessing: (isProcessing) => {
      set(() => ({
        isProcessing,
      }));
    },
    setIsMCPProcessing: (isMCPProcessing) => {
      set(() => ({
        isMCPProcessing,
      }))
    },
    setIsApplying: (isApplying) => {
      set(() => ({
        isApplying,
      }))
    },
    setIsAutoApproved: (isAutoApproved) => {
      set(() => ({
        isAutoApproved,
      }))
    },
    setLoadingMessage: (msg) => {
      set(() => ({
        loadingMessage: msg,
      }))
    },
    message: DEFAULT_ASSISTANT_MESSAGE,
    resetMessage: () => {
      set(() => ({
        message: DEFAULT_ASSISTANT_MESSAGE,
      }))
    },
    prePromptCodeBlock: null,
    updateToolCallResults(
      result: {
        [propName: string]: { path: string; content: string; isError?: boolean; isTruncated?: boolean };
      },
      extra?: any,
      executionContext?: ExecutionContext,
      options?: { skipSync?: boolean; skipAutoExecute?: boolean },
    ) {
      const chatStoreState = useChatStore.getState();
      let isProcessing = true;
      // 标记是否有正在运行的 task 工具（subagent）
      let hasActiveTaskTools = false;

      // 推断或使用提供的执行上下文
      let inferredContext: ExecutionContext | null = null;

      chatStoreState.updateCurrentSession((session) => {
        if (session && session.data) {
          const messages = session.data.messages || [];

          // ✅ 修复：找到最后一条包含 tool_calls 的 assistant message
          // 因为 updateTaskToolResult 可能已经在 messages 中插入了 tool message
          let lastMessage: ChatMessage | undefined;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === ChatRole.Assistant && messages[i].tool_calls) {
              lastMessage = messages[i];
              break;
            }
          }

          if (!lastMessage) {
            return;
          }

          lastMessage.tool_result = lastMessage.tool_result || {};
          lastMessage.tool_result = {
            ...lastMessage.tool_result,
            ...result,
          };
          if (extra && extra.finalResult) {
            lastMessage.finalResult = extra.finalResult;
          }

          // 推断执行上下文（如果没有提供）
          if (!executionContext) {
            inferredContext = get()
              .inferExecutionContext(session, lastMessage);
          }

          const context = executionContext || inferredContext!;
          // 检查是否有 task 工具（subagent）存在且尚未全部返回结果
          const taskToolCalls =
            lastMessage.tool_calls?.filter(
              (tc) => tc.function.name === 'task',
            ) || [];
          const taskResultCount = taskToolCalls.filter(
            (tc) => lastMessage.tool_result?.[tc.id],
          ).length;

          // hasActiveTaskTools 判断：使用 TaskCompletionTracker 作为唯一状态源
          const hasTaskTools = taskToolCalls.length > 0;
          const allTasksHaveResults = taskResultCount === taskToolCalls.length;
          const currentSessionId = useChatStore.getState().currentSessionId;
          const trackerSessionComplete = useTaskCompletionStore
            .getState()
            .isSessionComplete(currentSessionId || '');

          // 使用 Tracker 统一判断：有 task 工具且 Tracker 认为 session 未完成
          hasActiveTaskTools =
            hasTaskTools && (!trackerSessionComplete || !allTasksHaveResults);

          // ✅ 使用 TaskCompletionTracker 进行统一判断
          if (taskToolCalls.length > 0) {
            const tracker = useTaskCompletionStore.getState();
            const isComplete = tracker.isSessionComplete(currentSessionId || '');

            if (!isComplete) {
              return;
            }
          }

          // 所有 tool call 结果都已收到时，清除 message 上的 processing 标记
          if (
            !lastMessage.tool_calls?.length ||
            Object.keys(lastMessage.tool_result).length ===
              lastMessage.tool_calls?.length
          ) {
            isProcessing = false;
            lastMessage.processing = false;

            // ✅ 修复：只有在未设置 skipAutoExecute 时才调用 handleAutoExecute
            // 这是为了避免与事件驱动的完成通知机制产生竞态
            if (!options?.skipAutoExecute) {
              get().handleAutoExecute(lastMessage, context, hasActiveTaskTools);
            }
          }
        }
      });
      if (!options?.skipSync) {
        chatStoreState.syncHistory();
      }
      // 如果有正在运行的 task 工具，不设置 isProcessing（由 subagent store 管理）
      const currentStoreIsProcessing = get().isProcessing;
      if (!hasActiveTaskTools) {
        set(() => ({
          isProcessing: isProcessing,
        }));
      } else {
        console.log(
          '[Debug][updateToolCallResults] → skip set isProcessing (task still running), current store isProcessing:',
          currentStoreIsProcessing,
        );
      }
    },

    /**
     * 找到 Tool 消息的正确插入位置
     * 确保 Tool 消息紧跟在对应的 Assistant 消息后面，解决并发插入顺序问题
     */
    findCorrectToolMessageIndex(messages: ChatMessage[], toolCallId: string): number {
      let assistantIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === ChatRole.Assistant &&
            messages[i].tool_calls?.some(tc => tc.id === toolCallId)) {
          assistantIndex = i;
          break;
        }
      }

      if (assistantIndex === -1) {
        console.warn(
          `[findCorrectToolMessageIndex] Assistant message with tool_call ${toolCallId} not found, appending to end`
        );
        return messages.length;
      }

      let insertIndex = assistantIndex + 1;
      while (insertIndex < messages.length && messages[insertIndex].role === ChatRole.Tool) {
        insertIndex++;
      }
      return insertIndex;
    },

    async updateTaskToolResult(params) {
      const { toolCallId, taskResult, sessionId } = params;

      // 🔒 使用全局锁保护，防止并发更新导致的竞态条件
      const release = await sessionUpdateLock.acquire(sessionId, 60000);

      try {
        // ✅ 修复竞态：先插入 tool message，再调 updateToolCallResults
        // 原因：updateToolCallResults 在所有 tool result 齐全时会自动触发 handleAutoExecute。
        // 若 handleAutoExecute → onUserSubmit 时 tool message 还未在 messages 数组中，
        // API payload 构建会因缺少该消息而报错。
        // 正确顺序：splice message → updateToolCallResults（自动触发 handleAutoExecute）

        // Step 1: 持久化 task tool message 到主 session
        const chatStore = useChatStore.getState();
        const sessions = chatStore.sessions;
        const session = sessions.get(sessionId);

        if (!session?.data?.messages) {
          console.warn(`[updateTaskToolResult] Session ${sessionId} not found`);
          return;
        }

        // 幂等检查：如果 tool message 已存在，跳过写入
        const alreadyExists = session.data.messages.some(
          (msg: ChatMessage) => msg.role === ChatRole.Tool && msg.tool_call_id === toolCallId
        );

        if (!alreadyExists) {
          // 找到正确的插入位置，确保 Tool 消息紧跟对应的 Assistant 消息
          const insertIndex = get().findCorrectToolMessageIndex(session.data.messages, toolCallId);

          session.data.messages.splice(insertIndex, 0, {
            id: nanoid(),
            role: ChatRole.Tool,
            tool_call_id: toolCallId,
            content: taskResult.output,
            createdAt: Date.now(),
            context: {
              task: {
                taskId: taskResult.taskId,
                agentName: taskResult.agentName || 'unknown',
                description: taskResult.description || '',
                isError: !taskResult.success,
                isTruncated: taskResult.isTruncated || false,
              },
            },
          });

          // ✅ 只更新内存状态，不在此处调 syncHistory。
          // 最终持久化由下方的 updateToolCallResults（skipSync 默认 false）统一完成，
          // 确保 tool message 和 tool_result 都就绪后才做一次 sync，避免重复写入。
          useChatStore.setState({ sessions: new Map(sessions) });
        }

        // Step 2: 更新 tool_result 并（在所有工具完成时）自动触发 handleAutoExecute
        // 此时 tool message 已在 messages 数组中，handleAutoExecute 可安全执行。
        // 不传 skipSync，由 updateToolCallResults 在末尾统一调 syncHistory（一次写入）。
        get().updateToolCallResults({
          [toolCallId]: {
            path: '',
            content: taskResult.output,
            isError: !taskResult.success,
            extra: {
              isTruncated: taskResult.isTruncated,
            },
          },
        });
      } catch (err) {
        console.error(
          `[updateTaskToolResult] ❌ Task tool ${toolCallId} 更新失败:`,
          err
        );
        throw err;
      } finally {
        release();
      }
    },

    /**
     * 推断执行上下文
     * 根据最后一条消息是否包含 task 工具调用来判断是主 agent 还是 subagent
     */
    inferExecutionContext(
      session: ChatSession,
      lastMessage: ChatMessage,
    ): ExecutionContext {
      const hasTaskTools =
        lastMessage.tool_calls?.some((tc) => tc.function.name === 'task') ||
        false;

      if (hasTaskTools) {
        // 包含task工具，说明是subagent执行
        return createSubagentContext(lastMessage.id || '', session._id);
      } else {
        // 主agent执行，需要当前的权限配置
        const permissions: AutoExecutePermissions = {
          autoApprove: useChatConfig.getState().autoApprove,
          autoApply: useChatConfig.getState().autoApply,
          autoExecute: useChatConfig.getState().autoExecute,
          autoTodo: useChatConfig.getState().autoTodo,
        };
        return createMainAgentContext(
          lastMessage.id || '',
          session._id,
          permissions,
        );
      }
    },

    /**
     * 处理自动执行逻辑
     * 使用策略模式根据执行上下文决定是否自动执行
     */
    handleAutoExecute(
      lastMessage: ChatMessage,
      context: ExecutionContext,
      hasActiveTaskTools: boolean,
    ) {

      if (!lastMessage.tool_calls?.length) {
        return;
      }

      const currentSessionId = useChatStore.getState().currentSessionId;
      const trackerSessionComplete = useTaskCompletionStore
        .getState()
        .isSessionComplete(currentSessionId || '');
      if (!trackerSessionComplete && !hasActiveTaskTools) {
        return;
      }

      // 根据执行上下文类型决定是否进行路径权限检查
      if (context.type === 'main_agent') {
        // Main agent 需要严格的路径权限校验
        // const codebaseDefaultAuthorizationPath = [
        //   ...(useConfigStore.getState().config
        //     .codebaseDefaultAuthorizationPath || []),
        // ];
        // const allow_paths = useWorkspaceStore.getState().devSpace.allow_paths;
        // const allAuthorizedPaths = [
        //   ...codebaseDefaultAuthorizationPath,
        //   ...(allow_paths || []),
        // ];
        // const allPathsMatch = pathsMatch(
        //   lastMessage.tool_result || {},
        //   allAuthorizedPaths,
        // );
        // console.log(
        //   '[Debug][handleAutoExecute] Main agent path authorization check:',
        //   'allPathsMatch:',
        //   allPathsMatch,
        //   'authorizedPaths:',
        //   allAuthorizedPaths,
        // );
        // if (!allPathsMatch) {
        //   console.log(
        //     '[Debug][handleAutoExecute] Main agent skipping auto-execute due to unauthorized paths',
        //   );
        //   return;
        // }
      } else {
        // Subagent 跳过路径检查，因为它们已经通过了初始权限验证
      }

      const strategy = getExecutionStrategy(context);
      let hasAutoExecution = false;
      const autoExecuteTools: string[] = [];

      // 检查每个工具是否应该自动执行
      for (const toolCall of lastMessage.tool_calls) {
        const toolResult = lastMessage.tool_result?.[toolCall.id];
        const shouldAuto = strategy.shouldAutoExecute(toolCall, context, toolResult);

        if (shouldAuto) {
          hasAutoExecution = true;
          autoExecuteTools.push(toolCall.function.name);

          // 特殊处理edit_file工具
          if (
            ['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(
              toolCall.function.name,
            )
          ) {
            useChatApplyStore.getState().acceptEdit(toolCall.id);
          }
        }
      }

      // 如果有自动执行且没有活跃的task工具，提交结果
      if (hasAutoExecution && !hasActiveTaskTools) {

        const keysObject = get()
          .buildAutoExecuteResponse(lastMessage);

        // 设置自动授权标志
        useChatStreamStore.getState().setIsAutoApproved(true);
        useChatStreamStore.getState().onUserSubmit(
          '',
          {
            event: UserEvent.CODE_CHAT_CODEBASE,
          },
          undefined,
          keysObject,
        );
      } else if (lastMessage.tool_calls?.length) {

        // 处理MCP工具的特殊情况
        get().handleMCPTools(lastMessage);
      } else {
        console.log('[Debug][handleAutoExecute] No execution path taken');
        console.log('[Debug][handleAutoExecute] hasAutoExecution:', hasAutoExecution);
        console.log('[Debug][handleAutoExecute] hasActiveTaskTools:', hasActiveTaskTools);
        console.log('[Debug][handleAutoExecute] tool_calls length:', lastMessage.tool_calls?.length);
      }
    },

    /**
     * 构建自动执行的响应对象
     */
    buildAutoExecuteResponse(
      lastMessage: ChatMessage,
    ): Record<string, boolean> {
      return Object.keys(lastMessage.tool_result || {}).reduce(
        (acc: Record<string, boolean>, key) => {
          acc[key] = true;
          return acc;
        },
        {},
      );
    },

    /**
     * 处理MCP工具的特殊逻辑
     */
    handleMCPTools(lastMessage: ChatMessage) {

      const isMCPTools = lastMessage.tool_calls?.some((tool) =>
        ['use_mcp_tool', 'access_mcp_resource'].includes(tool.function.name),
      );

      if (isMCPTools) {
        // 获取 MCP 服务器配置和自动执行检查
        const MCPServers = useMCPStore.getState().MCPServers;
        let mcpServerUsed = '';
        let mcpServerConfig = null;

        try {
          // Find the first actual MCP tool call (not just tool_calls[0] which may be non-MCP)
          const mcpToolCall = lastMessage.tool_calls!.find(tc =>
            tc.function.name === 'use_mcp_tool' || tc.function.name === 'access_mcp_resource'
          );
          const toolParams = JSON.parse(
            mcpToolCall?.function.arguments || '{}',
          );
          mcpServerUsed = toolParams.server_name || '';
          
          // 查找对应的 MCP 服务器配置
          if (mcpServerUsed) {
            const normalizedServerName = mcpServerUsed.replace(/\\/g, '/').split('/').slice(-1)[0];
            mcpServerConfig = MCPServers.find(server => {
              const serverName = (server.name || '').replace(/\\/g, '/').split('/').slice(-1)[0];
              return serverName === normalizedServerName;
            });
          }
        } catch (error) {
          mcpServerUsed = '';
        }

        // 检查是否应该自动执行
        const shouldAutoExecute = mcpServerConfig?.config?.autoApprove === true || mcpServerConfig?.autoApprove === true;

        if (!shouldAutoExecute) {
          // autoApprove=false 说明是手动确认场景，直接继续对话
          // （autoApprove 时序问题已由 Gate2 层的订阅处理，TOOL_CALL_RESULT 到达时 store 必然已更新）
          const keysObject = get()
            .buildAutoExecuteResponse(lastMessage);
          useChatStreamStore.getState().setIsMCPProcessing(false);
          useChatStreamStore.getState().onUserSubmit(
            '',
            {
              event: UserEvent.CODE_CHAT_CODEBASE,
              isMCPToolResponse: true,
              mcpServerUsed,
            },
            undefined,
            keysObject,
          );
          return;
        }

        const keysObject = get()
          .buildAutoExecuteResponse(lastMessage);

        useChatStreamStore.getState().setIsMCPProcessing(false);
        useChatStreamStore.getState().setIsAutoApproved(true);
        useChatStreamStore.getState().onUserSubmit(
          '',
          {
            event: UserEvent.CODE_CHAT_CODEBASE,
            isMCPToolResponse: true,
            mcpServerUsed,
          },
          undefined,
          keysObject,
        );
      }
    },
    clearToolCallResults() {
      set(() => ({
        toolCallResults: {},
      }));
    },
    getPrePromptByCodeBlock: () => {
      const prePromptCodeBlock = get().prePromptCodeBlock;
      if (!prePromptCodeBlock) {
        return '';
      }
      return prePromptCodeBlock.reduce((pre, cur) => {
        return (pre += `\n\`\`\`${cur?.language}${cur?.path ? ` filePath=${cur?.path}` : ''}\n${cur?.content}\n\`\`\`\n`);
      }, '');
    },

    /** @private */
    reset: () => {
      set(() => ({
        isStreaming: false,
        isProcessing: false,
        isMCPProcessing: false,
        isApplying: false,
        isSearching: false,
        message: DEFAULT_ASSISTANT_MESSAGE,
        prePromptCodeBlock: null,
        runnerTask: undefined,
      }));
    },

    onUserResubmit() {
      const { isStreaming, isSearching, isMCPProcessing } = get();
      if ((isStreaming || isSearching || isMCPProcessing)) {
        return;
      }
      const chatStoreState = useChatStore.getState();
      const session = chatStoreState.currentSession();
      if (!session || !session.data || !session.data.messages) {
        return;
      }
      const sendMessages = session?.data?.messages || [];
      let isToolRetry = false;
      for (let i = sendMessages.length - 1; i >= 0; i--) {
        const sendMessage = sendMessages[i];
        if (sendMessage.isCompressionSummary) {
          const newMessages = cloneDeep(sendMessages).splice(0, i + 1) || [];
          chatStoreState.updateCurrentSession((session) => {
            if (session.data?.messages) {
              session.data.messages = newMessages;
            }
          });
          // 如果是压缩总结，直接从总结的内容开始
          get().onUserSubmit('', { event: UserEvent.CODE_CHAT_CODEBASE, skipUserMessage: true });
          break;
        }
        if (sendMessage.role === ChatRole.Tool) {
          isToolRetry = true;
        } else if (
          sendMessage.role === ChatRole.User &&
          sendMessage._originalRequestData &&
          !isToolRetry
        ) {
          const { attachs, content, originPrompt, options } =
            sendMessage._originalRequestData;
          useChatAttach.getState().update(attachs);
          if (sendMessage.shortcutPrompt && (i === sendMessages.length - 2)) {
            usePromptApp.getState().update({
              meta: {
                description: '',
                name: sendMessage.shortcutPrompt.title,
                prompt: sendMessage.shortcutPrompt.content,
                type: PromptCategoryType.CodeWiki,
                _id: sendMessage.shortcutPrompt._id,
              },
              type: UnionType.Prompt,
              name: '',
            })
          }
          const newMessages = cloneDeep(sendMessages).splice(0, i) || [];
          if (!content) return;
          chatStoreState.updateCurrentSession((session) => {
            if (session.data?.messages) {
              session.data.messages = newMessages;
            }
          });
          get().onUserSubmit(content, options || {}, originPrompt);
          break;
        } else if (isToolRetry && sendMessage.role === ChatRole.Assistant) {
          const newMessages = cloneDeep(sendMessages).splice(0, i + 1) || [];
          chatStoreState.updateCurrentSession((session) => {
            if (session.data?.messages) {
              session.data.messages = newMessages;
            }
          });
          get().onUserSubmit(
            '',
            {
              event: UserEvent.CODE_CHAT_CODEBASE,
            },
            undefined,
            sendMessage.response,
          );
          break;
        }
      }
    },

    /** @private */
    onUserSubmit: async (
      content: string,
      options: {
        event?: PrePromptEvent | string;
        // 用来区分是不是 MCP tool 消息
        isMCPToolResponse?: boolean;
        mcpServerUsed?: string;
        ntesTraceId?: string;
        retryCount?: number;
        skipUserMessage?: boolean;
        specPrompt?: Prompt;
        agentTaskDirective?: AgentTaskDirective;
      },
      originPrompt?: string,
      toolResponse?: {
        [propName: string]: boolean;
      },
      unselectedResults?: Set<string>,
    ) => {
      // 防止重复触发
      if (Date.now() - submitTimestamp < 2000) return;
      const chatStoreState = useChatStore.getState();
      const isSubagentProcessing = !useTaskCompletionStore.getState().isSessionComplete(chatStoreState.currentSessionId || '');
      const chatType = chatStoreState.chatType;
      submitTimestamp = Date.now();
      // 先判断是否"处于流传输中"或者是"处于搜索中"或者"终端运行中"
      if (get().isStreaming || get().isSearching || get().isTerminalProcessing || isSubagentProcessing) {
        userReporter.report({
          event: UserEvent.CHAT_SUBMIT_ERROR,
          extends: {
            errorMessage: 'Chat is streaming or searching'
          },
        });
        return;                                             // 1. 前置检查，正在流式传输？ → 拒绝，return正在搜索？     → 拒绝，return终端执行中？   → 拒绝，return没有 session？ → 创建新 session，return
      }

      // 反馈池支持多个消息反馈，根据目前需求，只支持最近一次 chat 的反馈
      FeedbackPool.clear();
      const model = useChatConfig.getState().config.model;
      const codeChatApiKey = useConfigStore.getState().config.codeChatApiKey;
      // const codeChatApiBaseUrl = useConfigStore.getState().config.codeChatApiBaseUrl;

      get().resetMessage();

      const session = chatStoreState.currentSession();
      const chatPromptStoreState = useChatPromptStore.getState();

      const prompApp = usePromptApp.getState();
      const handlePromptUpdate = (prompt: string) => {
        const lastMessage: any = messages[messages.length - 1];
        if (typeof lastMessage.content === 'string') {
          lastMessage.content = `${prompt}\n${lastMessage.content.replace(prompApp?.runner?.meta?.prompt || '', '')}`;
        }
        if (
          isArray(lastMessage.content) &&
          lastMessage.content[0].type === 'text'
        ) {
          lastMessage.content[0].text = `${prompt}\n${lastMessage.content[0].text.replace(prompApp?.runner?.meta?.prompt || '', '')}`;
        }
        prompApp.reset();
      };
      if (!session || !session.data || !session.data.messages) {
        useChatStore.getState().onNewSession();
        userReporter.report({
          event: UserEvent.CHAT_SUBMIT_ERROR,
          extends: {
            errorMessage: 'No session found'
          },
        });
        return;
      }
      const currentSessionModel = session.data.model;
      // 重置 searchResult
      set(() => ({
        searchMessage: [],
      }));
      // message id
      const id = nanoid();
      lastMessageId = id;
      let userInputContent = content;
      const mcpRunnerState = useMcpPromptApp.getState();
      if (mcpRunnerState.runner && mcpRunnerState.resultText) {
        userInputContent = mcpRunnerState.resultText + '\n\n' + userInputContent;
      }
      const skillRunnerState = useSkillPromptApp.getState();
      if (skillRunnerState.runner && skillRunnerState.resultText) {
        userInputContent = skillRunnerState.resultText + '\n\n' + userInputContent;
      }
      if (usePluginApp.getState().runner) {
        userInputContent =
          `/${usePluginApp.getState().runner?.app_shortcut.name}\n\n` +
          userInputContent;
      }
      const chatConfig = useChatConfig.getState().config;
      const compressConfig = useChatConfig.getState().compressConfig;
      const codebaseModelMaxTokens =
        useChatConfig.getState().codebaseModelMaxTokens;
      const attachs = useChatAttach.getState().attachs;
      const getCodebaseChatSystemPrompt =
        useWorkspaceStore.getState().getCodebaseChatSystemPrompt;
      const getCodebaseChatTools =
        useWorkspaceStore.getState().getCodebaseChatTools;
      const workspaceInfo = useWorkspaceStore.getState().workspaceInfo;
      const devSpace = useWorkspaceStore.getState().devSpace;
      const userContent = assembleUserPromptContent(userInputContent || '-');
      const chatModels = useChatConfig.getState().chatModels
      const ntesTraceId =
        chatType === 'default'
          ? get().streamRetryCount > 0
            ? options.ntesTraceId || generateTraceId()
            : generateTraceId()
          : undefined;
      const submitOptions =
        ntesTraceId
          ? {
              ...options,
              ntesTraceId,
            }
          : options;

      /* 2.拼接用户消息
      用户消息 = {
      id: 随机ID,
      role: "user",
      content: 用户输入的文字,
      
      // 以下全是可选的"附加物"：
      attachs:       附件（图片/文件/文件夹/知识库/...）
      pluginApp:     插件信息
      mcpPrompt:     MCP Prompt 信息
      skillPrompt:   Skill 信息
      rules:         生效的规则列表
      shortcutPrompt: CodeWiki 快捷指令
      } */

      const userMessage: ChatMessage = {
        id,
        role: ChatRole.User,
        content: userContent,
        createdAt: Date.now(),
      };

      const mask = useMaskStore.getState().currentMask();
      // 非默认模型的 ID 都认为是编程模式
      const isProgrammingMode = IS_PROGRAMMING_MODE.includes(mask?._id || '');

      const hasMentionKnowledgeBases = !!(attachs as IMultiAttachment)?.dataSource?.some(i => i?.attachType === AttachType.Docset)
      const currentSessionId = useChatStore.getState().currentSessionId
      if (hasMentionKnowledgeBases && currentSessionId) {
        mentionKnowledgeMap.set(currentSessionId, true)
      }
      // 重置关联Skill&Mcp&Rule Prompt
      PromptLinkMgr.ins.reset()
      // 消息重发时此依赖原始数据恢复状态。但发送消息不要携带此消息体，否则会加大token计算
      if (!userMessage._originalRequestData) {
        userMessage._originalRequestData = {};
        Object.assign(userMessage._originalRequestData, {
          content,
          originPrompt,
          attachs,
          options: submitOptions,
        });
      }

      if (attachs) {
        if (
          chatType === 'default' &&
          attachs.attachType === AttachType.Docset
        ) {
          const { docsets } = attachs as Docsets;
          userMessage.attachs = docsets.map((docset) => ({
            _id: docset._id,
            name: docset.name,
            code: docset.code,
            project: docset.project,
            type: ChatMessageAttachType.Docset,
          }));
          // userMessage.attachs = [
          //   {
          //     // _id: _id,
          //     // name,
          //     // code,
          //     // project,
          //     docsets:docsets,
          //     type: ChatMessageAttachType.Docset,
          //   },
          // ];
        } else if (
          chatType === 'default' &&
          attachs.attachType === AttachType.CodeBase
        ) {
          const { collection } = attachs as CodeBase;
          userMessage.attachs = [
            {
              collection,
              searchResult: [],
              type: ChatMessageAttachType.CodeBase,
            },
          ];
        } else if (
          chatType === 'default' &&
          attachs.attachType === AttachType.NetworkModel
        ) {
          const { model } = attachs as NetworkModel;
          userMessage.attachs = [
            {
              type: ChatMessageAttachType.NetworkModel,
              model: model,
            },
          ];
        } else if (attachs.attachType === AttachType.KnowledgeAugmentation) {
          userMessage.attachs = [
            {
              type: ChatMessageAttachType.KnowledgeAugmentation,
            },
          ];
        } else if (attachs.attachType === AttachType.MultiAttachment) {
          userMessage.attachs = [
            {
              type: ChatMessageAttachType.MultiAttachment,
              attachs: attachs
            }
          ]
          // 用来在userMessage上展示信息
          const imgUrls = getImageUrlFromAttachs(attachs as IMultiAttachment)
          if (chatModels[chatConfig.model]?.parseImgType !== ParseImgType.NONE && imgUrls.length) {
            for (const imgUrl of imgUrls) {
              (userMessage.content as ChatMessageContentUnion[]).push({
                type: ChatMessageContent.ImageUrl,
                image_url: {
                  url: imgUrl,
                },
              });
            }
          }
          useChatAttach.getState().update(undefined);
        }
      }

      const pluginApp = usePluginApp.getState().runner;
      if (pluginApp) {
        userMessage.pluginApp = pluginApp;
      }
      const mcpRunner = mcpRunnerState.runner;
      if (mcpRunner) {
        userMessage.mcpPrompt = {
          serverName: mcpRunner.serverName,
          promptName: mcpRunner.promptName,
          title: mcpRunner.title,
        };
      }
      const skillRunner = skillRunnerState.runner;
      if (skillRunner) {
        userMessage.skillPrompt = {
          skillName: skillRunner.skillName,
          title: skillRunner.title,
          source: skillRunner.source,
        };
        // 上报 Skill 使用事件（用户手动触发）
        import('../services/skillUsage').then(({ reportSkillInvoke }) => {
          import('./skills').then(({ getSkillDescription }) => {
            const description = getSkillDescription(skillRunner.skillName);
            reportSkillInvoke(skillRunner.skillName, { source: 'codemaker-user', description });
          });
        });
      }

      const promptRunner = usePromptApp.getState().runner
      const promptMeta = promptRunner?.meta
      if (promptMeta?._id?.includes('codewiki') && userMessage) {
        userMessage.shortcutPrompt = {
          content: promptMeta.prompt,
          title: promptMeta.name,
          _id: promptMeta._id,
          type: PromptCategoryType.CodeWiki
        }
        usePromptApp.getState().reset()
      }
      let effectiveRules: Rule[] = [];
      let attachFiles: FileItem[] = [];
      let attachFolders: FolderItem[] = [];
      if (attachs && attachs.attachType === AttachType.MultiAttachment) {
        attachFiles = (attachs as IMultiAttachment).dataSource.filter((item) => item.attachType === AttachType.File) as FileItem[];
        attachFolders = (attachs as IMultiAttachment).dataSource.filter((item) => item.attachType === AttachType.Folder) as FolderItem[];
      }
      const rules = useWorkspaceStore.getState().rules;
      const teamRules = useWorkspaceStore.getState().teamRules;
      const selectedRules = useWorkspaceStore.getState().selectedRules;
      const isOldVersion = false;
      effectiveRules = getEffectiveRules({
        selectedRules: [
          ...teamRules,
          ...rules.filter((rule) => selectedRules.includes(rule.filePath))
        ],
        mentionPaths: [
          ...attachFiles.map(file => file.path),
          ...attachFolders.map(folder => folder.path)
        ],
        codebaseCustomPrompt: useWorkspaceStore.getState().workspaceInfo?.codebaseCustomPrompt || '',
        code_style: useWorkspaceStore.getState().devSpace?.code_style || '',
        oldVersion: isOldVersion
      })
      if (attachs && attachs.attachType === AttachType.MultiAttachment) {
        const attachRules: RuleItem[] = (attachs as IMultiAttachment).dataSource.filter((item) => item.attachType === AttachType.Rules) as RuleItem[];
        if (attachRules) {
          for (const attachRule of attachRules) {
            if (!effectiveRules.find((item) => item.filePath === attachRule.filePath)) {
              const rule = rules.find((item) => item.filePath === attachRule.filePath);
              if (rule) {
                effectiveRules.push(rule);
              }
            }
          }
        }
      }
      if (chatType === 'codebase' && effectiveRules.length) {
        userMessage.rules = effectiveRules.map((rule) => {
          return {
            name: rule.name,
            filePath: rule.filePath
          }
        });
        try {
          userReporter.report({
            event: UserEvent.CHAT_WITH_RULES,
            extends: {
              rules: effectiveRules
            },
          });
        } catch (err) {
          console.error('chat with rules report error', err);
        }
      }

      // 3.处理上一轮工具结果

      if (toolResponse) {  //有 toolResponse（工具执行完了，带着结果回来）
        chatStoreState.updateCurrentSession((session) => {
          if (session && session.data) {
            session.chat_repo = session.chat_repo || workspaceInfo.repoName;
            const lastMessage =
              session.data.messages[session.data.messages.length - 1];
            lastMessage.response = toolResponse;
            if (lastMessage.tool_calls) {
              lastMessage.tool_calls.forEach((tool, index) => {
                // 跳过已存在的 tool message（去重，避免与 updateTaskToolResult 冲突）
                const alreadyExists = session.data?.messages.some(
                  (msg) => msg.role === ChatRole.Tool && msg.tool_call_id === tool.id
                );
                // 修复工具丢失，循环触发工具
                if (alreadyExists && tool.type === 'task') {
                  return;
                }

                const toolResults = lastMessage.tool_result || {};
                const result = toolResults[tool.id] || {
                  content: '',
                  path: '',
                };
                // 将 retrieve_code 和 retrieve_knowledge 格式处理一下
                const resultContent = formatResultContent({
                  toolResponse: toolResponse[tool.id],
                  tool: tool,
                  result: result,
                  unselectedResults: unselectedResults,
                  session: session,
                  userMessage: userMessage,
                  model: getAIGWModel(chatConfig.model),
                });
                session.data?.messages.push({
                  id: `${lastMessage.id}-${index}`,
                  role: ChatRole.Tool,
                  tool_call_id: tool.id,
                  content: resultContent || '',
                });
              });
            }
          }
          /*上一轮 LLM 说：调用 edit_file 和 grep_search
          用户点了确认 → 工具执行完毕 → toolResponse 带着结果进来

          代码做的事：
            遍历上一条 assistant 消息的每个 tool_call
              → 格式化工具结果
              → push 一条 Tool 消息到 messages

          messages 变成：
            [..., assistant(tool_calls), Tool(结果1), Tool(结果2)] */
        });
      } else {
        // 如果有未处理的 tool 请求，又没有 toolResponse，全部置为拒绝先
        const rejectResponse: {
          [propName: string]: boolean;
        } = {};
        if (session.data.messages.length) {
          const lastMessage =
            session.data.messages[session.data.messages.length - 1];
          if (
            lastMessage.tool_calls &&
            lastMessage.tool_calls.length &&
            (!lastMessage.response ||
              Object.keys(lastMessage.response).length !==
              lastMessage.tool_calls.length)
          ) {
            lastMessage.tool_calls.forEach((tool) => {
              rejectResponse[tool.id] = false;
              if (['edit_file', 'replace_in_file', 'write', 'edit'].includes(tool.function.name)) {
                useChatApplyStore.getState().rejectEdit(tool.id);
              }
            });
          }
          /*代码做的事：
            1. 检查上一条 assistant 有没有未处理的 tool_calls
              → 有的话全部标记为 "用户拒绝了"
              → push Tool 消息（content = "The user denied this operation."）
            
            2. 把用户新消息 push 到 messages

          messages 变成：
            [..., assistant(tool_calls), Tool(拒绝), User(新消息)] */
        }
        // 更新 user 的 message
        // 4.组装请求数据
        chatStoreState.updateCurrentSession((session) => {
          session.chat_repo = session.chat_repo || workspaceInfo.repoName;
          if (rejectResponse && session?.data?.messages) {
            const lastMessage =
              session.data.messages[session?.data?.messages.length - 1];
            const rejectResponseIds = Object.keys(rejectResponse);
            if (rejectResponseIds.length) {
              rejectResponseIds.forEach((toolId, index) => {
                const tool = lastMessage?.tool_calls?.find((tool) => tool.id === toolId);
                session.data?.messages.push({
                  id: `${lastMessage.id}-${index}`,
                  role: ChatRole.Tool,
                  tool_call_id: toolId,
                  content: tool?.function.name === PlanTool.function.name
                    ? processMakePlanDenied()
                    : tool?.function.name === TodoTool.function.name
                      ? processWriteTodoDenied()
                      : formatUserDeniedResult(tool?.function.name || 'unknown', toolId),
                });
                lastMessage.tool_result = lastMessage.tool_result || {};
                if (tool?.function.name === 'ask_user_question') {
                  lastMessage.tool_result[tool.id] = {
                    path: '',
                    content: '未选择任何选项',
                    isError: false
                  }
                }
              });
              // session.data?.messages.push({
              //   role: ChatRole.Assistant,
              //   hidden: true,
              //   content: '-',
              // });
              lastMessage.response = rejectResponse;
            }
          }
          if (!options.skipUserMessage) {
            session?.data?.messages.push(userMessage);
          }
        });
        userMessage.attachs = await getParsedAttachs(userMessage.attachs as MultipleAttach[])

        // 清理 MCP Runner 状态，避免重复使用上次结果
        try {
          useMcpPromptApp.getState().reset();
        } catch (e) {
          void e;
        }
        try {
          useSkillPromptApp.getState().reset();
        } catch (e) {
          void e;
        }
      }
      // 更新最后一次 message 的 prompt
      chatStoreState.updateLastMessagePrompt(chatPromptStoreState.prompt);

      const sessionId = chatStoreState.currentSessionId;
      if (!sessionId) {
        return;
      }
      const messageIndex = session?.data?.messages.length + 1;

      // 报错分析/终端输出分析 hardcode 插入指令
      if (
        chatPromptStoreState.prompt &&
        ['1715235825372', '1716420480006'].includes(
          chatPromptStoreState.prompt._id,
        )
      ) {
        const currentPrompt = chatPromptStoreState.prompt;
        let loadingMessage = '正在分析';
        if (['1715235825372'].includes(chatPromptStoreState.prompt._id)) {
          loadingMessage = '正在进行错误分析';
        } else if (
          ['1716420480006'].includes(chatPromptStoreState.prompt._id)
        ) {
          loadingMessage = '正在分析选中内容';
        }
        // 重置
        get().reset();
        chatPromptStoreState.reset();
        set(() => ({
          isStreaming: true,
          loadingMessage: loadingMessage,
        }));
        requestBMChatStream(
          content,
          {
            code: `docset_${currentPrompt._id}`,
            project: 'codemaker',
            type: DocsetType._BrainMaker,
            attachType: 'docset',
          } as Docset,
          [],
          {
            onMessage(content, done, bmSearch) {
              get().setStreamRetryCount(0)
              if (chatStoreState.isError) {
                chatStoreState.setError(false);
              }
              if (done) {
                ControllerPool.remove(sessionId, messageIndex);
                FeedbackPool.add(id);
                set((state) => {
                  state.isStreaming = false;
                });
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({ ...get().message, id }),
                );
                useChatStore.getState().syncHistory();
              } else {
                set((state) => {
                  if (state.message) {
                    state.message.content = content;
                    // 保存 bmSearch 相关数据
                    if (bmSearch) {
                      // 保存思考过程内容
                      if (bmSearch.reasoningContent) {
                        state.message.reasoning_content = bmSearch.reasoningContent;
                      }
                    }
                  } else {
                    console.error(
                      'create bot message before set message content!',
                    );
                  }
                  state.loadingMessage = '';
                });
              }
            },
            onError(error) {
              console.dir(error);
              userReporter.report({
                event: UserEvent.REPLY_EXCEPTION,
                extends: {
                  model,
                  session_id: session._id,
                  content: content,
                  docset: currentPrompt._id,
                  error_message: error.message,
                },
              });
              webToolsHub.withScope((scope) => {
                scope.setExtras({
                  event: UserEvent.REPLY_EXCEPTION,
                  model,
                  session_id: session._id,
                  content: content,
                  docset: currentPrompt._id,
                  mark: 0,
                });
                webToolsLogger.captureException(error);
              });
              let outputContent = get().message.content;
              // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
              // error.name 为 AbortError 表示该错误是 abort 触发的
              if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                return
              }
              if (error.name !== ABORT_ERROR_NAME) {
                // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                const isCloseCodeBackticks = checkCodeBlockIsClose(
                  outputContent as string,
                );
                if (!isCloseCodeBackticks) {
                  outputContent += `\n${CODE_BACKTICKS}`;
                }
                if (error.message === StreamError.AuthTokenIsExpired) {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.GET_INIT_DATA,
                      data: {
                        isExpired: true,
                      },
                    },
                    '*',
                  );
                } else {
                  chatStoreState.setError(true);
                  outputContent += '\n\n 出错了，稍后重试吧';
                }
                if (error.name === REQUEST_TIMEOUT_NAME) {
                  outputContent = `\n\n 消息请求超时`;
                }
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({
                    ...DEFAULT_ASSISTANT_MESSAGE,
                    id,
                    content: outputContent,
                    group_tokens: 8,
                  }),
                );
                ControllerPool.remove(sessionId, messageIndex);
                chatStoreState.syncHistory();
                get().reset();
              }
            },
            onController: (abortController) => {
              ControllerPool.addController(
                sessionId,
                messageIndex,
                abortController,
              );
            },
            onFinish: (extraData: any) => {
              chatStoreState.updateLastMessageSearchRecordId(
                lodashGet(extraData, '_bm_extra.search_record_id'),
              );
            },
          },
        );
        return;
      }

      // 处理系统级别的 Prompt
      if (chatPromptStoreState.prompt) {
        get().reset();
        const { name } = chatPromptStoreState.prompt;
        const codeBlock = chatPromptStoreState.codeBlock || '';
        const formatInput = `/${name} \n ${codeBlock} `;
        userMessage.content = reassembleContentWithImages(
          userMessage.content,
          formatInput,
        );
        userMessage.systemPrompt = {
          ...chatPromptStoreState.prompt,
          codeBlock: codeBlock,
        };
      }

      // spec prompt 处理
      if (options?.specPrompt) {
        const { name } = options.specPrompt;
        const formatInput = `/${name} \n ${content} `;
        userMessage.content = reassembleContentWithImages(
          userMessage.content,
          formatInput,
        );
        userMessage.specPrompt = name;
      }

      try {
        if (content) {
          (userMessage.content as ChatMessageContentUnion[]).push({
            type: ChatMessageContent.Text,
            text: getEnvironmentDetails({}),
          });
        }
      } catch (err) {
        console.error('注入 environment_details 失败', err);
      }

      // attach codebase @知识库 数据预处理
      let searchCodeBase = '';
      if (attachs && attachs.attachType === AttachType.CodeBase) {
        const { collection } = attachs as CodeBase;
        set((state) => {
          state.isSearching = true;
          state.searchMessage = [];
        });
        const searchData = await getCodeSearchDataNew(
          originPrompt || '',
          collection,
        );
        console.log('搜索结果：', searchData);
        const searchResult = searchData.map((i) => ({
          module_name: i.module_name,
          code: i.code,
          language: i?.language,
          name: i.name || i.func_name || '',
          annotation: i.annotation,
          id: nanoid(),
        }));
        useSearchResultStore.getState().addByArray(searchResult);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const attachResult = searchResult.map(({ code, ...refs }) => ({
          ...refs,
        }));
        set((state) => {
          state.isSearching = false;
          state.searchMessage = attachResult;
        });
        chatStoreState.updateCurrentSession((session) => {
          const userMessage =
            session.data?.messages[session.data.messages.length - 1];
          if (userMessage) {
            userMessage.attachs = [
              {
                collection,
                searchResult: attachResult || [],
                type: ChatMessageAttachType.CodeBase,
              },
            ];
          }

          searchCodeBase = searchData ? concatenatePrompt(searchData) : '';
        });
      }

      if (attachs && attachs.attachType === AttachType.Docset) {    // 走 BM 的逻辑
        // 重置
        get().reset();
        set(() => ({ isStreaming: true }));
        // 清理 prompt
        if (chatPromptStoreState.prompt) {
          chatPromptStoreState.reset();
        }
        const { docsets } = attachs as Docsets;
        chatStoreState.updateCurrentSession((session) => {
          session.data = session.data || { messages: [], consumedTokens: createInitialConsumedTokens(), attaches: { docsets: [], attachType: AttachType.Docset } };
          session.data.attaches = session.data.attaches || { docsets: [], attachType: AttachType.Docset };
          session.data.attaches = { attachType: AttachType.Docset, docsets: filterDocsetsFn(docsets) as Docset[] };
          return session;
        });
        if (docsets.length > 1) {
          const len = session.data.messages.length;
          const sendMessages = session.data.messages.slice(
            Math.max(len - 7, 0),
          );
          const filterSendMessage = cloneDeep(sendMessages).map((message) => {
            let content = '';
            if (Array.isArray(message.content)) {
              const textContent = message.content.find(
                (item) => item.type === ChatMessageContent.Text,
              );
              content = (textContent as ChatMessageContentText)?.text || '';
            } else {
              content = message.content;
            }
            return {
              content,
              id: message.id,
              role: message.role,
            };
          });
          filterSendMessage.pop();
          requestMultipleBMChatStream(content, docsets, filterSendMessage, {
            onMessage(content, done, jsonData) {
              get().setStreamRetryCount(0)
              if (chatStoreState.isError) {
                chatStoreState.setError(false);
              }
              if (done) {
                ControllerPool.remove(sessionId, messageIndex);
                FeedbackPool.add(id);
                set((state) => {
                  state.isStreaming = false;
                });
                chatStoreState.updateCurrentSession((session) => {
                  session.data?.messages.push({ ...get().message, id });
                  return session;
                });
                chatStoreState.generateAndUpdateSessionTopic();
                chatStoreState.updateConsumedTokens({
                  model: model,
                  curSession: session,
                  promptTokens: jsonData?.metadata?.usage?.prompt_tokens || 0,
                  completionTokens: jsonData?.metadata?.usage?.completion_tokens || 0,
                  cacheCreationInputTokens: jsonData?.metadata?.usage?.cache_creation_input_tokens || 0,
                  cacheReadInputTokens: jsonData?.metadata?.usage?.cache_read_input_tokens || 0
                });
                chatStoreState.syncHistory();
              } else {
                set((state) => {
                  if (state.message) {
                    state.message.content = content;
                  } else {
                    console.error(
                      'create bot message before set message content!',
                    );
                  }
                  state.loadingMessage = '';
                });
              }
            },
            onError(error) {
              console.dir(error);
              userReporter.report({
                event: UserEvent.REPLY_EXCEPTION,
                extends: {
                  model,
                  session_id: session._id,
                  content: content,
                  docsets: docsets.map((item) => item._id),
                  error_message: error.message,
                },
              });
              webToolsHub.withScope((scope) => {
                scope.setExtras({
                  event: UserEvent.REPLY_EXCEPTION,
                  model,
                  session_id: session._id,
                  content: content,
                  docsets: docsets.map((item) => item._id),
                  error_message: error.message,
                  mark: 1,
                });
                webToolsLogger.captureException(error);
              });
              let outputContent = get().message.content;
              if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                return
              }
              // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
              // error.name 为 AbortError 表示该错误是 abort 触发的
              if (error.name !== ABORT_ERROR_NAME) {
                // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                const isCloseCodeBackticks = checkCodeBlockIsClose(
                  outputContent as string,
                );
                if (!isCloseCodeBackticks) {
                  outputContent += `\n${CODE_BACKTICKS}`;
                }
                if (error.message === StreamError.AuthTokenIsExpired) {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.GET_INIT_DATA,
                      data: {
                        isExpired: true,
                      },
                    },
                    '*',
                  );
                } else {
                  chatStoreState.setError(true);
                  outputContent += '\n\n 出错了，稍后重试吧';
                }
                if (error.name === REQUEST_TIMEOUT_NAME) {
                  outputContent = `\n\n 消息请求超时`;
                }
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({
                    ...DEFAULT_ASSISTANT_MESSAGE,
                    id,
                    content: outputContent,
                  }),
                );
                ControllerPool.remove(sessionId, messageIndex);
                chatStoreState.syncHistory();
                get().reset();
              }
            },
            onController: (abortController) => {
              ControllerPool.addController(
                sessionId,
                messageIndex,
                abortController,
              );
            },
          });
        } else {
          const doceset = docsets[0] as Docset;
          const { _id, name, code } = doceset;
          userReporter.report({
            event: UserEvent.CODE_CHAT_START_BM_STREAM,
            extends: {
              content: content,
              docset_id: _id,
              docset_name: name,
              docset_code: code,
            },
          });
          const historyMessage = doceset?.chat_config?.chat_mode?.use_messages;
          let filterSendMessage: ChatMessage[] = [];
          if (historyMessage) {
            const len = session.data.messages.length;
            const sendMessages = session.data.messages.slice(
              Math.max(len - 7, 0),
            );
            filterSendMessage = cloneDeep(sendMessages).map((message) => {
              let content = '';
              if (Array.isArray(message.content)) {
                const textContent = message.content.find(
                  (item) => item.type === ChatMessageContent.Text,
                );
                content = (textContent as ChatMessageContentText)?.text || '';
              } else {
                content = message.content;
              }
              return {
                content,
                id: message.id,
                role: message.role,
              };
            });

            filterSendMessage.pop();
          }
          requestBMChatStream(content, doceset, filterSendMessage, {
            onMessage(content, done, bmSearch) {
              get().setStreamRetryCount(0)
              if (chatStoreState.isError) {
                chatStoreState.setError(false);
              }
              if (done) {
                ControllerPool.remove(sessionId, messageIndex);
                FeedbackPool.add(id);
                set((state) => {
                  state.isStreaming = false;
                });
                const { bmMark, contexts, reasoningContent } = bmSearch;
                const baseMessage = {
                  ...get().message,
                  id,
                  bmSearch: contexts,
                  bmMark,
                  reasoningContent,
                };
                let messageToAdd;
                if (bmMark) {
                  try {
                    const { replaceString, sourcesIndex } =
                      bmExtractAndReplaceSources(content);
                    messageToAdd = {
                      ...baseMessage,
                      content: replaceString,
                      bmSearchSourcesIndex: sourcesIndex,
                    };
                  } catch (error) {
                    messageToAdd = {
                      ...baseMessage,
                      content,
                    };
                  }
                } else {
                  messageToAdd = {
                    ...baseMessage,
                    content,
                  };
                }
                if (reasoningContent) {
                  messageToAdd.reasoning_content = reasoningContent;
                }
                chatStoreState.updateCurrentSession((session) => {
                  if (session.data) {
                    session.data?.messages.push(messageToAdd);
                  }
                });
                useChatStore.getState().generateAndUpdateSessionTopic();
                useChatStore.getState().syncHistory();
              } else {
                set((state) => {
                  if (bmSearch?.reasoningContent) {
                    state.message.reasoning_content = bmSearch.reasoningContent;
                  }
                  if (state.message) {
                    state.message.content = content;
                  } else {
                    console.error(
                      'create bot message before set message content!',
                    );
                  }
                  state.loadingMessage = '';
                });
              }
            },
            onError(error) {
              console.dir(error);
              userReporter.report({
                event: UserEvent.REPLY_EXCEPTION,
                extends: {
                  model,
                  session_id: session._id,
                  content: content,
                  docset: doceset._id,
                  error_message: error.message,
                },
              });
              webToolsHub.withScope((scope) => {
                scope.setExtras({
                  event: UserEvent.REPLY_EXCEPTION,
                  model,
                  session_id: session._id,
                  content: content,
                  docset: doceset._id,
                  error_message: error.message,
                  mark: 2,
                });
                webToolsLogger.captureException(error);
              });
              let outputContent = get().message.content;
              if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                return
              }
              // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
              // error.name 为 AbortError 表示该错误是 abort 触发的
              if (error.name !== ABORT_ERROR_NAME) {
                // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                const isCloseCodeBackticks = checkCodeBlockIsClose(
                  outputContent as string,
                );
                if (!isCloseCodeBackticks) {
                  outputContent += `\n${CODE_BACKTICKS}`;
                }
                if (error.message === StreamError.AuthTokenIsExpired) {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.GET_INIT_DATA,
                      data: {
                        isExpired: true,
                      },
                    },
                    '*',
                  );
                } else {
                  chatStoreState.setError(true);
                  outputContent += '\n\n 出错了，稍后重试吧';
                }
                if (error.name === REQUEST_TIMEOUT_NAME) {
                  outputContent = `\n\n 消息请求超时`;
                }
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({
                    ...DEFAULT_ASSISTANT_MESSAGE,
                    id,
                    content: outputContent,
                  }),
                );
                ControllerPool.remove(sessionId, messageIndex);
                chatStoreState.syncHistory();
                get().reset();
              }
            },
            onController: (abortController) => {
              ControllerPool.addController(
                sessionId,
                messageIndex,
                abortController,
              );
            },
          });
        }
        return;
      } else if (attachs && attachs.attachType === AttachType.KnowledgeAugmentation) {    // 走 BM 知识增强的逻辑
        // 重置
        get().reset();
        set(() => ({ isStreaming: true }));
        // 清理 prompt
        if (chatPromptStoreState.prompt) {
          chatPromptStoreState.reset();
        }
        // if (docsets.length > 1) {
        const len = session.data.messages.length;
        const sendMessages = session.data.messages.slice(Math.max(len - 7, 0));
        const filterSendMessage = cloneDeep(sendMessages).map((message) => {
          let content = '';
          if (Array.isArray(message.content)) {
            const textContent = message.content.find(
              (item) => item.type === ChatMessageContent.Text,
            );
            content = (textContent as ChatMessageContentText)?.text || '';
          } else {
            content = message.content;
          }
          return {
            content,
            id: message.id,
            role: message.role,
          };
        });
        filterSendMessage.pop();

        requestBMKnowledgeAugmentationStream(
          content,
          filterSendMessage,
          { model, repo: workspaceInfo.repoName || '' },
          {
            onMessage(content, done, jsonData) {
              get().setStreamRetryCount(0)
              if (chatStoreState.isError) {
                chatStoreState.setError(false);
              }
              if (done) {
                ControllerPool.remove(sessionId, messageIndex);
                FeedbackPool.add(id);
                set((state) => {
                  state.isStreaming = false;
                });
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({ ...get().message, id }),
                );
                useChatStore.getState().generateAndUpdateSessionTopic();
                useChatStore.getState().updateConsumedTokens({
                  model: model,
                  curSession: session,
                  promptTokens: jsonData?.metadata?.usage?.prompt_tokens || 0,
                  completionTokens: jsonData?.metadata?.usage?.completion_tokens || 0,
                  cacheCreationInputTokens: jsonData?.metadata?.usage?.cache_creation_input_tokens || 0,
                  cacheReadInputTokens: jsonData?.metadata?.usage?.cache_read_input_tokens || 0
                });
                useChatStore.getState().syncHistory();
              } else {
                set((state) => {
                  if (state.message) {
                    state.message.content = content;
                  } else {
                    console.error(
                      'create bot message before set message content!',
                    );
                  }
                  state.loadingMessage = '';
                });
              }
            },
            onError(error) {
              console.dir(error);
              userReporter.report({
                event: UserEvent.REPLY_EXCEPTION,
                extends: {
                  model,
                  session_id: session._id,
                  error_message: error.message,
                },
              });
              webToolsHub.withScope((scope) => {
                scope.setExtras({
                  event: UserEvent.REPLY_EXCEPTION,
                  model,
                  session_id: session._id,
                  error_message: error.message,
                  mark: 3,
                });
                webToolsLogger.captureException(error);
              });
              let outputContent = get().message.content;
              if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                return
              }
              // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
              // error.name 为 AbortError 表示该错误是 abort 触发的
              if (error.name !== ABORT_ERROR_NAME) {
                // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                const isCloseCodeBackticks = checkCodeBlockIsClose(
                  outputContent as string,
                );
                if (!isCloseCodeBackticks) {
                  outputContent += `\n${CODE_BACKTICKS}`;
                }
                if (error.message === StreamError.AuthTokenIsExpired) {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.GET_INIT_DATA,
                      data: {
                        isExpired: true,
                      },
                    },
                    '*',
                  );
                } else {
                  chatStoreState.setError(true);
                  outputContent += '\n\n 出错了，稍后重试吧';
                }
                if (error.name === REQUEST_TIMEOUT_NAME) {
                  outputContent = `\n\n 消息请求超时`;
                }
                chatStoreState.updateCurrentSession((session) =>
                  session.data?.messages.push({
                    ...DEFAULT_ASSISTANT_MESSAGE,
                    id,
                    content: outputContent,
                  }),
                );
                ControllerPool.remove(sessionId, messageIndex);
                chatStoreState.syncHistory();
                get().reset();
              }
            },
            onController: (abortController) => {
              ControllerPool.addController(
                sessionId,
                messageIndex,
                abortController,
              );
            },
          },
        );
        return;
        // }
      } else if (attachs && attachs.attachType === AttachType.NetworkModel) {    // 走联网模型逻辑
        get().reset();
        set(() => ({ isStreaming: true }));
        const { model } = attachs as NetworkModel;
        const convertPrompt = await useMaskStore
          .getState()
          .convertToPrompt(content);
        const maskPrompt = {
          id: mask?._id,
          role: ChatRole.User,
          content: convertPrompt,
          attachs: [
            {
              type: ChatMessageAttachType.NetworkModel,
              model: model,
            },
          ],
        };
        const config = useConfigStore.getState().config;
        const len = session.data.messages.length;
        const sendMessages = session.data.messages.slice(
          Math.max(len - config.historyMessageCount - 1, 0),
        );
        const messages = cloneDeep(sendMessages).map((message) => {
          let content = '';
          if (Array.isArray(message.content)) {
            const textContent = message.content.find(
              (item) => item.type === ChatMessageContent.Text,
            );
            content = (textContent as ChatMessageContentText)?.text || '';
          } else {
            content = message.content;
          }
          delete message._originalRequestData;
          // delete message.attachs;
          return {
            ...message,
            content,
          };
        });
        // 非编程模式下，后端不会帮忙补 prompt ，所以需要自己替换和补 prompt
        if (!isProgrammingMode) {
          // 对齐 prompt ，格式为 user->assistant->user
          if (messages[0].role !== ChatRole.Assistant) {
            messages.unshift({
              ...DEFAULT_ASSISTANT_MESSAGE,
              content: '-',
            });
          }
          messages.unshift(maskPrompt)
        }
        if (chatPromptStoreState.prompt) {
          const currentMessageIndex = messages.length - 1;
          messages[currentMessageIndex].content = content;
          chatPromptStoreState.reset();
        }
        const data: ChatPromptBody = {
          messages,
          model,
          max_tokens: chatConfig.max_tokens,
          stream: true,
          // temperature: chatConfig.temperature,
          extra_body: {
            vertexai_tool: {
              google_search_retrieval: {
                open: true,
                dynamic_retrieval_config: {
                  mode: 'MODE_UNSPECIFIED',
                },
              },
            },
          },
        };
        if (isProgrammingMode) {
          // 编程模式下， prompt 让后端补即可，前端不做任何更改 prompt 的操作
          const currentMaskCode = DEFAULT_MASKS.find(
            (i) => i._id === mask?._id,
          )?.code;
          data.prompt_construct = {
            mode: 'default',
            params: {},
          };
          if (currentMaskCode !== '') {
            data.prompt_construct.params = {
              tpl_code: currentMaskCode,
            };
          }
        }
        const chatRequestUrl = isProgrammingMode
          ? '/proxy/gpt/gpt/code_chat_stream'
          : '/proxy/gpt/gpt/text_chat_stream';

        requestNetworkChatStream(submitOptions.event, data, chatRequestUrl, {
          onMessage(content, done, webSearch, jsonData) {
            get().setStreamRetryCount(0)
            if (chatStoreState.isError) {
              chatStoreState.setError(false);
            }
            if (done) {
              ControllerPool.remove(sessionId, messageIndex);
              FeedbackPool.add(id);
              set((state) => {
                state.isStreaming = false;
              });
              chatStoreState.updateCurrentSession((session) =>
                session.data?.messages.push({
                  ...get().message,
                  id,
                  content: content,
                  webSearch: webSearch,
                }),
              );
              useChatStore.getState().generateAndUpdateSessionTopic();
              chatStoreState.updateConsumedTokens({
                model: data.model as ChatModel,
                curSession: session,
                promptTokens: jsonData?.metadata?.usage?.prompt_tokens || 0,
                completionTokens: jsonData?.metadata?.usage?.completion_tokens || 0,
                cacheCreationInputTokens: jsonData?.metadata?.usage?.cache_creation_input_tokens || 0,
                cacheReadInputTokens: jsonData?.metadata?.usage?.cache_read_input_tokens || 0
              });
              chatStoreState.syncHistory();
            } else {
              set((state) => {
                if (state.message) {
                  state.message.content = content;
                } else {
                  console.error(
                    'create bot message before set message content!',
                  );
                }
                state.loadingMessage = '';
              });
            }
          },
          onError(error) {
            console.dir(error);
            userReporter.report({
              event: UserEvent.REPLY_EXCEPTION,
              extends: {
                model,
                session_id: session._id,
                messages: data.messages,
                error_message: error.message,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.REPLY_EXCEPTION,
                model,
                session_id: session._id,
                // messages: data.messages, 数据太大了
                error_message: error.message,
                mark: 4,
              });
              webToolsLogger.captureException(error);
            });
            let outputContent = get().message.content;
            if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
              get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
              return
            }
            if (error.name !== ABORT_ERROR_NAME) {
              // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
              const isCloseCodeBackticks = checkCodeBlockIsClose(
                outputContent as string,
              );
              if (!isCloseCodeBackticks) {
                outputContent += `\n${CODE_BACKTICKS}`;
              }
              if (error.message === StreamError.AuthTokenIsExpired) {
                window.parent.postMessage(
                  {
                    type: BroadcastActions.GET_INIT_DATA,
                    data: {
                      isExpired: true,
                    },
                  },
                  '*',
                );
              }
              outputContent += handleStreamError(error);
              chatStoreState.updateCurrentSession((session) =>
                session.data?.messages.push({
                  ...DEFAULT_ASSISTANT_MESSAGE,
                  id,
                  content: outputContent,
                  group_tokens: 8,
                }),
              );
              ControllerPool.remove(sessionId, messageIndex);
              chatStoreState.syncHistory();
              get().reset();
            }
          },
          onController(abortController) {
            ControllerPool.addController(
              sessionId,
              messageIndex,
              abortController,
            );
          },
          ntesTraceId,
        });
        userReporter.report({
          event: UserEvent.CODE_CHAT_START_STREAM,
          extends: {
            content: content,
            mask_id: mask?._id,
            mask_name: mask?.name,
            mask_content: mask?.prompt,
            mask_type: mask?.type,
            model: model,
          },
        });
        return;
      } else if (chatStoreState.chatType === 'codebase') {    // 走 CodeBase Chat 逻辑
        get().reset();
        set(() => ({ isStreaming: true }));
        let cacheEnable = false;
        if (chatModels[chatConfig.model]?.hasTokenCache) {
          if (codebaseModelMaxTokens[chatConfig.model] > 64 * 1000) {
            cacheEnable = true;
          }
        }

        const compressionSummaryCountAtRequest = (session.data?.messages || []).filter(msg => msg.isCompressionSummary).length;

        const unCompressedMessages = (session.data?.messages || []).filter((msg, index, self) => (
          !msg.isCompressed ||
          (msg.role === ChatRole.Assistant && self?.[index + 1]?.role === ChatRole.Tool && !self?.[index + 1]?.isCompressed)
        ))

        const currentCompressStatus = await getCompressSessionStatus(sessionId);

        const compressionEnabled =
          compressConfig.enable &&
          compressConfig.visible &&
          !chatModels[chatConfig.model].isPrivate;
        const useCompression =
          compressionEnabled &&
          currentCompressStatus !== SessionStatus.FAILED;

        let truncationResult;
        if (useCompression) {
          truncationResult = {
            sendMessages: await pruneToolOutputs(unCompressedMessages),
            containUserMessage: true,
            newTruncateStart: -1,
            previousTokens: 0,
            fallbackToSlideWindow: false,
          };
        } else if (cacheEnable) {
          truncationResult = truncateMessagesIfNeeded({
            messages: unCompressedMessages,
            model: chatConfig.model,
            codebaseModelMaxTokens,
          });
        } else {
          truncationResult = truncatedMessageWithSlideWindow({
            messages: unCompressedMessages,
            model: chatConfig.model,
            codebaseModelMaxTokens,
          });
        }

        const {
          sendMessages,
          containUserMessage,
          newTruncateStart,
          previousTokens,
          fallbackToSlideWindow,
        } = truncationResult;


        if (sendMessages.length < unCompressedMessages.length
          && !chatModels[chatConfig.model].isPrivate
          && compressConfig.enable
          && compressConfig.visible
          && currentCompressStatus !== SessionStatus.COMPRESSING
          && currentCompressStatus !== SessionStatus.FAILED
        ) {
          console.log('检测到消息截断, 触发强制压缩');
          void chatStoreState.triggerCompression(sessionId);
        }

        if (fallbackToSlideWindow) {
          cacheEnable = false;
        }
        const isReAct = false;

        // 收集 agent system-reminders（注入到 system prompt tier2）
        const subagentEnable = useExtensionStore.getState().subagentEnable;
        const agents = useSubagentStore.getState().agents;
        const systemReminders: string[] = [];

        // Agent listing：subagentEnable 时始终注入（无论手动/自动触发模式）
        if (subagentEnable && agents.length > 0) {
          systemReminders.push(buildAgentListingReminder(agents));
        }

        // Agent 调用 reminder：仅在 slash 触发时注入
        if (options.agentTaskDirective) {
          const invocationReminder = wrapSystemReminder(
            generateSubagentConstraintText(options.agentTaskDirective.agentName),
          );
          systemReminders.push(invocationReminder);
        }

        const agentReminders = systemReminders.length > 0
          ? systemReminders.join('\n\n')
          : undefined;

        const codebaseChatSystemPrompt = getCodebaseChatSystemPrompt({
          isReAct,
          effectiveRules,
          agentReminders,
        });
        sendMessages.unshift({
          role: ChatRole.System,
          content: codebaseChatSystemPrompt,
        });
        // FIX：修复消息上下文丢失的问题
        // OPTIMIZED: 遍历 messages +2
        const filteredMessages = await serializeCodebaseMessages({
          model,
          sendMessages,
          session,
          isReAct,
          status: 1,
          iterator: (message) => {
            stripImagesForUnsupportedModel(message, chatModels[chatConfig.model]);
          }
        });

        // TODO: 不应该在这里重复处理
        if (chatPromptStoreState.prompt && ![
          ...BUILT_IN_PROMPTS.map(prompt => prompt.name),
          ...BUILT_IN_PROMPTS_SPECKIT.map(speckitPrompt => speckitPrompt.name)
        ].includes(chatPromptStoreState.prompt.name)) {
          const currentMessageIndex = filteredMessages.length - 1;
          filteredMessages[currentMessageIndex].content =
            reassembleContentWithImages(
              filteredMessages[currentMessageIndex].content,
              content,
            );
          chatPromptStoreState.reset();
        }

        // 处理 mermaid 图表相关的 prompt 替换
        const metaId = prompApp?.runner?.meta?._id || '';
        const MERMAID_PROMPT_MAP: Record<string, string> = {
          '66cf10e1f16cb1260db58a08': ER_PROMPT,      // ER 图
          '66cf0a830fe8cbf0be33b162': CLASS_PROMPT,   // 类图
          '66d0704b0fe8cbf0be33b170': CFG_PROMPT,     // 流程图
          '66e00c47f16cb1260db58a95': SEQUENCE_PROMPT, // 时序图
          '66cd9986f16cb1260db589ec': MINDMAP_PROMPT, // 思维导图
        };

        const targetPrompt = MERMAID_PROMPT_MAP[metaId];
        if (targetPrompt) {
          const lastMessage: any = filteredMessages[filteredMessages.length - 1];
          const originalPrompt = prompApp?.runner?.meta?.prompt || '';
          const replaceContent = (text: string) => `${targetPrompt}\n${text.replace(originalPrompt, '')}`;

          if (typeof lastMessage.content === 'string') {
            lastMessage.content = replaceContent(lastMessage.content);
          } else if (isArray(lastMessage.content) && lastMessage.content[0]?.type === 'text') {
            lastMessage.content[0].text = replaceContent(lastMessage.content[0].text);
          }

          prompApp.reset();
        }

        // 当有 agentTaskDirective 时（用户通过 SLASH 命令触发），强制包含 task 工具
        const forceIncludeTask = !!options.agentTaskDirective;

        const data: ChatPromptBody = {
          messages: filteredMessages,
          model: getAIGWModel(chatConfig.model),
          // max_tokens: chatConfig.max_tokens,
          mode_type: "main.agent",
          stream: true,
          tool_choice: chatConfig.model.startsWith('claude')
            ? undefined
            : 'auto',
          tools: getCodebaseChatTools({ forceIncludeTask }),
        };

        // 如果用户填了 apikey，则使用用户���定的 apiKey
        if (codeChatApiKey) {
          data.app_key = codeChatApiKey;
        }
        // if (codeChatApiBaseUrl) {
        //   data.base_url = codeChatApiBaseUrl;
        // }
        const chatRequestUrl = '/proxy/gpt/u5_chat/codebase_agent_stream';
        // Codebase Chat 固定设置 temperature 为 0;
        data.temperature = 0;
        const ntesTraceId = generateTraceId();

        // OPTIMZIED: 遍历 messages +1
        for (const message of data.messages) {
          // 快捷指令发送
          if (message.role === ChatRole.User && message?.shortcutPrompt) {
            message.content = [{
              type: ChatMessageContent.Text,
              text: message?.shortcutPrompt.content + '\n' + getContentString(message.content)
            }]
          }
          if (message.tool_calls && !message.tool_calls.length) {
            delete message.tool_calls;
          }
          if (message.specPrompt) {
            const realPrompt = specPromptMap[message.specPrompt];
            if (Array.isArray(message.content)) {
              message.content.unshift({
                type: ChatMessageContent.Text,
                text: realPrompt
              })
            } else {
              message.content = realPrompt + '\n\n' + message.content;
            }
          }
        }

        // OPTIMIZED: 遍历 messages +1
        reuseDuplicateFileRead({
          messages: data.messages,
          triggerReuse: !cacheEnable || newTruncateStart >= 0
        });

        useChatConfig.getState().chatModels
        if (chatModels[chatConfig.model]?.hasThinking && getAIGWModel(chatConfig.model)?.toLocaleLowerCase?.()?.includes?.('claude')) {
          // const { maxToken, budgetToken } = calculateTokenBudget(data?.max_tokens || 4096)
          data.max_tokens = 48000;
          const budgetToken = Math.max(
            (data?.max_tokens || CHAT_MIN_TOKENS) / 2,
            1024,
          );

          // OPTIMZIED: 遍历 messages +1
          if (checkThinkingSignatureValid(data.messages)) {
            data.extra_body = {
              thinking: {
                type: 'enabled',
                budget_tokens: budgetToken,
              },
            };
          }
        }

        if (cacheEnable) {
          data.messages = addCacheMarksToMessages(data.messages);
          data.tools = addCacheMarksToTools(data.tools);
        }

        // 如果由于窗口偏移导致 user 信息丢失，补充进来并告知模型
        if (!containUserMessage) {
          const lastUserIndex = findLastIndex(session.data.messages, (msg => msg.role === ChatRole.User));
          if (lastUserIndex >= 0) {
            const lastUserMessage = session.data.messages[lastUserIndex];
            let lastUserContent: ChatMessageContentUnion[] = []
            if (Array.isArray(lastUserMessage.content)) {
              lastUserContent = lastUserMessage.content;
            } else {
              lastUserContent = [{
                type: ChatMessageContent.Text,
                text: lastUserMessage.content
              }];
            }
            data.messages.push({
              role: ChatRole.User,
              content: [
                {
                  type: ChatMessageContent.Text,
                  text: getPlanContextTruncationInstruction() + `<important>\n由于上文长度限制，未展示所有历史对话消息，请不要继续调用多工具，尝试总结并回复，若已有消息不足以得出结论，提示用户提供更多信息\n\n原始题内容如下:</important>\n\n`
                },
                ...lastUserContent
              ]
            })
          }
        }

        // 研发空间使用上报
        if (devSpace?._id) {
          userReporter.report({
            event: UserEvent.CODE_CHAT_DEV_SPACE_USED,
            extends: {
              model,
              session_id: session._id,
              dev_space_id: devSpace._id,
              dev_space_name: devSpace.name,
              dev_space_project: devSpace.project,
            },
          })
        }
        const userChatConfig = useChatConfig.getState();
        userReporter.report({
          event: UserEvent.CODE_CHAT_ACCEPT_AUTO_MODE_BEFORE_CHAT,
          extends: {
            autoApply: userChatConfig.autoApply,
            autoExecute: userChatConfig.autoExecute,
            autoApprove: userChatConfig.autoApprove,
            session_id: session._id,
            model,
          },
        })
        // if (content) {
        //   const currentMessageIndex = data.messages.length - 1;
        //   const lastMessage = data.messages[currentMessageIndex];
        //   if (chatType === 'codebase' && lastMessage.role === ChatRole.User) {
        //     const lastMessageContent = lastMessage.content;
        //     if (Array.isArray(lastMessageContent)) {
        //       if (lastMessageContent[0].type === 'text') {
        //         lastMessageContent[0].text = `<user_query>${lastMessageContent[0].text}</user_query>`;
        //       }
        //     }
        //   }
        // }
        if (isReAct) {
          const DEFAULT_MAX_TOKENS = 10240
          data.max_tokens = data.max_tokens || DEFAULT_MAX_TOKENS;
          delete data.tool_choice;
          delete data.tools;
          requestDSCodebaseChatStream(
            data,
            chatRequestUrl,
            {
              onMessage(content, done, toolCalls, reasoningText, totalTokens, completionTokens, streamingToolCall) {
                get().setStreamRetryCount(0)
                if (chatStoreState.isError) {
                  chatStoreState.setError(false);
                }
                if (done) {
                  if (attachs) {
                    useChatAttach.getState().reset();
                  }
                  ControllerPool.remove(sessionId, messageIndex);
                  FeedbackPool.add(id);
                  const response: {
                    [propName: string]: boolean;
                  } = {};
                  const results: {
                    [propName: string]: {
                      path: string;
                      content: string;
                    };
                  } = {};
                  const allResponsed = false;
                  let isProcessing = toolCalls.length && !allResponsed ? true : false;
                  // 遍历 toolCalls，如果非常规 tool，在 mcp tool 中找一下是否有对应的，恢复一下
                  const MCPServers = useMCPStore
                    .getState()
                    .MCPServers.filter((server) => !server.disabled);
                  toolCalls.forEach((tool) => {
                    if (!toolCallNames.includes(tool.function.name)) {
                      for (const server of MCPServers) {
                        const targetTool = (server.tools || []).find((t) => t.name === tool.function.name);
                        if (targetTool) {
                          tool.function = {
                            name: 'use_mcp_tool',
                            arguments: JSON.stringify({
                              server_name: server.name,
                              tool_name: tool.function.name,
                              arguments: tool.function.arguments
                            })
                          }
                          return;
                        }
                        const targetResource = (server.resources || []).find((t) => t.name === tool.function.name);
                        if (targetResource) {
                          tool.function = {
                            name: 'access_mcp_resource',
                            arguments: JSON.stringify({
                              server_name: server.name,
                              tool_name: tool.function.name,
                              arguments: tool.function.arguments
                            })
                          }
                          return;
                        }
                      }
                    }
                  })

                  if (toolCalls.find(toolCall => [
                    'use_mcp_tool',
                    'access_mcp_resource',
                    'edit_file',
                    'reapply',
                    'run_terminal_cmd',
                    'replace_in_file',
                    'edit',
                    'write',
                    'ask_user_question',
                    'make_plan',
                  ].includes(toolCall.function.name))) {
                    isProcessing = false;
                  }
                  set((state) => {
                    state.isStreaming = false;
                    state.isProcessing = isProcessing;
                    state.isApplying = toolCalls.some(toolCall => ['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(toolCall.function.name));
                  });
                  chatStoreState.updateCurrentSession((session) => {
                    session.data?.messages.push({
                      ...get().message,
                      id,
                      content,
                      tool_calls: toolCalls || [],
                      processing: isProcessing,
                      completion_tokens: completionTokens,
                      response: response,
                      tool_result: results,
                      reasoning_content: reasoningText
                    });
                    // chatStoreState.updateConsumedTokens(session, data.messages, totalTokens, completionTokens);
                  });
                  onMessageToolCallResponse(session, content, done, toolCalls, totalTokens, completionTokens)
                  if (MCPServers && MCPServers.length) {
                    let mcpServersUsed: string[] = [];
                    try {
                      mcpServersUsed = MCPServers.map((server) => server.name);
                    } catch {
                      mcpServersUsed = [];
                    }
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_MCP_SESSION_TOKEN_USED,
                      extends: {
                        totalTokens: totalTokens,
                        model: data.model,
                        mcp_servers: mcpServersUsed
                      }
                    })
                  }
                  if (options.isMCPToolResponse) {
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_MCP_MESSAGE_TOKEN_USED,
                      extends: {
                        totalTokens: totalTokens,
                        model: data.model,
                        mcp_server: options.mcpServerUsed
                      }
                    })
                  }
                  if (toolCalls.length) {
                    if (!allResponsed) {
                      // 分离 task 工具和非 task 工具
                      const taskToolCalls = toolCalls.filter(
                        (t) => t.function.name === 'task',
                      );
                      const nonTaskToolCalls = toolCalls.filter(
                        (t) => t.function.name !== 'task',
                      );
                      // task 工具：并行启动所有（不等待，各自完成后独立更新结果）
                      if (taskToolCalls.length > 0 && chatStoreState.currentSessionId) {
                        const parentSessionId = chatStoreState.currentSessionId;
                        const taskToolCallIds = taskToolCalls.map((t) => t.id);

                        // ✅ 启动 watchdog 定时器
                        taskCoordinator.startSessionWatchdog(
                          parentSessionId,
                          taskToolCallIds,
                        );

                        // ============ 阶段 1：原子注册所有 task ============
                        taskToolCalls.forEach((taskTool) => {
                          let task_params: any = {};
                          try {
                            task_params = JSON.parse(
                              taskTool.function.arguments || '{}',
                            );
                          } catch (err) {
                            console.error(err);
                            task_params = {};
                          }

                          // ✅ 发射 TASK_REGISTERED 事件（同步）
                          emitTaskRegistered(
                            parentSessionId,
                            taskTool.id,
                            task_params.subagent_type || 'explore',
                            task_params.description,
                          );
                        });

                        // ============ 阶段 2：标记注册完成 ============
                        taskCoordinator.markRegistrationComplete(
                          parentSessionId,
                          taskToolCallIds,
                        );

                        // ============ 阶段 3：异步执行所有 task ============
                        taskToolCalls.forEach((taskTool) => {
                          let task_params: any = {};
                          try {
                            task_params = JSON.parse(
                              taskTool.function.arguments || '{}',
                            );
                          } catch (err) {
                            console.error(err);
                            task_params = {};
                          }

                          // 异步执行子代理，完成后将结果注入主会话
                          (async () => {
                            try {
                              const { runSubagent } =
                                await import('../modules/subagent');
                              const parentController =
                                ControllerPool.controllers.get(
                                  ControllerPool.key(sessionId, messageIndex),
                                );
                              // 获取当前的 conversationRound（用于 OTEL 追踪，Y3 可能为空）
                              const round = (get() as any).conversationRound;

                              const taskResult = await runSubagent(
                                {
                                  description: task_params.description || '',
                                  prompt: task_params.prompt || '',
                                  subagent_type:
                                    task_params.subagent_type || 'explore',
                                },
                                {
                                  parentSessionId,
                                  parentAbortSignal: parentController?.signal,
                                  toolCallId: taskTool.id,
                                  round,
                                },
                              );

                              // ✅ 使用 await 等待锁保护的异步更新完成
                              await get().updateTaskToolResult({
                                toolCallId: taskTool.id,
                                taskResult,
                                sessionId: parentSessionId,
                              });
                            } catch (err) {
                              const errorMsg =
                                err instanceof Error ? err.message : String(err);

                              // ✅ 错误恢复：将错误信息作为 tool result 注入主会话
                              try {
                                get().updateToolCallResults({
                                  [taskTool.id]: {
                                    path: '',
                                    content: `Subagent execution failed: ${errorMsg}`,
                                    isError: true,
                                  },
                                });
                              } catch (updateErr) {
                                console.error(
                                  `[Debug][subagent] CRITICAL: Failed to update error tool_result for ${taskTool.id}:`,
                                  updateErr,
                                );
                              }
                            }
                          })().catch((err) => {
                            console.error(
                              `[Debug][subagent] CRITICAL: Unhandled promise rejection in task tool ${taskTool.id}:`,
                              err,
                            );

                            try {
                              get().updateToolCallResults({
                                [taskTool.id]: {
                                  path: '',
                                  content: `Critical error: ${err instanceof Error ? err.message : String(err)}`,
                                  isError: true,
                                },
                              });
                            } catch (finalErr) {
                              console.error(
                                `[Debug][subagent] FATAL: Cannot update tool_result even in final catch for ${taskTool.id}:`,
                                finalErr,
                              );
                            }
                          });
                        });
                      }

                      // 非 task 工具：处理全部工具
                      for (const tool of nonTaskToolCalls) {
                        if (!response[tool.id]) {
                          let tool_params: any = {};
                          if (tool.function.arguments) {
                            try {
                              tool_params = JSON.parse(tool.function.arguments);
                            } catch (err) {
                              console.error(err);
                              tool_params = {};
                            }
                          }
                          if (tool.function.name === 'use_mcp_tool' || tool.function.name === 'access_mcp_resource') {
                            let params: any = {};
                            try {
                              params = JSON.parse(tool.function.arguments || '{}');
                            } catch (err) {
                              console.error('解析MCP参数失败', err)
                              params = {};
                            }
                            let autoApprove = false;
                            if (params && params.server_name && params.tool_name) {
                              // Normalize server name for lookup (handles path-based names)
                              const normalizedParamsServer = (params.server_name || '')
                                .replace(/\\/g, '/')
                                .split('/')
                                .slice(-1)[0];
                              const targetServer = MCPServers.find(
                                (server) => {
                                  if (server.name === params.server_name) return true;
                                  const sNorm = (server.name || '').replace(/\\/g, '/').split('/').slice(-1)[0];
                                  return sNorm === normalizedParamsServer;
                                },
                              );
                              if (targetServer && targetServer.tools) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else {
                                  const targetTool = targetServer.tools.find(
                                    (tool) => tool.name === params.tool_name,
                                  );
                                  if (targetTool && targetTool.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              } else if (targetServer) {
                                // Server found but tools not yet loaded — check server-level autoApprove
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                }
                              } else {
                                // Server not found by name — search all servers by tool name
                                const toolName =
                                  params?.tool_name?.toLowerCase?.();
                                for (const server of MCPServers) {
                                  const targetTool = server.tools?.find(
                                    (tool) =>
                                      tool?.name?.toLowerCase?.() === toolName,
                                  );
                                  if (targetTool) {
                                    // Check both tool-level and server-level autoApprove
                                    if (targetTool?.autoApprove || server.autoApprove) {
                                      autoApprove = true;
                                    }
                                    params.server_name = server.name;
                                    break;
                                  }
                                }
                              }
                            } else if (params && params.server_name && params.uri) {
                              // Normalize server name for lookup
                              const normalizedParamsServerForUri = (params.server_name || '')
                                .replace(/\\/g, '/')
                                .split('/')
                                .slice(-1)[0];
                              const targetServer = MCPServers.find(
                                (server) => {
                                  if (server.name === params.server_name) return true;
                                  const sNorm = (server.name || '').replace(/\\/g, '/').split('/').slice(-1)[0];
                                  return sNorm === normalizedParamsServerForUri;
                                },
                              );
                              if (targetServer && targetServer.resources) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else {
                                  const targetResource =
                                    targetServer.resources.find(
                                      (resource) => resource.uri === params.uri,
                                    );
                                  if (
                                    targetResource &&
                                    targetResource.autoApprove
                                  ) {
                                    autoApprove = true;
                                  }
                                }
                              } else if (targetServer) {
                                // Server found but resources not yet loaded
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                }
                              } else {
                                const uri = params?.uri?.toLowerCase?.();
                                for (const server of MCPServers) {
                                  const targetResource = server.resources?.find(
                                    (resource) =>
                                      resource?.uri?.toLowerCase?.() === uri,
                                  );
                                  if (targetResource) {
                                    // Check both resource-level and server-level autoApprove
                                    if (targetResource?.autoApprove || server.autoApprove) {
                                      autoApprove = true;
                                    }
                                    params.server_name = server.name;
                                    break;
                                  }
                                }
                              }
                            }
                            if (autoApprove) {
                              useChatStreamStore.getState().setIsMCPProcessing(true);
                              window.parent.postMessage(
                                {
                                  type: BroadcastActions.TOOL_CALL,
                                  data: {
                                    tool_name: tool.function.name,
                                    tool_params: params,
                                    tool_id: tool.id,
                                  },
                                },
                                '*',
                              );
                            } else {
                              // autoApprove 当前为 false，可能是 SYNC_MCP_SERVERS 还未到达
                              // 订阅 MCPStore 变化，一旦 autoApprove 变为 true 立即补发 TOOL_CALL
                              const capturedToolId = tool.id;
                              const capturedToolName = tool.function.name;
                              const capturedParams = { ...params };
                              const capturedSessionId = sessionId;

                              let dispatched = false;
                              let unsubscribeMCPWatch: (() => void) | undefined;

                              const cleanupMCPWatch = () => {
                                if (unsubscribeMCPWatch) {
                                  unsubscribeMCPWatch();
                                  unsubscribeMCPWatch = undefined;
                                }
                              };

                              const watchTimeoutId = setTimeout(cleanupMCPWatch, 3000);

                              // 检查函数：按 server_name 归一化名称在 MCPServers 里查找 autoApprove
                              const checkAndDispatch = (mcpServers: typeof MCPServers) => {
                                if (dispatched) return;
                                const targetNorm = (capturedParams.server_name || '')
                                  .replace(/\\/g, '/')
                                  .split('/')
                                  .slice(-1)[0];
                                const foundServer = mcpServers.find((server) => {
                                  const sNorm = (server.name || '')
                                    .replace(/\\/g, '/')
                                    .split('/')
                                    .slice(-1)[0];
                                  return sNorm === targetNorm;
                                });
                                const autoApproveNow =
                                  foundServer?.config?.autoApprove === true ||
                                  foundServer?.autoApprove === true;
                                if (autoApproveNow) {
                                  dispatched = true;
                                  clearTimeout(watchTimeoutId);
                                  cleanupMCPWatch();
                                  // 用户点击 checkbox 已直接派发过 TOOL_CALL，跳过重复派发
                                  if (useChatStreamStore.getState().isMCPProcessing) {
                                    return;
                                  }
                                  useChatStreamStore.getState().setIsMCPProcessing(true);
                                  window.parent.postMessage(
                                    {
                                      type: BroadcastActions.TOOL_CALL,
                                      data: {
                                        tool_name: capturedToolName,
                                        tool_params: capturedParams,
                                        tool_id: capturedToolId,
                                      },
                                    },
                                    '*',
                                  );
                                }
                              };

                              // 立即用当前 store 检查一次——应对「autoApprove 已是 true 但 store 不会再变」的场景
                              checkAndDispatch(useMCPStore.getState().MCPServers);

                              unsubscribeMCPWatch = useMCPStore.subscribe((state) => {
                                if (dispatched) return;
                                // 会话已切走则放弃，避免在错误的会话上触发
                                if (useChatStore.getState().currentSessionId !== capturedSessionId) {
                                  clearTimeout(watchTimeoutId);
                                  cleanupMCPWatch();
                                  return;
                                }
                                checkAndDispatch(state.MCPServers);
                              });
                            }
                          } else if (tool.function.name === 'retrieve_code') {
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params: {
                                    question: tool_params.search_query,
                                    collection: parseAtMentionedCodeBaseByAttach(),
                                  },
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          } else if (
                            tool.function.name === 'retrieve_knowledge'
                          ) {
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params: {
                                    // messages: data.messages,
                                    messages: [
                                      {
                                        role: 'user',
                                        content: tool_params.search_query,
                                      },
                                    ],
                                    input: tool_params.search_query,
                                    docset: tool_params.docset_id,
                                    model: data.model,
                                  },
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          } else if (tool.function.name === 'read_file') {
                            try {
                              const toolCallParams = JSON.parse(tool.function.arguments || '{}');
                              // TODO: 需要先给路径做规范化之后再对比
                              const readFilePath = toolCallParams.path.replace(/\\\\/g, '/');
                              if (readFilePath) {
                                const chatApplyInfo = useChatApplyStore.getState().chatApplyInfo;
                                const chatApplyItems = Object.values(chatApplyInfo);
                                const targetApplyItem = chatApplyItems.find(item => item.filePath && item.filePath === readFilePath);
                                if (targetApplyItem && targetApplyItem.finalResult) {
                                  window.postMessage({
                                    type: SubscribeActions.TOOL_CALL_RESULT,
                                    data: {
                                      tool_name: 'read_file',
                                      tool_result: {
                                        path: readFilePath,
                                        content: targetApplyItem.finalResult,
                                        isError: false
                                      },
                                      tool_id: tool.id,
                                    },
                                  },
                                    '*'
                                  );
                                }
                              } else {
                                window.parent.postMessage(
                                  {
                                    type: BroadcastActions.TOOL_CALL,
                                    data: {
                                      tool_name: tool.function.name,
                                      tool_params,
                                      tool_id: tool.id,
                                    },
                                  },
                                  '*',
                                );
                              }
                            } catch (err) {
                              console.error(getErrorMessage(err));
                            }
                          } else if (tool.function.name === terminalCmdFunction) {
                            if (useChatConfig.getState().autoExecute &&
                              isCommandSafe(useConfigStore.getState().config.codeBaseCheckCommands, tool_params.command)
                            ) {
                              window.parent.postMessage(
                                {
                                  type: BroadcastActions.TOOL_CALL,
                                  data: {
                                    tool_name: tool.function.name,
                                    tool_params: {
                                      ...tool_params,
                                      messageId: id,
                                      is_approve: true,
                                    },
                                    tool_id: tool.id,
                                  },
                                },
                                '*',
                              )
                            }
                          } else if (tool.function.name === 'ask_user_question') {
                            // ask_user_question 工具在 WebView 中本地处理，不发送 TOOL_CALL 到 IDE
                            // 用户在界面上交互后，通过 AskUserQuestion 组件提交结果
                            console.log('[Debug] ask_user_question tool intercepted, waiting for user response');
                          } else {
                            if (['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(tool.function.name)) {
                              const filePath = tool_params.target_file;
                              const updateSnippet = tool_params.code_edit;
                              const replaceSnippet = tool_params.diff;
                              const isCreateFile = tool_params.is_create_file;
                              useChatApplyStore.getState().setChatApplyItem(tool.id, {
                                filePath,
                                originalContent: '',
                                updateSnippet,
                                replaceSnippet,
                                type: tool.function.name,
                                toolCallId: tool.id,
                                applying: true,
                                accepted: false,
                                isCreateFile
                              })
                              userReporter.report({
                                event: getReportEventByToolName({ toolName: tool.function.name, status: 0 }),
                                extends: {
                                  model,
                                  tool_params: tool_params,
                                  tool_id: tool.id,
                                  tool_name: tool.function.name
                                },
                              })
                            }
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params,
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          }
                        }
                      }
                    } else {
                      get().onUserSubmit(
                        '',
                        {
                          event: UserEvent.CODE_CHAT_CODEBASE,
                        },
                        undefined,
                        response,
                      );
                    }
                  } else {
                    get().resetMessage();
                    window.parent.postMessage({
                      type: 'WEBVIEW_ACK',
                      data: {
                        event: 'content_completed',
                        payload: session.data,
                      },
                    }, '*');
                  }
                  if (
                    !currentSessionModel ||
                    currentSessionModel !== chatConfig.model
                  ) {
                    // 本次会话没有模型类型或者模型更改了，重新设置模型类型
                    chatStoreState.updateModel(chatConfig.model);
                  }
                  useChatStore.getState().generateAndUpdateSessionTopic();
                  chatStoreState.syncHistory();
                } else {
                  set((state) => {
                    if (state.message) {
                      let codeContent = ''
                      if (streamingToolCall) {
                        if (['edit_file', 'replace_in_file', 'reapply'].includes(streamingToolCall.name)) {
                          const updateSnippet = streamingToolCall.params && streamingToolCall.params.code_edit;
                          const replaceSnippet = streamingToolCall.params && streamingToolCall.params.diff;
                          const filePath = streamingToolCall.params && streamingToolCall.params.target_file;
                          if (filePath && updateSnippet) {
                            // console.log(updateSnippet)
                            // const language = filePath.split('.').slice(-1)[0];
                            codeContent += `\n\n\`\`\`\n${updateSnippet.replace(/\\n/g, '\n')}\n\`\`\``;
                          }
                          if (filePath && replaceSnippet) {
                            // console.log(replaceSnippet)
                            // const language = filePath.split('.').slice(-1)[0];
                            codeContent += `\n\n\`\`\`\n${replaceSnippet.replace(/\\n/g, '\n')}\n\`\`\``;
                          }
                        }
                      }
                      state.message.codeContent = codeContent;
                      state.message.content = content;
                    } else {
                      console.error(
                        'create bot message before set message content!',
                      );
                    }
                    state.loadingMessage = '';
                  });
                }
              },
              onError(error) {
                console.dir(error);
                userReporter.report({
                  event: UserEvent.REPLY_EXCEPTION,
                  extends: {
                    model,
                    session_id: session._id,
                    messages: data.messages,
                    error_message: error.message,
                    ntesTraceId: ntesTraceId,
                  },
                });
                webToolsHub.withScope((scope) => {
                  scope.setExtras({
                    event: UserEvent.REPLY_EXCEPTION,
                    model,
                    session_id: session._id,
                    // messages: data.messages, 数据太大了
                    error_message: error.message,
                    ntesTraceId: ntesTraceId,
                    mark: 5,
                  });
                  webToolsLogger.captureException(error);
                });
                let outputContent = get().message.content;
                if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                  get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                  return
                }
                if (error.name !== ABORT_ERROR_NAME) {
                  // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                  const isCloseCodeBackticks = checkCodeBlockIsClose(
                    outputContent as string,
                  );
                  if (!isCloseCodeBackticks) {
                    outputContent += `\n${CODE_BACKTICKS}`;
                  }
                  if (error.message === StreamError.AuthTokenIsExpired) {
                    window.parent.postMessage(
                      {
                        type: BroadcastActions.GET_INIT_DATA,
                        data: {
                          isExpired: true,
                        },
                      },
                      '*',
                    );
                  }
                  outputContent += handleStreamError(error);
                  chatStoreState.updateCurrentSession((session) =>
                    session.data?.messages.push({
                      ...DEFAULT_ASSISTANT_MESSAGE,
                      id,
                      content: outputContent,
                      group_tokens: 8,
                    }),
                  );
                  ControllerPool.remove(sessionId, messageIndex);
                  chatStoreState.syncHistory();
                  get().reset();
                }
              },
              onController(abortController) {
                ControllerPool.addController(
                  sessionId,
                  messageIndex,
                  abortController,
                );
              },
              ntesTraceId: ntesTraceId,
              setError: (type) => {
                chatStoreState.setError(type)
              }
            },
          );
        } else {
          let DEFAULT_MAX_TOKENS = 10240;
          if ([ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(chatConfig.model)) {
            DEFAULT_MAX_TOKENS = 32000;
          }
          data.max_tokens = Math.max(data.max_tokens || 0, DEFAULT_MAX_TOKENS)
          // TEST: 调试用
          // data.messages = mockMessages as any;
          // data.messages = [
          //   data.messages[0],
          //   ...((mockMessages as any).slice(1))
          // ]

          let throttleTime = 0;
          let toolcallParsedIndex = 0;
          let parsedArgumentStr = '';
          let parsedTargetFile = '';
          let parsedCodeEdit = '';
          let parsedDiff = '';
          let inTargetFile = false;
          let inIsCreateFile = false;
          let inCodeEdit = false;
          let inDiff = false;

          const codebaseChatMode = useChatStore.getState().codebaseChatMode
          if (session.data?.enablePlanMode && !['openspec', 'speckit'].includes(codebaseChatMode || '')) {
            injectTodoListToLastUserMessage(data.messages, session.data.todoList);
          }

          // 如果是Deppseek模型，需要扁平化数据内容
          convertDeepseekMessages(chatConfig.model, data.messages);
          if ([ChatModel.GPT5, ChatModel.GPT51, ChatModel.GPT51Codex].includes(data.model as ChatModel)) {
            delete data.temperature;
          } else if (data.model.includes('gemini') || data.model.includes('Gemini')) {
            data.messages[0].content += `\nNote:Don't repeat yourself`
            data.temperature = 1
          } else if ([ChatModel.Glm47, ChatModel.Glm5].includes(data.model as ChatModel)) {
            data.temperature = 2
          }
          // DEBUG: 调试用，校验是否前缀匹配
          // checkReusable({
          //   messages: data.messages,
          //   tools: data.tools || []
          // })
          data.codebase_chat_mode = codebaseChatMode || 'vibe';
          const active_change_id = useChatStore.getState().activeChangeId;
          const active_feature_id = useChatStore.getState().activeFeatureId;
          if (active_change_id) {
            data.active_change_id = active_change_id;
          }
          if (active_feature_id) {
            data.active_feature_id = active_feature_id;
          }

          // 这里是真正给LLM发送消息的地方
          requestCodebaseChatStream(
            UserEvent.CODE_CHAT_CODEBASE,
            data,
            chatRequestUrl,
            {
              onMessage(content, done, toolCalls, totalTokens, completionTokens, promptTokens, cacheCreationInputTokens, cacheReadInputTokens, claude37Response, responseId) {
                get().setStreamRetryCount(0)

                if (chatStoreState.isError) {
                  chatStoreState.setError(false);
                }
                if (done) {
                  // 检查 Subagent 功能是否启用，如果禁用则过滤掉 task 工具
                  if (toolCalls?.length && !useExtensionStore.getState().subagentEnable) {
                    toolCalls = toolCalls.filter(
                      (tc) => tc.function?.name !== 'task',
                    );
                  }
                  debugSuccess('Main Agent onMessage', 'Stream done. Final tool calls:', {
                    toolCalls,
                    data,
                  });
                  // 模型返回后检测是否需要压缩
                  // 先检查请求期间是否发生过压缩（通过比较压缩摘要数量）
                  const currentSession = chatStoreState.currentSession();
                  const compressionSummaryCountNow = (currentSession?.data?.messages || []).filter(msg => msg.isCompressionSummary).length
                  const hasCompressionOccurredDuringRequest = compressionSummaryCountNow !== compressionSummaryCountAtRequest;
                  try {
                    if (toolCalls[0]?.function?.name === PlanTool.function.name) {
                      planReport(toolCalls[0]?.function?.arguments || '{}');
                    }
                  } catch {
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_PLAN_PARSE_REPORT_ERROR,
                    });
                  }
                  console.log(`promptTokens: ${promptTokens}, completionTokens: ${completionTokens}, cacheCreationInputTokens: ${cacheCreationInputTokens}, cacheReadInputTokens: ${cacheReadInputTokens}`);
                  if (attachs) {
                    const curAttachs = useChatAttach.getState().attachs as IMultiAttachment
                    const dataSource = (curAttachs?.dataSource || []).filter(i => [AttachType.CodeBase, AttachType.Docset].includes(i.attachType))
                    useChatAttach.getState().update({
                      dataSource: dataSource,
                      attachType: AttachType.MultiAttachment,
                    })
                  }
                  ControllerPool.remove(sessionId, messageIndex);
                  FeedbackPool.add(id);
                  const response: {
                    [propName: string]: boolean;
                  } = {};
                  const results: {
                    [propName: string]: {
                      path: string;
                      content: string;
                    };
                  } = {};
                  const allResponsed = false;
                  let isProcessing = toolCalls.length && !allResponsed ? true : false;
                  // 遍历 toolCalls，如果非常规 tool，在 mcp tool 中找一下是否有对应的，恢复一下
                  const MCPServers = useMCPStore
                    .getState()
                    .MCPServers.filter((server) => !server.disabled);
                  toolCalls.forEach((tool) => {
                    if (!toolCallNames.includes(tool.function.name)) {
                      for (const server of MCPServers) {
                        const targetTool = (server.tools || []).find((t) => t.name === tool.function.name);
                        if (targetTool) {
                          tool.function = {
                            name: 'use_mcp_tool',
                            arguments: JSON.stringify({
                              server_name: server.name,
                              tool_name: tool.function.name,
                              arguments: tool.function.arguments
                            })
                          }
                          return;
                        }
                        const targetResource = (server.resources || []).find((t) => t.name === tool.function.name);
                        if (targetResource) {
                          tool.function = {
                            name: 'access_mcp_resource',
                            arguments: JSON.stringify({
                              server_name: server.name,
                              tool_name: tool.function.name,
                              arguments: tool.function.arguments
                            })
                          }
                          return;
                        }
                      }
                    }
                  })



                  // 用于隐藏多余的assistant消息
                  if (toolCalls.find(toolCall => [
                    'use_mcp_tool',
                    'access_mcp_resource',
                    'edit_file',
                    'reapply',
                    'run_terminal_cmd',
                    'replace_in_file',
                    'edit',
                    'write',
                    'ask_user_question',
                    'make_plan',
                  ].includes(toolCall.function.name))) {
                    isProcessing = false;
                  }
                  set((state) => {
                    state.isStreaming = false;
                    state.isProcessing = isProcessing;
                    state.isApplying = toolCalls.some(toolCall => ['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(toolCall.function.name));
                  });
                  const curSessionId = chatStoreState.currentSessionId as string;
                  chatStoreState.updateCurrentSession((session) => {
                    if (session._id !== curSessionId) return
                    if (session.data?.messages) {
                      if (!cacheEnable || newTruncateStart >= 0) {
                        const lastMessage = session.data.messages[session.data.messages.length - 1]
                        if (lastMessage) {
                          lastMessage.reuseStart = false;
                        }
                      }
                      if (newTruncateStart >= 0) {
                        session.data.messages[newTruncateStart].truncateStart = true;
                      }
                    }

                    onMessageToolCallResponse(session, content, done, toolCalls, totalTokens, completionTokens);
                    let groupTokens = completionTokens || 0;
                    if (previousTokens && totalTokens - previousTokens > 0) {
                      groupTokens = totalTokens - previousTokens;
                    }
                    session.data?.messages.push({
                      ...get().message,
                      ...claude37Response,
                      id,
                      content,
                      tool_calls: toolCalls || [],
                      processing: isProcessing,
                      total_tokens: totalTokens,
                      group_tokens: groupTokens,
                      completion_tokens: completionTokens,
                      response: response,
                      tool_result: results,
                      usage: {
                        prompt_tokens: promptTokens || 0,
                        completion_tokens: completionTokens || 0,
                        total_tokens: totalTokens || 0,
                        cache_creation_input_tokens: cacheCreationInputTokens || 0,
                        cache_read_input_tokens: cacheReadInputTokens || 0
                      },
                      isOutdatedTokens: hasCompressionOccurredDuringRequest,
                    });
                    chatStoreState.updateConsumedTokens({
                      model: model,
                      curSession: session,
                      promptTokens: promptTokens || 0,
                      completionTokens: completionTokens || 0,
                      cacheCreationInputTokens: cacheCreationInputTokens || 0,
                      cacheReadInputTokens: cacheReadInputTokens || 0,
                      systemTokens: estimateSystemPromptTokens(data.messages),
                      skillTokens: estimateTokens(PromptLinkMgr.ins.skillPrompt),
                      ruleTokens: estimateTokens(PromptLinkMgr.ins.rulePrompt),
                      mcpTokens: estimateTokens(PromptLinkMgr.ins.mcpPrompt),
                    });
                    PromptLinkMgr.ins.reset();
                  });
                  if (MCPServers && MCPServers.length) {
                    let mcpServersUsed: string[] = [];
                    try {
                      mcpServersUsed = MCPServers.map((server) => server.name);
                    } catch {
                      mcpServersUsed = [];
                    }
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_MCP_SESSION_TOKEN_USED,
                      extends: {
                        totalTokens: promptTokens + completionTokens + cacheReadInputTokens + cacheCreationInputTokens,
                        model: data.model,
                        mcp_servers: mcpServersUsed
                      }
                    });
                  }
                  if (options.isMCPToolResponse) {
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_MCP_MESSAGE_TOKEN_USED,
                      extends: {
                        totalTokens: promptTokens + completionTokens + cacheReadInputTokens + cacheCreationInputTokens,
                        model: data.model,
                        mcp_server: options.mcpServerUsed
                      }
                    });
                  }
                  userReporter.report({
                    event: UserEvent.CODE_CHAT_TOKEN_USED,
                    extends: {
                      is_model_cache_enable: chatModels[chatConfig.model].hasTokenCache,
                      model: chatConfig.model,
                      fallback_to_slide_window: fallbackToSlideWindow,
                      cache_enable: cacheEnable,
                      chat_type: chatType,
                      response_from: responseId ? responseId.slice(0, 8) : '',
                      prompt_tokens: promptTokens || 0,
                      completion_tokens: completionTokens || 0,
                      total_tokens: totalTokens || 0,
                      cache_creation_input_tokens: cacheCreationInputTokens || 0,
                      cache_read_input_tokens: cacheReadInputTokens || 0,
                      cache_hit: cacheReadInputTokens > 0,
                      compression_enabled: compressConfig.enable && compressConfig.visible,
                    }
                  });
                  if (toolCalls.length) {
                    if (!allResponsed) {
                      // 分离 task 工具和非 task 工具
                      const taskToolCalls = toolCalls.filter(
                        (t) => t.function.name === 'task',
                      );
                      const nonTaskToolCalls = toolCalls.filter(
                        (t) => t.function.name !== 'task',
                      );
                      // task 工具：并行启动所有（不等待，各自完成后独立更新结果）
                      if (taskToolCalls.length > 0 && chatStoreState.currentSessionId) {
                        const parentSessionId = chatStoreState.currentSessionId;
                        const taskToolCallIds = taskToolCalls.map((t) => t.id);

                        // ✅ 启动 watchdog 定时器
                        taskCoordinator.startSessionWatchdog(
                          parentSessionId,
                          taskToolCallIds,
                        );

                        // ============ 阶段 1：原子注册所有 task ============
                        // 使用同步操作，确保所有 task 在任何执行开始前都已注册
                        taskToolCalls.forEach((taskTool) => {
                          let task_params: any = {};
                          try {
                            task_params = JSON.parse(
                              taskTool.function.arguments || '{}',
                            );
                          } catch (err) {
                            console.error(err);
                            task_params = {};
                          }

                          // ✅ 发射 TASK_REGISTERED 事件（同步）
                          emitTaskRegistered(
                            parentSessionId,
                            taskTool.id,
                            task_params.subagent_type || 'explore',
                            task_params.description,
                          );
                        });

                        // ============ 阶段 2：标记注册完成 ============
                        // 通知 TaskCoordinator 所有 task 已注册完成
                        taskCoordinator.markRegistrationComplete(
                          parentSessionId,
                          taskToolCallIds,
                        );

                        // ============ 阶段 3：异步执行所有 task ============
                        taskToolCalls.forEach((taskTool) => {
                          let task_params: any = {};
                          try {
                            task_params = JSON.parse(
                              taskTool.function.arguments || '{}',
                            );
                          } catch (err) {
                            console.error(err);
                            task_params = {};
                          }

                          // 异步执行子代理，完成后将结果注入主会话
                          (async () => {
                            try {
                              const { runSubagent } =
                                await import('../modules/subagent');
                              const parentController =
                                ControllerPool.controllers.get(
                                  ControllerPool.key(sessionId, messageIndex),
                                );
                              // 获取当前的 conversationRound（用于 OTEL 追踪，Y3 可能为空）
                              const round = (get() as any).conversationRound;

                              const taskResult = await runSubagent(
                                {
                                  description: task_params.description || '',
                                  prompt: task_params.prompt || '',
                                  subagent_type:
                                    task_params.subagent_type || 'explore',
                                },
                                {
                                  parentSessionId,
                                  parentAbortSignal: parentController?.signal,
                                  toolCallId: taskTool.id,
                                  round,
                                },
                              );

                              // ✅ 使用 await 等待锁保护的异步更新完成
                              await get().updateTaskToolResult({
                                toolCallId: taskTool.id,
                                taskResult,
                                sessionId: parentSessionId,
                              });
                            } catch (err) {
                              const errorMsg =
                                err instanceof Error ? err.message : String(err);

                              // ✅ 错误恢复：将错误信息作为 tool result 注入主会话
                              try {
                                get().updateToolCallResults({
                                  [taskTool.id]: {
                                    path: '',
                                    content: `Subagent execution failed: ${errorMsg}`,
                                    isError: true,
                                  },
                                });
                              } catch (updateErr) {
                                console.error(
                                  `[Debug][subagent] CRITICAL: Failed to update error tool_result for ${taskTool.id}:`,
                                  updateErr,
                                );
                              }
                            }
                          })().catch((err) => {
                            // ========== 最外层兜底：捕获所有未处理的 Promise rejection ==========
                            console.error(
                              `[Debug][subagent] CRITICAL: Unhandled promise rejection in task tool ${taskTool.id}:`,
                              err,
                            );

                            try {
                              get().updateToolCallResults({
                                [taskTool.id]: {
                                  path: '',
                                  content: `Critical error: ${err instanceof Error ? err.message : String(err)}`,
                                  isError: true,
                                },
                              });
                            } catch (finalErr) {
                              console.error(
                                `[Debug][subagent] FATAL: Cannot update tool_result even in final catch for ${taskTool.id}:`,
                                finalErr,
                              );
                            }
                          });
                        });
                      }

                      // 非 task 工具：处理全部工具
                      // 混合场景（task + 其他工具）下不能只取第一个，
                      // 否则其余工具的 postMessage 永远不发出，tool_result 凑不够，
                      // 导致 onUserSubmit 永远不被触发，UI 卡在 loading 状态
                      for (const tool of nonTaskToolCalls) {
                        if (!response[tool.id]) {
                          let tool_params: any = {};
                          if (tool.function.arguments) {
                            try {
                              tool_params = JSON.parse(tool.function.arguments);
                            } catch (err) {
                              console.error(err);
                              tool_params = {};
                            }
                          }
                          if (tool.function.name === 'use_mcp_tool' || tool.function.name === 'access_mcp_resource') {
                            let params: any = {};
                            try {
                              params = JSON.parse(tool.function.arguments || '{}');
                            } catch (err) {
                              console.error('解析MCP参数失败', err)
                              params = {};
                            }
                            let autoApprove = false;
                            if (params && params.server_name && params.tool_name) {
                              // Normalize server name for lookup (handles path-based names)
                              const normalizedParamsServer = (params.server_name || '')
                                .replace(/\\/g, '/')
                                .split('/')
                                .slice(-1)[0];
                              const targetServer = MCPServers.find(
                                (server) => {
                                  if (server.name === params.server_name) return true;
                                  const sNorm = (server.name || '').replace(/\\/g, '/').split('/').slice(-1)[0];
                                  return sNorm === normalizedParamsServer;
                                },
                              );
                              if (targetServer && targetServer.tools) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else {
                                  const targetTool = targetServer.tools.find(tool => tool.name === params.tool_name)
                                  if (targetTool && targetTool.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              } else if (targetServer) {
                                // Server found but tools not yet loaded — check server-level autoApprove
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                }
                              } else {
                                const toolName = params?.tool_name?.toLowerCase?.()
                                for (const server of MCPServers) {
                                  const targetTool = (server?.tools || []).find(tool => tool?.name?.toLowerCase?.() === toolName)
                                  if (targetTool) {
                                    // Check both tool-level and server-level autoApprove
                                    if (targetTool?.autoApprove || server.autoApprove) {
                                      autoApprove = true;
                                    }
                                    params.server_name = server.name
                                    tool.function.arguments = JSON.stringify(params)
                                    break
                                  }
                                }
                              }
                            } else if (params && params.server_name && params.uri) {
                              // Normalize server name for lookup
                              const normalizedParamsServerForUri = (params.server_name || '')
                                .replace(/\\/g, '/')
                                .split('/')
                                .slice(-1)[0];
                              const targetServer = MCPServers.find(
                                (server) => {
                                  if (server.name === params.server_name) return true;
                                  const sNorm = (server.name || '').replace(/\\/g, '/').split('/').slice(-1)[0];
                                  return sNorm === normalizedParamsServerForUri;
                                },
                              );
                              if (targetServer && targetServer.resources) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else {
                                  const targetResource = targetServer.resources.find(resource => resource.uri === params.uri)
                                  if (targetResource && targetResource.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              } else if (targetServer) {
                                // Server found but resources not yet loaded
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                }
                              } else {
                                const uri = params?.uri?.toLowerCase?.()
                                for (const server of MCPServers) {
                                  const targetResource = (server?.resources || []).find(resource => resource?.uri?.toLowerCase?.() === uri)
                                  if (targetResource) {
                                    // Check both resource-level and server-level autoApprove
                                    if (targetResource?.autoApprove || server.autoApprove) {
                                      autoApprove = true;
                                    }
                                    params.server_name = server.name
                                    tool.function.arguments = JSON.stringify(params)
                                    break
                                  }
                                }
                              }
                            }
                            if (autoApprove) {
                              useChatStreamStore.getState().setIsMCPProcessing(true);
                              window.parent.postMessage(
                                {
                                  type: BroadcastActions.TOOL_CALL,
                                  data: {
                                    tool_name: tool.function.name,
                                    tool_params: params,
                                    tool_id: tool.id,
                                  },
                                },
                                '*',
                              );
                            } else {
                              // autoApprove 当前为 false，可能是 SYNC_MCP_SERVERS 还未到达
                              // 订阅 MCPStore 变化，一旦 autoApprove 变为 true 立即补发 TOOL_CALL
                              const capturedToolId = tool.id;
                              const capturedToolName = tool.function.name;
                              const capturedParams = { ...params };
                              const capturedSessionId = sessionId;

                              let dispatched = false;
                              let unsubscribeMCPWatch: (() => void) | undefined;

                              const cleanupMCPWatch = () => {
                                if (unsubscribeMCPWatch) {
                                  unsubscribeMCPWatch();
                                  unsubscribeMCPWatch = undefined;
                                }
                              };

                              const watchTimeoutId = setTimeout(cleanupMCPWatch, 3000);

                              // 检查函数：按 server_name 归一化名称在 MCPServers 里查找 autoApprove
                              const checkAndDispatch = (mcpServers: typeof MCPServers) => {
                                if (dispatched) return;
                                const targetNorm = (capturedParams.server_name || '')
                                  .replace(/\\/g, '/')
                                  .split('/')
                                  .slice(-1)[0];
                                const foundServer = mcpServers.find((server) => {
                                  const sNorm = (server.name || '')
                                    .replace(/\\/g, '/')
                                    .split('/')
                                    .slice(-1)[0];
                                  return sNorm === targetNorm;
                                });
                                const autoApproveNow =
                                  foundServer?.config?.autoApprove === true ||
                                  foundServer?.autoApprove === true;
                                if (autoApproveNow) {
                                  dispatched = true;
                                  clearTimeout(watchTimeoutId);
                                  cleanupMCPWatch();
                                  // 用户点击 checkbox 已直接派发过 TOOL_CALL，跳过重复派发
                                  if (useChatStreamStore.getState().isMCPProcessing) {
                                    return;
                                  }
                                  useChatStreamStore.getState().setIsMCPProcessing(true);
                                  window.parent.postMessage(
                                    {
                                      type: BroadcastActions.TOOL_CALL,
                                      data: {
                                        tool_name: capturedToolName,
                                        tool_params: capturedParams,
                                        tool_id: capturedToolId,
                                      },
                                    },
                                    '*',
                                  );
                                }
                              };

                              // 立即用当前 store 检查一次——应对「autoApprove 已是 true 但 store 不会再变」的场景
                              checkAndDispatch(useMCPStore.getState().MCPServers);

                              unsubscribeMCPWatch = useMCPStore.subscribe((state) => {
                                if (dispatched) return;
                                // 会话已切走则放弃，避免在错误的会话上触发
                                if (useChatStore.getState().currentSessionId !== capturedSessionId) {
                                  clearTimeout(watchTimeoutId);
                                  cleanupMCPWatch();
                                  return;
                                }
                                checkAndDispatch(state.MCPServers);
                              });
                            }
                          } else if (tool.function.name === 'retrieve_code') {
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params: {
                                    question: tool_params.search_query,
                                    collection: parseAtMentionedCodeBaseByAttach(),
                                  },
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          } else if (
                            tool.function.name === 'retrieve_knowledge'
                          ) {
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params: {
                                    // messages: data.messages,
                                    messages: [
                                      {
                                        role: 'user',
                                        content: tool_params.search_query,
                                      },
                                    ],
                                    input: tool_params.search_query,
                                    docset: tool_params.docset_id,
                                    model: data.model,
                                  },
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          } else if (tool.function.name === 'read_file') {
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params,
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          } else if (tool.function.name === terminalCmdFunction) {
                            if (useChatConfig.getState().autoExecute &&
                              isCommandSafe(useConfigStore.getState().config.codeBaseCheckCommands, tool_params.command)
                            ) {
                              useChatStreamStore.getState().setIsTerminalProcessing(true)
                              window.parent.postMessage(
                                {
                                  type: BroadcastActions.TOOL_CALL,
                                  data: {
                                    tool_name: tool.function.name,
                                    tool_params: {
                                      ...tool_params,
                                      messageId: id,
                                      is_approve: true,
                                    },
                                    tool_id: tool.id,
                                  },
                                },
                                '*',
                              )
                            }
                          } else if (tool.function.name === 'ask_user_question') {
                            // ask_user_question 工具在 WebView 中本地处理，不发送 TOOL_CALL 到 IDE
                            // 用户在界面上交互后，通过 AskUserQuestion 组件提交结果
                            console.log('[Debug] ask_user_question tool intercepted (codebase), waiting for user response');
                          } else {
                            if (['edit_file', 'reapply', 'replace_in_file', 'edit', 'write'].includes(tool.function.name)) {
                              const filePath = tool_params.target_file;
                              const updateSnippet = tool_params.code_edit;
                              const replaceSnippet = tool_params.diff;
                              const isCreateFile = tool_params.is_create_file;
                              useChatApplyStore.getState().setChatApplyItem(tool.id, {
                                filePath,
                                originalContent: '',
                                updateSnippet,
                                replaceSnippet,
                                type: tool.function.name,
                                toolCallId: tool.id,
                                applying: true,
                                accepted: false,
                                isCreateFile
                              })
                              userReporter.report({
                                event: getReportEventByToolName({ toolName: tool.function.name, status: 0 }),
                                extends: {
                                  model,
                                  tool_params: tool_params,
                                  tool_id: tool.id,
                                  tool_name: tool.function.name
                                },
                              })
                            }
                            window.parent.postMessage(
                              {
                                type: BroadcastActions.TOOL_CALL,
                                data: {
                                  tool_name: tool.function.name,
                                  tool_params,
                                  tool_id: tool.id,
                                },
                              },
                              '*',
                            );
                          }
                        }
                      }
                    } else {
                      get().onUserSubmit(
                        '',
                        {
                          event: UserEvent.CODE_CHAT_CODEBASE,
                        },
                        undefined,
                        response,
                      );
                    }
                  } else {
                    get().resetMessage();
                    window.parent.postMessage({
                      type: 'WEBVIEW_ACK',
                      data: {
                        event: 'content_completed',
                        payload: { ...session.data, id: session._id },
                      },
                    }, '*');
                  }
                  if (
                    !currentSessionModel ||
                    currentSessionModel !== chatConfig.model
                  ) {
                    // 本次会话没有模型类型或者模型更改了，重新设置模型类型
                    chatStoreState.updateModel(chatConfig.model);
                  }
                  useChatStore.getState().generateAndUpdateSessionTopic();
                  chatStoreState.syncHistory();


                  if (hasCompressionOccurredDuringRequest) {
                    console.log('请求期间已发生压缩，跳过压缩检测。请求前摘要数:', compressionSummaryCountAtRequest, '当前摘要数:', compressionSummaryCountNow);
                  } else {
                    // usage 有效，可以进行压缩检测
                    void getCompressSessionStatus(sessionId).then(status => {
                      chatStoreState.analyzeContext(sessionId).then(compressionAnalysis => {
                        if (compressionAnalysis.shouldCompress
                          && status !== SessionStatus.COMPRESSING
                          && !chatModels[chatConfig.model].isPrivate
                          && status !== SessionStatus.FAILED) {
                          console.log('模型返回后触发自动压缩，token使用率:', compressionAnalysis.thresholds);
                          void chatStoreState.triggerCompression(sessionId);
                        }
                      })
                    })

                  }
                } else {
                  set((state) => {
                    if (state.message) {
                      if (toolCalls && toolCalls.length) {
                        try {
                          const now = Date.now();
                          if (now - throttleTime > 100) {
                            throttleTime = now;
                            for (const toolCall of toolCalls) {
                              if (['edit_file', 'replace_in_file', 'reapply'].includes(toolCall.function.name)) {
                                const argumentStr = toolCall.function?.arguments || '';
                                state.message.codeContent = argumentStr;
                                for (let i = toolcallParsedIndex; i < argumentStr.length; i++) {
                                  parsedArgumentStr += argumentStr[i];
                                  toolcallParsedIndex++;
                                  if (parsedArgumentStr.endsWith('"target_file": "')) {
                                    inTargetFile = true;
                                  } else if (inTargetFile) {
                                    parsedTargetFile += argumentStr[i];
                                    if (parsedArgumentStr.endsWith('", "is_create_file"')) {
                                      inTargetFile = false;
                                      inIsCreateFile = true;
                                      parsedTargetFile = parsedTargetFile.slice(0, -19);
                                    } else if (parsedArgumentStr.endsWith(', "code_edit": "')) {
                                      inTargetFile = false;
                                      inCodeEdit = true;
                                      parsedTargetFile = parsedTargetFile.slice(0, -15);
                                    } else if (parsedArgumentStr.endsWith(', "diff": "')) {
                                      inTargetFile = false;
                                      inDiff = true;
                                      parsedTargetFile = parsedTargetFile.slice(0, -10);
                                    }
                                  } else if (inIsCreateFile) {
                                    if (parsedArgumentStr.endsWith(', "code_edit": "')) {
                                      inIsCreateFile = false;
                                      inCodeEdit = true;
                                    } else if (parsedArgumentStr.endsWith(', "diff": "')) {
                                      inIsCreateFile = false;
                                      inDiff = true;
                                    }
                                  } else if (inCodeEdit) {
                                    parsedCodeEdit += argumentStr[i];
                                  } else if (inDiff) {
                                    parsedDiff += argumentStr[i];
                                  }
                                }
                                // console.log(argumentStr)
                                let codeContent = '';
                                if (parsedTargetFile && parsedCodeEdit) {
                                  // const language = filePath.split('.').slice(-1)[0];
                                  codeContent = `\n\n\`\`\`\n${parsedCodeEdit.replace(/\\n/g, '\n')}\n\`\`\``;
                                }
                                if (parsedTargetFile && parsedDiff) {
                                  // const language = filePath.split('.').slice(-1)[0];
                                  codeContent = `\n\n\`\`\`\n${parsedDiff.replace(/\\n/g, '\n')}\n\`\`\``;
                                }
                                state.message.codeContent = codeContent;
                              }
                            }
                          }
                        } catch (err) {
                          state.message.content = content;
                          console.error(err);
                        }
                      }
                      state.message.content = content;
                      state.message.reasoningContent = claude37Response.reasoning_content;
                    } else {
                      console.error(
                        'create bot message before set message content!',
                      );
                    }
                    state.loadingMessage = '';
                  });
                }
              },
              async onError(error) {
                console.dir(error);
                userReporter.report({
                  event: UserEvent.REPLY_EXCEPTION,
                  extends: {
                    model,
                    session_id: session._id,
                    messages: data.messages,
                    error_message: error.message,
                    ntesTraceId: ntesTraceId,
                    chatType: 'codebase',

                  },
                });
                webToolsHub.withScope((scope) => {
                  scope.setExtras({
                    event: UserEvent.REPLY_EXCEPTION,
                    model,
                    session_id: session._id,
                    // messages: data.messages, 数据太大了
                    error_message: error.message,
                    ntesTraceId: ntesTraceId,
                    mark: 6,
                    chatType: 'codebase',
                  });
                  webToolsLogger.captureException(error);
                });
                let outputContent = get().message.content;
                if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                  get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                  return
                }
                if (error.name !== ABORT_ERROR_NAME) {
                  // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
                  const isCloseCodeBackticks = checkCodeBlockIsClose(
                    outputContent as string,
                  );
                  if (!isCloseCodeBackticks) {
                    outputContent += `\n${CODE_BACKTICKS}`;
                  }
                  if (error.message === StreamError.AuthTokenIsExpired) {
                    window.parent.postMessage(
                      {
                        type: BroadcastActions.GET_INIT_DATA,
                        data: {
                          isExpired: true,
                        },
                      },
                      '*',
                    );
                  }
                  let shouldRetry = false;
                  const errorString = handleStreamError(error, (errorType) => {
                    if (errorType === 'ContextTooLong') {
                      shouldRetry = true;
                    }
                  });
                  if (shouldRetry) {
                    const suffix = '_retry';
                    chatStoreState.updateCurrentSession((session) => {
                      session.data?.messages.push({
                        ...DEFAULT_ASSISTANT_MESSAGE,
                        id: id + suffix,
                        content: '',
                        group_tokens: 8,
                        isAutoCompressingMessage: true
                      })
                    });
                    const compressionSuccess = await chatStoreState.triggerCompression(sessionId);
                    if (compressionSuccess) {
                      chatStoreState.updateCurrentSession((session) => {
                        if (session.data?.messages) {
                          const compressingMsgIndex = session.data.messages.findIndex(msg => msg.id === id + suffix);
                          if (compressingMsgIndex !== -1) {
                            session.data.messages.splice(compressingMsgIndex, 1);
                          }
                        }
                      });
                      ControllerPool.remove(sessionId, messageIndex);
                      chatStoreState.syncHistory();
                      get().reset();
                      get().onUserResubmit();
                      return;
                    }
                    outputContent += errorString;
                    chatStoreState.updateCurrentSession((session) => {
                      if (session.data?.messages) {
                        const lastMsg = session.data.messages[session.data.messages.length - 1];
                        if (lastMsg && lastMsg.id === id + suffix) {
                          lastMsg.content = outputContent;
                        }
                      }
                    });
                  } else {
                    outputContent += errorString;
                    chatStoreState.updateCurrentSession((session) => {
                      session.data?.messages.push({
                        ...DEFAULT_ASSISTANT_MESSAGE,
                        id,
                        content: outputContent,
                        group_tokens: 8,
                      })
                    });
                  }
                  ControllerPool.remove(sessionId, messageIndex);
                }
                chatStoreState.syncHistory();
                get().reset();
              },
              onController(abortController) {
                ControllerPool.addController(
                  sessionId,
                  messageIndex,
                  abortController,
                );
              },
              ntesTraceId: ntesTraceId,
              setError: (type) => {
                chatStoreState.setError(type)
              }
            },
          );
        }
        userReporter.report({
          event: UserEvent.CODE_CHAT_START_CODEBASE_STREAM,
          extends: {
            content: content,
            model: chatConfig.model,
            codeTable: workspaceInfo.repoCodeTable,
            repoUrl: workspaceInfo.repoUrl,
            workspace: workspaceInfo.workspace,
            messages: data.messages,
            ntesTraceId: ntesTraceId,
          },
        });
        if (session.data?.enablePlanMode) {
          userReporter.report({
            event: UserEvent.CODE_CHAT_PLAN_MODE_MESSAGE
          });
        }
        return;
      }

      userReporter.report({
        event: UserEvent.CODE_CHAT_START_STREAM,
        extends: {
          content: content,
          mask_id: mask?._id,
          mask_name: mask?.name,
          mask_content: mask?.prompt,
          mask_type: mask?.type,
          model: chatConfig.model,
        },
      });

      const config = useConfigStore.getState().config;
      const len = session.data.messages.length;
      // 取最近的 {config.historyMessageCount} 条对话
      const sendMessages = session.data.messages.slice(
        Math.max(len - config.historyMessageCount - 1, 0),
      );
      // 修复上下文消息丢失导致Claude3.5无法请求
      let messages: ChatMessage[] = [];
      for (let i = 0; i < sendMessages.length; i++) {
        const message = cloneDeep(sendMessages[i]);
        delete message?._originalRequestData;
        if (
          message.role === ChatRole.User &&
          !(message.content?.[0] as { text: string })?.text
        ) {
          message.content = [{ type: ChatMessageContent.Text, text: '-' }];
        }

        const modelConfig = chatModels[model];
        const supplyChannel = modelConfig?.supplyChannel?.toLocaleLowerCase?.() || '';
        const isCludeThinking = modelConfig?.hasThinking && getAIGWModel(model)?.toLocaleLowerCase?.()?.includes?.('claude');
        const isDeepSeek = supplyChannel === ChatModelSupplyChannel.DEEPSEEK
          || model?.toLocaleLowerCase?.()?.includes?.('deepseek');
        // 处理 claude37Sonnet的字段兼容问题
        if (isCludeThinking && message.role === ChatRole.Assistant) {
          message.redacted_thinking = message.redacted_thinking || '';
          message.thinking_signature = message.thinking_signature || '-';
          message.reasoning_content = message.reasoning_content || '';
        } else if ([ChatModel.Gemini3Pro].includes(model)) {
          if (!message.thinking_signature) {
            delete message.redacted_thinking;
            delete message.thinking_signature;
            delete message.reasoning_content;
          }
        } else if (isDeepSeek && message.role === ChatRole.Assistant) {
          // DeepSeek V4 Pro 等模型要求 reasoning_content 必须回传，否则返回 400
          // 保留 reasoning_content，清除 Claude 特有字段
          delete message.redacted_thinking;
          delete message.thinking_signature;
          message.reasoning_content = message.reasoning_content || '';
        } else {
          delete message.redacted_thinking;
          delete message.thinking_signature;
          delete message.reasoning_content;
        }
        messages.push(message);
        const nextMessage = sendMessages[i + 1];
        if (!nextMessage) break;
        if (
          nextMessage.role === ChatRole.Assistant &&
          message.role === ChatRole.Assistant
        ) {
          messages.push({
            id: nanoid(),
            role: ChatRole.User,
            content: [{ type: ChatMessageContent.Text, text: '-' }],
          });
        } else if (
          nextMessage.role === ChatRole.User &&
          message.role === ChatRole.User
        ) {
          const newMessage: ChatMessage = {
            id: nanoid(),
            role: ChatRole.Assistant,
            content: '-',
          }
          if (isCludeThinking) {
            message.redacted_thinking = '';
            message.thinking_signature = '-';
            message.reasoning_content = '';
          } else {
            // 为其他模型初始化 reasoning_content 字段
            message.reasoning_content = message.reasoning_content || '';
          }
          messages.push(newMessage);
        }
      }
      if (model === BAI_CHUAN) {
        useChatConfig.getState().update((config) => {
          config.model = ChatModel.QWen;
        });
      }
      const convertPrompt = await useMaskStore
        .getState()
        .convertToPrompt(content);
      const maskContent = assembleUserPromptContent(convertPrompt);

      const maskPrompt: ChatMessage = {
        id: mask?._id,
        role: ChatRole.User,
        content: maskContent,
      };

      // 编程模式的情况下，不需要带上额外的 prompt，由后端处理
      if (!isProgrammingMode) {
        /**
         * 针对 Claude3 的规则:
         * 1. messages 必须要以 role 为 user 作为起始的消息
         * 2. messages 格式必须是 user-assistant-user-assistant-... 的格式
         * 3. message 中的内容不能为空，也不能全为空格（whitespace）
         * 4. 不能穿插其他类型，相邻两条 message 的 role 不能相同
         */
        if (
          model === ChatModel.DeepseekReasoner0120 ||
          model === ChatModel.DeepseekReasonerDistilled0206 ||
          model?.toLocaleLowerCase?.()?.includes?.('claude')
        ) {
          if (messages[0].role !== ChatRole.Assistant) {
            messages.unshift({
              ...DEFAULT_ASSISTANT_MESSAGE,
              content: '-',
            });
          }
        }
        messages.unshift(maskPrompt);
      }
      let originContent = '';
      if (attachs?.attachType === AttachType.CodeBase) {
        const currentMessageIndex = messages.length - 1;
        const content = getContentString(messages[currentMessageIndex].content);
        originContent = content;
        messages[currentMessageIndex].content =
          `${content}\n\n${searchCodeBase}`;
      }

      const currentAttach = userMessage?.attachs?.[0] as MultipleAttach
      if (currentAttach?.type === ChatMessageAttachType.MultiAttachment) {
        const currentMessageIndex = messages.length - 1;
        const currentContent = getContentString(
          messages[currentMessageIndex].content,
        );
        originContent = currentContent;
        messages[currentMessageIndex].content = await parseMentions(originContent, currentAttach.attachs)
      }
      // 替换需要发送给模型的 prompt
      if (chatPromptStoreState.prompt) {
        const currentMessageIndex = messages.length - 1;
        messages[currentMessageIndex].content = reassembleContentWithImages(
          messages[currentMessageIndex].content,
          content,
        );
        chatPromptStoreState.reset();
      }
      if (chatModels[chatConfig.model]?.peerUserContent) {
        messages = messages.map((message) => {
          if (Array.isArray(message.content)) {
            message.content = message.content
              .filter((m) => m.type === ChatMessageContent.Text)
              .map((m) => (m as ChatMessageContentText).text)
              .join('');
          }
          return message;
        });
      }


      const metaId = prompApp?.runner?.meta?._id || '';
      if (['66cf10e1f16cb1260db58a08'].includes(metaId)) {
        handlePromptUpdate(ER_PROMPT);
      } else if (['66cf0a830fe8cbf0be33b162'].includes(metaId)) {
        handlePromptUpdate(CLASS_PROMPT);
      } else if (['66d0704b0fe8cbf0be33b170'].includes(metaId)) {
        handlePromptUpdate(CFG_PROMPT);
      } else if (['66e00c47f16cb1260db58a95'].includes(metaId)) {
        handlePromptUpdate(SEQUENCE_PROMPT);
      } else if (['66cd9986f16cb1260db589ec'].includes(metaId)) {
        handlePromptUpdate(MINDMAP_PROMPT);
      }

      const data: ChatPromptBody = {
        ...chatConfig,
        model: getAIGWModel(chatConfig.model),
        backend: GptBackendService.Azure,
        messages,
        max_tokens: calculateTokens(chatConfig.max_tokens)
      };

      if (isProgrammingMode) {
        // TODO: 编程模式下携带的参数，后续可以根据后端的需要传参
        const currentMaskCode = DEFAULT_MASKS.find(
          (i) => i._id === mask?._id,
        )?.code;
        data.prompt_construct = {
          mode: 'default',
          params: {},
        };
        if (currentMaskCode !== '') {
          data.prompt_construct.params = {
            tpl_code: currentMaskCode,
          };
        }
      }

      const runner = usePluginApp.getState().runner;

      if (runner) {
        const editorFileState = useEditorFileState.getState().state;
        if (runner?.app_shortcut.action === PluginAction.Chat) {
          get().reset();
          set(() => ({ isStreaming: true }));
          const attach = useChatAttach.getState().attachs;
          const reference: PluginAppRunnerParams['reference'] = {};
          if (attach?.attachType === AttachType.File) {
            const _attach = attach as AttachFile;
            reference.files = _attach.attachFiles.map((file) => ({
              path: file.path,
              content: file.content,
              file_name: file.fileName,
            }));
            // reference.files = [
            //   {
            //     path: _attach.path,
            //     content: _attach.content,
            //     file_name: _attach.fileName,
            //   },
            // ];
          }
          const runnerExtends = usePluginApp.getState().runnerExtends;
          const data: PluginAppRunnerParams = {
            task_id: runner._id,
            app_id: runner.app_id,
            url: runner.url,
            action: {
              name: runner.app_shortcut.action,
              // 待补充 params
              params: {},
            },
            app_settings: runner.app_settings,
            description: content,
            shortcut: {
              action: runner.app_shortcut.action,
              name: runner.app_shortcut.name,
            },
            extends: {
              session_id: session._id,
              message_id: id,
              ...runnerExtends,
            },
            reference,
            messages: [
              {
                id: userMessage.id,
                role: userMessage.role,
                content: userMessage.content,
              },
            ],
            ...editorFileState,
          };
          requestPluginStream(data, {
            onMessage: (message: string, done: boolean) => {
              if (done) {
                ControllerPool.remove(sessionId, messageIndex);
                FeedbackPool.add(id);
                set((state) => {
                  state.isStreaming = false;
                });
                if (
                  attachs &&
                  (attachs?.attachType === AttachType.CodeBase ||
                    attachs?.attachType === AttachType.File)
                ) {
                  chatStoreState.updateCurrentSession((session) => {
                    session.data?.messages.push({ ...get().message, id });
                    // 更新 user
                    const userSession = session.data?.messages.find(
                      (i) => i.id === id && i.role === ChatRole.User,
                    );
                    if (userSession) {
                      userSession.content = originContent;
                      originContent = '';
                    }
                  });
                } else {
                  chatStoreState.updateCurrentSession((session) =>
                    session.data?.messages.push({
                      ...get().message,
                      id,
                    }),
                  );
                }
                useChatStore.getState().generateAndUpdateSessionTopic();
                chatStoreState.syncHistory();
              } else {
                set((state) => {
                  if (state.message) {
                    state.message.content = message;
                  } else {
                    console.error(
                      'create bot message before set message content!',
                    );
                  }
                  state.loadingMessage = '';
                });
              }
            },
            onError: (error) => {
              console.log(error);
              userReporter.report({
                event: UserEvent.REPLY_EXCEPTION,
                extends: {
                  model,
                  session_id: session._id,
                  messages: data.messages,
                  error_message: error.message,
                },
              });
              webToolsHub.withScope((scope) => {
                scope.setExtras({
                  event: UserEvent.REPLY_EXCEPTION,
                  model,
                  session_id: session._id,
                  // messages: data.messages, 数据太大了
                  error_message: error.message,
                  mark: 7,
                });
                webToolsLogger.captureException(error);
              });
              const outputContent = get().message.content;
              if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
                get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
                return
              }
              chatStoreState.updateCurrentSession((session) =>
                session.data?.messages.push({
                  ...DEFAULT_ASSISTANT_MESSAGE,
                  id,
                  content: outputContent,
                }),
              );
              ControllerPool.remove(sessionId, messageIndex);
              chatStoreState.syncHistory();
              get().reset();
            },
            onController: (abortController) => {
              ControllerPool.addController(
                sessionId,
                messageIndex,
                abortController,
              );
            },
          });
        } else {
          get().onPluginAppSubmit(messages);
        }

        return;
      }
      const chatRequestUrl = isProgrammingMode
        ? '/proxy/gpt/gpt/code_chat_stream'
        : '/proxy/gpt/gpt/text_chat_stream';
      // 重置
      get().reset();
      set(() => ({ isStreaming: true }));

      // 如果用户填了 apikey，则使用用户指定的 apiKey
      if (codeChatApiKey) {
        data.app_key = codeChatApiKey;
      }
      // if (codeChatApiBaseUrl) {
      //   data.base_url = codeChatApiBaseUrl;
      // }

      // 临时补丁，避免content为空导致异常
      for (const message of messages) {
        if (message.content === '') {
          message.content = '-';
        }
      }
      // deepseekreasoner 这个模型会有一部分推理的内容展示，先特殊处理一下，后续得整体优化
      if (
        [
          ChatModelSupplyChannel.DEEPSEEK,
          ChatModelSupplyChannel.QWEN,
        ]
          .includes(getModelSupplyChannel(chatConfig.model))
      ) {
        // 待优化，Qwen需要支持Thkinking配置
        if (chatConfig.model === ChatModel.QWen3Thinking) {
          data.model = ChatModel.QWen3;
          const budgetToken = Math.max(
            (data?.max_tokens || CHAT_MIN_TOKENS) / 2,
            1024,
          );
          data.extra_body = {
            enable_thinking: true,
            thinking_budget: budgetToken,
          };
        }
        requestDeepseekReasonerChatStream(options.event, data, chatRequestUrl, {
          onMessage(content, done, reasoningText, jsonData) {
            get().setStreamRetryCount(0)
            if (chatStoreState.isError) {
              chatStoreState.setError(false);
            }
            if (done) {
              ControllerPool.remove(sessionId, messageIndex);
              FeedbackPool.add(id);
              set((state) => {
                state.isStreaming = false;
                // 如果模型回答是空的，那么就往模型里面塞一条信息确保下次回答的时候不会报错
                if (content === '') {
                  state.message.content = '-';
                }
              });
              chatStoreState.updateCurrentSession((session) => {
                session.data?.messages.push({
                  ...get().message,
                  id,
                  content,
                  reasoning_content: reasoningText,
                });
              });
              if (
                attachs &&
                (attachs?.attachType === AttachType.CodeBase ||
                  attachs?.attachType === AttachType.File)
              ) {
                chatStoreState.updateCurrentSession((session) => {
                  // 更新 user
                  const userSession = session.data?.messages.find(
                    (i) => i.id === id && i.role === ChatRole.User,
                  );
                  if (userSession) {
                    userSession.content = originContent;
                    originContent = '';
                  }
                });
              }
              if (
                !currentSessionModel ||
                currentSessionModel !== chatConfig.model
              ) {
                // 本次会话没有模型类型或者模型更改了，重新设置模型类型
                chatStoreState.updateModel(chatConfig.model);
              }

              chatStoreState.generateAndUpdateSessionTopic();
              chatStoreState.updateConsumedTokens({
                model: model,
                curSession: session,
                promptTokens: jsonData?.usage?.prompt_tokens || 0,
                completionTokens: jsonData?.usage?.completion_tokens || 0,
                cacheCreationInputTokens: jsonData?.usage?.cache_creation_input_tokens || 0,
                cacheReadInputTokens: jsonData?.usage?.cache_read_input_tokens || 0
              });
              chatStoreState.syncHistory();
            } else {
              set((state) => {
                if (state.message) {
                  state.message.content = content;
                  state.message.reasoningContent = reasoningText;
                } else {
                  console.error(
                    'create bot message before set message content!',
                  );
                }
                state.loadingMessage = '';
              });
            }
          },
          onError(error) {
            console.dir(error);
            userReporter.report({
              event: UserEvent.REPLY_EXCEPTION,
              extends: {
                model,
                session_id: session._id,
                messages: data.messages,
                error_message: error.message,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.REPLY_EXCEPTION,
                model,
                session_id: session._id,
                // messages: data.messages, 数据太大了
                error_message: error.message,
                mark: 8,
              });
              webToolsLogger.captureException(error);
            });
            let outputContent = get().message.content;
            if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
              get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
              return
            }
            // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
            // error.name 为 AbortError 表示该错误是 abort 触发的
            if (error.name !== ABORT_ERROR_NAME) {
              // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
              const isCloseCodeBackticks = checkCodeBlockIsClose(
                outputContent as string,
              );
              if (!isCloseCodeBackticks) {
                outputContent += `\n${CODE_BACKTICKS}`;
              }
              if (error.message === StreamError.AuthTokenIsExpired) {
                window.parent.postMessage(
                  {
                    type: BroadcastActions.GET_INIT_DATA,
                    data: {
                      isExpired: true,
                    },
                  },
                  '*',
                );
              }
              outputContent += handleStreamError(error);
              chatStoreState.updateCurrentSession((session) =>
                session.data?.messages.push({
                  ...DEFAULT_ASSISTANT_MESSAGE,
                  id,
                  content: outputContent,
                  group_tokens: 8,
                }),
              );
              ControllerPool.remove(sessionId, messageIndex);
              chatStoreState.syncHistory();
              get().reset();
            }
          },
          onController: (abortController) => {
            ControllerPool.addController(
              sessionId,
              messageIndex,
              abortController,
            );
          },
          setError: (type) => {
            chatStoreState.setError(type);
          },
        });
        return;
      }

      if (getAIGWModel(chatConfig.model)?.toLocaleLowerCase?.().includes?.('claude')) {
        if (chatModels[chatConfig.model]?.hasThinking) {
          const budgetToken = Math.max(
            (data?.max_tokens || CHAT_MIN_TOKENS) / 2,
            1024,
          );
          data.extra_body = {
            thinking: {
              type: 'enabled',
              budget_tokens: budgetToken,
            },
          };
        }

        requestClaude37ChatStream(options.event, data, chatRequestUrl, {
          onMessage(content, done, claude37Response, jsonData) {
            get().setStreamRetryCount(0)
            if (chatStoreState.isError) {
              chatStoreState.setError(false);
            }
            if (done) {
              ControllerPool.remove(sessionId, messageIndex);
              FeedbackPool.add(id);
              set((state) => {
                state.isStreaming = false;
                // 如果模型回答是空的，那么就往模型里面塞一条信息确保下次回答的时候不会报错
                if (content === '') {
                  state.message.content = '-';
                }
              });
              chatStoreState.updateCurrentSession((session) => {
                session.data?.messages.push({
                  ...get().message,
                  id,
                  content,
                  ...claude37Response,
                });
              });
              if (
                attachs &&
                (attachs?.attachType === AttachType.CodeBase ||
                  attachs?.attachType === AttachType.File)
              ) {
                chatStoreState.updateCurrentSession((session) => {
                  // 更新 user
                  const userSession = session.data?.messages.find(
                    (i) => i.id === id && i.role === ChatRole.User,
                  );
                  if (userSession) {
                    userSession.content = originContent;
                    originContent = '';
                  }
                });
              }
              if (
                !currentSessionModel ||
                currentSessionModel !== chatConfig.model
              ) {
                // 本次会话没有模型类型或者模型更改了，重新设置模型类型
                chatStoreState.updateModel(chatConfig.model);
              }

              chatStoreState.generateAndUpdateSessionTopic();
              chatStoreState.updateConsumedTokens({
                model: model,
                curSession: session,
                promptTokens: jsonData?.usage?.prompt_tokens || 0,
                completionTokens: jsonData?.usage?.completion_tokens || 0,
                cacheCreationInputTokens: jsonData?.usage?.cache_creation_input_tokens || 0,
                cacheReadInputTokens: jsonData?.usage?.cache_read_input_tokens || 0
              });
              chatStoreState.syncHistory();
            } else {
              set((state) => {
                if (state.message) {
                  state.message.content = content;
                  state.message.reasoning_content =
                    claude37Response.reasoning_content;
                } else {
                  console.error(
                    'create bot message before set message content!',
                  );
                }
                state.loadingMessage = '';
              });
            }
          },
          onError(error) {
            console.dir(error);
            userReporter.report({
              event: UserEvent.REPLY_EXCEPTION,
              extends: {
                model,
                session_id: session._id,
                messages: data.messages,
                error_message: error.message,
              },
            });
            webToolsHub.withScope((scope) => {
              scope.setExtras({
                event: UserEvent.REPLY_EXCEPTION,
                model,
                session_id: session._id,
                // messages: data.messages, 数据太大了
                error_message: error.message,
                mark: 9,
              });
              webToolsLogger.captureException(error);
            });
            let outputContent = get().message.content;
            if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
              get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
              return
            }
            // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
            // error.name 为 AbortError 表示该错误是 abort 触发的
            if (error.name !== ABORT_ERROR_NAME) {
              // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
              const isCloseCodeBackticks = checkCodeBlockIsClose(
                outputContent as string,
              );
              if (!isCloseCodeBackticks) {
                outputContent += `\n${CODE_BACKTICKS}`;
              }
              if (error.message === StreamError.AuthTokenIsExpired) {
                window.parent.postMessage(
                  {
                    type: BroadcastActions.GET_INIT_DATA,
                    data: {
                      isExpired: true,
                    },
                  },
                  '*',
                );
              }
              outputContent += handleStreamError(error);
              chatStoreState.updateCurrentSession((session) =>
                session.data?.messages.push({
                  ...DEFAULT_ASSISTANT_MESSAGE,
                  id,
                  content: outputContent,
                  group_tokens: 8,
                }),
              );
              ControllerPool.remove(sessionId, messageIndex);
              chatStoreState.syncHistory();
              get().reset();
            }
          },
          onController: (abortController) => {
            ControllerPool.addController(
              sessionId,
              messageIndex,
              abortController,
            );
          },
          setError: (type) => {
            chatStoreState.setError(type);
          },
        });
        return;
      }

      if ([ChatModel.GPT5, ChatModel.GPT51, ChatModel.GPT51Codex].includes(model)) {
        delete data.temperature;
      }

      requestChatStream(options.event, data, chatRequestUrl, {
        onMessage(content, done, reasoningResponse, jsonData) {
          get().setStreamRetryCount(0)
          if (chatStoreState.isError) {
            chatStoreState.setError(false);
          }
          if (done) {
            ControllerPool.remove(sessionId, messageIndex);
            FeedbackPool.add(id);
            set((state) => {
              state.isStreaming = false;
              // 如果模型回答是空的，那么就往模型里面塞一条信息确保下次回答的时候不会报错
              if (content === '') {
                state.message.content = '-';
              }
            });
            if (
              attachs &&
              (attachs?.attachType === AttachType.CodeBase ||
                attachs?.attachType === AttachType.File)
            ) {
              chatStoreState.updateCurrentSession((session) => {
                session.data?.messages.push({
                  ...get().message,
                  id,
                  content,
                  reasoning_content: reasoningResponse?.reasoning_content,
                });
                // 更新 user
                const userSession = session.data?.messages.find(
                  (i) => i.id === id && i.role === ChatRole.User,
                );
                if (userSession) {
                  userSession.content = originContent;
                  originContent = '';
                }
              });
            } else {
              chatStoreState.updateCurrentSession((session) => {
                return session.data?.messages.push({
                  ...get().message,
                  id,
                  content,
                  reasoning_content: reasoningResponse?.reasoning_content,
                });
              });
            }
            if (
              !currentSessionModel ||
              currentSessionModel !== chatConfig.model
            ) {
              // 本次会话没有模型类型或者模型更改了，重新设置模型类型
              chatStoreState.updateModel(chatConfig.model);
            }

            get().resetMessage();
            chatStoreState.generateAndUpdateSessionTopic();
            chatStoreState.updateConsumedTokens({
              model: model,
              curSession: session,
              promptTokens: jsonData?.usage?.prompt_tokens || 0,
              completionTokens: jsonData?.usage?.completion_tokens || 0,
              cacheCreationInputTokens: jsonData?.usage?.cache_creation_input_tokens || 0,
              cacheReadInputTokens: jsonData?.usage?.cache_read_input_tokens || 0
            });
            chatStoreState.syncHistory();
          } else {
            set((state) => {
              if (state.message) {
                state.message.content = content;
                // 处理流式更新中的 reasoning_content
                if (reasoningResponse?.reasoning_content) {
                  state.message.reasoning_content = reasoningResponse.reasoning_content;
                }
              } else {
                console.error('create bot message before set message content!');
              }
              state.loadingMessage = '';
            });
          }
        },
        onError(error) {
          console.dir(error);
          userReporter.report({
            event: UserEvent.REPLY_EXCEPTION,
            extends: {
              model,
              session_id: session._id,
              messages: data.messages,
              error_message: error.message,
            },
          });
          webToolsHub.withScope((scope) => {
            scope.setExtras({
              event: UserEvent.REPLY_EXCEPTION,
              model,
              session_id: session._id,
              // messages: data.messages, 数据太大了
              error_message: error.message,
              mark: 10,
            });
            webToolsLogger.captureException(error);
          });
          let outputContent = get().message.content;
          if (error.name === REQUEST_TIMEOUT_NAME || specialErrorPatterns[1].condition(error.message)) {
            get().retryChatStream(id, error.name === REQUEST_TIMEOUT_NAME ? ERetryType.Timeout : ERetryType.AccessLimit)
            return
          }
          // https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
          // error.name 为 AbortError 表示该错误是 abort 触发的
          if (error.name !== ABORT_ERROR_NAME) {
            // 判断 code block 是否闭合，如无闭合，需要先将 code block 闭合
            const isCloseCodeBackticks = checkCodeBlockIsClose(
              outputContent as string,
            );
            if (!isCloseCodeBackticks) {
              outputContent += `\n${CODE_BACKTICKS}`;
            }
            if (error.message === StreamError.AuthTokenIsExpired) {
              window.parent.postMessage(
                {
                  type: BroadcastActions.GET_INIT_DATA,
                  data: {
                    isExpired: true,
                  },
                },
                '*',
              );
            }
            outputContent += handleStreamError(error);
            chatStoreState.updateCurrentSession((session) =>
              session.data?.messages.push({
                ...DEFAULT_ASSISTANT_MESSAGE,
                id,
                content: outputContent,
                group_tokens: 8,
              }),
            );
            ControllerPool.remove(sessionId, messageIndex);
            chatStoreState.syncHistory();
            get().reset();
          }
        },
        onController: (abortController) => {
          ControllerPool.addController(
            sessionId,
            messageIndex,
            abortController,
          );
        },
        setError: (type) => {
          chatStoreState.setError(type)
        }
      });
    },
    onStop: () => {
      parseFileController?.abort?.()
      if (get().retryTimmer) {
        clearTimeout(get().retryTimmer)
      }
      const currentSessionId = useChatStore.getState().currentSessionId;
      if (
        !get().isStreaming &&
        !get().isProcessing &&
        !get().isMCPProcessing &&
        useTaskCompletionStore.getState().isSessionComplete(currentSessionId || '') &&
        !get().isApplying
      ) {
        return;
      }

      if (get().runnerTask) {
        get().onPluginAppStop();
        return;
      }
      const chatStoreState = useChatStore.getState();
      const session = chatStoreState.currentSession();
      const sessionId = chatStoreState.currentSessionId;
      if (!sessionId) {
        return;
      }
      const isStreamingMessageIndex = session?.data?.messages.length;

      if (isStreamingMessageIndex) {
        const attachs = useChatAttach.getState().attachs;
        // 在这里判断是否上报 bm stop stream 的前提是在 stream 中不能对 attachs 进行操作
        // 目前在 stream 中，attachs 是不展示的，不支持用户操作，需要等 stream 结束
        // 假设未来在 stream 中时可以对 attachs 操作，就不能这么判断，需要额外添加变量
        if (attachs && attachs.attachType === AttachType.Docset) {
          const { _id, name, code } = attachs as unknown as Docset;
          userReporter.report({
            event: UserEvent.CODE_CHAT_STOP_BM_STREAM,
            extends: {
              content: get().message.content,
              docset_id: _id,
              docset_name: name,
              docset_code: code,
            },
          });
        } else {
          userReporter.report({
            event: UserEvent.CODE_CHAT_STOP_STREAM,
            extends: {
              content: get().message.content,
            },
          });
        }
        let outputContent = get().message.content;
        chatStoreState.updateCurrentSession((session) => {
          const streamingMessage =
            session?.data?.messages[isStreamingMessageIndex];
          if (streamingMessage) {
            streamingMessage.processing = false;
          }

          // ✅ 检查最后一条 assistant message 是否有未完成的 tool_calls
          let lastAssistantMessage: ChatMessage | null = null;
          let lastAssistantIndex = -1;

          if (session?.data?.messages) {
            for (let i = session.data.messages.length - 1; i >= 0; i--) {
              const msg = session.data.messages[i];
              if (msg.role === ChatRole.Assistant && msg.tool_calls?.length) {
                lastAssistantMessage = msg;
                lastAssistantIndex = i;
                break;
              }
            }
          }

          // ✅ 检查哪些 tool_calls 没有对应的 tool message
          const existingToolMessages = new Set<string>();
          if (lastAssistantMessage && session?.data?.messages) {
            for (let i = lastAssistantIndex + 1; i < session.data.messages.length; i++) {
              const msg = session.data.messages[i];
              if (msg.role === ChatRole.Tool && msg.tool_call_id) {
                existingToolMessages.add(msg.tool_call_id);
              }
            }
          }

          // ✅ 找出未完成的 task tool_calls
          const unfinishedTaskCalls = lastAssistantMessage?.tool_calls?.filter(
            (tc) => tc.function.name === 'task' && !existingToolMessages.has(tc.id)
          ) || [];

          // 如果有未完成的 task 工具，为它们添加 aborted 状态
          if (unfinishedTaskCalls.length > 0) {
            console.log(
              `[onStop] Found ${unfinishedTaskCalls.length} unfinished task tools, adding aborted messages`,
              { toolCallIds: unfinishedTaskCalls.map(tc => tc.id) }
            );

            unfinishedTaskCalls.forEach((toolCall) => {
              // 从 subagent store 获取真实的 taskId、描述、agent 名称等信息
              // 若 subagent 尚未创建 session（例如还在队列中），taskId 为空字符串
              const statusInfo = useSubagentStore.getState().statuses[toolCall.id];
              const subagentTaskId = statusInfo?.taskId || '';
              const taskDescription = statusInfo?.description || 'Task aborted by user';
              const agentName = statusInfo?.agentName || 'unknown';
              const currentStep = statusInfo?.step || 0;

              // 构造 aborted 状态的 tool result content
              const abortedContent = formatTaskResult({
                id: subagentTaskId,
                description: taskDescription,
                status: TaskStatus.Aborted,
                messages: [],
                abortReason: 'User stopped the conversation',
                agent: agentName,
                steps: currentStep,
              } as any);

              // ✅ 直接添加 tool message，不调用 updateTaskToolResult
              session.data?.messages.push({
                id: nanoid(),
                role: ChatRole.Tool,
                tool_call_id: toolCall.id,
                content: abortedContent,
                createdAt: Date.now(),
              } as ChatMessage);

              // ✅ 同时更新 tool_result 和 response（用于 UI 显示）
              if (lastAssistantMessage) {
                if (!lastAssistantMessage.tool_result) {
                  lastAssistantMessage.tool_result = {};
                }
                lastAssistantMessage.tool_result[toolCall.id] = {
                  path: '',
                  content: abortedContent,
                  isError: true,
                };

                if (!lastAssistantMessage.response) {
                  lastAssistantMessage.response = {};
                }
                lastAssistantMessage.response[toolCall.id] = false;
              }
            });
          }

          // ✅ 只有在没有未完成的 tool_calls 时，才添加 assistant message
          const hasUnfinishedTools = lastAssistantMessage?.tool_calls?.some(
            (tc) => !existingToolMessages.has(tc.id)
          ) || false;

          if (!hasUnfinishedTools && !get().isMCPProcessing && !get().isApplying) {
            session.data?.messages.push({
              ...DEFAULT_ASSISTANT_MESSAGE,
              id: lastMessageId,
              content: (outputContent += '\n\n 用户中止回答'),
              group_tokens: 8,
            });
          }
          // TODO: 直接在这里将 toolcall 结果同步为用户中止，待优化
          const chatApplyInfo = useChatApplyStore.getState().chatApplyInfo;
          Object.keys(chatApplyInfo).forEach((toolCallId) => {
            const chatApplyItem = chatApplyInfo[toolCallId];
            if (chatApplyItem.applying) {
              useChatApplyStore.getState().updateChatApplyItem(
                toolCallId,
                {
                  applying: false,
                }
              )
              const lastMessage = session.data?.messages[
                session.data?.messages.length - 1
              ];
              if (lastMessage?.tool_calls?.some(toolCall => toolCall.id === toolCallId)) {
                lastMessage.response = {
                  [toolCallId]: false
                }
                lastMessage.tool_result = {
                  [toolCallId]: {
                    path: chatApplyItem.filePath,
                    isError: false,
                    content: 'user cancel apply',
                  }
                }
              }
            }
          })
        });
        chatStoreState.syncHistory();
        get().reset();
        ControllerPool.stop(sessionId, isStreamingMessageIndex + 1);
        subagentCoordinator.abortBySession(sessionId);
        // reset() 已清除 isStreaming/isProcessing，但 taskCompletionTracker 中的任务
        // 状态仍为 Running，导致 isSessionComplete 返回 false，下次点击 stop 会绕过
        // early-return 再次执行本段逻辑（叠加"用户中止回答"）。
        // 在此立即将该 session 所有未完成任务标记为 Cancelled，确保状态同步。
        const tracker = useTaskCompletionStore.getState();
        tracker.getSessionTasks(sessionId).forEach((task) => {
          if (
            task.status === TaskCompletionStatus.Registered ||
            task.status === TaskCompletionStatus.Running
          ) {
            tracker.updateTaskStatus(
              sessionId,
              task.toolCallId,
              TaskCompletionStatus.Cancelled,
              { error: 'Cancelled by user stop' },
            );
          }
        });
        // 清除任何仍在等待用户操作的工具二次确认弹窗。
        // executor 中的 requestConfirmation 会通过 abort signal 自动解决，
        // 此处作为兜底保障，确保即使 abort 信号路径出现问题，UI 状态也能及时清除。
        useToolConfirmationStore.getState().clear();
        get().setStreamRetryCount(0);
      }
    },

    onPluginAppSubmit: async (messages: ChatMessage[]) => {
      const userInputMessage = messages.pop();
      get().reset();
      set(() => ({ isStreaming: true }));
      let content = userInputMessage?.content;
      const runner = usePluginApp.getState().runner;
      set((state) => {
        state.runnerTask = {
          id: userInputMessage?.id,
          task: runner,
        };
      });
      let currentContent = '';
      if (typeof content === 'string') {
        currentContent = content;
      } else
        [
          (currentContent = content?.length
            ? (content[0] as ChatMessageContentText).text
            : ''),
        ];
      // TODO: 暂时这么处理，后续需要重新调整下数据结构
      // content = content?.replace(`/${runner?.app_shortcut.name}`, '');
      content = currentContent.replace(`/${runner?.app_shortcut.name}`, '');
      const attach = useChatAttach.getState().attachs;
      const runnerExtends = usePluginApp.getState().runnerExtends;
      const data = {
        task_id: userInputMessage?.id,
        plugin_app: { ...runner, extends: runnerExtends },
        prompt: content,
        attachs:
          attach?.attachType === AttachType.File
            ? {
              file: attach,
            }
            : null,
        messages: [
          {
            id: userInputMessage?.id,
            role: userInputMessage?.role,
            content: userInputMessage?.content,
          },
        ],
      };
      window.parent.postMessage(
        {
          type: BroadcastActions.PLUGIN_APP_ACTION_START,
          data,
        },
        '*',
      );
      // 清空
      usePluginApp.getState().update(undefined);
      if (attach?.attachType === AttachType.File) {
        useChatAttach.getState().reset();
      }
      set((state) => {
        if (state.message) {
          state.message.content =
            runner?.app_shortcut.loading_msg || '指令正在执行';
        } else {
          console.error('create bot message before set message content!');
        }
      });
    },
    onPluginAppStop: () => {
      const runnerTask = get().runnerTask;
      window.parent.postMessage(
        {
          type: BroadcastActions.PLUGIN_APP_ACTION_END,
          data: {
            task_id: runnerTask?.id,
          },
        },
        '*',
      );
    },
    onPluginAppDone: (data: PluginRecieveData) => {
      const runnerTask = get().runnerTask;
      if (data.task_id !== runnerTask?.id) {
        return;
      }
      const chatStoreState = useChatStore.getState();
      chatStoreState.updateCurrentSession((session) =>
        session.data?.messages.push({
          ...DEFAULT_ASSISTANT_MESSAGE,
          id: runnerTask.id,
          content:
            data.message ||
            runnerTask.task?.app_shortcut.success_msg ||
            '指令已经执行完毕',
        }),
      );
      chatStoreState.syncHistory();
      get().reset();
    },
    onUpdatePrePromptCodeBlock: (data) => {
      set((state) => {
        if (!data) {
          return state;
        }
        const currentCodeBlocks = state.prePromptCodeBlock || [];

        // 自动分配序号和时间戳
        const dataWithSequence = {
          ...data,
          sequenceNumber: currentCodeBlocks.length + 1,
          createdAt: Date.now(),
        };

        return {
          prePromptCodeBlock: [...currentCodeBlocks, dataWithSequence],
        };
      });
    },
    onUpdateSelectionPrePromptCodeBlock: (data) => {
      set((state) => {
        if (!data) return;
        let prePromptCodeBlock = state.prePromptCodeBlock || [];
        let hasReplaced = false;

        // 遍历数组，寻找符合条件的项
        for (let i = 0; i < prePromptCodeBlock.length; i++) {
          const item = prePromptCodeBlock[i];

          // 如果找到了满足条件的项
          if (item.textEditorSelection && !item.holding) {
            // 用新的数据替换该项
            prePromptCodeBlock[i] = data;
            hasReplaced = true;
            break;
          }
        }

        // 如果没有替换，则插入新的数据
        if (!hasReplaced) {
          const dataWithSequence = {
            ...data,
            sequenceNumber: prePromptCodeBlock.length + 1,
            createdAt: Date.now(),
          };
          prePromptCodeBlock.push(dataWithSequence);
        } else {
          // 如果进行了替换，保持原有序号但更新时间戳
          const dataWithSequence = {
            ...data,
            sequenceNumber: data.sequenceNumber || prePromptCodeBlock.length + 1,
            createdAt: Date.now(),
          };
          prePromptCodeBlock = prePromptCodeBlock.filter(
            (item) => item !== data,
          );
          prePromptCodeBlock.push(dataWithSequence);
        }

        // 更新状态
        state.prePromptCodeBlock = prePromptCodeBlock;
      });
    },
    onUpdateHoldingValue: (index, newHoldingValue) => {
      set((state) => {
        if (typeof index !== 'number' || !state.prePromptCodeBlock) {
          return;
        }

        // 直接在 draft 上进行操作
        if (index >= 0 && index < state.prePromptCodeBlock.length) {
          state.prePromptCodeBlock[index].holding = newHoldingValue;
        }
      });
    },
    onRemovePrePromptCodeBlock: (index?: number) => {
      set((state) => {
        if (typeof index !== 'number') {
          return { prePromptCodeBlock: null };
        }
        const currentCodeBlocks = state.prePromptCodeBlock || [];
        const newCodeBlocks = currentCodeBlocks
          .filter((_, idx) => idx !== index)
          .map((block, idx) => ({
            ...block,
            sequenceNumber: idx + 1, // 重新分配序号
          }));
        return {
          prePromptCodeBlock: newCodeBlocks.length ? newCodeBlocks : null,
        };
      });
    },
    loadingMessage: '',
  })),
);

export interface CodeBase {
  collection: string;
  label: string;
  branches?: string[];
  attachType: AttachType;
  searchResult?: SearchResultNew[];
}
export interface FileItem {
  fileName: string;
  path: string;
  content: string;
  attachType: AttachType;
  isActive?: boolean;
  isCurrent?: boolean;
  hadParsed?: boolean;
}

export interface RuleItem {
  name: string;
  filePath: string;
  content: string;
  attachType: AttachType;
}

export interface FolderItem {
  fileName: string;
  path: string;
  content: string;
  attachType: AttachType;
}

export interface AttachFile {
  attachFiles: FileItem[];
  attachType: AttachType;
}

export interface AttachFolder {
  attachFolders: FolderItem[];
  attachType: AttachType;
}

export interface ImageUrl {
  attachType: AttachType;
  imgUrls: string[];
}

export interface NetworkModel {
  attachType: AttachType;
  model: ChatModel;
}
export interface KnowledgeAugmentationModel {
  attachType: AttachType;
}

export interface IProblem {
  attachType: AttachType,
  problem: string
}

export type TMixAttach = Docset | CodeBase | FileItem | FolderItem | IProblem | ImageUrl | RuleItem
export interface IMultiAttachment {
  attachType: AttachType,
  dataSource: TMixAttach[]
}

export type ChatAttachStore = {
  attachs?:
  | Docsets
  | CodeBase
  | AttachFile
  | AttachFolder
  | ImageUrl
  | NetworkModel
  | KnowledgeAugmentationModel
  | IProblem
  | IMultiAttachment

  reset: () => void;
  // update: (updater: (attachs?: Docset[]) => void) => void
  update: (
    attach?: ChatAttachStore['attachs']
  ) => void;
};

export const useChatAttach = create<ChatAttachStore>()((set) => ({
  reset: (attach?: IMultiAttachment) => {
    if (attach) {
      set(() => ({ attachs: attach }));
    } else {
      set(() => ({ attachs: undefined }));
    }
  },

  update: (attach) => {
    set(() => ({ attachs: attach }));
  },
}));

function checkCodeBlockIsClose(content: string) {
  const flags = content.match(new RegExp(CODE_BACKTICKS, 'gm'));
  if (!flags) {
    return true;
  }
  return flags?.length % 2 === 0;
}

// 16-character random string
export const nanoid = customAlphabet('0123456789abcdef', 16);

export async function requestChatSessions(chatType?: ChatType) {
  const params: ChatHistoryGetterParams = {
    _num: 20,
    _sort_by: '-metadata.create_time',
    _exclude: 'data',
    ...(chatType ? { chat_type: chatType } : {}),
  };
  return getHistories(params);
}
interface ChatSessionTracker {
  sessionIDs: string[];
  addSessionID: (sessionID: string) => void;
  removeSessionID: (sessionID: string) => void;
}

export const useChatSessionTracker = create<ChatSessionTracker>()(
  persist(
    (set) => ({
      sessionIDs: [],
      addSessionID: (sessionID: string) => {
        set((state) => {
          // 如果 sessionID 已存在于数组中，则不添加
          if (state.sessionIDs.includes(sessionID)) {
            return state;
          }
          return {
            sessionIDs: [...state.sessionIDs, sessionID],
          };
        });
      },
      removeSessionID: (sessionID: string) => {
        set((state) => {
          const newSessionIDs = state.sessionIDs.filter(
            (item) => item !== sessionID,
          );
          return { ...state, sessionIDs: newSessionIDs };
        });
      },
    }),
    {
      name: 'chat-session-tracker',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionIDs: state.sessionIDs,
      }),
    },
  ),
);

export type ChatPromptStore = {
  prompt?: Prompt | undefined;
  codeBlock?: string;
  reset: () => void;
  update: (prompt: Prompt | undefined, codeBlock?: string) => void;
};

export const useChatPromptStore = create<ChatPromptStore>((set) => ({
  reset: () => {
    set(() => ({ prompt: undefined, codeBlock: undefined }));
  },
  update: (newPrompt, codeBlock?: string) => {
    set(() => ({ prompt: newPrompt, codeBlock }));
  },
}));

export type ChatUserAction = {
  createdFilePaths: Record<string, string[]>
  appliedCodeBlocks: Record<string, string[]>
  updateCreatedFilePaths: (messageId: string, createdPaths: string[]) => void;
  updateAppliedCodeBlocks: (messageId: string, codeBlocks: string[], applyType?: 'apply' | 'revert') => void;
  resumeUserAction: () => void
};

enum EUserAction {
  ApplyFile = 'cm-user-action-apply-file',
  CreateFile = 'cm-user-action-create-file',
  ApplyCodeBlock = 'cm-user-action-apply-codeblock',
  AutoApply = 'cm-user-action-auto-apply',
  AutoApprove = 'cm-user-action-auto-approve',
  AutoExecute = 'cm-user-action-auto-execute',
  AutoTodo = 'cm-user-action-auto-todo'
}

// 用户行为Store
export const useUserActionStore = create<ChatUserAction>((set, get) => ({
  createdFilePaths: {}, // 被创建的文件路径
  appliedCodeBlocks: {}, // 被应用的代码块

  updateCreatedFilePaths: (messageId: string, createdPaths: string[]) => {
    const paths = cloneDeep(get().createdFilePaths[messageId] || [])
    get().createdFilePaths = {
      [messageId]: Array.from(new Set([...createdPaths, ...paths]))
    }
    const createdFiles = cloneDeep(get().createdFilePaths) // 解析为普通对象
    localStorage.setItem(EUserAction.CreateFile, JSON.stringify(createdFiles))
  },
  updateAppliedCodeBlocks: (messageId: string, codeBlocks: string[], applyType = 'apply') => {
    set((state) => {
      const codes = cloneDeep(state.appliedCodeBlocks || {})
      codeBlocks.forEach(codeBlockId => {
        if (!codes[messageId]) {
          codes[messageId] = []
        }
        const index = codes[messageId].findIndex(id => id === codeBlockId)
        if (applyType === 'revert') {
          if (index >= 0) {
            codes[messageId].splice(index, 1)
          }
        } else {
          if (index < 0) {
            codes[messageId].push(codeBlockId)
          }
        }
      })
      localStorage.setItem(EUserAction.ApplyCodeBlock, JSON.stringify(codes))
      return {
        appliedCodeBlocks: { ...codes }
      }
    });
  },
  resumeUserAction: async () => {
    const createdFiles = (getLocalStorage(EUserAction.CreateFile) || {}) as Record<string, string[]>
    const appliedCodeBlocks = (getLocalStorage(EUserAction.ApplyCodeBlock) || {}) as Record<string, string[]>
    set(() => ({
      createdFilePaths: createdFiles,
      appliedCodeBlocks: appliedCodeBlocks,
    }))
  },
}));

/**
 * 重新组装消息内容，替换文本部分但保留已有的图片 URL。
 *
 * 用于系统级 Prompt / specPrompt 处理时替换 userMessage.content，
 * 防止之前 MultiAttachment 分支中 push 进 content 的 ImageUrl 被覆盖丢失。
 */
function reassembleContentWithImages(
  existingContent: string | ChatMessageContentUnion[],
  newTextContent: string,
): ChatMessageContentUnion[] {
  // 从现有 content 中提取图片（仅数组格式且存在 ImageUrl 时需要保留）
  const existingImageUrls = Array.isArray(existingContent)
    ? existingContent.filter(
        (item) => item.type === ChatMessageContent.ImageUrl,
      )
    : [];
  const newContent = assembleUserPromptContent(newTextContent);
  if (existingImageUrls.length) {
    newContent.push(...existingImageUrls);
  }
  return newContent;
}

function assembleUserPromptContent(content: string) {
  return [
    { type: ChatMessageContent.Text, text: content },
  ] as ChatMessageContentUnion[];
}

export function getContentString(content: string | ChatMessageContentUnion[]) {
  if (typeof content === 'string') {
    return content;
  } else {
    const currentContent = content.filter(
      (i) => i.type === ChatMessageContent.Text,
    )[0];
    return currentContent
      ? (currentContent as ChatMessageContentText).text
      : '';
  }
}

function calculateTokens(tokens: number): number {
  return Math.min(Math.max(tokens, CHAT_MIN_TOKENS), CHAT_MAX_TOKENS);
}

/**
 * 获取 activeChanges 中最新修改的 change 的 id
 * 根据 proposalFile.lastModified 排序，返回最大的
 */
export function getLatestChangeId(changes: ChangeInfo[]): string | undefined {
  if (!changes || changes.length === 0) {
    return undefined;
  }
  const sorted = [...changes].sort((a, b) => {
    const aTime = a.proposalFile?.lastModified || 0;
    const bTime = b.proposalFile?.lastModified || 0;
    return bTime - aTime;
  });
  return sorted[0]?.id;
}

/**
 * 获取 SpecKit feature 中所有文件的最大 lastModified 时间戳
 */
function getFeatureLatestModified(feature: SpecKitFeatureInfo): number {
  const times: number[] = [];
  if (feature.specFile?.lastModified) times.push(feature.specFile.lastModified);
  if (feature.planFile?.lastModified) times.push(feature.planFile.lastModified);
  if (feature.tasksFile?.lastModified) times.push(feature.tasksFile.lastModified);
  if (feature.researchFile?.lastModified) times.push(feature.researchFile.lastModified);
  if (feature.dataModelFile?.lastModified) times.push(feature.dataModelFile.lastModified);
  if (feature.quickstartFile?.lastModified) times.push(feature.quickstartFile.lastModified);
  if (feature.checklistFile?.lastModified) times.push(feature.checklistFile.lastModified);
  if (feature.contractFiles?.length) {
    feature.contractFiles.forEach((f) => {
      if (f.lastModified) times.push(f.lastModified);
    });
  }
  return times.length > 0 ? Math.max(...times) : 0;
}

/**
 * 获取 features 中最新修改的 feature 的 id
 * 根据所有文件的最大 lastModified 排序
 */
export function getLatestFeatureId(
  features: SpecKitFeatureInfo[],
): string | undefined {
  if (!features || features.length === 0) {
    return undefined;
  }
  const sorted = [...features].sort((a, b) => {
    const aTime = getFeatureLatestModified(a);
    const bTime = getFeatureLatestModified(b);
    return bTime - aTime;
  });
  return sorted[0]?.id;
}

/**
 * 当 specInfo 变化时，自动选择最新的 change 或 feature
 * 条件：
 * 1. chatType === 'codebase'
 * 2. codebaseChatMode === 'openspec' 或 'speckit'
 * 3. 对应的 activeChangeId 或 activeFeatureId 为空
 */
export function autoSelectActiveChangeOrFeature(specInfo: SpecInfo): void {
  const chatStore = useChatStore.getState();
  const { chatType, codebaseChatMode, activeChangeId, activeFeatureId } = chatStore;

  // 条件 1: 必须是 codebase chat
  if (chatType !== 'codebase') {
    return;
  }

  // 条件 2 & 3: 根据 codebaseChatMode 分类处理
  if (codebaseChatMode === 'openspec') {
    // 如果已选中，不覆盖
    if (activeChangeId) {
      return;
    }
    // 从 specInfo 中找到 openspec 框架
    const openspecFramework = specInfo.frameworks.find(
      (f) => f.framework === SpecFramework.OpenSpec,
    );
    if (openspecFramework?.activeChanges?.length) {
      const latestId = getLatestChangeId(openspecFramework.activeChanges);
      if (latestId) {
        chatStore.setActiveChangeId(latestId);
      }
    }
  } else if (codebaseChatMode === 'speckit') {
    // 如果已选中，不覆盖
    if (activeFeatureId) {
      return;
    }
    // 从 specInfo 中找到 speckit 框架
    const speckitFramework = specInfo.frameworks.find(
      (f) => f.framework === SpecFramework.SpecKit,
    );
    if (speckitFramework?.features?.length) {
      const latestId = getLatestFeatureId(speckitFramework.features);
      if (latestId) {
        chatStore.setActiveFeatureId(latestId);
      }
    }
  }
  // vibe 模式或 undefined 不触发自动选择
}

// =====================================================
// 开发环境调试 & 事件驱动完成通知机制初始化
// =====================================================

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.chatStore = useChatStore;

  // 加载 subagent completion 调试工具
  import('../utils/subagentCompletionDebug').catch(() => {
    // 忽略加载错误
  });
}

/**
 * 处理 SESSION_ALL_TASKS_COMPLETE 事件的核心逻辑
 */
function processSessionComplete(
  event: { sessionId: string; results: Record<string, unknown> },
): void {
  const { sessionId } = event;
  const chatStore = useChatStore.getState();
  const chatStreamStore = useChatStreamStore.getState();

  const session = chatStore.sessions.get(sessionId);
  if (!session?.data?.messages) {
    return;
  }

  const messages = session.data.messages;
  // 找到最后一条包含 tool_calls 的 assistant message
  let lastMessage: ChatMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === ChatRole.Assistant && messages[i].tool_calls) {
      lastMessage = messages[i];
      break;
    }
  }

  if (!lastMessage?.tool_calls) {
    return;
  }

  // 幂等检查：如果 processing 已经是 false，说明已经被处理过
  if (lastMessage.processing === false) {
    return;
  }

  // 检查所有工具结果是否完整
  const tool_result = lastMessage.tool_result || {};
  const tool_calls = lastMessage.tool_calls || [];

  const allToolResultsComplete =
    Object.keys(tool_result).length === tool_calls.length;

  if (!allToolResultsComplete) {
    const missingToolCallIds = tool_calls
      .filter(tc => !tool_result[tc.id])
      .map(tc => tc.id);

    const existingResultIds = Object.keys(tool_result);

    console.warn(
      `[TaskEventBus] Tool results incomplete: ${existingResultIds.length}/${tool_calls.length} completed. Missing: ${missingToolCallIds.join(', ')}`,
    );
    return;
  }

  // ✅ 修复竞态：校验所有 task tool_calls 在 messages 数组中均存在对应的 tool message
  // 场景：executor abort catch block 先调 updateToolCallResults（设 tool_result），
  // 再 synchronously emitCompletionEvent → SESSION_ALL_TASKS_COMPLETE → 此处。
  // 此时 updateTaskToolResult 尚未执行，tool message 还未 splice 进 messages。
  // 若此处直接 handleAutoExecute，onUserSubmit 构建 API payload 时会因缺少 tool message 报错。
  // 返回后由 updateTaskToolResult 在插入消息后手动触发 handleAutoExecute。
  const taskToolCalls = tool_calls.filter(tc => tc.function.name === 'task');
  if (taskToolCalls.length > 0) {
    const missingMessages = taskToolCalls.filter(
      tc => !messages.some(
        msg => msg.role === ChatRole.Tool && msg.tool_call_id === tc.id
      )
    );
    if (missingMessages.length > 0) {
      if (import.meta.env.DEV) {
        console.warn(
          '[TaskEventBus] ⚠️ Tool messages not yet in session, deferring handleAutoExecute to updateTaskToolResult',
          {
            sessionId,
            missingToolCallIds: missingMessages.map(tc => tc.id),
          },
        );
      }
      return;
    }
  }

  // 推断执行上下文
  const context = chatStreamStore.inferExecutionContext(session, lastMessage);

  // 事件驱动路径：所有 task 都已完成，hasActiveTaskTools = false
  const hasActiveTaskTools = false;

  // ✅ 幂等检查增强：检查 isProcessing 状态
  if (chatStreamStore.isProcessing) {
    return;
  }

  // 设置 processing = false
  lastMessage.processing = false;

  // 触发自动执行（兜底路径）
  chatStreamStore.handleAutoExecute(lastMessage, context, hasActiveTaskTools);
}

/**
 * 监听 SESSION_ALL_TASKS_COMPLETE 事件，触发 handleAutoExecute（兜底路径）。
 */
if (typeof window !== 'undefined') {
  taskEventBus.on('SESSION_ALL_TASKS_COMPLETE', (event) => {
    const { sessionId } = event;

    const chatStore = useChatStore.getState();

    // 检查是否是当前会话
    if (chatStore.currentSessionId !== sessionId) {
      // 存储非当前 session 的事件
      pendingEventQueue.enqueue(sessionId, event);
      return;
    }

    // 当前 session 的事件直接处理
    processSessionComplete(event);
  });

  // ========== 监听 session 切换，处理待处理事件 ==========
  let prevSessionId: string | null = useChatStore.getState().currentSessionId;
  useChatStore.subscribe((state) => {
    const currentSessionId = state.currentSessionId;
    if (currentSessionId && currentSessionId !== prevSessionId) {
      prevSessionId = currentSessionId;

      const pendingEvent = pendingEventQueue.dequeue(currentSessionId);
      if (pendingEvent) {
        processSessionComplete(pendingEvent);
      }
    } else if (!currentSessionId) {
      prevSessionId = null;
    }
  });

  // ========== 定期清理过期事件（每 5 分钟） ==========
  const cleanupIntervalId = setInterval(() => {
    pendingEventQueue.cleanup();
  }, 5 * 60 * 1000);

  // 确保页面卸载时清理定时器
  window.addEventListener('beforeunload', () => {
    clearInterval(cleanupIntervalId);
  });
}
