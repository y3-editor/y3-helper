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
import ToolCall from './ToolCall';
import Icon from '../../../components/Icon';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import * as React from 'react';

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

// 合并消息的渲染器
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
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);

  // 只有当前消息组正在流式输出时不合并，其他情况都合并
  const shouldMerge = !(isLatest && (isStreaming || isProcessing));

  // 合并连续的包含 read_file 的消息
  const mergedMessages = useMemo(() => {
    // 如果不应该合并，直接返回单个消息
    if (!shouldMerge) {
      return messages.map((message, index) => ({
        type: 'single' as const,
        messages: [message],
        indices: [index],
      }));
    }

    const result: Array<{
      type: 'single' | 'merged_read_file';
      messages: ChatMessage[];
      indices: number[];
    }> = [];

    let currentReadFileGroup: ChatMessage[] = [];
    let currentReadFileIndices: number[] = [];
    let currentToolCategory: 'list' | 'read' | 'search' | null = null; // 记录当前组的工具类别

    messages.forEach((message, index) => {
      const isAssistant = message.role === ChatRole.Assistant;
      if (!isAssistant || message.processing) {
        // 如果有累积的工具调用，先处理
        if (currentReadFileGroup.length > 0) {
          if (currentReadFileGroup.length === 1) {
            result.push({
              type: 'single',
              messages: [currentReadFileGroup[0]],
              indices: [currentReadFileIndices[0]],
            });
          } else {
            result.push({
              type: 'merged_read_file',
              messages: currentReadFileGroup,
              indices: currentReadFileIndices,
            });
          }
          currentReadFileGroup = [];
          currentReadFileIndices = [];
          currentToolCategory = null;
        }
        return;
      }

      // 检查消息是否包含可合并的工具调用
      const toolName = message.tool_calls?.[0]?.function?.name;
      const toolCategory = getToolCategory(toolName);
      const hasEmptyContent = !message.content || message.content === '-' || message.content === '';

      // grep_search 不参与合并，单独显示
      const shouldMergeThisTool = message.tool_calls?.length === 1
        && message.tool_calls[0]?.type === 'function'
        && toolCategory !== null
        && toolName !== 'grep_search' // grep_search 不合并
        && hasEmptyContent; // 其他工具只有 content 为空时才合并

      if (shouldMergeThisTool) {
        // 如果工具类别和当前组的类别不同，先处理之前的组
        if (currentToolCategory !== null && currentToolCategory !== toolCategory) {
          if (currentReadFileGroup.length === 1) {
            result.push({
              type: 'single',
              messages: [currentReadFileGroup[0]],
              indices: [currentReadFileIndices[0]],
            });
          } else if (currentReadFileGroup.length > 1) {
            result.push({
              type: 'merged_read_file',
              messages: currentReadFileGroup,
              indices: currentReadFileIndices,
            });
          }
          currentReadFileGroup = [];
          currentReadFileIndices = [];
        }

        currentReadFileGroup.push(message);
        currentReadFileIndices.push(index);
        currentToolCategory = toolCategory;
      } else {
        // 如果有累积的工具调用，先处理
        if (currentReadFileGroup.length > 0) {
          if (currentReadFileGroup.length === 1) {
            result.push({
              type: 'single',
              messages: [currentReadFileGroup[0]],
              indices: [currentReadFileIndices[0]],
            });
          } else {
            result.push({
              type: 'merged_read_file',
              messages: currentReadFileGroup,
              indices: currentReadFileIndices,
            });
          }
          currentReadFileGroup = [];
          currentReadFileIndices = [];
          currentToolCategory = null;
        }

        // 添加当前的非可合并工具消息
        result.push({
          type: 'single',
          messages: [message],
          indices: [index],
        });
      }
    });

    // 处理最后累积的工具调用
    if (currentReadFileGroup.length > 0) {
      if (currentReadFileGroup.length === 1) {
        result.push({
          type: 'single',
          messages: [currentReadFileGroup[0]],
          indices: [currentReadFileIndices[0]],
        });
      } else {
        result.push({
          type: 'merged_read_file',
          messages: currentReadFileGroup,
          indices: currentReadFileIndices,
        });
      }
    }

    return result;
  }, [messages, shouldMerge]);

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
    type: 'single' | 'merged_read_file';
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

  // 检查是否有工具调用需要用户确认
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

  // 流式进行中时展开，流式结束后折叠；但需要用户确认时保持展开
  const [isCollapsed, setIsCollapsed] = React.useState(
    !isLatest || (!(isStreaming || isProcessing) && !needsUserConfirmation)
  );

  // 监听流式状态变化，自动更新折叠状态
  React.useEffect(() => {
    if (isLatest) {
      // 如果需要用户确认，保持展开
      if (needsUserConfirmation) {
        setIsCollapsed(false);
      } else {
        setIsCollapsed(!(isStreaming || isProcessing));
      }
    }
  }, [isLatest, isStreaming, isProcessing, needsUserConfirmation]);

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
                  {outerGroup.groups.map((group, groupIndex) => {
                    if (group.type === 'merged_read_file') {
                      return (
                        <MergedReadFileMessages
                          key={`merged-${group.messages[0]?.id || groupIndex}`}
                          messages={group.messages}
                          isLatest={isLatest}
                          isShare={isShare}
                        />
                      );
                    } else {
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
                    }
                  })}
                </VStack>
              )}
            </Box>
          );
        } else {
          // 正常渲染
          return (
            <Box key={`outer-${outerIndex}`}>
              {outerGroup.groups.map((group, groupIndex) => {
                if (group.type === 'merged_read_file') {
                  return (
                    <MergedReadFileMessages
                      key={`merged-${group.messages[0]?.id || groupIndex}`}
                      messages={group.messages}
                      isLatest={isLatest}
                      isShare={isShare}
                    />
                  );
                } else {
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
                }
              })}
            </Box>
          );
        }
      })}
    </>
  );
}

// 合并的 read_file 消息组件
function MergedReadFileMessages({
  messages,
  isLatest,
  isShare,
}: {
  messages: ChatMessage[];
  isLatest: boolean | undefined;
  isShare: boolean | undefined;
}) {
  // 合并所有 tool_calls 和 tool_result
  const mergedMessage = useMemo(() => {
    const allToolCalls = messages.flatMap(msg => msg.tool_calls || []);
    const allToolResults = messages.reduce((acc, msg) => {
      return { ...acc, ...(msg.tool_result || {}) };
    }, {});

    return {
      ...messages[0],
      tool_calls: allToolCalls,
      tool_result: allToolResults,
      response: messages.reduce((acc, msg) => {
        return { ...acc, ...(msg.response || {}) };
      }, {}),
    };
  }, [messages]);

  return (
    <Box>
      <ToolCall
        message={mergedMessage}
        isShare={!!isShare}
        isLatest={isLatest}
      />
    </Box>
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