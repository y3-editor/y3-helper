import { Box, Flex, Avatar, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, VStack } from '@chakra-ui/react';
import CodeMakerLogo from '../../../assets/cmlogo.png';
import ChatAssistantMessage from './AssistantMessage';
import { GroupAIMessageProps } from './types';
import ChatMessageActionBar from '../ChatMessageActionBar';
import userReporter from '../../../utils/report';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { useCallback, useMemo, useState } from 'react';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import { createNewSession } from '../../../utils/chat';
import FileRecommendApplyPanel, { IRecommendFileChangeRecord } from '../FileRecommendApplyPanel';
import { UserEvent } from '../../../types/report';
import { ChatRole } from '../../../types/chat';
import { ChatMessage } from '../../../services';
import Icon from '../../../components/Icon';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import * as React from 'react';
import { usePrevious } from '../../../hooks/usePrevious';

// 工具分类函数 - 提取到组件外部避免重复定义
const getToolCategory = (toolName: string | undefined): 'list' | 'read' | 'search' | null => {
  if (toolName === 'list_files_recursive' || toolName === 'list_files_top_level' || toolName === 'view_source_code_definitions_top_level') {
    return 'list';
  }
  if (toolName === 'read_file') {
    return 'read';
  }
  if (toolName === 'grep_search') {
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
}: {
  messages: ChatMessage[];
  isLatest: boolean | undefined;
  attachs: any[];
  onNewSession: any;
  onFeedback: any;
  isShare: boolean | undefined;
  setRecommendFileChanges: any;
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
    />
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
}) {
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);

  // 检查是否有工具调用需要用户确认（提前计算，用于初始状态）
  const needsUserConfirmation = React.useMemo(() => {
    return mergedMessages.some(item => {
      return item.messages.some(msg => {
        if (!msg.tool_calls || !msg.tool_calls.length) return false;
        // 检查是否所有工具调用都已经有 response
        const hasAllResponses = msg.tool_calls.every(tool => {
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

  const [isCollapsed, setIsCollapsed] = React.useState(initialCollapsedRef.current);

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
  }, [isLatest, isStreaming, isProcessing, prevIsStreaming, prevIsProcessing, needsUserConfirmation]);

  // 判断一个消息组是否是文件操作
  const isFileOperation = (group: typeof mergedMessages[0]) => {
    const firstMessage = group.messages[0];
    const toolName = firstMessage.tool_calls?.[0]?.function?.name;
    return getToolCategory(toolName) !== null;
  };

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
  const shouldWrapRange = firstFileOpIndex !== -1
    && lastFileOpIndex !== -1
    && firstFileOpIndex !== lastFileOpIndex;

  if (shouldWrapRange) {
    // 将第一个文件操作到最后一个文件操作之间的所有消息包裹起来
    const rangeGroups = mergedMessages.slice(firstFileOpIndex, lastFileOpIndex + 1);
    // const totalFileOps = rangeGroups.filter(g => isFileOperation(g)).length;

    // 前面的消息
    const beforeGroups = mergedMessages.slice(0, firstFileOpIndex);
    // 后面的消息
    const afterGroups = mergedMessages.slice(lastFileOpIndex + 1);

    outerGroups.push(
      ...beforeGroups.map(group => ({
        type: 'normal' as const,
        groups: [group],
      })),
      {
        type: 'file_operations' as const,
        groups: rangeGroups,
      },
      ...afterGroups.map(group => ({
        type: 'normal' as const,
        groups: [group],
      }))
    );
  } else {
    // 不需要包裹，所有消息正常显示
    outerGroups.push(...mergedMessages.map(group => ({
      type: 'normal' as const,
      groups: [group],
    })));
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
}: GroupAIMessageProps) {
  const message = messages[0];
  const [isShowAction, setIsShowAction] = useState(false);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [removeQA, onNewSession, chatType] = useChatStore((state) => [state.removeQA, state.onNewSession, state.chatType]);
  const currentSession = useChatStore((state) => state.currentSession());
  const { postMessage } = usePostMessage();
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const showFeedback = useChatStreamStore((state) => state.showFeedback);
  const onUserResubmit = useChatStreamStore((state) => state.onUserResubmit);
  const setStreamRetryCount = useChatStreamStore((state) => state.setStreamRetryCount);
  const [recommendFileChanges, setRecommendFileChanges] = useState<IRecommendFileChangeRecord>({});
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

  const handleCopyToClipboard = useCallback(
    () => {
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
    },
    [postMessage, currentSession?._id, message.id, messages],
  );

  const handleNewSession = useCallback(() => {
    if (!currentSession || !message.id) return;
    const newMessages = createNewSession(message, currentSession, chatType);
    void onNewSession(newMessages);
  }, [message, currentSession, onNewSession, chatType]);

  const onRetryClick = useCallback(() => {
    setStreamRetryCount(0)
    onUserResubmit()
  }, [onUserResubmit, setStreamRetryCount])

  const renderActionBar = useMemo(() => {
    if (isShowAction && !isStreaming && !isProcessing && !isSearching) {
      const hideNewSession = false; // 允许所有聊天类型都支持从此处重新发起对话
      const hideRemove = false;
      const hideRetry = isSearching || isStreaming || !isLatest || !enableReply || !!message.revertedFiles;
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
    message,
    isSearching,
    isStreaming,
    isProcessing,
    enableReply,
    handleNewSession,
    handleCopyToClipboard,
    isLatest,
    onRetryClick,
    onFeedback,
    showFeedback,
  ]);

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
          <Box display="flex" alignItems="center">
            <Avatar w="16px" h="18px" src={CodeMakerLogo} mr="2" />
            <Box flex={1} color="text.secondary" fontSize="12px">
              CodeMaker
            </Box>
          </Box>
          {!isShare && renderActionBar}
        </Flex>
        <Box className="m-2 mx-4 px-0 py-1" color="text.primary">
          <MergedMessagesRenderer
            messages={messages}
            isLatest={isLatest}
            attachs={attachs}
            onNewSession={onNewSession}
            onFeedback={onFeedback}
            isShare={isShare}
            setRecommendFileChanges={setRecommendFileChanges}
          />
        </Box>
        {
          !isShare && !isStreaming && !isProcessing && !isSearching &&
          <Flex
            gap={2}
            h={8}
            mx={4}
            mb={4}
            alignItems="center"
            justifyContent="right"
          >
            {renderActionBar}
          </Flex>
        }
      </Box>
      {isLatest && !!Object?.keys(recommendFileChanges)?.length && (
        <FileRecommendApplyPanel
          data={{
            ...data,
            sessionId: currentSession?._id || ''
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
