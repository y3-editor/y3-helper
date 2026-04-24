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
import { pathsMatch, truncateSessionTopic } from '../utils/common';
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
import { checkThinkingSignatureValid, convertDeepseekMessages, repairToolIdOfMessages, reuseDuplicateFileRead, serializeCodebaseMessages } from '../utils/validateBeforeChat';
import { injectTodoListToLastUserMessage, processWriteTodoDenied } from './workspace/tools/todo';
import { useMCPStore } from './mcp';
import { useMcpPromptApp } from './mcp-prompt';
import { useSkillPromptApp } from './skills/skill-prompt';
import { useChatApplyStore } from './chatApply';
import { terminalCmdFunction } from '../routes/CodeChat/ChatMessagesList/TermialPanel';
import { getLocalStorage } from '../utils/storage';
import { formatResultContent } from '../utils/toolCall';
import type { ExtendedPlanData, PlanStatus } from '../types/plan';
import type { TodoList } from './workspace/tools/todo';
import { onMessageToolCallResponse } from '../utils/chatToolCallHandler';
import { UserEvent } from '../types/report';
import { ChatRole } from '../types/chat';
import { getPlanContextTruncationInstruction } from './workspace/planModePrompts';
// import mockMessages from './mockMessages.json';
import { Tool as PlanTool, processMakePlanDenied, report as planReport } from '../store/workspace/tools/plan'
import { Tool as TodoTool } from '../store/workspace/tools/todo'
import addCacheMarksToMessages from '../utils/addCacheMarksToMessages';
import { truncatedMessageWithSlideWindow, truncateMessagesIfNeeded } from '../utils/truncateMessages';
import { SessionStatus, type CompressionContext, type CompressionHistory, type SessionCompressionState } from '../types/contextCompression';
import { compressionService, getCompressSessionStatus, getPrevCompressSessionStatus, setCompressSessionStatus } from '../services/compressionService';
import { parseAtMentionedCodeBaseByAttach } from '../utils/codebaseChat';
import { getImageUrlFromAttachs } from '../routes/CodeChat/ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
import { getParsedAttachs, parseFileController } from '../utils/chatAttachParseHandler';
import { ChatModel } from '../services/chatModel';
import { BAI_CHUAN, ParseImgType } from '../services/chatModel';
import { UnionType } from '../routes/CodeChat/ChatTypeAhead/Prompt/type';
import { BUILT_IN_PROMPTS, BUILT_IN_PROMPTS_SPECKIT, specPromptMap } from '../services/builtInPrompts';

const CODE_BACKTICKS = '```';
export const DEFAULT_TOPIC = '';
const ABORT_ERROR_NAME = 'AbortError';
export const REQUEST_TIMEOUT_NAME = 'RequestTimeout';

// 设置会话项目数量的最大阈值为 60。超过这个数量，系统会显示一个界面提示
// 以提醒用户会话太长可能会影响性能或用户体验。
export const MAX_SHOW_TIP_NUM = 60;

export const MAX_CHAT_RETRY_NUM = 3;

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
  message_count: number | null;
  data?: {
    messages: ChatMessage[];
    consumedTokens: {
      input: number
      output: number
      inputCost: number
      outputCost: number
    }
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
  clearSession: () => void;
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
    curSession: ChatSession,
    promptTokens: number,
    completionTokens: number,
    cacheCreationInputTokens: number,
    cacheReadInputTokens: number,
    model: ChatModel,
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
        const filterData = data.filter((item) => item.chat_type === chatType);
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
          if (!currentSessionId || !nextSessions.has(currentSessionId)) {
            currentSessionId = filterData[0]._id;
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

        if (
          !useChatStreamStore.getState().isStreaming &&
          !useChatStreamStore.getState().isSearching &&
          !useChatStreamStore.getState().isApplying &&
          !useChatStreamStore.getState().isTerminalProcessing
        ) {
          try {
            const data = await getSessionData(id);
            const nextSessions = new Map(get().sessions);
            nextSessions.set(id, data);
            const attaches = data.data?.attaches
            resumeAttaches(attaches as IMultiAttachment)
            // 避免流式过程中更新 session 导致消息丢失
            // 避免 syncHistory 正在写入时用服务端旧数据覆盖本地新数据导致消息回滚
            if (
              !useChatStreamStore.getState().isStreaming &&
              !useChatStreamStore.getState().isSearching &&
              !useChatStreamStore.getState().isApplying &&
              !useChatStreamStore.getState().isTerminalProcessing &&
              !pendingSyncCounts.has(id)
            ) {
              set(() => ({ sessions: nextSessions }));
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
            set(() => ({ currentSessionId: null }));
            if (error?.response?.status === 404) {
              console.log(`[Debug] Session ${id} not found, creating new session`);
              get().onNewSession();
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
          const safeConsumedTokens = { input: 0, output: 0, inputCost: 0, outputCost: 0 };
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
        set(() => ({ sessions: sessions }));
      },

      removeSession: async (id: string) => {
        const sessions = get().sessions;
        const chatType = useChatStore.getState().chatType;
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
          await get().loadSessionData(id, { callback: callback });
          // 检查加载后 currentSessionId 是否被清空（说明加载失败）
          if (get().currentSessionId === null) {
            throw new Error('Session not found');
          }
          useChatApplyStore.getState().clearChatApplyInfo();
          set({
            currentSessionId: id,
          });
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

        const newSession = {
          ...session,
          chat_repo: '',
          data: {
            ...session.data,
            messages: [],
            consumedTokens: session.data?.consumedTokens || {
              input: 0,
              output: 0,
              inputCost: 0,
              outputCost: 0,
            },
          },
        };
        try {
          await updateSession(newSession);
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
            consumedTokens: Object.assign({
              input: 0,
              output: 0,
              inputCost: 0,
              outputCost: 0,
            }, sessionData?.consumedTokens || {}),
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
        model: ChatModel,
        curSession: ChatSession,
        promptTokens: number,
        completionTokens: number,
        cacheCreationInputTokens: number,
        cacheReadInputTokens: number,
      }) => {
        const {
          curSession,
          promptTokens = 0,
          completionTokens = 0,
          cacheCreationInputTokens = 0,
          cacheReadInputTokens = 0,
        } = options;
        if (curSession.data) {
          if (!curSession.data.consumedTokens) {
            curSession.data.consumedTokens = { input: 0, output: 0, inputCost: 0, outputCost: 0, }
          }
          const modelCostInfo = useChatConfig.getState().chatModels?.[options.model]?.priceInfo
          if (modelCostInfo) {
            const inputCost = curSession.data?.consumedTokens?.inputCost || 0
            const outputCost = curSession.data?.consumedTokens?.outputCost || 0
            curSession.data.consumedTokens.inputCost = (
              inputCost
              + promptTokens / 1000 * (modelCostInfo?.promptWeight || 0)
              + cacheCreationInputTokens / 1000 * (modelCostInfo?.cacheWeightFor5min || 0)
              + cacheReadInputTokens / 1000 * (modelCostInfo?.hitCacheWeight || 0)
            );
            curSession.data.consumedTokens.outputCost = outputCost + completionTokens / 1000 * (modelCostInfo?.completionWeight || 0);
          }
          curSession.data.consumedTokens.output += completionTokens;
          curSession.data.consumedTokens.input += promptTokens + cacheReadInputTokens + cacheCreationInputTokens;
        }

        if (curSession.data?.compression?.pendingSavedTokens) {
          const messagesCount = curSession.data.messages.length;
          const threshold = (curSession.data.compression.messagesCountAtCompression || 0) + 1;

          if (messagesCount > threshold) {
            curSession.data.compression.pendingSavedTokens = 0;
            curSession.data.compression.messagesCountAtCompression = 0;
          }
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
        if (!session) {
          return;
        }
        const latestData = {
          _id: session._id,
          topic: session.topic,
          data: session.data,
          chat_repo: session.chat_repo,
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
            messages: await serializeCodebaseMessages(
              ChatModel.Gemini3Flash,
              readyToCompress
            ),
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
  // TODO: 后续看是否可以在 store 内通过事务来改变状态
  setIsProcessing: (isProcessing: boolean) => void;
  // TODO: 后续看是否可以在 store 内通过事务来改变状态
  setIsMCPProcessing: (isMCPProcessing: boolean) => void;
  // TODO: 后续看是否可以在 store 内通过事务来改变状态
  setIsApplying: (isApplying: boolean) => void;
  // TODO: 后续看是否可以在 store 内通过事务来改变状态
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
  // // toolCall 结果
  // toolCallResults: {
  //   [propName: string]: ToolCallResult;
  // }
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
    [propName: string]: { path: string; content: string, isError?: boolean, extra?: Record<string, any> };
  }, extra?: any) => void;
};

const DEFAULT_ASSISTANT_MESSAGE = {
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
        useChatStore.getState().syncHistory()
        get().reset()
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
    updateToolCallResults(result: {
      [propName: string]: { path: string; content: string };
    }, extra?: any) {
      let codebaseDefaultAuthorizationPath = [
        ...(useConfigStore.getState().config.codebaseDefaultAuthorizationPath ||
          []),
      ];
      let extraPath: string[] = [];

      const allow_paths = useWorkspaceStore.getState().devSpace.allow_paths;
      if (allow_paths && allow_paths.length) {
        extraPath = allow_paths;
      }

      codebaseDefaultAuthorizationPath = [
        ...codebaseDefaultAuthorizationPath,
        ...extraPath
      ];
      const chatStoreState = useChatStore.getState();
      let isProcessing = true;

      // 监听工具回调的地方
      chatStoreState.updateCurrentSession((session) => {
        if (session && session.data) {
          const messages = session.data.messages || [];
          const lastMessage = messages[messages.length - 1];
          lastMessage.tool_result = lastMessage.tool_result || {};
          lastMessage.tool_result = {
            ...lastMessage.tool_result,
            ...result,
          };
          if (extra && extra.finalResult) {
            lastMessage.finalResult = extra.finalResult
          }
          if (
            !lastMessage.tool_calls?.length ||                      // 没有工具调用
            Object.keys(lastMessage.tool_result).length ===
            lastMessage.tool_calls?.length                            // 或者所有工具结果都收到了
          ) {
            isProcessing = false;                                 // 进入判断：要不要自动继续？
            const allPathsMatch = pathsMatch(
              lastMessage.tool_result,
              codebaseDefaultAuthorizationPath,
            );

            // 兜底措施: 如果当前会话已循环多次，停止自动继续，暂定一个问题 50 条消息作为上限
            // const lastUserIndex = findLastIndex(messages, (msg => msg.role === ChatRole.User));
            // if (lastUserIndex >= 0) {
            //   if (messages.length - lastUserIndex > 50) {
            //   userReporter.report({
            //       event: UserEvent.MAX_AUTO_APPROVED_REACHED
            //     })
            //     return;
            //   }
            // }
            // TODO: 先直接判断 edit_file 自动确认 toolcall 操作，后续拆分
            let auto = false;
            const userConfig = useChatConfig.getState();
            // 根据工具类型和用户配置决定是否自动继续
            if (lastMessage.tool_calls?.length) {
              if (lastMessage.tool_calls.some(toolCall => ['edit_file', 'replace_in_file', 'reapply'].includes(toolCall.function.name))) {
                if (userConfig.autoApply) {
                  useChatApplyStore.getState().acceptEdit(lastMessage.tool_calls[0].id);
                }
              } else if (allPathsMatch) {
                auto = true;              // 路径在授权范围内 → 自动
              } else if (lastMessage.tool_calls.some(toolCall => ['make_plan'].includes(toolCall.function.name))) {
                auto = userConfig.autoPlanApprove;
              } else if (lastMessage.tool_calls.some(toolCall => ["write_todo"].includes(toolCall.function.name))) {
                auto = userConfig.autoTodo;
              } else if (lastMessage.tool_calls.some(toolCall => ["ask_user_question"].includes(toolCall.function.name))) {
                auto = true;
              } else if (userConfig.autoApprove) {
                auto = true;                       // 用户开了自动授权 → 自动
              }
            }
            if (auto) {
               // ⭐ 这就是"循环"！自动提交，触发新一轮 LLM 调用
              const keysObject = Object.keys(lastMessage.tool_result).reduce(
                (acc: any, key) => {
                  (acc as Record<string, boolean>)[key] = true;
                  acc[key] = true;
                  return acc;
                },
                {},
              );
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
              // lastMessage.autoCompleteAdress = true;
            } else if (lastMessage.tool_calls?.length) {
              const isMCPTools = lastMessage.tool_calls.some((tool) => ['use_mcp_tool', 'access_mcp_resource'].includes(tool.function.name));
              const keysObject = Object.keys(lastMessage.tool_result).reduce(
                (acc: any, key) => {
                  (acc as Record<string, boolean>)[key] = true;
                  acc[key] = true;
                  return acc;
                },
                {},
              );
              if (isMCPTools) {
                let mcpServerUsed = '';
                try {
                  const toolParams = JSON.parse(lastMessage.tool_calls[0].function.arguments || '{}');
                  mcpServerUsed = toolParams.server_name;
                } catch {
                  mcpServerUsed = '';
                }
                useChatStreamStore.getState().setIsMCPProcessing(false);
                // 设置自动授权标志
                useChatStreamStore.getState().setIsAutoApproved(true);
                useChatStreamStore.getState().onUserSubmit(
                  '',
                  {
                    event: UserEvent.CODE_CHAT_CODEBASE,
                    isMCPToolResponse: true,
                    mcpServerUsed
                  },
                  undefined,
                  keysObject,
                );
              }
            }
          }
        }
      });
      chatStoreState.syncHistory();
      set(() => ({
        isProcessing: isProcessing,
      }));
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
        retryCount?: number;
        skipUserMessage?: boolean;
        specPrompt?: Prompt;
      },
      originPrompt?: string,
      toolResponse?: {
        [propName: string]: boolean;
      },
      unselectedResults?: Set<string>,
    ) => {
      const chatStoreState = useChatStore.getState();
      // 先判断是否"处于流传输中"或者是"处于搜索中"或者"终端运行中"
      if (get().isStreaming || get().isSearching || get().isTerminalProcessing) {
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
      const codeChatApiBaseUrl = useConfigStore.getState().config.codeChatApiBaseUrl;

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
      const chatType = useChatStore.getState().chatType;

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
      };

      const mask = useMaskStore.getState().currentMask();
      // 非默认模型的 ID 都认为是编程模式
      const isProgrammingMode = IS_PROGRAMMING_MODE.includes(mask?._id || '');

      // 消息重发时此依赖原始数据恢复状态。但发送消息不要携带此消息体，否则会加大token计算
      if (!userMessage._originalRequestData) {
        userMessage._originalRequestData = {};
        Object.assign(userMessage._originalRequestData, {
          content,
          originPrompt,
          attachs,
          options,
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
              if (['edit_file', 'replace_in_file'].includes(tool.function.name)) {
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
                      : 'The user denied this operation.',
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
        userMessage.content = assembleUserPromptContent(formatInput);
        userMessage.systemPrompt = {
          ...chatPromptStoreState.prompt,
          codeBlock: codeBlock,
        };
      }

      // spec prompt 处理
      if (options?.specPrompt) {
        const { name } = options.specPrompt;
        const formatInput = `/${name} \n ${content} `;
        userMessage.content = assembleUserPromptContent(formatInput);
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
          session.data = session.data || { messages: [], consumedTokens: { input: 0, output: 0, inputCost: 0, outputCost: 0, }, attaches: { docsets: [], attachType: AttachType.Docset } };
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

        requestNetworkChatStream(options.event, data, chatRequestUrl, {
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

        const [currentCompressStatus, previousCompressStatus] = await Promise.all([getCompressSessionStatus(sessionId), getPrevCompressSessionStatus(sessionId)])

        // 判断 tokens 是否超了需要进行截断，遍历 messages+3
        const {
          sendMessages,
          containUserMessage,
          newTruncateStart,
          previousTokens,
          fallbackToSlideWindow
        } =
          (
            (
              (previousCompressStatus === SessionStatus.COMPRESSING && currentCompressStatus === SessionStatus.COMPRESSED)
              || (previousCompressStatus === SessionStatus.COMPRESSED && currentCompressStatus === SessionStatus.COMPRESSING)
              || (previousCompressStatus === SessionStatus.COMPRESSED && currentCompressStatus === SessionStatus.COMPRESSED)
            )
            && compressConfig.enable
            && compressConfig.visible
            && !chatModels[chatConfig.model].isPrivate
          )
            ? {
              sendMessages: unCompressedMessages,
              containUserMessage: true,
              newTruncateStart: -1,
              previousTokens: 0,
              fallbackToSlideWindow: false
            }
            : cacheEnable
              ? truncateMessagesIfNeeded({
                messages: unCompressedMessages,
                model: chatConfig.model,
                codebaseModelMaxTokens
              })
              : truncatedMessageWithSlideWindow({
                messages: unCompressedMessages,
                model: chatConfig.model,
                codebaseModelMaxTokens
              });


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
        const codebaseChatSystemPrompt = getCodebaseChatSystemPrompt({
          isReAct,
          effectiveRules
        });
        sendMessages.unshift({
          role: ChatRole.System,
          content: codebaseChatSystemPrompt,
        });
        // FIX：修复消息上下文丢失的问题
        // OPTIMIZED: 遍历 messages +2
        let filteredMessages = await serializeCodebaseMessages(model, sendMessages, session, isReAct);
        // OPTIMIZED: 遍历 messages +1
        filteredMessages = repairToolIdOfMessages(filteredMessages, model);

        // TODO: 不应该在这里重复处理
        if (chatPromptStoreState.prompt && ![
          ...BUILT_IN_PROMPTS.map(prompt => prompt.name),
          ...BUILT_IN_PROMPTS_SPECKIT.map(speckitPrompt => speckitPrompt.name)
        ].includes(chatPromptStoreState.prompt.name)) {
          const currentMessageIndex = filteredMessages.length - 1;
          filteredMessages[currentMessageIndex].content = content;
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

        const data: ChatPromptBody = {
          messages: filteredMessages,
          model: getAIGWModel(chatConfig.model),
          // max_tokens: chatConfig.max_tokens,
          stream: true,
          tool_choice: chatConfig.model.startsWith('claude')
            ? undefined
            : 'auto',
          tools: getCodebaseChatTools(),
        };

        // 如果用户填了 apikey，则使用用户���定的 apiKey
        if (codeChatApiKey) {
          data.app_key = codeChatApiKey;
        }
        if (codeChatApiBaseUrl) {
          data.base_url = codeChatApiBaseUrl;
        }
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
                  const MCPServers = useMCPStore.getState().getAvailableMCPServers();
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
                    'ask_user_question'
                  ].includes(toolCall.function.name))) {
                    isProcessing = false;
                  }
                  set((state) => {
                    state.isStreaming = false;
                    state.isProcessing = isProcessing;
                    state.isApplying = toolCalls.some(toolCall => ['edit_file', 'reapply', 'replace_in_file'].includes(toolCall.function.name));
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
                      for (const tool of toolCalls) {
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
                              const targetServer = MCPServers.find(server => server.name === params.server_name);
                              if (targetServer && targetServer.tools) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else if (targetServer.tools) {
                                  const targetTool = targetServer.tools.find(tool => tool.name === params.tool_name)
                                  if (targetTool && targetTool.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              }
                            } else if (params && params.server_name && params.uri) {
                              const targetServer = MCPServers.find(server => server.name === params.server_name);
                              if (targetServer && targetServer.resources) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else if (targetServer.resources) {
                                  const targetResource = targetServer.resources.find(resource => resource.uri === params.uri)
                                  if (targetResource && targetResource.autoApprove) {
                                    autoApprove = true;
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
                            if (['edit_file', 'reapply', 'replace_in_file'].includes(tool.function.name)) {
                              const filePath = tool_params.target_file;
                              const updateSnippet = tool_params.code_edit;
                              const replaceSnippet = tool_params.diff;
                              const isCreateFile = tool_params.is_create_file;
                              useChatApplyStore.getState().setChatApplyItem(tool.id, {
                                filePath,
                                originalContent: '',
                                updateSnippet,
                                replaceSnippet,
                                type: tool.function.name === 'replace_in_file' ? 'replace' : 'edit',
                                toolCallId: tool.id,
                                applying: true,
                                accepted: false,
                                isCreateFile
                              })
                              userReporter.report({
                                event: tool.function.name === 'replace_in_file' ? UserEvent.CODE_CHAT_REPLACE_IN_FILE : UserEvent.CODE_CHAT_EDIT_FILE,
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
          } else if ([ChatModel.Gemini3Pro].includes(data.model as ChatModel)) {
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

          // 这里是真正给LLM发送消息的地方
          requestCodebaseChatStream(
            data,
            chatRequestUrl,
            {
              onMessage(content, done, toolCalls, totalTokens, completionTokens, promptTokens, cacheCreationInputTokens, cacheReadInputTokens, claude37Response, responseId) {
                get().setStreamRetryCount(0)

                if (toolCalls && toolCalls.length) {
                  // 只取第一个 tool call
                  toolCalls = toolCalls.slice(0, 1);
                }
                if (chatStoreState.isError) {
                  chatStoreState.setError(false);
                }
                if (done) {
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
                  const MCPServers = useMCPStore.getState().getAvailableMCPServers();
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
                    'ask_user_question'
                  ].includes(toolCall.function.name))) {
                    isProcessing = false;
                  }
                  set((state) => {
                    state.isStreaming = false;
                    state.isProcessing = isProcessing;
                    state.isApplying = toolCalls.some(toolCall => ['edit_file', 'reapply', 'replace_in_file'].includes(toolCall.function.name));
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
                      cacheReadInputTokens: cacheReadInputTokens || 0
                    });
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
                      for (const tool of toolCalls) {
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
                              const targetServer = MCPServers.find(server => server.name === params.server_name);
                              if (targetServer && targetServer.tools) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else if (targetServer.tools) {
                                  const targetTool = targetServer.tools.find(tool => tool.name === params.tool_name)
                                  if (targetTool && targetTool.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              } else {
                                const toolName = params?.tool_name?.toLowerCase?.()
                                for (const server of MCPServers) {
                                  const targetTool = (server?.tools || []).find(tool => tool?.name?.toLowerCase?.() === toolName)
                                  if (targetTool) {
                                    if (targetTool?.autoApprove) {
                                      autoApprove = true;
                                    }
                                    params.server_name = server.name
                                    tool.function.arguments = JSON.stringify(params)
                                    break
                                  }
                                }
                              }
                            } else if (params && params.server_name && params.uri) {
                              const targetServer = MCPServers.find(server => server.name === params.server_name);
                              if (targetServer && targetServer.resources) {
                                if (targetServer.autoApprove) {
                                  autoApprove = true;
                                } else if (targetServer.resources) {
                                  const targetResource = targetServer.resources.find(resource => resource.uri === params.uri)
                                  if (targetResource && targetResource.autoApprove) {
                                    autoApprove = true;
                                  }
                                }
                              } else {
                                const uri = params?.uri?.toLowerCase?.()
                                for (const server of MCPServers) {
                                  const targetResource = (server?.resources || []).find(resource => resource?.uri?.toLowerCase?.() === uri)
                                  if (targetResource) {
                                    if (targetResource?.autoApprove) {
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
                            if (['edit_file', 'reapply', 'replace_in_file'].includes(tool.function.name)) {
                              const filePath = tool_params.target_file;
                              const updateSnippet = tool_params.code_edit;
                              const replaceSnippet = tool_params.diff;
                              const isCreateFile = tool_params.is_create_file;
                              useChatApplyStore.getState().setChatApplyItem(tool.id, {
                                filePath,
                                originalContent: '',
                                updateSnippet,
                                replaceSnippet,
                                type: tool.function.name === 'replace_in_file' ? 'replace' : 'edit',
                                toolCallId: tool.id,
                                applying: true,
                                accepted: false,
                                isCreateFile
                              })
                              userReporter.report({
                                event: tool.function.name === 'replace_in_file' ? UserEvent.CODE_CHAT_REPLACE_IN_FILE : UserEvent.CODE_CHAT_EDIT_FILE,
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

        const isCludeThinking = chatModels[model]?.hasThinking && getAIGWModel(model)?.toLocaleLowerCase?.()?.includes?.('claude')
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
        messages[currentMessageIndex].content = content;
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
      if (codeChatApiBaseUrl) {
        data.base_url = codeChatApiBaseUrl;
      }

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
      if (!get().isStreaming && !get().isProcessing && !get().isMCPProcessing && !get().isApplying) {
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
          if (!get().isMCPProcessing && !get().isApplying) {
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

export async function requestChatSessions() {
  const params: ChatHistoryGetterParams = {
    _num: 200,
    _sort_by: '-metadata.create_time',
    _exclude: 'data',
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
