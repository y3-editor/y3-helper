import * as React from 'react';
import {
  Button,
  Box,
  Divider,
  AbsoluteCenter,
  Grid,
  Spinner,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { TbCircleMinus } from 'react-icons/tb';
import ChatNavigationButtons from './ChatNavigationButtons';
import {
  requestChatSessions,
  useChatAttach,
  useChatStore,
  useChatStreamStore,
  useChatSessionTracker,
  MAX_SHOW_TIP_NUM,
  useChatPromptStore,
  nanoid,
  FileItem,
  ImageUrl,
  useUserActionStore,
  IMultiAttachment,
  IProblem,
  FolderItem,
} from '../../store/chat';
import {
  BroadcastActions,
  PostMessageSubscribeType,
  SubscribeActions,
} from '../../PostMessageProvider';
import '../../assets/github-markdown-dark.css';
import ChatHeaderToolbar from './ChatHeaderToolbar';
import ChatMessagesList, {
  StreamingChatMessage,
  ChatMessageHandle,
} from './ChatMessagesList';
import PrePromptCodeBlock from './PrePromptCodeBlock';
import { useAtBottom } from '../../hooks/useAtBottom';
import { Prompt } from '../../services/prompt';
import { ChatTypeAheadHandle } from './ChatTypeAhead/ChatTypeAhead';
import userReporter from '../../utils/report';
import {
  INNER_VARIABLE,
  PROMPT_CODE_VARIABLE,
  prePromptEventIdsMap,
  COMMIT_MSG_PROMPT,
  COMMIT_MSG_SHORT_PROMPT,
  prePromptIdsMap,
  PrePrompt,
  getLatestPrompts,
} from './ChatTypeAhead/Prompt/useUserPrompt';
import { TOAST_STREAMING_PREVENT_SUBMIT_ID } from '../../utils/toast';
import Split from '../../components/Split';
import { SplitDirection, SplitValueType } from '../../components/Split/Split';
import { validateBeforeChat } from '../../utils/validateBeforeChat';
import useCustomToast from '../../hooks/useCustomToast';
import { uploadMessageFeedback } from '../../services/chat';
import ChatMaskVariableForm from './ChatMaskSelector/ChatMaskVariableForm';
import GlobalDataLoader from './GlobalDataLoader';
import Icon from '../../components/Icon';
import { useMaskStore, DEFAULT_MASKS } from '../../store/mask';
import { TypeAheadMode } from './ChatTypeAhead/const';
import { useChatConfig } from '../../store/chat-config';
import { usePluginApp } from '../../store/plugin-app';
import { useMcpPromptApp } from '../../store/mcp-prompt';
import { createSkillToolId, isSkillToolId } from '../../store/skills';
import { useSkillPromptApp } from '../../store/skills/skill-prompt';
import { PromptCategoryType } from '../../services/prompt';
import { debounce, cloneDeep, findLastIndex, isEqual } from 'lodash';
import useService from '../../hooks/useService';
// import ChatSessionClearPanel from './ChatSessionClearPanel';
import { useAuthStore } from '../../store/auth';
import { countGodeGenerate, DateFormat, truncateContent } from '../../utils';
import ChatRecommendation from './ChatRecommendation';
import { Docset, Docsets } from '../../services/docsets';
import {
  ChatFeedbackType,
  ChatMessageContent,
  ChatMessage,
  ChatMessageContentText,
} from '../../services';
import ImagePanel from './ImagePanel';
import { AttachType } from '../../store/attaches';
import ImageUpload, {
  allowedTypes,
  HandleImageUpload,
} from '../../components/ImageUpload/ImageUpload';
import { useChatActionStore } from '../../store/chatAction';
import PluginAppVariableForm from './PluginAppSelector/PluginAppVariableFrom';
import McpPromptVariableForm from './McpPromptSelector/McpPromptVariableForm';
import { usePromptApp } from '../../store/promp-app';
import ChatInput from './ChatInput';
import { useWorkspaceStore } from '../../store/workspace';
import { CodeChatContext } from './CodeChatProvider';
import { ChatSamples } from './ChatSamples';
import useFirstFocusedEffect from '../../hooks/useFirstFocusEffect';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import CodeBaseFeedback, { CodeBaseFeedbackDetail } from './CodeBaseFeedback';
import { filterMentionedAttach } from '../../utils/chatMention';
import { toastError } from '../../services/error';
import { ChatFileItem, useChatApplyStore } from '../../store/chatApply';
import {
  ETerminalStatus,
  terminalCmdFunction,
  useTerminalMessage,
} from './ChatMessagesList/TermialPanel';
import { useChatTerminalStore } from '../../store/chatTerminal';
import ChatBottomTabs, { ChatBottomTabsRef } from './ChatBottomTabs/ChatBottomTabsV2';
// import { LuListTodo } from 'react-icons/lu';
import PlanTab, { PlanTabApi } from './ChatBottomTabs/tabs/PlanTab';
import { UserEvent } from '../../types/report';
import { ChatRole } from '../../types/chat';
// import { MdOutlineDifference } from 'react-icons/md';
import ChatApplyTab from './ChatBottomTabs/tabs/ChatApplyTab';
// import { usePrevious } from '../../hooks/usePrevious';
import { generateCodeQualityFixPrompt } from '../../utils/codebaseQualityAutofix';
import { useMcpServices } from '../../hooks/useMcpServices';
import { shallow } from 'zustand/shallow';
import { useSelecteFileAttach } from './ChatTypeAhead/Attach/Hooks/useSelectFileAttach';
import { useSelectedFolderAttach } from './ChatTypeAhead/Attach/Hooks/useSelectFolderAttach';
import {
  exceedsMaxLines,
  getDiffPatchOfContent,
  getLargeFilePrombt,
} from '../../store/workspace/tools/read';
import { updateCurrentSession as updateCurrentSessionUtil } from '../../hooks/useCurrentSession';
import { generateTraceId } from '../../utils/trace';
import * as ChatNavUtils from './chatNavigationUtils';
import { useGlobalEvent } from '../../hooks/useGlobalEvent';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import {
  EParsedDocsStatus,
  parseReadFileToolContent,
} from '../../utils/chatAttachParseHandler';
import FileUpload from '../../components/FileUpload';
import { TokenUsageIndicator } from './TokenUsageIndicator';
import { ChatModel, ParseImgType } from '../../services/chatModel';
import { useSelectImageAttach } from './ChatTypeAhead/Attach/Hooks/useSelectImageAttach';
import { useUploadRes } from '../../components/ImageUpload/useUploadRes';
import MCPErrorModal from './MCPErrorModal';
import {
  BUILT_IN_PROMPTS_OPENSPEC,
  BUILT_IN_PROMPTS_SPECKIT,
} from '../../services/builtInPrompts';
import SpecInitModal from './SpecInitModal';
import { FaFolderOpen } from 'react-icons/fa';
import SpecActiveChangeGuide from './SpecActiveChangeGuide';
import {
  usePageEntryTour,
  useEventTriggerTour,
  CODEBASE_SESSION_CREATED_EVENT,
} from '../../components/FeatureTour';
import { usePanelContext } from '../../context/PanelContext';

// 468(原本宽度)+40(token数的宽度)
// const MAX_SHOW_CONTEXT_WIDTH = '508px';

//设置最大字符数限制10w
export const MAX_CHARACTER_LIMIT = 100000;

enum ChatTab {
  Changes = 'Changes',
  Plan = 'Plan',
}

function CodeChat() {
  const { isPanelMode, panelId: currentPanelId } = usePanelContext();
  const loading = useChatStore((state) => state.loading());
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const currentSession = useChatStore((state) => state.currentSession());
  const todoList = useChatStore(
    (state) => state.currentSession()?.data?.todoList,
  );
  const [
    revalidateChatSessions,
    updateCurrentSession,
    syncHistory,
    onNewSession,
    selectSession,
  ] = useChatStore(
    (state) => [
      state.revalidateChatSessions,
      state.updateCurrentSession,
      state.syncHistory,
      state.onNewSession,
      state.selectSession,
    ],
    shallow,
  );
  const sessionIDs = useChatSessionTracker((state) => state.sessionIDs);
  const addSessionID = useChatSessionTracker((state) => state.addSessionID);
  const model = useChatConfig((state) => state.config.model);
  const compressConfig = useChatConfig((state) => state.compressConfig);
  const updateChatConfig = useChatConfig((state) => state.update);
  const modelMaxTokenMap = useChatConfig((state) => state.modelMaxToken);
  const setEnableEditableMode = useChatConfig(
    (state) => state.setEnableEditableMode,
  );
  const setDevSpace = useWorkspaceStore((state) => state.setDevSpace);
  const updateTerminals = useChatTerminalStore(
    (state) => state.updateTerminals,
  );

  const [bottomTabActiveKey, setBottomTabActiveKey] = React.useState<
    ChatTab | ''
  >('');
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const setIsProcessing = useChatStreamStore((state) => state.setIsProcessing);
  const isAutoApproved = useChatStreamStore((state) => state.isAutoApproved);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const isApplying = useChatStreamStore((state) => state.isApplying);
  const onUserSubmit = useChatStreamStore((state) => state.onUserSubmit);
  const onStreamStop = useChatStreamStore((state) => state.onStop);
  const updateToolCallResults = useChatStreamStore(
    (state) => state.updateToolCallResults,
  );
  const setStreamRetryCount = useChatStreamStore(
    (state) => state.setStreamRetryCount,
  );
  const chatModels = useChatConfig((state) => state.chatModels);
  const [tokenNumber] = React.useState(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const prePromptCodeBlock = useChatStreamStore((state) =>
    state.getPrePromptByCodeBlock(),
  );
  const [showRecommendation, setShowRecommendation] = React.useState(false);

  const onUpdatePrePromptCodeBlock = useChatStreamStore(
    (state) => state.onUpdatePrePromptCodeBlock,
  );
  const onUpdateSelectionPrePromptCodeBlock = useChatStreamStore(
    (state) => state.onUpdateSelectionPrePromptCodeBlock,
  );
  const onRemovePrePromptCodeBlock = useChatStreamStore(
    (state) => state.onRemovePrePromptCodeBlock,
  );

  const selectedFileHook = useSelecteFileAttach();
  const selectedFolderHook = useSelectedFolderAttach();

  // 功能引导触发器
  usePageEntryTour('/chat');
  useEventTriggerTour(CODEBASE_SESSION_CREATED_EVENT);

  const { stopRunningTerminal } = useTerminalMessage();

  const maskId = useMaskStore((state) => state.config.id);
  const maskList = useMaskStore((state) => state.maskList);
  const mask = React.useMemo(() => {
    return maskList.find((m) => m._id === maskId) || DEFAULT_MASKS[1];
  }, [maskId, maskList]);

  const attachs = useChatAttach((state) => state.attachs);
  const updateAttachs = useChatAttach((state) => state.update);
  const updateChatApplyItem = useChatApplyStore(
    (state) => state.updateChatApplyItem,
  );
  const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);
  const [
    getChatApplyItem,
    handleAcceptEditSuccess,
    handleAcceptEditFailed,
    handleRevertEditSuccess,
    handleRevertEditFailed,
  ] = useChatApplyStore(
    (state) => [
      state.getChatApplyItem,
      state.handleAcceptEditSuccess,
      state.handleAcceptEditFailed,
      state.handleRevertEditSuccess,
      state.handleRevertEditFailed,
    ],
    shallow,
  );
  // const prevChatFileInfo = usePrevious(chatFileInfo);
  // const prevTodoList = usePrevious(todoList);
  const chatBottomTabsRef = React.useRef<ChatBottomTabsRef>(null);
  const selectImageHook = useSelectImageAttach();
  const batchUploadRes = useUploadRes();
  const pluginApp = usePluginApp((state) => state.runner);
  const mcpRunner = useMcpPromptApp((state) => state.runner);
  const skillRunner = useSkillPromptApp((state) => state.runner);
  const [chatType, setChatType] = useChatStore(
    (state) => [state.chatType, state.setChatType],
    shallow,
  );
  const promptApp = usePromptApp((state) => state.runner);
  const updatePromptApp = usePromptApp((state) => state.update);
  const updateChatPrompt = useChatPromptStore((state) => state.update);
  const createdFilePaths = useUserActionStore(
    (state) => state.createdFilePaths,
  );
  const [resumeUserAction, updateAppliedCodeBlocks, updateCreatedFilePaths] =
    useUserActionStore(
      (state) => [
        state.resumeUserAction,
        state.updateAppliedCodeBlocks,
        state.updateCreatedFilePaths,
      ],
      shallow,
    );

  const hasImageAttach = React.useMemo(() => {
    return (
      attachs?.attachType === AttachType.MultiAttachment &&
      (attachs as IMultiAttachment)?.dataSource?.some(
        (i) =>
          i.attachType === AttachType.ImageUrl &&
          (i as ImageUrl)?.imgUrls?.length > 0,
      )
    );
  }, [attachs]);

  const { toast, isActive, closeAll } = useCustomToast();
  useMcpServices();
  useGlobalEvent();

  // 处理选中目录
  const handleSelectedPathsAttach = React.useCallback(
    (selectedPaths: string[]) => {
      if (!Array.isArray(selectedPaths) || !selectedPaths.length) return;
      // 先判断chattype，如果不是codebase才需要setchattype和settimeout
      const isCodeBaseChatMode = chatType === 'codebase';
      if (isCodeBaseChatMode) {
        setChatType('codebase');
      }

      setTimeout(
        () => {
          const folders = selectedPaths.map((path) => ({
            fileName: path.split('/').pop() || path,
            path: path.endsWith('/') ? path : path + '/',
            content: path.endsWith('/') ? path : path + '/',
          }));
          selectedFolderHook.selectFolderAttaches(
            folders as FolderItem[],
            true,
            true,
          );
        },
        isCodeBaseChatMode ? 200 : 1000,
      );
    },
    [setChatType, chatType, selectedFolderHook],
  );

  const chatMessagesRef = React.useRef<ChatMessageHandle | null>(null);
  const chatContextRef = React.useRef<HTMLDivElement>(null);
  const chatBodyRef = React.useRef<HTMLDivElement>(null);
  const [, scrollToBottom] = useAtBottom(chatBodyRef);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const promptProtalRef = React.useRef<ChatTypeAheadHandle | null>(null);
  const uploadImgRef = React.useRef<HandleImageUpload | null>(null);
  const promptRef = React.useRef<Prompt | null>(null);
  const fillInputRef = React.useRef<((text: string) => void) | null>(null);
  const prevStreamState = React.useRef<boolean>(isStreaming);
  // 用户是否打断 auto scroll
  const userScrollLock = React.useRef(false);
  const [isFocused, setFocused] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const isScrollToBottomRef = React.useRef(true);
  const length = currentSession?.data?.messages?.length;
  const { activeTheme } = useTheme();

  const lastMessage = React.useMemo(() => {
    const lastIdx = length ? length - 1 : -1;
    return lastIdx !== -1 ? currentSession?.data?.messages[lastIdx] : undefined;
  }, [currentSession?.data?.messages, length]);

  // const isShowTip = React.useMemo(() => {
  //   return (
  //     length! >= MAX_SHOW_TIP_NUM &&
  //     !sessionIDs.includes(currentSession?._id || '')
  //   );
  // }, [currentSession, sessionIDs, length]);

  const { data, isLoading } = useService(requestChatSessions, {
    revalidateOnFocus: true,
  });

  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const currentFileAutoAttach = useWorkspaceStore(
    (state) => state.currentFileAutoAttach,
  );
  const [showCodebaseFeedBack, setShowCodebaseFeedBack] = React.useState(false);
  const [feedbackDetail, setFeedbackDetail] =
    React.useState<CodeBaseFeedbackDetail | null>(null);

  const [updateApplyingInfo] = useChatStore(
    (state) => [state.updateApplyingInfo],
    shallow,
  );

  const authExtends = useAuthStore((state) => state.authExtends);
  const triggerCustomPromptSample = useChatActionStore(
    (state) => state.triggerCustomPromptSample,
  );
  const triggerCustomMaskSample = useChatActionStore(
    (state) => state.triggerCustomMaskSample,
  );

  const { updateTerminalLog, updateTerminalResult } = useTerminalMessage();

  React.useEffect(() => {
    // 切换会话、新建会话的时候，清空用户反馈的状态
    setShowCodebaseFeedBack(false);
    setFeedbackDetail(null);
    resumeUserAction();
  }, [currentSessionId, resumeUserAction]);

  React.useEffect(() => {
    if (attachs?.attachType === AttachType.Docset) {
      setShowRecommendation(true);
    } else {
      setShowRecommendation(false);
    }
  }, [attachs]);

  React.useEffect(() => {
    if (data) {
      revalidateChatSessions(data.items, chatType);
    }
  }, [data, revalidateChatSessions, chatType, workspaceInfo.repoName]);

  React.useEffect(
    function scrollToBottomWhenChangeSession() {
      if (!loading) {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentSessionId, loading],
  );

  // 质量问题修复功能
  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data.type === SubscribeActions.CODEBASE_QUALITY_ISSUE_AUTOFIX) {
        const autofixData = event.data.data;
        if (
          isStreaming ||
          isProcessing ||
          isMCPProcessing ||
          isTerminalProcessing ||
          isApplying
        ) {
          toast({
            title: '当前对话正在处理中，请稍后再试',
            status: 'info',
            duration: 4000,
            isClosable: true,
          });
          return;
        }
        console.log('[CodeChat] 处理代码质量问题修复请求:', autofixData);

        if (chatType !== 'codebase') {
          console.log('[CodeChat] 自动切换到仓库智聊模式');
          setChatType('codebase');
        }

        setTimeout(() => {
          try {
            const fixPrompt = generateCodeQualityFixPrompt(autofixData);
            if (fillInputRef.current) {
              fillInputRef.current(fixPrompt);
              toast({
                title: `已为您生成${autofixData.sourceModule}问题的修复提示词，请检查后发送。`,
                status: 'success',
                duration: 4000,
                isClosable: true,
              });
            } else {
              toast({
                title: '聊天输入框未准备就绪，请稍后再试。',
                status: 'warning',
                duration: 3000,
                isClosable: true,
              });
            }
          } catch (error) {
            toast({
              title: '自动生成修复提示词时出现错误，请稍后再试。',
              status: 'error',
              duration: 3000,
              isClosable: true,
            });
          }
        }, 500);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    toast,
    chatType,
    setChatType,
    isStreaming,
    isProcessing,
    isMCPProcessing,
    isTerminalProcessing,
    isApplying,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleInputChange = React.useCallback(
    debounce(async () => {
      // 取消之前的异步操作
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 500),
    [],
  );

  const handleMentionAttach = React.useCallback(
    (prompt: string) => {
      // 根据关键字剔除@无效附件
      if (attachs?.attachType !== AttachType.MultiAttachment) return;
      const filteredAttaches = filterMentionedAttach(
        prompt,
        attachs as IMultiAttachment,
      );
      updateAttachs({
        attachType: AttachType.MultiAttachment,
        dataSource: filteredAttaches,
      });
    },
    [attachs, updateAttachs],
  );

  // 清空输入框草稿的辅助函数
  const clearInputDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(`codemaker-draft-input-${chatType}`);
    } catch (e) {
      console.warn('Failed to clear draft input:', e);
    }
  }, [chatType]);

  const handleSubmit = React.useCallback(
    async (prompt: string) => {
      // console.log('prompt', prompt);
      // console.log('pluginApp', promptApp);

      let specPrompt: Prompt | undefined = undefined;
      if (promptApp && !promptApp?.meta?._id.includes('codewiki')) {
        if (
          [
            ...BUILT_IN_PROMPTS_OPENSPEC.map(
              (openspecPrompt) => openspecPrompt.name,
            ),
            ...BUILT_IN_PROMPTS_SPECKIT.map(
              (speckitPrompt) => speckitPrompt.name,
            ),
          ].includes(promptApp.name)
        ) {
          specPrompt = promptApp.meta;
          promptRef.current = promptApp.meta;
        } else {
          prompt = `${promptApp.meta.prompt}\n${prompt}`;
        }
        if (
          ![
            '66cf10e1f16cb1260db58a08', //ER_PROMPT
            '66cf0a830fe8cbf0be33b162', //CLASS_PROMPT
            '66d0704b0fe8cbf0be33b170', // CFG_PROMPT
            '66e00c47f16cb1260db58a95', // SEQUENCE_PROMPT
            '66cd9986f16cb1260db589ec', // MINDMAP_PROMPT
          ].includes(promptApp?.meta?._id || '')
        ) {
          updatePromptApp(undefined);
        }
      }
      userScrollLock.current = false;
      isScrollToBottomRef.current = true;
      // 当没有 pluginApp、没有 prompt、没有 mcpRunner、没有 skillRunner 、也没有 specPrompt 时才阻止发送
      if (!pluginApp && !prompt && !mcpRunner && !skillRunner && !specPrompt) {
        return;
      }

      // 回复中或者查询中不能重复发送消息
      if (isStreaming || isSearching || isProcessing) {
        if (!isActive(TOAST_STREAMING_PREVENT_SUBMIT_ID)) {
          toast({
            id: TOAST_STREAMING_PREVENT_SUBMIT_ID,
            title: 'Y3Maker 正在回复中，请稍后再提问',
            position: 'top',
            duration: 1000,
            status: 'warning',
          });
        }
        return;
      }

      // 对 lead prompt 进行 PROMPT_CODE_VARIABLE 校验
      if (mask?.prompt.includes(PROMPT_CODE_VARIABLE)) {
        if (!prePromptCodeBlock) {
          toast({
            title: '未选择代码片段',
            description:
              '请在编辑区划选需要 Chat 的代码，通过点击【右键菜单】-【Y3Maker】-【Y3Maker: Chat】将代码添加至聊天上下文后，再重新提交。',
            position: 'top',
            status: 'info',
            isClosable: true,
          });
          promptRef.current = null;
          return;
        }
      }

      let _prompt = prompt;

      if (_prompt === '抽盲盒' || _prompt === '盲盒' || _prompt === '开盲盒') {
        // 先把事件上报
        userReporter.submit();
        promptRef.current = null;
        onRemovePrePromptCodeBlock();
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
          setFocused(true);
          clearInputDraft(); // 清空草稿
        }

        const id = nanoid();
        const user = {
          id,
          content: _prompt,
          role: ChatRole.User,
        };
        const assistant = {
          id,
          content:
            'Y3Maker新用户盲盒活动已结束，感谢您的参与！请持续关注，更多精彩活动即将来临～',
          role: ChatRole.Assistant,
          suffix: '',
          loading: false,
        };
        // let userStatue: SteryBoxStatus | null = null;
        updateCurrentSession((session) => {
          session.data?.messages.push(cloneDeep(user));
          session.data?.messages.push(cloneDeep(assistant));
        });
        await syncHistory();
        scrollToBottom();
        return;
      }

      // TODO: Commit Msg 让用户跳转到 source control 操作
      if (
        _prompt === COMMIT_MSG_PROMPT ||
        _prompt === COMMIT_MSG_SHORT_PROMPT
      ) {
        userReporter.submit();
        promptRef.current = null;
        onRemovePrePromptCodeBlock();
        if (inputRef.current) {
          inputRef.current.value = '';
          inputRef.current.focus();
          setFocused(true);
          clearInputDraft(); // 清空草稿
        }
        const id = nanoid();
        const user = {
          id,
          content: _prompt,
          role: ChatRole.User,
        };
        const assistant = {
          id,
          content: '-',
          role: ChatRole.Assistant,
          loading: false,
          commitMsgPayload: {
            short: _prompt === COMMIT_MSG_SHORT_PROMPT,
          },
        };
        updateCurrentSession((session) => {
          session.data?.messages.push(cloneDeep(user));
          session.data?.messages.push(cloneDeep(assistant));
        });
        await syncHistory();
        scrollToBottom();
        return;
      }

      if (_prompt.includes(PROMPT_CODE_VARIABLE)) {
        if (!prePromptCodeBlock) {
          toast({
            title: '未选择代码片段',
            description:
              '请在编辑区划选需要 Chat 的代码，通过点击【右键菜单】-【Y3Maker】-【Y3Maker: Chat】将代码添加至聊天上下文后，再重新选择 Prompt。',
            position: 'top',
            status: 'info',
            isClosable: true,
          });
          promptRef.current = null;
          return;
        }
      }
      _prompt = compileTemplateVariableNode(_prompt, prePromptCodeBlock);

      const length = currentSession?.data?.messages.length;
      if (length! >= MAX_SHOW_TIP_NUM) {
        if (currentSession?._id && !sessionIDs.includes(currentSession?._id)) {
          addSessionID(currentSession._id);
        }
      }

      const event = promptRef.current
        ? prePromptEventIdsMap.get(promptRef.current._id) ||
          UserEvent.CODE_CHAT_PROMPT_CUSTOM
        : UserEvent.CODE_CHAT_PROMPT_CUSTOM;
      if (promptRef.current) {
        userReporter.report({
          event: event as unknown as string,
          extends: {
            prompt_id: promptRef.current._id,
            prompt_name: promptRef.current.name,
            prompt_creator: promptRef.current.metadata?.creator,
            content: promptRef.current.prompt,
            type: promptRef.current.type,
          },
        });
        updateChatPrompt(promptRef.current, prePromptCodeBlock);
      } else {
        updateChatPrompt(undefined, undefined);
      }
      // 发问之后，就不再展示开场问题
      setShowRecommendation(false);
      // @指令时，附件去重处理
      handleMentionAttach(_prompt);
      if (_prompt.length > MAX_CHARACTER_LIMIT) {
        if (![ChatModel.Gemini25, ChatModel.Gemini3Pro].includes(model)) {
          if (new Blob([_prompt]).size > MAX_CHARACTER_LIMIT) {
            //提醒
            toastError(
              '单次限制10万字符，可改用 Gemini-2.5 模型或调整输入内容',
            );
            return;
          }
          if (
            new Blob([JSON.stringify(attachs)]).size >
            MAX_CHARACTER_LIMIT + 1000
          ) {
            //提醒
            toastError(
              '单次限制10万字符，可改用 Gemini-2.5 模型或调整输入内容',
            );
            return;
          }
        } else {
          if (new Blob([_prompt]).size > MAX_CHARACTER_LIMIT * 3) {
            //提醒
            toastError('单次限制30万字符，请调整输入内容');
            return;
          }

          if (
            new Blob([JSON.stringify(attachs)]).size >
            MAX_CHARACTER_LIMIT * 3 + 1000
          ) {
            //提醒
            toastError('单次限制30万字符，请调整输入内容');
            return;
          }
        }

        // TODO: 因为 CodeBase 需要原始的 prompt 切割用户输入的问题，所以现在直接传进去了，后续需要优化
      }
      setStreamRetryCount(0);
      onUserSubmit(
        _prompt,
        { event, specPrompt: specPrompt as Prompt },
        prompt,
      );
      // clear
      onRemovePrePromptCodeBlock();
      if (inputRef.current) {
        if (!promptRef.current || specPrompt) {
          inputRef.current.value = '';
          clearInputDraft(); // 清空草稿
        }
        inputRef.current.focus();
        setFocused(true);
      }
      promptRef.current = null;
    },
    [setStreamRetryCount, addSessionID, currentSession?._id, currentSession?.data?.messages.length, handleMentionAttach, isActive, isProcessing, isSearching, isStreaming, mask?.prompt, onRemovePrePromptCodeBlock, onUserSubmit, pluginApp, prePromptCodeBlock, promptApp, scrollToBottom, sessionIDs, syncHistory, toast, updateChatPrompt, updateCurrentSession, updatePromptApp, attachs, model, mcpRunner, skillRunner, clearInputDraft],
  );

  const handlePrePromptSubmit = React.useCallback(
    async (prompt: Prompt, code: string, language: string) => {
      const markdownCode = `\n \`\`\`${language}\n${code}\n\`\`\`\n`;
      const _prompt = compileTemplateVariableNode(prompt.prompt, markdownCode);
      const event = prePromptEventIdsMap.get(prompt._id);
      userReporter.report({
        event: event as unknown as string,
        extends: {
          prompt_id: prompt._id,
          prompt_name: prompt.name,
          prompt_creator: prompt.metadata?.creator,
          content: prompt.prompt,
          type: prompt.type,
        },
      });
      updateChatPrompt(prompt, markdownCode);
      onUserSubmit(_prompt, { event });
    },
    [onUserSubmit, updateChatPrompt],
  );

  const checkTokensAllowed = React.useCallback(() => {
    if (
      currentSession?.data?.messages &&
      currentSession?.data?.messages.length
    ) {
      const lastMessage =
        currentSession.data.messages[currentSession.data.messages.length - 1];
      if (typeof lastMessage.total_tokens === 'number') {
        return modelMaxTokenMap[model] > lastMessage.total_tokens;
      }
    }
    return true;
  }, [modelMaxTokenMap, model, currentSession]);

  const checkRepoAllowed = React.useCallback(() => {
    if (!workspaceInfo.repoName) {
      return false;
    }
    if (
      currentSession?.chat_repo &&
      currentSession.chat_repo !== workspaceInfo.repoName
    ) {
      return false;
    }
    return true;
  }, [currentSession, workspaceInfo]);

  const handleStopStream = React.useCallback(() => {
    stopRunningTerminal();
    onStreamStop();
    if (inputRef.current) {
      inputRef.current.focus();
      setFocused(true);
    }
  }, [onStreamStop, stopRunningTerminal]);

  React.useEffect(() => {
    async function handleMessage(
      event: MessageEvent<PostMessageSubscribeType>,
    ) {
      const eventData = event.data as any;

      // 多面板模式下，只处理指定给自己的消息或广播消息（无 targetPanelId）
      if (isPanelMode && eventData?.targetPanelId && eventData.targetPanelId !== currentPanelId) {
        return;
      }

      const language = eventData?.data?.language;
      console.debug('[CodeChat] handleMessage', JSON.stringify(eventData));
      if (eventData?.type === SubscribeActions.CHAT_ACTION) {
        if (chatType === 'codebase') {
          if (!checkRepoAllowed()) {
            toast({
              title: '当前会话和工作空间仓库不一致',
              description: '请打开对应的工作空间后再使用仓库聊天功能',
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            return;
          }
        }
        const isNext = validateBeforeChat(
          language,
          model,
          authExtends.c_unrestrict,
        );
        if (!isNext) return;
        const { event, code } = eventData.data as any;
        let promptId = '';
        switch (event) {
          case PrePrompt.Explain:
            promptId = prePromptIdsMap.get(PrePrompt.Explain) || '';
            break;
          case PrePrompt.FindProblem:
            promptId = prePromptIdsMap.get(PrePrompt.FindProblem) || '';
            break;
          case PrePrompt.Optimize:
            promptId = prePromptIdsMap.get(PrePrompt.Optimize) || '';
            break;
          case PrePrompt.UnitTest:
            promptId = prePromptIdsMap.get(PrePrompt.UnitTest) || '';
            break;
        }
        const currentPrompt = (await getLatestPrompts()).find(
          (item: any) => item._id === promptId,
        );
        if (!currentPrompt) return;
        handlePrePromptSubmit(currentPrompt, code, language);
      }
      // 监听从 editor 到 webview 的代码块
      if (eventData?.type === SubscribeActions.CHAT_INSERT_CODE) {
        const isNext = validateBeforeChat(
          language,
          model,
          authExtends.c_unrestrict,
        );
        if (!isNext) return;
        onUpdatePrePromptCodeBlock(eventData?.data);
        if (inputRef.current) {
          // 插入代码块后自动 focus 到输入框
          inputRef.current.focus();
          setFocused(true);
        }
      }
      // 监听从 editor 到 webview 的代码块
      if (eventData?.type === SubscribeActions.TEXT_EDITOR_SELECTION) {
        const isNext = validateBeforeChat(
          language,
          model,
          authExtends.c_unrestrict,
        );
        if (!isNext) return;
        onUpdateSelectionPrePromptCodeBlock(eventData?.data);
        if (inputRef.current) {
          // 插入代码块后自动 focus 到输入框
          inputRef.current.focus();
          setFocused(true);
        }
      }
      if (eventData?.type === SubscribeActions.RUN_CUSTOM_PROMPT_TEMPLATE) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        const content = eventData?.data?.content;
        if (content) {
          const isNext = validateBeforeChat(
            language,
            model,
            authExtends.c_unrestrict,
          );
          if (!isNext) return;
          onUpdatePrePromptCodeBlock(eventData?.data);
        }
        if (inputRef.current) {
          // 插入代码块后自动 focus 到输入框
          // handleTriggerPromptTemplate();
          promptProtalRef.current?.trigger(
            TypeAheadMode.Prompt,
            false,
            PromptCategoryType.User,
          );
        }
      }
      if (eventData?.type === SubscribeActions.APPLY_KEYBOARD_PASTE) {
        handleInputChange();
      }
      if (eventData?.type === SubscribeActions.RUN_PLUGIN_PROMPT_TEMPLATE) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        const isNext = validateBeforeChat(
          language,
          model,
          authExtends.c_unrestrict,
        );
        if (!isNext) return;
        onUpdatePrePromptCodeBlock(eventData?.data);
        if (inputRef.current) {
          // 插入代码块后自动 focus 到输入框
          // handleTriggerPromptTemplate();
          promptProtalRef.current?.trigger(
            TypeAheadMode.Prompt,
            false,
            PromptCategoryType.Plugin,
          );
        }
      }
      if (eventData?.type === SubscribeActions.SEND_CODE_CHAT_MESSAGE) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        const content = eventData?.data.content;
        if (content) {
          onUserSubmit(content, {});
        }
      }
      if (eventData?.type === SubscribeActions.ERROR_ANALYSIS) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        const { context, error_message, language } = eventData?.data || {};
        if (error_message && context) {
          updateChatPrompt({
            name: 'ErrorAnalysis',
            prompt: '请分析下面的错误信息',
            _id: '1715235825372',
            type: PromptCategoryType._CodeMaker,
          });
          handleSubmit(
            '请分析报错原因并提供修复建议，错误信息: \n\n' +
              '```\n' +
              error_message +
              '\n' +
              '```\n\n' +
              '相关代码: \n\n' +
              `\`\`\`${language || ''}\n` +
              context +
              '\n' +
              '```',
          );
        }
      }
      if (eventData?.type === SubscribeActions.EXPLAIN_TERMINAL_SELECTION) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        const { selection } = eventData?.data || {};
        if (selection) {
          updateChatPrompt({
            name: 'ExplainTerminalSelection',
            prompt: '请解释终端输出',
            _id: '1716420480006',
            type: PromptCategoryType._CodeMaker,
          });
          const submitMessage =
            '请解释终端输出: \n\n' + '```\n' + selection + '\n' + '```\n';
          handleSubmit(submitMessage);
        }
      }
      if (eventData?.type === SubscribeActions.SHOW_CUSTOM_PROMPT_SAMPLE) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        if (promptProtalRef.current) {
          promptProtalRef.current?.trigger(
            TypeAheadMode.Prompt,
            false,
            PromptCategoryType.User,
          );
        }
        setTimeout(() => {
          triggerCustomPromptSample({
            promptName: '算法复杂度评估',
            promptContent:
              '假设你是一个编程算法专家，我会给你提供一些算法代码，你会告诉我算法的时间复杂度和空间复杂度，以及有什么优化方案。',
          });
        }, 500);
      }
      if (eventData?.type === SubscribeActions.SHOW_CUSTOM_MASK_SAMPLE) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        if (promptProtalRef.current) {
          promptProtalRef.current?.trigger(
            TypeAheadMode.Mask,
            false,
            PromptCategoryType.User,
          );
        }
        setTimeout(() => {
          triggerCustomMaskSample({
            name: '算法专家',
            description: '算法专家示例聊天模式',
            prompt:
              '假设你是一个编程算法专家，我会给你提供一些算法代码，你会告诉我算法的时间复杂度和空间复杂度，以及有什么优化方案。',
          });
        }, 500);
      }
      if (eventData?.type === SubscribeActions.SHOW_PLUGIN_MARKET) {
        if (chatType === 'codebase') {
          setChatType('default');
        }
        if (promptProtalRef.current) {
          promptProtalRef.current?.trigger(TypeAheadMode.Plugin);
        }
      }
      if (eventData?.type === SubscribeActions.SELECTED_FILES) {
        const files = (event.data.data as FileItem[]) || [];
        let filterFiles = files;
        // 统一过滤掉 c 文件
        if (!authExtends.c_unrestrict && !chatModels[model].isPrivate) {
          filterFiles = files.filter(
            (file) =>
              !file.fileName.endsWith('.c') && !file.fileName.endsWith('.h'),
          );
        }
        if (filterFiles?.length) {
          selectedFileHook.selectFileAttaches(filterFiles, true, true);
        }
      }
      if (eventData?.type === SubscribeActions.SELECTED_PATHS) {
        const { selectedPaths } =
          (event.data.data as { selectedPaths: string[] }) || {};
        if (selectedPaths?.length) {
          handleSelectedPathsAttach(selectedPaths);
        }
      }
      if (eventData?.type === SubscribeActions.INSTALL_BUILTIN_SKILL_RESULT) {
        // 如果消息指定了 targetPanelId，只有匹配的面板处理
        const targetPanelId = eventData?.targetPanelId;
        if (targetPanelId) {
          if (targetPanelId !== currentPanelId) {
            return;
          }
        }
        const result = (eventData?.data || {}) as {
          success?: boolean;
          skillName?: string;
          installPath?: string;
          error?: string;
        };
        if (result.success && result.skillName) {
          // 上报安装事件
          import('../../services/skillUsage').then(({ reportSkillInstall }) => {
            reportSkillInstall(result.skillName!, { source: 'codemaker-command' });
          });
          toast({
            title: 'Skill 安装成功',
            description: `${result.skillName} 已安装到 ${result.installPath}`,
            status: 'success',
            position: 'top',
            duration: 2000,
            isClosable: true,
          });
          const toolId = createSkillToolId();
          window.parent.postMessage(
            {
              type: BroadcastActions.TOOL_CALL,
              panelId: currentPanelId,
              data: {
                tool_name: 'use_skill',
                tool_params: { skill_name: result.skillName },
                tool_id: toolId,
              },
            },
            '*',
          );
        } else {
          useSkillPromptApp.getState().setLoading(false);
          toast({
            title: 'Skill 安装失败',
            description: result.error || '请检查网络连接或登录状态',
            status: 'error',
            position: 'top',
            duration: 3000,
            isClosable: true,
          });
        }
        return;
      }
      if (eventData?.type === SubscribeActions.TOOL_CALL_RESULT) {
        const {
          tool_result,
          tool_id,
          tool_name,
          extra = {},
        } = eventData?.data || {};
        if (tool_name === 'use_skill' && isSkillToolId(tool_id)) {
          // 如果消息指定了 targetPanelId，只有匹配的面板处理
          const targetPanelId = eventData?.targetPanelId;
          if (targetPanelId) {
            if (targetPanelId !== currentPanelId) {
              return;
            }
          }
          const { parseSkillToolResult, getSkillSourceLabel } = await import('../../store/skills');
          const { useSkillPromptApp } = await import('../../store/skills/skill-prompt');
          // 解析skill结果(支持单个对象或数组)
          let skillsDataArray: unknown[] = [];
          const content = tool_result?.content?.trim();
          if (content) {
            try {
              const parsed: unknown = JSON.parse(content);
              skillsDataArray = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              console.error('[use_skill] Failed to parse skill result:', e, tool_result?.content);
              skillsDataArray = [];
            }
          } else {
            console.warn('[use_skill] Empty or invalid skill result content');
            skillsDataArray = [];
          }

          if (tool_result?.isError || skillsDataArray.length === 0) {
            useSkillPromptApp.getState().setLoading(false);
          } else {
            skillsDataArray.forEach((skillDataRaw) => {
              const skillData = parseSkillToolResult(JSON.stringify(skillDataRaw));
              if (skillData) {
                // 如果skill不存在则添加(处理AI直接调用use_skill的情况)
                if (!useSkillPromptApp.getState().hasSkill(skillData.name)) {
                  useSkillPromptApp.getState().addSkill(skillData.name, {
                    title: `/${skillData.name}`,
                    source: getSkillSourceLabel(skillData.source),
                  });
                }
                useSkillPromptApp.getState().setSkillData(skillData.name, skillData);
              } else {
                console.warn('[use_skill] Failed to parse skill data:', skillDataRaw);
              }
            });
          }
          return;
        }
        if (tool_name === terminalCmdFunction) {
          updateTerminalResult({
            messageId: extra?.messageId,
            terminalId: tool_id,
            terminalStatus: extra?.terminalStatus || ETerminalStatus.FAILED,
            content: tool_result.content,
            hasShellIntegration: extra?.hasShellIntegration || false,
          });
          updateTerminals(tool_id, {
            id: tool_id,
            status: extra?.terminalStatusForJetbrains || extra?.status || '',
          });
          return;
        }
        // 先判断当前消息是否在等待回复，是的话，看看 tool_id 是否属于当前消息
        if (currentSession && currentSession.data) {
          const messages = currentSession.data.messages;
          const lastMessage = messages[messages.length - 1];
          if (
            ![
              'edit_file',
              'reapply',
              'replace_in_file',
              'ask_user_question',
            ].includes(tool_name)
          ) {
            // 部分工具不做判断，避免阻塞
            if (!isProcessing && !isMCPProcessing && !isApplying) {
              return;
            }
            if (!lastMessage.tool_calls) {
              return;
            }
            if (
              lastMessage.tool_calls.findIndex(
                (toolCall) => toolCall.id === tool_id,
              ) < 0
            ) {
              return;
            }
          }
        }
        if (['edit_file', 'reapply', 'replace_in_file'].includes(tool_name)) {
          useChatStreamStore.getState().setIsApplying(false);
          if (!tool_result.isError) {
            updateChatApplyItem(tool_id, {
              filePath: tool_result.path,
              finalResult: extra?.finalResult || '',
              beforeEdit: extra?.beforeEdit,
              diffPatch: extra?.diffPatch || '',
              taskId: extra?.taskId,
              applying: false,
              autoApply: useChatConfig.getState().autoApply,
            });
            userReporter.report({
              event:
                tool_name === 'replace_in_file'
                  ? UserEvent.CODE_CHAT_REPLACE_IN_FILE_SUCCESS
                  : UserEvent.CODE_CHAT_EDIT_FILE_SUCCESS,
              extends: {
                filePath: tool_result.path,
                finalResult: extra?.finalResult || '',
                beforeEdit: extra?.beforeEdit,
                editSnippet: extra?.editSnippet,
                replaceSnippet: extra?.replaceSnippet,
                taskId: extra?.taskId,
                tool_id,
                tool_name,
                enablePlanMode: currentSession?.data?.enablePlanMode || false,
              },
            });
          } else {
            userReporter.report({
              event:
                tool_name === 'replace_in_file'
                  ? UserEvent.CODE_CHAT_REPLACE_IN_FILE_FAILED
                  : UserEvent.CODE_CHAT_EDIT_FILE_FAILED,
              extends: {
                filePath: tool_result.path,
                beforeEdit: extra?.beforeEdit,
                editSnippet: extra?.editSnippet,
                replaceSnippet: extra?.replaceSnippet,
                taskId: extra?.taskId,
                tool_id,
                tool_name,
                enablePlanMode: currentSession?.data?.enablePlanMode || false,
              },
            });
            updateChatApplyItem(tool_id, {
              applying: false,
            });
          }
        }
        // 兼容MCP文本TOKEN限制
        if (['use_mcp_tool'].includes(tool_name)) {
          if (Array.isArray(tool_result.content)) {
            // 只有列表才会返回MCP结果内容
            tool_result.content.forEach(
              (contentItem: { type: 'text'; text: string }) => {
                if (contentItem.type === 'text') {
                  contentItem.text = truncateContent(contentItem.text, 60000);
                }
              },
            );
          }
        }
        updateCurrentSession((session) => {
          if (session && session.data) {
            const messages = session.data.messages;
            const lastMessage = messages[messages.length - 1];

            if (lastMessage.tool_calls) {
              const targetToolCallIndex = lastMessage.tool_calls.findIndex(
                (tool) => tool.id === tool_id,
              );
              if (targetToolCallIndex >= 0) {
                if (tool_result) {
                  if (tool_result.isError) {
                    // 工具调用失败
                    userReporter.report({
                      event: UserEvent.CHAT_TOOL_CALL_ERROR,
                      extends: {
                        tool_name: tool_name,
                        tool_id: tool_id,
                        message_id: lastMessage.id,
                        session_id: session._id,
                        error_message: tool_result.content,
                      },
                    });
                  }
                  if (
                    !tool_result.content &&
                    ['retrieve_code', 'retrieve_knowledge'].includes(tool_name)
                  ) {
                    updateToolCallResults({
                      [tool_id]: {
                        path: tool_result.path,
                        content: '未查询到相关信息',
                        isError: tool_result.isError,
                      },
                    });
                  } else if (tool_name === 'read_file') {
                    const fileExt = tool_result.path
                      ? tool_result.path.split('.').pop()
                      : '';
                    if (
                      (fileExt === 'c' || fileExt === 'h') &&
                      !authExtends.c_unrestrict &&
                      !chatModels[model]?.isPrivate
                    ) {
                      updateToolCallResults(
                        {
                          [tool_id]: {
                            path: tool_result.path,
                            content: '(出于安全考虑，当前文件不允许读取)',
                            isError: tool_result.isError,
                          },
                        },
                        extra,
                      );
                    } else {
                      if (
                        extra?.parseDocStatus === EParsedDocsStatus.NotParsed
                      ) {
                        parseReadFileToolContent(tool_id, tool_result);
                        return;
                      } else {
                        let content = tool_result.content;
                        const lines = content.split('\n');
                        // 允许误差行数
                        if (lines?.length > exceedsMaxLines + 10) {
                          content = getLargeFilePrombt(
                            tool_result.path,
                            content,
                          );
                        }
                        updateToolCallResults(
                          {
                            [tool_id]: {
                              path: tool_result.path,
                              content: truncateContent(content),
                              isError: tool_result.isError,
                              extra: extra, // 读取分页的信息
                            },
                          },
                          extra,
                        );
                      }
                    }
                  } else if (
                    ['edit_file', 'reapply', 'replace_in_file'].includes(
                      tool_name,
                    )
                  ) {
                    const beforeEdit = extra?.beforeEdit || '';
                    let finalResult = '';
                    let isLargeFile = false;
                    if (tool_result?.isError) {
                      finalResult = tool_result?.content || '';
                    } else {
                      finalResult = extra?.finalResult || '';
                      isLargeFile =
                        (finalResult?.split('\n')?.length || 0) >
                        exceedsMaxLines;
                      if (isLargeFile) {
                        finalResult = getDiffPatchOfContent(
                          beforeEdit,
                          finalResult,
                        );
                      }
                    }
                    updateToolCallResults(
                      {
                        [tool_id]: {
                          ...tool_result,
                          content: finalResult,
                          isError: tool_result.isError,
                          extra: {
                            isLargeFile: isLargeFile,
                          },
                        },
                      },
                      extra,
                    );
                  } else {
                    // TODO: 如果回复的内容太长，先做截断，后续进行优化
                    if (
                      tool_result.content &&
                      tool_result.content.length > 100000 &&
                      !['retrieve_code', 'retrieve_knowledge'].includes(
                        tool_name,
                      )
                    ) {
                      updateToolCallResults(
                        {
                          [tool_id]: {
                            path: tool_result.path,
                            content: `${tool_result.content.slice(0, 100000)}\n\n(Truncated due to content size limit)`,
                            isError: tool_result.isError,
                            extra: extra,
                          },
                        },
                        extra,
                      );
                    } else {
                      // TODO: 版本过渡，后续把 isError 恢复过来
                      updateToolCallResults(
                        {
                          [tool_id]: {
                            ...tool_result,
                            isError: tool_result.isError,
                            extra: extra,
                          },
                        },
                        extra,
                      );
                    }
                  }
                  // 更新 tool_result
                  if (['retrieve_code'].includes(tool_name)) {
                    let searchResult = [];
                    try {
                      searchResult = JSON.parse(tool_result.content);
                    } catch (e) {
                      console.log('无法解析原内容：', tool_result.content);
                    }
                    const devSpace = useWorkspaceStore.getState().devSpace;

                    let isLpc = false;
                    isLpc = devSpace?.allow_public_model_access === false;
                    searchResult.forEach((item: any) => {
                      item.isLpc = isLpc;
                      if (item.to_func) {
                        item.to_func.forEach((func: any) => {
                          func.isLpc = isLpc;
                        });
                      }
                    });
                    updateToolCallResults(
                      {
                        [tool_id]: {
                          path: tool_result.path,
                          content: JSON.stringify(searchResult),
                          isError: tool_result.isError,
                        },
                      },
                      extra,
                    );
                  }
                }
                if (
                  Object.keys(lastMessage?.tool_result || {}).length ===
                  lastMessage.tool_calls.length
                ) {
                  lastMessage.processing = false;
                  if (tool_result && tool_result.isError) {
                    useChatStreamStore.getState().onUserSubmit(
                      '',
                      {
                        event: UserEvent.CODE_CHAT_CODEBASE,
                      },
                      undefined,
                      {
                        [tool_id]: true,
                      },
                    );
                  }
                }
              }
            }
          }
        });
      }
      if (eventData?.type === SubscribeActions.APPLY_EDIT_START) {
        const { codeBlockId, replacedCodes } = eventData?.data || {};
        userReporter.report({
          event: UserEvent.CODE_CHAT_APPLY_EDIT_START,
          extends: {
            code_block_id: codeBlockId,
            session_id: currentSession?._id,
            repoUrl: workspaceInfo.repoUrl,
            repoName: workspaceInfo.repoName,
            chat_type: chatType,
            ...countGodeGenerate(replacedCodes ? replacedCodes.join('\n') : ''),
          },
        });
        updateApplyingInfo({
          codeBlockId: codeBlockId,
        });
      }
      if (eventData?.type === SubscribeActions.APPLY_EDIT_CANCEL) {
        const { codeBlockId } = eventData?.data || {};
        userReporter.report({
          event: UserEvent.CODE_CHAT_APPLY_EDIT_CANCEL,
          extends: {
            code_block_id: codeBlockId,
            session_id: currentSession?._id,
            chat_type: chatType,
          },
        });
        updateApplyingInfo(null);
      }
      if (eventData?.type === SubscribeActions.APPLY_EDIT_FAILED) {
        const { message } = eventData?.data || {};
        userReporter.report({
          event: UserEvent.CODE_CHAT_APPLY_EDIT_FAILED,
          extends: {
            session_id: currentSession?._id,
            message: message,
            chat_type: chatType,
          },
        });
        toast({
          description: message,
          position: 'top',
          status: 'info',
          isClosable: true,
        });
      }
      if (eventData?.type === SubscribeActions.APPLY_EDIT_SUCCESS) {
        const {
          messageId,
          createdFilePath,
          replacedCodes = [],
          codeBlockId,
        } = eventData?.data || {};
        userReporter.report({
          event: UserEvent.CODE_CHAT_APPLY_EDIT_SUCCESS,
          extends: {
            message_id: messageId,
            repoUrl: workspaceInfo.repoUrl,
            repoName: workspaceInfo.repoName,
            chat_type: chatType,
            ...countGodeGenerate(replacedCodes.join('\n')),
          },
        });
        if (createdFilePath) {
          updateCreatedFilePaths(messageId, [createdFilePath]);
        }
        updateChatApplyItem(codeBlockId, {
          accepted: true,
        });
      }
      if (eventData?.type === SubscribeActions.BATCH_APPLY_CHANGES_SUCCESS) {
        const {
          type,
          messageId,
          createdFilePaths,
          appliedCodeBlockIds = [],
          replacedCodes = [],
          status = 'all',
        } = eventData?.data || {};
        const statusLabel = status === 'part' ? '部分' : '所有';
        toast({
          description:
            type === 'apply'
              ? `批量应用${statusLabel}修改成功`
              : `批量回退${statusLabel}修改成功`,
          position: 'top',
          status: 'info',
          isClosable: true,
        });
        userReporter.report({
          event: UserEvent.CODE_CHAT_BATCH_APPLY_SUCCESS,
          extends: {
            type: type,
            message_id: messageId,
            repoUrl: workspaceInfo.repoUrl,
            repoName: workspaceInfo.repoName,
            chat_type: chatType,
            ...countGodeGenerate(replacedCodes.join('\n')),
          },
        });
        updateCreatedFilePaths(messageId, createdFilePaths);
        updateAppliedCodeBlocks(messageId, appliedCodeBlockIds, type);
      }
      if (eventData?.type === SubscribeActions.BATCH_APPLY_CHANGES_FAILED) {
        const { messageId, message } = eventData?.data || {};
        toast({
          description: `${message}(建议: 手动复制代码替换)`,
          position: 'top',
          status: 'info',
          isClosable: true,
        });
        userReporter.report({
          event: UserEvent.CODE_CHAT_APPLY_BATCH_FAILED,
          extends: {
            message_id: messageId,
            repoUrl: workspaceInfo.repoUrl,
            repoName: workspaceInfo.repoName,
            chat_type: chatType,
          },
        });
      }
      if (eventData?.type === SubscribeActions.APPLY_SINGLE_EDIT_SUCCESS) {
        const {
          messageId,
          appliedCodeBlockIds,
          type,
          createdPath,
          replacedCodes = [],
          status = 'all',
        } = eventData?.data || {};
        const statusLabel = status === 'part' ? '部分' : '';
        toast({
          description:
            type === 'revert'
              ? `回退${statusLabel}代码成功`
              : `应用${statusLabel}修改成功`,
          position: 'top',
          status: 'info',
          isClosable: true,
        });
        if (createdPath) {
          updateCreatedFilePaths(messageId, [createdPath]);
        }
        updateAppliedCodeBlocks(messageId, appliedCodeBlockIds, type);
        userReporter.report({
          event:
            type === 'revert'
              ? UserEvent.CODE_CHAT_SINGLE_REVERT_SUCCESS
              : UserEvent.CODE_CHAT_SINGLE_APPLY_SUCCESS,
          extends: {
            message_id: messageId,
            repoUrl: workspaceInfo.repoUrl,
            repoName: workspaceInfo.repoName,
            chat_type: chatType,
            ...countGodeGenerate(replacedCodes.join('\n')),
          },
        });
      }
      // 获取工作区间错误
      if (eventData?.type === SubscribeActions.ON_GET_WORKSPACE_PROBLEMS) {
        const attach = {
          attachType: AttachType.Problems,
          problem: eventData?.data,
        };
        if (attachs?.attachType !== AttachType.MultiAttachment) {
          updateAttachs({
            attachType: AttachType.MultiAttachment,
            dataSource: [attach],
          });
        } else {
          const dataSource = [
            ...((attachs as IMultiAttachment).dataSource || []),
          ];
          const target = dataSource.find(
            (d) => d?.attachType === AttachType.Problems,
          );
          if (target) {
            (target as IProblem).problem = eventData?.data;
          } else {
            dataSource.push(attach);
          }
          updateAttachs({
            attachType: AttachType.MultiAttachment,
            dataSource: dataSource,
          });
        }
      }
      if (eventData?.type === SubscribeActions.PREVIEW_DIFF_RESULT) {
        const { success, message } = eventData?.data || {};
        if (!success) {
          toast({
            description: message,
            position: 'top',
            status: 'info',
            isClosable: true,
          });
        }
      }
      if (
        eventData?.type === SubscribeActions.REAPPLY_EDIT_RESULT ||
        eventData?.type === SubscribeActions.REAPPLY_REPLACE_RESULT
      ) {
        const {
          filePath,
          toolCallId,
          finalResult,
          originalContent,
          isError,
          taskId,
          diffPatch,
          beforeEdit,
        } = eventData?.data || {};
        if (!isError) {
          if (finalResult === originalContent) {
            // TODO: 待去掉
            updateChatApplyItem(toolCallId, {
              applying: false,
            });
            userReporter.report({
              event: UserEvent.CODE_CHAT_REAPPLY_SUCCESS,
              extends: {
                toolCallId,
                filePath,
                finalResult,
                originalContent,
                noChange: true,
                type:
                  eventData?.type === SubscribeActions.REAPPLY_REPLACE_RESULT
                    ? 'replace'
                    : 'edit',
              },
            });
            toast({
              description: 'apply无改动',
            });
          } else {
            updateChatApplyItem(toolCallId, {
              filePath,
              finalResult,
              beforeEdit,
              applying: false,
              accepted: false,
              rejected: false,
              autoApply: useChatConfig.getState().autoApply,
              diffPatch,
              taskId,
            });
            if (useChatConfig.getState().autoApply) {
              // 自动应用
              const item = getChatApplyItem(toolCallId);
              if (item && item.finalResult) {
                window.parent.postMessage(
                  {
                    type: BroadcastActions.ACCEPT_EDIT,
                    data: {
                      item: item,
                    },
                  },
                  '*',
                );
              }
            }
            // if (originalContent !== undefined) {
            //   setFileOriginalContent(filePath, originalContent, true);
            // }
            // postMessage({
            //   type: 'DIFF_WHOLE_FILE',
            //   data: {
            //     filePath,
            //     finalResult,
            //     toolCallId,
            //     isCreateFile
            //   },
            // });
            userReporter.report({
              event: UserEvent.CODE_CHAT_REAPPLY_SUCCESS,
              extends: {
                toolCallId,
                filePath,
                finalResult,
                originalContent,
                type:
                  eventData?.type === SubscribeActions.REAPPLY_REPLACE_RESULT
                    ? 'replace'
                    : 'edit',
              },
            });
          }
        } else {
          updateChatApplyItem(toolCallId, {
            applying: false,
          });
          userReporter.report({
            event: UserEvent.CODE_CHAT_REAPPLY_FAILED,
            extends: {
              toolCallId,
              filePath,
              finalResult,
              originalContent,
              type:
                eventData?.type === SubscribeActions.REAPPLY_REPLACE_RESULT
                  ? 'replace'
                  : 'edit',
            },
          });
        }
      }
      if (eventData?.type === SubscribeActions.ACCEPT_EDIT_RESULT) {
        const { result } = eventData?.data || {};
        if (result) {
          if (result.success) {
            handleAcceptEditSuccess(result.item);
            if (!result.item?.autoApply) {
              toast({
                description: '应用修改成功',
                position: 'top',
                status: 'info',
                isClosable: true,
              });
            }
            if (result.item.toolCallId) {
              const { filePath, beforeEdit, isCreateFile } = result.item;
              updateCurrentSession((session) => {
                if (session && session.data) {
                  const messages = session.data.messages;
                  const lastUserIndex = findLastIndex(
                    messages,
                    (msg) => msg.role === ChatRole.User,
                  );
                  if (lastUserIndex >= 0) {
                    const lastUserMessage =
                      session.data.messages[lastUserIndex];
                    lastUserMessage.checkPointFiles =
                      lastUserMessage.checkPointFiles || {};
                    if (!lastUserMessage.checkPointFiles[filePath]) {
                      lastUserMessage.checkPointFiles[filePath] = {
                        content: beforeEdit,
                        filePath,
                        isCreateFile,
                      };
                    }
                  }
                }
              });
              useChatStreamStore.getState().onUserSubmit(
                '',
                {
                  event: UserEvent.CODE_CHAT_CODEBASE,
                },
                undefined,
                {
                  [result.item.toolCallId]: true,
                },
              );
            }
          } else {
            handleAcceptEditFailed(result.item);
            toastError(result.message);
          }
        }
      }
      if (eventData?.type === SubscribeActions.REVERT_EDIT_RESULT) {
        const { result } = eventData?.data || {};
        if (result) {
          if (result.success) {
            handleRevertEditSuccess(result.item);
            toast({
              description: '回退修改成功',
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            updateCurrentSession((session) => {
              if (session && session.data) {
                const messages = session.data.messages;
                const msgId = nanoid();
                const item = result.item;
                if (messages) {
                  const newUserMessage: ChatMessage = {
                    id: msgId,
                    role: ChatRole.User,
                    hidden: true,
                    content: [
                      {
                        type: ChatMessageContent.Text,
                        text:
                          'The following files has been reverted to previous status as below:\n' +
                          item.filePath,
                      },
                      {
                        type: ChatMessageContent.Text,
                        text: `<final_file_content path="${item.filePath}">\n${item.originalContent || '(file content empty)'}\n</final_file_content>`,
                      },
                    ],
                  };
                  messages.push(newUserMessage);
                  const newAssistantMessage: ChatMessage = {
                    id: msgId,
                    role: ChatRole.Assistant,
                    content: 'ok',
                    revertedFiles: {
                      [item.filePath]: {
                        filePath: item.filePath,
                        content: item.originalContent,
                      },
                    },
                  };
                  messages.push(newAssistantMessage);
                }
              }
            });
          } else {
            handleRevertEditFailed(result.item);
            toastError(result.message);
          }
        }
      }
      if (eventData?.type === SubscribeActions.BATCH_ACCEPT_EDIT_RESULT) {
        const { results } = eventData?.data || {};
        if (Array.isArray(results)) {
          let successCount = 0;
          results.forEach((result) => {
            if (result.success) {
              handleAcceptEditSuccess(result.item);
              successCount++;
            } else {
              handleAcceptEditFailed(result.item);
            }
          });
          if (successCount === results.length) {
            toast({
              description: '应用修改成功',
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_ACCEPT_EDIT_SUCCESS,
            });
          } else if (successCount === 0) {
            toast({
              description: `部分修改应用失败，${results.length - successCount} 个修改应用失败`,
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_ACCEPT_EDIT_FAILED,
            });
          } else {
            toastError('应用修改失败');
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_ACCEPT_EDIT_FAILED,
            });
          }
        }
      }
      if (eventData?.type === SubscribeActions.BATCH_REVERT_EDIT_RESULT) {
        const { results } = eventData?.data || {};
        if (Array.isArray(results)) {
          const successRevert: ChatFileItem[] = [];
          results.forEach((result) => {
            if (result.success) {
              handleRevertEditSuccess(result.item);
              // successCount++;
              successRevert.push(result.item);
            } else {
              handleRevertEditFailed(result.item);
            }
          });
          if (successRevert.length === results.length) {
            toast({
              description: '回退修改成功',
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_REVERT_EDIT_SUCCESS,
            });
          } else if (successRevert.length === 0) {
            toast({
              description: `部分修改回退失败，${results.length - successRevert.length} 个修改回退失败`,
              position: 'top',
              status: 'info',
              isClosable: true,
            });
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_REVERT_EDIT_FAILED,
            });
          } else {
            toastError('回退修改失败');
            userReporter.report({
              event: UserEvent.CODE_CHAT_BATCH_REVERT_EDIT_FAILED,
            });
          }
          if (successRevert.length > 0) {
            updateCurrentSession((session) => {
              if (session && session.data) {
                const messages = session.data.messages;
                const msgId = nanoid();
                if (messages) {
                  const newUserMessage: ChatMessage = {
                    id: msgId,
                    role: ChatRole.User,
                    hidden: true,
                    content: [
                      {
                        type: ChatMessageContent.Text,
                        text:
                          'The following files has been reverted to previous status as below:\n' +
                          successRevert.map((item) => item.filePath).join('\n'),
                      },
                    ],
                  };
                  successRevert.forEach((item: ChatFileItem) => {
                    (newUserMessage.content as ChatMessageContentText[]).push({
                      type: ChatMessageContent.Text,
                      text: `<final_file_content path="${item.filePath}">\n${item.originalContent || '(file content empty)'}\n</final_file_content>`,
                    });
                  });
                  messages.push(newUserMessage);
                  const newAssistantMessage: ChatMessage = {
                    id: msgId,
                    role: ChatRole.Assistant,
                    content: 'ok',
                    revertedFiles: {},
                  };
                  successRevert.forEach((item) => {
                    if (newAssistantMessage.revertedFiles) {
                      newAssistantMessage.revertedFiles[item.filePath] = {
                        filePath: item.filePath,
                        content: item.originalContent,
                      };
                    }
                  });
                  messages.push(newAssistantMessage);
                }
              }
            });
            syncHistory();
          }
        }
      }

      if (eventData?.type === SubscribeActions.TERMINAL_TRANSFER_LOG) {
        const { terminalId, messageId, log, extra } = eventData?.data || {};
        updateTerminalLog({
          messageId,
          terminalId,
          log,
          terminalStatus: extra?.terminalStatus || ETerminalStatus.RUNNING,
          enableTimeout: true,
        });
        updateTerminals(terminalId, {
          id: terminalId,
          status: extra?.terminalStatusForJetbrains || extra?.status || '',
        });
      }

      if (eventData?.type === SubscribeActions.EVALUATION_TASK) {
        const {
          messages,
          session_id: sessionId,
          model,
          plan,
          triggerer,
          read_only: readOnly,
          devSpace,
        } = eventData?.data || {};
        if (messages && Array.isArray(messages) && messages.length > 0) {
          const message = messages[messages.length - 1].content;
          if (sessionId) {
            await selectSession(sessionId);
          } else {
            await onNewSession(undefined, {
              chat_source: 'remote',
              raw_user: triggerer,
            });
          }
          handleStopStream();
          updateChatConfig((config) => {
            config.model = model || config.model;
          });
          // 设置自动化执行配置
          useChatConfig.getState().updateAutoApply(true);
          useChatConfig.getState().updateAutoApprove(true);
          useChatConfig.getState().updateAutoExecute(true);
          useChatConfig.getState().updateAutoPlanApprove(true);
          if (plan) {
            updateCurrentSessionUtil((session) => {
              if (session.data) {
                session.data.enablePlanMode = true;
              }
            });
          }
          if (devSpace && typeof devSpace === 'object') {
            setDevSpace({
              _id: generateTraceId(),
              name: (triggerer || '') + 'Task',
              project: 'Task',
              knowledge_bases: devSpace.knowledge_bases || [],
              codebases: devSpace.codebases || [],
              code_style: devSpace.code_styles?.[0]?.style || '',
              ignore_paths: [],
              allow_paths: [],
              repos: [],
              allow_public_model_access: false,
              rules: []
            });
          }
          setEnableEditableMode(readOnly ? false : true);
          onUserSubmit(
            message,
            {
              event: UserEvent.CODE_CHAT_CODEBASE,
            },
            message,
          );
        }
      }
      if (eventData?.type === SubscribeActions.CURRENT_FILE_CHANGE) {
        const { filePath, content = '', fileName } = eventData?.data || {};
        if (currentFileAutoAttach) {
          const selectedFile = {
            path: filePath,
            content: content,
            fileName: fileName,
            isCurrent: true,
          } as unknown as FileItem;
          selectedFileHook.selectFileAttaches([selectedFile], false);
        }
      }

      if (eventData?.type === SubscribeActions.ON_WEBVIEW_DRAG_LEAVE) {
        setIsDragOver(false);
      }

      if (eventData?.type === SubscribeActions.ON_WEBVIEW_DRAG_ENTER) {
        setIsDragOver(true);
      }

      if (eventData?.type === SubscribeActions.ON_WEBVIEW_DROP) {
        setIsDragOver(false);
        let { resourceUrlsData, files } = eventData?.data || {};
        try {
          resourceUrlsData = JSON.parse(resourceUrlsData);
          resourceUrlsData = resourceUrlsData.filter(
            (uri: string) =>
              uri &&
              (uri.startsWith('vscode-file:') || uri.startsWith('file:')),
          );
        } catch (e) {
          resourceUrlsData = [];
        }
        let hasNoneWorkspaceFile = false;
        files = (Array.from(files) as []).filter((i: File) => {
          if (allowedTypes.includes(i.type)) {
            return true;
          }
          hasNoneWorkspaceFile = true;
          return false;
        });
        if (hasNoneWorkspaceFile) {
          toast({
            title: '目前只支持非工作区域图片类型，拖拽进行上传',
          });
          return;
        }
        if (
          chatModels[model].parseImgType === ParseImgType.NONE &&
          (files.length ||
            resourceUrlsData?.some((url: string) =>
              ['png', 'webp', 'jpg', 'gif']?.some((l) => url?.endsWith(l)),
            ))
        ) {
          toast({
            title: '当前模型不支持图片拖拽进行上传',
          });
          return;
        }

        if (files.length) {
          batchUploadRes(files);
        }
        if (resourceUrlsData.length) {
          window.parent.postMessage(
            {
              type: BroadcastActions.DROP_FILES,
              data: {
                fileUrls: resourceUrlsData,
              },
            },
            '*',
          );
        }
      }

      if (eventData?.type === SubscribeActions.ON_VSCODE_DROP_FILES) {
        const files = eventData?.data;
        if (Array.isArray(files)) {
          const textFiles: FileItem[] = [];
          const imageFiles: File[] = [];
          files.forEach((file) => {
            if (file.type === 'image') {
              const content = file?.data?.content as any;
              if (content) {
                const uint8Array = new Uint8Array(content.data);
                const blob = new Blob([uint8Array], { type: 'image/png' });
                const newFile = new File([blob], `${Date.now()}.png`, {
                  type: blob.type,
                });
                imageFiles.push(newFile);
              }
            } else {
              if (file?.data?.isError) {
                toast({
                  title: file?.data?.content,
                  status: 'error',
                  duration: 2000,
                });
                return;
              }
              textFiles.push(file?.data);
            }
          });
          if (textFiles?.length) {
            selectedFileHook.selectFileAttaches(textFiles, true, true);
          }
          if (imageFiles.length) {
            batchUploadRes(imageFiles);
          }
        }
      }
    }

    // 监听 postMessage 消息
    window.addEventListener('message', handleMessage);

    return () => {
      // 移除消息监听器
      window.removeEventListener('message', handleMessage);
    };
  }, [batchUploadRes, closeAll, chatModels, selectImageHook, selectedFileHook, updateTerminals, onUpdatePrePromptCodeBlock, onUpdateSelectionPrePromptCodeBlock, onUserSubmit, model, attachs, workspaceInfo.repoCodeTable, updateAppliedCodeBlocks, handleInputChange, authExtends.c_unrestrict, updateChatPrompt, handleSubmit, triggerCustomPromptSample, triggerCustomMaskSample, updateAttachs, chatType, toast, syncHistory, checkRepoAllowed, checkTokensAllowed, handlePrePromptSubmit, setChatType, isProcessing, currentSession, updateCurrentSession, updateTerminalResult, updateTerminalLog, updateToolCallResults, updateApplyingInfo, workspaceInfo.repoUrl, workspaceInfo.repoName, setIsProcessing, createdFilePaths, updateCreatedFilePaths, currentFileAutoAttach, getChatApplyItem, handleAcceptEditFailed, handleAcceptEditSuccess, handleRevertEditFailed, handleRevertEditSuccess, handleSelectedPathsAttach, isApplying, isMCPProcessing, updateChatApplyItem, onNewSession, handleStopStream, selectSession, updateChatConfig, setEnableEditableMode, setDevSpace, isPanelMode, currentPanelId]);

  // TODO: 当 attachs、prePromptCodeBlock 或 config.historyMessageCount 改变时，会重新计算 token 数
  useFirstFocusedEffect(() => {
    handleInputChange();
    // 会话长度变化的时候，也需要重新计算 token 数
  }, [handleInputChange, currentSession?.data?.messages.length]);

  const handleResetPrompt = React.useCallback(
    (content: string) => {
      if (inputRef.current) {
        inputRef.current.value = content;
        EventBus.instance.dispatch(EBusEvent.Focus_Textarea);
        setFocused(true);
        handleInputChange();
      }
    },
    [handleInputChange],
  );

  React.useEffect(() => {
    EventBus.instance.on(EBusEvent.Edit_User_Message, handleResetPrompt);
    return () => {
      return EventBus.instance.off(
        EBusEvent.Edit_User_Message,
        handleResetPrompt,
      );
    };
  }, [handleResetPrompt, loading, toast]);

  React.useEffect(() => {
    prevStreamState.current = isStreaming;
  }, [isStreaming]);

  // TODO: attachs 更新的时候，是否需要滚动到底部
  React.useEffect(() => {
    if (prePromptCodeBlock) {
      scrollToBottom();
      return;
    }
  }, [prePromptCodeBlock, scrollToBottom]);

  React.useEffect(() => {
    const onUnlockScrool = () => {
      userScrollLock.current = false;
      isScrollToBottomRef.current = false;
    };
    EventBus.instance.on(EBusEvent.CodeChat_Unlock_Scroll, onUnlockScrool);
    return () => {
      return EventBus.instance.off(
        EBusEvent.CodeChat_Unlock_Scroll,
        onUnlockScrool,
      );
    };
  }, []);

  // 自动滚动到 stream 流回复框中
  React.useLayoutEffect(() => {
    let timer: number | null = null;
    // isStreaming 状态从 false 转变为 true，表示重新进行流数据渲染，此时重置 useScrollLock
    if (!isStreaming && prevStreamState.current) {
      // 流结束后的滚动逻辑保持不变
      if (!userScrollLock.current) {
        setTimeout(() => {
          scrollToBottom();
        }, 300);
      }
      // 重置自动授权标志
      if (isAutoApproved) {
        useChatStreamStore.getState().setIsAutoApproved(false);
      }
    }
    if (isStreaming) {
      timer = window.setInterval(() => {
        if (!userScrollLock.current) {
          scrollToBottom();
        }
      }, 300);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isStreaming, scrollToBottom, isAutoApproved]);

  const CodeChatContextValue = React.useMemo(() => {
    return {
      chatMessagesRef,
      chatContextRef,
    };
  }, [chatMessagesRef, chatContextRef]);

  const shouldShowDocsetTips = React.useMemo(() => {
    if (isStreaming) return false;
    if (attachs?.attachType !== AttachType.Docset) return false;
    const { docsets = [] } = attachs as Docsets;
    if (!docsets.length || docsets.length > 2) return false;
    const docset = docsets[0];
    if ((docset as Docset)?.chat_config?.chat_mode.use_messages) {
      return false;
    }
    return true;
  }, [attachs, isStreaming]);

  const questions = React.useMemo(() => {
    if (attachs?.attachType !== AttachType.Docset) return [];
    const { docsets = [] } = attachs as Docsets;
    return docsets[0]?.predetermined_questions || [];
  }, [attachs]);

  const shouldShowRecommendation = React.useMemo(() => {
    return (
      currentSession?.data?.messages.length !== 0 &&
      attachs?.attachType === AttachType.Docset &&
      showRecommendation &&
      !isStreaming &&
      (attachs as Docsets).docsets.length === 1 &&
      ((attachs as Docsets)?.docsets[0] as Docset)?.predetermined_questions
        ?.length > 0
    );
  }, [
    currentSession?.data?.messages.length,
    attachs,
    showRecommendation,
    isStreaming,
  ]);

  const submitFeedback = React.useCallback(
    (feedbackDetail: CodeBaseFeedbackDetail) => {
      if (feedbackDetail.feedback_type === ChatFeedbackType.UpVote) {
        userReporter.report({
          event: UserEvent.CODE_CHAT_UP_VOTE,
          extends: {
            session_id: feedbackDetail.session_id,
            message_id: feedbackDetail.message_id,
            chat_type: chatType,
          },
        });
      } else {
        userReporter.report({
          event: UserEvent.CODE_CHAT_DOWN_VOTE,
          extends: {
            session_id: feedbackDetail.session_id,
            message_id: feedbackDetail.message_id,
            chat_type: chatType,
          },
        });
      }
      uploadMessageFeedback({
        topic: currentSession?.topic || '',
        chat_type: chatType,
        chat_repo: workspaceInfo.repoUrl || '',
        session_id: feedbackDetail.session_id,
        message_id: feedbackDetail.message_id,
        feedback_type: feedbackDetail.feedback_type,
        feedback: feedbackDetail.feedback,
        messages: feedbackDetail.messages,
        imgUrls: feedbackDetail.imgUrls,
      });
      toast({
        title: '反馈成功',
        status: 'success',
        duration: 2000,
      });
      // 更新当前会话的状态
      updateCurrentSession((session) => {
        const currentMsg = session?.data?.messages.find(
          (msg) =>
            msg.id === feedbackDetail.message_id &&
            msg.role === ChatRole.Assistant,
        );
        if (currentMsg) {
          currentMsg.feedback = feedbackDetail.feedback_type;
        }
      });
      syncHistory();
      setShowCodebaseFeedBack(false);
      setFeedbackDetail(null);
    },
    [
      updateCurrentSession,
      syncHistory,
      toast,
      currentSession?.topic,
      chatType,
      workspaceInfo.repoUrl,
    ],
  );

  const [userMsgIndexes, setUserMsgIndexes] = React.useState<number[]>([]);
  const [currentUserMsgIdx, setCurrentUserMsgIdx] = React.useState<number>(-1);
  // 监听消息变化，收集所有用户消息的索引
  React.useEffect(() => {
    const msgs = currentSession?.data?.messages || [];
    const indexes = ChatNavUtils.calculateUserMsgIndexes(msgs);

    setUserMsgIndexes((prev) => {
      if (isEqual(prev, indexes)) {
        return prev;
      }
      return indexes;
    });

    setCurrentUserMsgIdx(indexes.length ? indexes.length - 1 : -1);
  }, [currentSession?.data?.messages]);

  // 监听滚动位置，当滚动到底部时更新当前用户消息索引
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = React.useState(true);

  React.useEffect(() => {
    let scrollTimeout: number;

    const handleScroll = () => {
      if (!isAutoScrollEnabled) return; // 如果自动滚动被禁用，直接返回

      if (chatBodyRef.current && userMsgIndexes.length > 0) {
        const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 允许10px的误差

        // 清除之前的定时器
        clearTimeout(scrollTimeout);

        // 设置一个短暂的延迟，避免在用户手动滚动时立即更新
        scrollTimeout = window.setTimeout(() => {
          if (isAtBottom) {
            // 使用函数式更新，避免依赖 currentUserMsgIdx
            setCurrentUserMsgIdx((prevIdx) => {
              if (prevIdx !== userMsgIndexes.length - 1) {
                return userMsgIndexes.length - 1;
              }
              return prevIdx;
            });
          }
        }, 200); // 增加延迟到200ms
      }
    };

    const container = chatBodyRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        clearTimeout(scrollTimeout);
      };
    }
  }, [chatBodyRef, userMsgIndexes, isAutoScrollEnabled]); // 添加 isAutoScrollEnabled 依赖

  // 跳转到指定用户消息
  const scrollToUserMessage = (targetIdx: number) => {
    if (
      userMsgIndexes.length === 0 ||
      targetIdx < 0 ||
      targetIdx >= userMsgIndexes.length
    ) {
      return;
    }

    // 暂时禁用自动滚动，避免干扰用户导航
    setIsAutoScrollEnabled(false);

    const msgs = currentSession?.data?.messages || [];
    const msg = msgs[userMsgIndexes[targetIdx]];

    if (msg && msg.id) {
      // 使用 ChatMessagesList 的 scrollToMessage 方法，确保目标消息被渲染
      if (chatMessagesRef.current) {
        chatMessagesRef.current.scrollToMessage('user', msg.id, '');
        setCurrentUserMsgIdx(targetIdx);

        // 滚动完成后重新启用自动滚动
        setTimeout(() => {
          setIsAutoScrollEnabled(true);
        }, 1000); // 增加到1000ms确保滚动和分页加载完成
      } else {
        // 降级方案：直接查找DOM元素
        const el = document.getElementById(`user-message-${msg.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setCurrentUserMsgIdx(targetIdx);

          setTimeout(() => {
            setIsAutoScrollEnabled(true);
          }, 500);
        } else {
          setIsAutoScrollEnabled(true);
        }
      }
    } else {
      setIsAutoScrollEnabled(true); // 如果没找到消息，立即重新启用
    }
  };

  const handlePrevUserMessage = () => {
    if (userMsgIndexes.length === 0) {
      return;
    }
    // 如果已经在第一条消息，则不再跳转
    if (currentUserMsgIdx <= 0) {
      return;
    }
    const prevIdx = currentUserMsgIdx - 1;
    scrollToUserMessage(prevIdx);
  };
  const handleNextUserMessage = () => {
    if (userMsgIndexes.length === 0) {
      return;
    }

    // 优先跳转到流式消息
    if (isStreaming) {
      const el = document.getElementById('streaming-assistant');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    // 如果已经在最后一条消息，则不再跳转
    if (currentUserMsgIdx >= userMsgIndexes.length - 1) {
      return;
    }

    const nextIdx = currentUserMsgIdx + 1;
    scrollToUserMessage(nextIdx);
  };

  // 检查是否可以上一组：当前位置 - 1 后是否 >= 0
  const canGoPrev = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    return currentUserMsgIdx - 1 >= 0;
  }, [userMsgIndexes.length, currentUserMsgIdx]);

  // 检查是否可以下一组：当前位置 + 1 后是否 <= 最大索引
  const canGoNext = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    return currentUserMsgIdx + 1 <= userMsgIndexes.length - 1;
  }, [userMsgIndexes.length, currentUserMsgIdx]);

  const isChatApplyTabVisible = React.useCallback(() => {
    return Object.keys(chatFileInfo).length > 0 && chatType === 'codebase';
  }, [chatFileInfo, chatType]);

  const isPlanTabVisible = React.useCallback(() => {
    const todos = todoList?.todos || [];
    return (
      (currentSession?.data?.enablePlanMode || false) &&
      todos.length > 0 &&
      chatType === 'codebase'
    );
  }, [chatType, currentSession?.data?.enablePlanMode, todoList?.todos]);

  // React.useEffect(() => {
  //   if (!isEqual(prevChatFileInfo, chatFileInfo)) {
  //     setBottomTabActiveKey(ChatTab.Changes);
  //   } else if (!isEqual(prevTodoList, todoList)) {
  //     setBottomTabActiveKey(ChatTab.Plan);
  //   }
  // }, [chatFileInfo, prevChatFileInfo, prevTodoList, todoList]);

  return (
    <CodeChatContext.Provider value={CodeChatContextValue}>
      {/* 功能引导组件 */}
      {/* <FeatureTour /> */}
      <Box
        // isPanelMode 的情况下，不需要减去顶部 Tabs 的高度 
        // h={ isPanelMode ? '100vh' : 'calc(100vh - 28px)'}
        h='100vh'
        className={
          activeTheme === ThemeStyle.Light ? 'light-mode' : 'dark-mode'
        }
        position={'relative'}
      >
        <Flex
          hidden={!isDragOver}
          position={'absolute'}
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={10}
          width={'100%'}
          height={'full'}
          align={'center'}
          justifyContent={'center'}
          alignItems={'center'}
          backgroundColor={
            activeTheme === ThemeStyle.Light
              ? 'rgba(255, 255, 255, .2)'
              : 'rgba(0, 0, 0, .2)'
          }
          backdropFilter={'blur(5px)'}
        >
          拖拽文件时，按住Shift可以将文件添加到当前聊天窗口
        </Flex>
        <GlobalDataLoader />
        <Split
          id="code-chat-new"
          direction={SplitDirection.Vertical}
          defaultSizes={[
            { type: SplitValueType.Auto },
            {
              type: SplitValueType.Absolute,
              value: 164,
              max: '50%',
              min: 164,
            },
          ]}
        >
          <Grid
            className="message-pane h-full"
            gridTemplateRows="auto 1fr auto"
          >
            <Box>
              <SpecActiveChangeGuide />
              <ChatHeaderToolbar />
            </Box>
            {isLoading || loading ? (
              <div className="h-full flex items-center justify-center">
                <Spinner
                  size="md"
                  thickness="4px"
                  color="blue.500"
                  zIndex={999}
                />
              </div>
            ) : (
              <div
                ref={chatBodyRef}
                className={`h-full overflow-y-scroll markdown-body shrink px-2`}
                onWheel={() => {
                  // 用户主动触发滚动事件时，表示 auto scroll 被打断，不需要执行 auto scroll
                  userScrollLock.current = true;
                }}
                id="code-chat-body"
              >
                <Box
                  h="full"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Box h="full">
                    <ChatSamples
                      onSubmit={handleSubmit}
                      onFillInput={(text) => fillInputRef.current?.(text)}
                      isShowRecommendation={showRecommendation}
                      questions={questions}
                    />
                    <Box ref={chatContextRef}>
                      <ChatMessagesList
                        containerRef={chatBodyRef}
                        userScrollLock={userScrollLock.current}
                        onResetPrompt={handleResetPrompt}
                        ref={chatMessagesRef}
                        onFeedback={(feedbackDetail) => {
                          if (
                            feedbackDetail.feedback_type ===
                            ChatFeedbackType.UpVote
                          ) {
                            // 点赞的时候，不需要弹出输入框，直接直接提交即可
                            submitFeedback(feedbackDetail);
                          } else {
                            setShowCodebaseFeedBack(true);
                            setFeedbackDetail(feedbackDetail);
                          }
                        }}
                      />
                    </Box>
                    {shouldShowRecommendation ? (
                      <ChatRecommendation
                        questions={questions}
                        onSubmit={(prompt: string) => {
                          void handleSubmit(prompt);
                        }}
                        onFillInput={(text) => fillInputRef.current?.(text)}
                        scrollToBottom={scrollToBottom}
                      />
                    ) : null}
                    <StreamingChatMessage />
                    <Box
                      position="relative"
                      py={4}
                      display={shouldShowDocsetTips ? 'block' : 'none'}
                    >
                      <Divider h="1px !important" />
                      <AbsoluteCenter
                        px={4}
                        bg="listBgColor"
                        minW="120px"
                        color="text.secondary"
                      >
                        私有知识库的问答仅支持单轮
                      </AbsoluteCenter>
                    </Box>
                  </Box>
                </Box>
              </div>
            )}
            {/* {currentSessionId && isShowTip && (
              <ChatSessionClearPanel messageID={currentSessionId} />
            )} */}
            {Object.keys(chatFileInfo).length > 10 && (
              <Box className="w-full pt-1 text-center text-[#666]">
                当前会话未归档的Changes较多，建议
                <Box
                  className="inline"
                  cursor={'pointer'}
                  px={1}
                  color={'blue.300'}
                  onClick={() => chatBottomTabsRef.current?.setExpanded(true)}
                >
                  打开Changes面板
                </Box>
                保留改动
              </Box>
            )}
            <Box
              className="relative w-full px-2 py-1 pb-0 flex items-center justify-between"
              position="relative"
            >
              <Flex alignItems="center" gap={2}>
                <TokenUsageIndicator
                  visible={
                    chatType === 'codebase' &&
                    compressConfig.enable &&
                    !isStreaming &&
                    !hasImageAttach
                  }
                />
                <Box className="w-full" hidden={!hasImageAttach}>
                  {!isStreaming &&
                    chatModels[model]?.parseImgType !== ParseImgType.NONE && (
                      <ImagePanel />
                    )}
                </Box>
              </Flex>
              {chatType === 'codebase' &&
              !currentSession?.data?.messages?.length ? (
                <Box
                  position="absolute"
                  top="calc(50% - 8px)"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  color="text.default"
                  bg="buttonBgColor"
                  p="2"
                  borderRadius="md"
                  fontSize="12px"
                >
                  <Icon as={FaFolderOpen} /> <span className='mx-1'>代码仓库</span>
                  {workspaceInfo.repoName}
                </Box>
              ) : (
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  marginLeft="auto"
                >
                  <ChatNavigationButtons
                    userMsgIndexes={userMsgIndexes}
                    isStreaming={isStreaming}
                    onPrevMessage={handlePrevUserMessage}
                    onNextMessage={handleNextUserMessage}
                    onScrollToBottom={() => {
                      scrollToBottom();
                      userScrollLock.current = false;
                      // 当用户点击置底时，更新当前用户消息索引为最后一条
                      if (userMsgIndexes.length > 0) {
                        setCurrentUserMsgIdx(userMsgIndexes.length - 1);
                      }
                    }}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                  />
                </Box>
              )}
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="80px"
                h="30px"
              >
                {(isStreaming ||
                  isProcessing ||
                  isMCPProcessing ||
                  isTerminalProcessing ||
                  isApplying) && (
                  <Button
                    size="sm"
                    onClick={handleStopStream}
                    leftIcon={
                      <Icon as={TbCircleMinus} size="sm" color="blue.300" />
                    }
                    borderRadius="full"
                    color="text.secondary"
                    bgColor="listBgColor"
                    disabled={
                      lastMessage?.isAutoCompressingMessage &&
                      !lastMessage?.content
                    }
                  >
                    中止生成
                  </Button>
                )}
              </Box>
            </Box>
            <Box className="w-full p-1 markdown-body overflow-scroll">
              <PrePromptCodeBlock fillInputRef={fillInputRef} />
            </Box>
            <Box px="2">
              <ChatBottomTabs
                ref={chatBottomTabsRef}
                items={[
                  {
                    key: ChatTab.Changes,
                    title: (
                      <Box
                        display="flex"
                        alignItems="center"
                        position="relative"
                      >
                        <span>Changes</span>
                        {(() => {
                          const count = Object.keys(chatFileInfo).length;
                          return count > 0 ? (
                            <Badge
                              colorScheme="blue"
                              variant="solid"
                              borderRadius="full"
                              ml={1}
                              fontSize="10px"
                              minW="16px"
                              h="16px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              {count}
                            </Badge>
                          ) : null;
                        })()}
                      </Box>
                    ),
                    tooltip: ChatTab.Changes,
                    render: ChatApplyTab,
                    isVisible: isChatApplyTabVisible,
                  },
                  {
                    key: ChatTab.Plan,
                    tooltip: ChatTab.Plan,
                    title: 'Plans',
                    render: PlanTab,
                    isVisible: isPlanTabVisible,
                    isLocked: (ctx) => {
                      const planTabApi = ctx.apiMap.plan as PlanTabApi;
                      return planTabApi?.isEditing || false;
                    },
                  },
                ]}
                defaultActiveKey={bottomTabActiveKey}
                activeKey={bottomTabActiveKey}
                onChange={(key) => setBottomTabActiveKey(key as ChatTab)}
                defaultExpanded
              />
            </Box>

            {chatType === 'codebase' ? null : <ChatMaskVariableForm />}
            {chatType === 'codebase' ? null : <PluginAppVariableForm />}
            <McpPromptVariableForm />
            {/* {chatType === 'codebase' ? null : ( */}
            <ImageUpload ref={uploadImgRef} />
            <FileUpload />
            {/* )} */}
          </Grid>
          <Grid className="h-full w-full px-2 pb-2 gap-2" gridTemplateRows="1fr">
            {showCodebaseFeedBack && feedbackDetail ? (
              <CodeBaseFeedback
                feedbackDetail={feedbackDetail}
                onResetFeedback={() => {
                  setShowCodebaseFeedBack(false);
                  setFeedbackDetail(null);
                }}
                onFeedbackSubmit={submitFeedback}
              />
            ) : (
              <ChatInput
                handleSubmit={handleSubmit}
                handleInputChange={handleInputChange}
                tokenNumber={tokenNumber}
                isFocused={isFocused}
                setFocused={setFocused}
                scrollToBottom={scrollToBottom}
                inputRef={inputRef}
                promptProtalRef={promptProtalRef}
                uploadImgRef={uploadImgRef}
                promptRef={promptRef}
                fillInputRef={fillInputRef}
              />
            )}
          </Grid>
        </Split>
        <MCPErrorModal />
        {/* Spec 初始化引导弹窗 */}
        <SpecInitModal />
      </Box>
    </CodeChatContext.Provider>
  );
}

function compileTemplateVariableNode(prompt: string, code: string) {
  let _prompt = prompt;
  if (prompt.includes(INNER_VARIABLE.__USER__)) {
    const user = useAuthStore.getState().username || '';
    _prompt = _prompt.replace(INNER_VARIABLE.__USER__, user);
  }
  if (prompt.includes(INNER_VARIABLE.__DATETIME__)) {
    const now = DateFormat(Date.now(), 'YYYY-MM-DD HH:mm:ss');
    _prompt = _prompt.replace(INNER_VARIABLE.__DATETIME__, now);
  }
  if (prompt.includes(PROMPT_CODE_VARIABLE)) {
    const content = _prompt.replace(PROMPT_CODE_VARIABLE, code);
    return content;
  }
  return _prompt + code;
}

if (process.env.NODE_ENV === 'development') {
  (CodeChat as any).whyDidYouRender = true;
}

export default CodeChat;
