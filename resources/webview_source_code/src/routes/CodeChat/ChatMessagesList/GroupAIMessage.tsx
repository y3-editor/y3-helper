import {
  Box,
  Checkbox,
  Flex,
  Avatar,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  useColorModeValue,
} from '@chakra-ui/react';
import CodeMakerLogo from '../../../assets/cmlogo.png';
import ChatAssistantMessage from './AssistantMessage';
import ToolCall from './ToolCall';
import { GroupAIMessageProps } from './types';
import ChatMessageActionBar from '../ChatMessageActionBar';
import userReporter from '../../../utils/report';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { useSubagentStore } from '../../../modules/subagent';
import { useCallback, useMemo, useState } from 'react';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import { createNewSession } from '../../../utils/chat';
import FileRecommendApplyPanel, {
  IRecommendFileChangeRecord,
} from '../FileRecommendApplyPanel';
import { UserEvent } from '../../../types/report';
import { ChatRole } from '../../../types/chat';
import { ChatMessage } from '../../../services';
import Icon from '../../../components/Icon';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import { RxCheckCircled } from 'react-icons/rx';
import * as React from 'react';
import { usePrevious } from '../../../hooks/usePrevious';
import { DateFormat } from '../../../utils';
import { getToolName } from '../../../utils/toolCall';
import { useTheme, ThemeStyle } from '../../../ThemeContext';
import TokenBreakdownPanel, {
  TOKEN_BREAKDOWN_COLORS,
} from '../../../components/TokenBreakdownPopover';
import type { TokenBreakdownItem } from '../../../components/TokenBreakdownPopover';
import type { ConsumedTokens } from '../../../utils/consumedTokensCalculator';

// 工具分类函数 - 提取到组件外部避免重复定义
const getToolCategory = (
  toolName: string | undefined,
): 'list' | 'read' | 'search' | null => {
  if (
    toolName === 'list_files_recursive' ||
    toolName === 'list_files_top_level' ||
    toolName === 'view_source_code_definitions_top_level'
  ) {
    return 'list';
  }
  if (toolName === 'read_file') {
    return 'read';
  }
  if (
    toolName === 'grep_search' ||
    toolName === 'glob_search'
  ) {
    return 'search';
  }
  return null;
};

// 消息渲染器（不再合并连续的相同工具调用）
function MergedMessagesRenderer({
  messages,
  isLatest,
  attachs,
  onNewSession,
  onFeedback,
  isShare,
  setRecommendFileChanges,
  userMsgId,
  isToolCallSelected,
  onToggleToolCallRound,
  isUserMsgSelected,
}: {
  messages: ChatMessage[];
  isLatest: boolean | undefined;
  attachs: any[];
  onNewSession: any;
  onFeedback: any;
  isShare: boolean | undefined;
  setRecommendFileChanges: any;
  userMsgId?: string;
  isToolCallSelected?: boolean;
  onToggleToolCallRound?: (userMsgId: string) => void;
  isUserMsgSelected?: boolean;
}) {
  // 不再合并，所有消息都作为单个消息处理
  const mergedMessages = useMemo(() => {
    return messages.map((message, index) => ({
      type: 'single' as const,
      messages: [message],
      indices: [index],
    }));
  }, [messages]);

  return (
    <OuterCollapseWrapper
      mergedMessages={mergedMessages}
      isLatest={isLatest}
      attachs={attachs}
      onNewSession={onNewSession}
      onFeedback={onFeedback}
      isShare={isShare}
      setRecommendFileChanges={setRecommendFileChanges}
      userMsgId={userMsgId}
      isToolCallSelected={isToolCallSelected}
      onToggleToolCallRound={onToggleToolCallRound}
      isUserMsgSelected={isUserMsgSelected}
    />
  );
}

// 收藏模式下单个工具调用的折叠项
function ShareToolCallItem({
  message,
  isLatest,
}: {
  message: ChatMessage;
  isLatest: boolean | undefined;
}) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const borderColor = useColorModeValue('#e2e8f0', '#3a3a3a');

  // 获取工具中文名称
  const toolName = React.useMemo(() => {
    const firstTool = message.tool_calls?.[0];
    if (!firstTool) return '工具调用';
    return getToolName(firstTool);
  }, [message.tool_calls]);

  return (
    <Box
      border="1px solid"
      borderColor={borderColor}
      borderRadius="4px"
      overflow="hidden"
      mt={2}
    >
      {/* 内层标题栏 */}
      <Flex
        px={2}
        py={1.5}
        alignItems="center"
        cursor="pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
        borderBottom={!isCollapsed ? '1px solid' : 'none'}
        borderColor={borderColor}
      >
        <Icon as={RxCheckCircled} color="green.500" boxSize="14px" />
        <Box
          ml={1.5}
          flex={1}
          fontSize="12px"
          fontWeight="400"
          color="text.primary"
          noOfLines={1}
        >
          {toolName}
        </Box>
        <Icon
          as={isCollapsed ? FaAngleRight : FaAngleDown}
          size="xs"
          color="text.secondary"
        />
      </Flex>
      {/* 内层内容区 */}
      {!isCollapsed && (
        <Box>
          <ToolCall message={message} isShare isLatest={isLatest} />
        </Box>
      )}
    </Box>
  );
}

// 收藏模式下的工具调用聚合面板
function ShareToolCallPanel({
  isToolCallCollapsed,
  setIsToolCallCollapsed,
  isToolCallSelected,
  onToggleToolCallRound,
  userMsgId,
  toolCallMessages,
  isLatest,
  isUserMsgSelected,
}: {
  isToolCallCollapsed: boolean;
  setIsToolCallCollapsed: (v: boolean) => void;
  isToolCallSelected?: boolean;
  onToggleToolCallRound?: (userMsgId: string) => void;
  userMsgId: string;
  toolCallMessages: ChatMessage[];
  isLatest: boolean | undefined;
  isUserMsgSelected?: boolean;
}) {
  const bgColor = useColorModeValue('#f8f9fa', '#1f1f1f');
  const borderColor = useColorModeValue('#e2e8f0', '#3a3a3a');
  const isDisabled = !isUserMsgSelected;

  return (
    <Box mb={2}>
      <Flex alignItems="flex-start" gap={1}>
        <Checkbox
          isChecked={isDisabled ? false : isToolCallSelected}
          isDisabled={isDisabled}
          onChange={() => onToggleToolCallRound?.(userMsgId)}
          size="md"
          mt={1.5}
        />
        {/* 外层容器 - 带背景/边框/圆角 */}
        <Box
          flex={1}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="4px"
          overflow="hidden"
          bg={bgColor}
        >
          {/* 外层标题栏 */}
          <Flex
            px={2}
            py={1.5}
            alignItems="center"
            cursor="pointer"
            onClick={() => setIsToolCallCollapsed(!isToolCallCollapsed)}
          >
            <Icon as={RxCheckCircled} color="green.500" boxSize="14px" />
            <Box
              ml={1.5}
              flex={1}
              fontSize="12px"
              fontWeight="500"
              color="text.primary"
            >
              工具调用
            </Box>
            <Icon
              as={isToolCallCollapsed ? FaAngleRight : FaAngleDown}
              size="xs"
              color="text.secondary"
            />
          </Flex>
          {/* 展开后的内层工具列表 */}
          {!isToolCallCollapsed && (
            <Box px={2} pb={2}>
              {toolCallMessages.map((msg, idx) => (
                <ShareToolCallItem
                  key={`${msg.id || ''}-${idx}`}
                  message={msg}
                  isLatest={isLatest}
                />
              ))}
            </Box>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

// 外层折叠面板包裹器
function OuterCollapseWrapper({
  mergedMessages,
  isLatest,
  attachs,
  onNewSession,
  onFeedback,
  isShare,
  setRecommendFileChanges,
  userMsgId,
  isToolCallSelected,
  onToggleToolCallRound,
  isUserMsgSelected,
}: {
  mergedMessages: Array<{
    type: 'single';
    messages: ChatMessage[];
    indices: number[];
  }>;
  isLatest: boolean | undefined;
  attachs: any[];
  onNewSession: any;
  onFeedback: any;
  isShare: boolean | undefined;
  setRecommendFileChanges: any;
  userMsgId?: string;
  isToolCallSelected?: boolean;
  onToggleToolCallRound?: (userMsgId: string) => void;
  isUserMsgSelected?: boolean;
}) {
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);

  // 检查是否有工具调用需要用户确认（提前计算，用于初始状态）
  const needsUserConfirmation = React.useMemo(() => {
    return mergedMessages.some((item) => {
      return item.messages.some((msg) => {
        if (!msg.tool_calls || !msg.tool_calls.length) return false;
        // 检查是否所有工具调用都已经有 response
        const hasAllResponses = msg.tool_calls.every((tool) => {
          return msg.response && msg.response[tool.id] !== undefined;
        });
        return !hasAllResponses; // 如果有工具调用没有 response，说明需要确认
      });
    });
  }, [mergedMessages]);

  // 追踪流式状态的变化
  const prevIsStreaming = usePrevious(isStreaming);
  const prevIsProcessing = usePrevious(isProcessing);

  // 非最新消息永远折叠，最新消息根据流式状态决定
  // 使用 useRef 来存储初始折叠状态，避免组件挂载时的状态变化
  const initialCollapsedRef = React.useRef<boolean | null>(null);
  if (initialCollapsedRef.current === null) {
    if (!isLatest) {
      initialCollapsedRef.current = true;
    } else if (needsUserConfirmation) {
      initialCollapsedRef.current = false;
    } else {
      initialCollapsedRef.current = !(isStreaming || isProcessing);
    }
  }

  const [isCollapsed, setIsCollapsed] = React.useState(
    initialCollapsedRef.current,
  );

  // 仅在流式传输 **结束** 时自动折叠，不在开始时触发状态变化
  React.useEffect(() => {
    // 非最新消息不处理
    if (!isLatest) return;

    // 需要用户确认时，保持展开
    if (needsUserConfirmation) {
      setIsCollapsed(false);
      return;
    }

    // 只检测流式传输结束（从运行中变为停止）
    const wasRunning = prevIsStreaming === true || prevIsProcessing === true;
    const isNowStopped = !isStreaming && !isProcessing;

    // 只在从运行状态变为停止状态时自动折叠
    if (wasRunning && isNowStopped) {
      setIsCollapsed(true);
    }
    // 注意：不处理从停止到开始的情况，避免触发滚动
  }, [
    isLatest,
    isStreaming,
    isProcessing,
    prevIsStreaming,
    prevIsProcessing,
    needsUserConfirmation,
  ]);

  // 判断一个消息组是否包含工具调用（用于收藏模式的工具调用聚合）
  const isToolCallGroup = React.useCallback(
    (group: (typeof mergedMessages)[0]) => {
      const firstMessage = group.messages[0];
      return !!firstMessage.tool_calls?.length;
    },
    [],
  );

  // 判断一个消息组是否是文件操作
  const isFileOperation = (group: (typeof mergedMessages)[0]) => {
    const firstMessage = group.messages[0];
    const toolName = firstMessage.tool_calls?.[0]?.function?.name;
    return getToolCategory(toolName) !== null;
  };

  // 收藏模式：检查该轮是否有工具调用
  const hasToolCalls = React.useMemo(() => {
    return mergedMessages.some((g) => isToolCallGroup(g));
  }, [mergedMessages, isToolCallGroup]);

  // 收藏模式：工具调用折叠状态
  const [isToolCallCollapsed, setIsToolCallCollapsed] = React.useState(true);

  // ===== 收藏模式下的渲染：工具调用 UI 聚合到折叠框，消息保持原始顺序但隐藏工具调用 =====
  if (isShare && hasToolCalls && userMsgId) {
    // 收集所有含 tool_calls 的消息，用于在折叠框中渲染 ToolCall 组件
    const toolCallMessages = mergedMessages
      .filter((g) => isToolCallGroup(g))
      .map((g) => g.messages[0]);

    return (
      <>
        {/* 工具调用聚合框 */}
        <ShareToolCallPanel
          isToolCallCollapsed={isToolCallCollapsed}
          setIsToolCallCollapsed={setIsToolCallCollapsed}
          isToolCallSelected={isToolCallSelected}
          onToggleToolCallRound={onToggleToolCallRound}
          userMsgId={userMsgId}
          toolCallMessages={toolCallMessages}
          isLatest={isLatest}
          isUserMsgSelected={isUserMsgSelected}
        />
        {/* 所有消息保持原始顺序渲染，但隐藏工具调用 UI */}
        {mergedMessages.map((group) => {
          const message = group.messages[0];
          const index = group.indices[0];
          return (
            <ChatAssistantMessage
              key={(message?.id || '') + index}
              index={index}
              message={message}
              isLatest={isLatest}
              isRecent={index === mergedMessages.length - 1 && isLatest}
              attachs={attachs}
              onNewSession={onNewSession}
              onFeedback={onFeedback}
              isShare={isShare}
              setRecommendFileChanges={setRecommendFileChanges}
              hideToolCalls
            />
          );
        })}
      </>
    );
  }

  // 非收藏模式下的渲染，保持原有逻辑
  const outerGroups: Array<{
    type: 'file_operations' | 'normal';
    groups: typeof mergedMessages;
  }> = [];

  // 找到第一个和最后一个文件操作的位置
  let firstFileOpIndex = -1;
  let lastFileOpIndex = -1;

  mergedMessages.forEach((group, index) => {
    if (isFileOperation(group)) {
      if (firstFileOpIndex === -1) {
        firstFileOpIndex = index;
      }
      lastFileOpIndex = index;
    }
  });

  // 如果第一个和最后一个文件操作不是同一个，且都存在，就折叠这个范围
  const shouldWrapRange =
    firstFileOpIndex !== -1 &&
    lastFileOpIndex !== -1 &&
    firstFileOpIndex !== lastFileOpIndex;

  if (shouldWrapRange) {
    // 将第一个文件操作到最后一个文件操作之间的所有消息包裹起来
    const rangeGroups = mergedMessages.slice(
      firstFileOpIndex,
      lastFileOpIndex + 1,
    );
    // const totalFileOps = rangeGroups.filter(g => isFileOperation(g)).length;

    // 前面的消息
    const beforeGroups = mergedMessages.slice(0, firstFileOpIndex);
    // 后面的消息
    const afterGroups = mergedMessages.slice(lastFileOpIndex + 1);

    outerGroups.push(
      ...beforeGroups.map((group) => ({
        type: 'normal' as const,
        groups: [group],
      })),
      {
        type: 'file_operations' as const,
        groups: rangeGroups,
      },
      ...afterGroups.map((group) => ({
        type: 'normal' as const,
        groups: [group],
      })),
    );
  } else {
    // 不需要包裹，所有消息正常显示
    outerGroups.push(
      ...mergedMessages.map((group) => ({
        type: 'normal' as const,
        groups: [group],
      })),
    );
  }

  return (
    <>
      {outerGroups.map((outerGroup, outerIndex) => {
        if (outerGroup.type === 'file_operations') {
          // 计算文件操作的总数
          // const totalFileOps = outerGroup.groups.reduce((sum, group) => {
          //   return sum + group.messages.length;
          // }, 0);

          return (
            <Box key={`outer-${outerIndex}`} mb={2}>
              <Box
                cursor="pointer"
                color="text.default"
                onClick={() => setIsCollapsed(!isCollapsed)}
                display="flex"
                alignItems="center"
              // mb="1"
              >
                {!isCollapsed ? (
                  <Icon as={FaAngleDown} size="xs" />
                ) : (
                  <Icon as={FaAngleRight} size="xs" />
                )}
                <Box ml="1" color="text.primary">
                  文件读取
                </Box>
              </Box>
              {!isCollapsed && (
                <VStack align="stretch" gap={0}>
                  {outerGroup.groups.map((group) => {
                    const message = group.messages[0];
                    const index = group.indices[0];
                    return (
                      <ChatAssistantMessage
                        key={(message?.id || '') + index}
                        index={index}
                        message={message}
                        isLatest={isLatest}
                        isRecent={false}
                        attachs={attachs}
                        onNewSession={onNewSession}
                        onFeedback={onFeedback}
                        isShare={isShare}
                        setRecommendFileChanges={setRecommendFileChanges}
                      />
                    );
                  })}
                </VStack>
              )}
            </Box>
          );
        } else {
          // 正常渲染
          return (
            <Box key={`outer-${outerIndex}`}>
              {outerGroup.groups.map((group) => {
                const message = group.messages[0];
                const index = group.indices[0];
                return (
                  <ChatAssistantMessage
                    key={(message?.id || '') + index}
                    index={index}
                    message={message}
                    isLatest={isLatest}
                    isRecent={index === mergedMessages.length - 1 && isLatest}
                    attachs={attachs}
                    onNewSession={onNewSession}
                    onFeedback={onFeedback}
                    isShare={isShare}
                    setRecommendFileChanges={setRecommendFileChanges}
                  />
                );
              })}
            </Box>
          );
        }
      })}
    </>
  );
}

export function GroupAIMessage({
  messages,
  isLatest,
  attachs = [],
  onFeedback,
  isShare,
  sentAt,
  completedAt,
  userMsgId,
  isToolCallSelected,
  onToggleToolCallRound,
  isUserMsgSelected,
}: GroupAIMessageProps) {
  const message = messages[0];
  const [isShowAction, setIsShowAction] = useState(false);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [removeQA, onNewSession, chatType] = useChatStore((state) => [
    state.removeQA,
    state.onNewSession,
    state.chatType,
  ]);
  const currentSession = useChatStore((state) => state.currentSession());
  const { postMessage } = usePostMessage();
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const isSubagentProcessing = useSubagentStore((state) =>
    state.hasActiveSubagents(),
  );
  const showFeedback = useChatStreamStore((state) => state.showFeedback);
  const onUserResubmit = useChatStreamStore((state) => state.onUserResubmit);
  const setStreamRetryCount = useChatStreamStore(
    (state) => state.setStreamRetryCount,
  );
  const [recommendFileChanges, setRecommendFileChanges] =
    useState<IRecommendFileChangeRecord>({});
  const enableReply = useMemo(() => {
    if (isStreaming || isSearching) return false;
    if (!currentSession?.data?.messages?.length) return false;
    const sendMessages = currentSession?.data?.messages || [];
    for (let i = sendMessages.length - 1; i >= 0; i--) {
      const sendMessage = sendMessages[i];
      if (
        sendMessage.role === ChatRole.User &&
        sendMessage._originalRequestData
      ) {
        return true;
      }
    }
    return false;
  }, [isStreaming, isSearching, currentSession?.data?.messages]);

  const handleCopyToClipboard = useCallback(() => {
    let content = '';
    for (const msg of messages) {
      content += msg.content as string;
    }
    userReporter.report({
      event: UserEvent.CODE_CHAT_COPY,
      extends: {
        session_id: currentSession?._id,
        message_id: message.id,
      },
    });
    postMessage({
      type: BroadcastActions.COPY_TO_CLIPBOARD,
      data: content,
    });
  }, [postMessage, currentSession?._id, message.id, messages]);

  const handleNewSession = useCallback(() => {
    if (!currentSession || !message.id) return;
    const newMessages = createNewSession(message, currentSession, chatType);
    void onNewSession(newMessages);
  }, [message, currentSession, onNewSession, chatType]);

  const onRetryClick = useCallback(() => {
    setStreamRetryCount(0);
    onUserResubmit();
  }, [onUserResubmit, setStreamRetryCount]);

  const renderActionBar = useMemo(() => {
    if (
      isShowAction &&
      !isStreaming &&
      !isProcessing &&
      !isSearching &&
      !isSubagentProcessing
    ) {
      const hideNewSession = false; // 允许所有聊天类型都支持从此处重新发起对话
      const hideRemove = false;
      const hideRetry =
        isSearching ||
        isStreaming ||
        isSubagentProcessing ||
        !isLatest ||
        !enableReply ||
        !!message.revertedFiles;
      const shouldShowFeedback = !isLatest || (isLatest && !showFeedback);
      const feedbackType = message.feedback;

      const isCompressedMessage = message.isCompressed || false;
      const isCompressionSummary = message.isCompressionSummary || false;

      if (isCompressionSummary) return null;
      return (
        <ChatMessageActionBar
          onCopyClick={() => {
            handleCopyToClipboard();
          }}
          onNewSessionClick={() => {
            handleNewSession();
          }}
          onRemoveClick={() => {
            setIsOpenModal(true);
          }}
          onFeedbackClick={onFeedback}
          onRetryClick={onRetryClick}
          hideNewSession={hideNewSession}
          hideRemove={hideRemove}
          hideRetry={hideRetry}
          feedbackType={feedbackType}
          shouldShowFeedback={shouldShowFeedback}
          isCompressedMessage={isCompressedMessage}
          isCompressionSummary={isCompressionSummary}
        />
      );
    } else {
      return null;
    }
  }, [
    isShowAction,
    isStreaming,
    isProcessing,
    isSearching,
    isSubagentProcessing,
    isLatest,
    enableReply,
    message.revertedFiles,
    message.feedback,
    message.isCompressed,
    message.isCompressionSummary,
    showFeedback,
    onFeedback,
    onRetryClick,
    handleCopyToClipboard,
    handleNewSession,
  ]);

  const sentAtText = useMemo(() => {
    if (!sentAt) return null;
    return DateFormat(new Date(sentAt), 'MM/DD HH:mm:ss');
  }, [sentAt]);

  const durationText = useMemo(() => {
    if (!sentAt || !completedAt || completedAt <= sentAt) return null;
    const seconds = Math.round((completedAt - sentAt) / 1000);
    return `${seconds}s`;
  }, [sentAt, completedAt]);

  // 从本轮消息中提取 token 消耗（基于 consumedTokensTotal 快照差值）
  // 使得各轮增量之和 = 底部 Tokens 总量
  const roundTokensText = useMemo(() => {
    const fmt = (n: number) =>
      n >= 1000 ? `${(n / 1000).toFixed(1)}k Tokens` : `${n} Tokens`;

    try {
      // 1. 从本轮消息中倒序查找 consumedTokensTotal 快照
      let currentSnapshot = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].consumedTokensTotal) {
          currentSnapshot = messages[i].consumedTokensTotal!;
          break;
        }
      }
      if (!currentSnapshot) return null;

      // 2. 从 store 中查找上一轮的 consumedTokensTotal 快照
      const session = useChatStore.getState().currentSession();
      const allMessages = session?.data?.messages || [];
      const firstMsgId = messages[0]?.id;

      let previousSnapshot = 0;
      if (firstMsgId) {
        const idx = allMessages.findIndex((m) => m.id === firstMsgId);
        if (idx > 0) {
          for (let j = idx - 1; j >= 0; j--) {
            if (allMessages[j].consumedTokensTotal) {
              previousSnapshot = allMessages[j].consumedTokensTotal!;
              break;
            }
          }
        }
      }

      // 增量 = 本轮快照 - 上轮快照，第一轮时 previousSnapshot = 0
      const increment = currentSnapshot - previousSnapshot;
      return increment > 0 ? fmt(increment) : fmt(currentSnapshot);
    } catch {
      return null;
    }
  }, [messages]);

  // 基于 consumedTokensSnapshot 计算单轮各维度的 token 增量分布
  const roundTokenBreakdown = useMemo((): TokenBreakdownItem[] => {
    try {
      // 1. 从本轮消息中倒序查找 consumedTokensSnapshot
      let currentSnapshot: ConsumedTokens | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].consumedTokensSnapshot) {
          currentSnapshot = messages[i].consumedTokensSnapshot;
          break;
        }
      }
      if (!currentSnapshot) return [];

      // 2. 从 store 中查找上一轮的 consumedTokensSnapshot
      const session = useChatStore.getState().currentSession();
      const allMessages = session?.data?.messages || [];
      const firstMsgId = messages[0]?.id;

      let previousSnapshot: ConsumedTokens | undefined;
      if (firstMsgId) {
        const idx = allMessages.findIndex((m) => m.id === firstMsgId);
        if (idx > 0) {
          for (let j = idx - 1; j >= 0; j--) {
            if (allMessages[j].consumedTokensSnapshot) {
              previousSnapshot = allMessages[j].consumedTokensSnapshot;
              break;
            }
          }
        }
      }

      // 3. 计算各维度增量
      const prev = previousSnapshot || ({} as Partial<ConsumedTokens>);
      const delta = (field: keyof ConsumedTokens) =>
        Math.max(
          0,
          ((currentSnapshot![field] as number) || 0) -
          ((prev[field] as number) || 0),
        );

      const systemPromptDelta = delta('systemTokens');
      const systemToolsDelta = delta('systemToolTokens');
      const inputDelta = delta('input');
      const outputDelta = delta('output');
      const messagesDelta = inputDelta + outputDelta;
      const readCacheDelta = delta('readCacheTokens');
      const mcpTokensDelta = delta('mcpTokens');
      const skillTokensDelta = delta('skillTokens');
      const ruleTokensDelta = delta('ruleTokens');

      const totalDelta =
        systemPromptDelta +
        systemToolsDelta +
        messagesDelta +
        readCacheDelta +
        mcpTokensDelta +
        skillTokensDelta +
        ruleTokensDelta;
      if (totalDelta <= 0) return [];

      const pct = (n: number) => (n / totalDelta) * 100;

      const items: TokenBreakdownItem[] = [
        {
          name: 'System prompt',
          tokens: systemPromptDelta,
          percentage: pct(systemPromptDelta),
          color: TOKEN_BREAKDOWN_COLORS['System prompt'],
        },
        {
          name: 'System tools',
          tokens: systemToolsDelta,
          percentage: pct(systemToolsDelta),
          color: TOKEN_BREAKDOWN_COLORS['System tools'],
          tooltip: '当前只有Claude系列模型才支持系统工具定义预览',
        },
        {
          name: 'Messages',
          tokens: messagesDelta,
          percentage: pct(messagesDelta),
          color: TOKEN_BREAKDOWN_COLORS['Messages'],
        },
        {
          name: 'Read Cache',
          tokens: readCacheDelta,
          percentage: pct(readCacheDelta),
          color: TOKEN_BREAKDOWN_COLORS['Read Cache'],
          tooltip:
            '目前仅 Claude 系列模型支持请求缓存功能，可缓存的内容包括：系统提示词（SystemPrompt）、系统工具（SystemTools）、上传的文件等。当请求命中缓存时，能有效减少 token 消耗，降低使用成本',
        },
        {
          name: 'Mcp tokens',
          tokens: mcpTokensDelta,
          percentage: pct(mcpTokensDelta),
          color: TOKEN_BREAKDOWN_COLORS['Mcp tokens'],
        },
        {
          name: 'Skill tokens',
          tokens: skillTokensDelta,
          percentage: pct(skillTokensDelta),
          color: TOKEN_BREAKDOWN_COLORS['Skill tokens'],
        },
        {
          name: 'Rule tokens',
          tokens: ruleTokensDelta,
          percentage: pct(ruleTokensDelta),
          color: TOKEN_BREAKDOWN_COLORS['Rule tokens'],
        },
      ];

      return items.filter((item) => item.tokens > 0);
    } catch {
      return [];
    }
  }, [messages]);

  const { activeTheme } = useTheme();
  const isDark = activeTheme === ThemeStyle.Dark;

  const timeInfoText = useMemo(() => {
    const parts: string[] = [];
    if (sentAtText) parts.push(sentAtText);
    if (durationText) parts.push(durationText);
    if (roundTokensText) parts.push(roundTokensText);
    return parts.join(' | ') || null;
  }, [sentAtText, durationText, roundTokensText]);

  // 不含 Tokens 的时间信息文本（用于 Popover 模式）
  const timeInfoWithoutTokens = useMemo(() => {
    const parts: string[] = [];
    if (sentAtText) parts.push(sentAtText);
    if (durationText) parts.push(durationText);
    return parts.join(' | ') || null;
  }, [sentAtText, durationText]);

  const data = { message, defaultExpanded: isLatest };

  return (
    <>
      <Box
        pb="0"
        mt="0"
        onMouseMove={() => {
          setIsShowAction(true);
        }}
        onMouseLeave={() => {
          setIsShowAction(false);
        }}
      >
        <Flex gap={2} h={8} mx={4} alignItems="center">
          <Box display="flex" alignItems="center" flexShrink={0}>
            <Avatar w="16px" h="18px" src={CodeMakerLogo} mr="2" />
            <Box color="text.secondary" fontSize="12px" whiteSpace="nowrap">
              Y3Maker
            </Box>
          </Box>
          {isShowAction && timeInfoText && (
            <Flex alignItems="center" gap={0} minW="0" overflow="hidden">
              {/* 时间和耗时部分 - Tooltip */}
              {timeInfoWithoutTokens && (
                <Tooltip
                  label={`${sentAtText ? `回复时间: ${sentAtText}` : ''}${durationText ? `，耗时: ${durationText}` : ''}`}
                >
                  <Box
                    color="text.muted"
                    fontSize="12px"
                    whiteSpace="nowrap"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    minW="0"
                  >
                    {timeInfoWithoutTokens}
                  </Box>
                </Tooltip>
              )}
              {/* Tokens 部分 - 有快照数据用 Popover，否则用 Tooltip */}
              {roundTokensText && (
                <>
                  {timeInfoWithoutTokens && (
                    <Box
                      color="text.muted"
                      fontSize="12px"
                      mx="1"
                      flexShrink={0}
                    >
                      |
                    </Box>
                  )}
                  {roundTokenBreakdown.length > 0 ? (
                    <Popover
                      trigger="hover"
                      placement="top"
                      openDelay={0}
                      closeDelay={200}
                    >
                      <PopoverTrigger>
                        <Box
                          color="text.muted"
                          fontSize="12px"
                          whiteSpace="nowrap"
                          cursor="pointer"
                          _hover={{ color: 'blue.300' }}
                          transition="color 0.2s"
                        >
                          {roundTokensText}
                        </Box>
                      </PopoverTrigger>
                      <PopoverContent
                        bg={isDark ? '#1E1E1E' : '#FFFFFF'}
                        border="1px solid"
                        borderColor={isDark ? '#333333' : '#E5E7EB'}
                        borderRadius="lg"
                        width="auto"
                        minW="240px"
                        maxW="350px"
                        boxShadow="xl"
                        _focus={{ boxShadow: 'xl' }}
                      >
                        <PopoverBody px={4} py={3} textAlign="left">
                          <TokenBreakdownPanel
                            items={roundTokenBreakdown}
                            isDark={isDark}
                            title="本轮 Tokens 消耗详情"
                          />
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Tooltip label={`本轮消耗: ${roundTokensText}`}>
                      <Box
                        color="text.muted"
                        fontSize="12px"
                        whiteSpace="nowrap"
                      >
                        {roundTokensText}
                      </Box>
                    </Tooltip>
                  )}
                </>
              )}
            </Flex>
          )}
          {!isShare && (
            <Box flex="0 0 auto" ml="auto">
              {renderActionBar}
            </Box>
          )}
        </Flex>
        <Box className="m-2 mx-4 mb-1 px-0 py-1" color="text.primary">
          <MergedMessagesRenderer
            messages={messages}
            isLatest={isLatest}
            attachs={attachs}
            onNewSession={onNewSession}
            onFeedback={onFeedback}
            isShare={isShare}
            setRecommendFileChanges={setRecommendFileChanges}
            userMsgId={userMsgId}
            isToolCallSelected={isToolCallSelected}
            onToggleToolCallRound={onToggleToolCallRound}
            isUserMsgSelected={isUserMsgSelected}
          />
        </Box>
        {!isShare &&
          !isStreaming &&
          !isProcessing &&
          !isSearching &&
          !isSubagentProcessing && (
            <Flex gap={2} h={8} mx={4} mb={4} alignItems="center">
              {isShowAction && timeInfoText && (
                <Flex alignItems="center" gap={0} minW="0" overflow="hidden">
                  {timeInfoWithoutTokens && (
                    <Tooltip
                      label={`${sentAtText ? `回复时间: ${sentAtText}` : ''}${durationText ? `，耗时: ${durationText}` : ''}`}
                    >
                      <Box
                        color="text.muted"
                        fontSize="12px"
                        whiteSpace="nowrap"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        minW="0"
                      >
                        {timeInfoWithoutTokens}
                      </Box>
                    </Tooltip>
                  )}
                  {roundTokensText && (
                    <>
                      {timeInfoWithoutTokens && (
                        <Box
                          color="text.muted"
                          fontSize="12px"
                          mx="1"
                          flexShrink={0}
                        >
                          |
                        </Box>
                      )}
                      {roundTokenBreakdown.length > 0 ? (
                        <Popover
                          trigger="hover"
                          placement="top"
                          openDelay={0}
                          closeDelay={200}
                        >
                          <PopoverTrigger>
                            <Box
                              color="text.muted"
                              fontSize="12px"
                              whiteSpace="nowrap"
                              cursor="pointer"
                              _hover={{ color: 'blue.300' }}
                              transition="color 0.2s"
                            >
                              {roundTokensText}
                            </Box>
                          </PopoverTrigger>
                          <PopoverContent
                            bg={isDark ? '#1E1E1E' : '#FFFFFF'}
                            border="1px solid"
                            borderColor={isDark ? '#333333' : '#E5E7EB'}
                            borderRadius="lg"
                            width="auto"
                            minW="240px"
                            maxW="350px"
                            boxShadow="xl"
                            _focus={{ boxShadow: 'xl' }}
                          >
                            <PopoverBody px={4} py={3} textAlign="left">
                              <TokenBreakdownPanel
                                items={roundTokenBreakdown}
                                isDark={isDark}
                                title="本轮 Tokens 消耗详情"
                              />
                            </PopoverBody>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Tooltip label={`本轮消耗: ${roundTokensText}`}>
                          <Box
                            color="text.muted"
                            fontSize="12px"
                            whiteSpace="nowrap"
                          >
                            {roundTokensText}
                          </Box>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Flex>
              )}
              <Box flex="0 0 auto" ml="auto">
                {renderActionBar}
              </Box>
            </Flex>
          )}
      </Box>
      {isLatest && !!Object?.keys(recommendFileChanges)?.length && (
        <FileRecommendApplyPanel
          data={{
            ...data,
            sessionId: currentSession?._id || '',
          }}
          recommendFileChanges={recommendFileChanges}
        />
      )}
      <Modal
        isCentered
        isOpen={isOpenModal}
        onClose={() => setIsOpenModal(false)}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>删除问答</ModalHeader>
          <ModalBody>
            <div>确定删除当前问答吗？</div>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={() => setIsOpenModal(false)}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              color="white"
              mr={3}
              onClick={() => {
                if (!message.id) return;
                removeQA(message.id, messages[messages.length - 1].id);
                setIsOpenModal(false);
              }}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
