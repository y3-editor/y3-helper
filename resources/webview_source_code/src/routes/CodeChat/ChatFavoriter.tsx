import * as React from 'react';
import {
  Button,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Checkbox,
  Box,
} from '@chakra-ui/react';
import { AiOutlineStar } from 'react-icons/ai';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { createSession } from '../../services/chat';
import useCustomToast from '../../hooks/useCustomToast';
import Icon from '../../components/Icon';
import { DateFormat } from '../../utils';
import ChatMessagesList from './ChatMessagesList';
import ChatNavigationButtons from './ChatNavigationButtons';
import { ChatRole } from '../../types/chat';
import { ChatMessageHandle } from './ChatMessagesList/types';
import * as ChatNavUtils from './chatNavigationUtils';
import { cloneDeep } from 'lodash';
import type { ChatMessage } from '../../services';
import { mutateService } from '../../hooks/useService';
import { requestChatSessions } from '../../store/chat';
import EventBus, { EBusEvent } from '../../utils/eventbus';

// 判断一轮消息中是否包含工具调用
function roundHasToolCalls(messages: ChatMessage[], userIdx: number): boolean {
  for (let j = userIdx + 1; j < messages.length; j++) {
    if (messages[j].role === ChatRole.User) break;
    const m = messages[j];
    if (m.role === ChatRole.Tool) return true;
    if (m.role === ChatRole.Assistant && m.tool_calls?.length) {
      return true;
    }
  }
  return false;
}

export interface ChatFavoriterHandle {
  isOpen: boolean;
}

const ChatFavoriter = React.forwardRef<ChatFavoriterHandle>((_, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFavoriting, setIsFavoriting] = React.useState(false);
  const currentSession = useChatStore((state) => state.currentSession());

  const { toast } = useCustomToast();

  // 消息选择状态管理
  const [selectedMessageIds, setSelectedMessageIds] = React.useState<
    Set<string>
  >(new Set());

  // 每轮工具调用的选中状态：key 是 user message id
  const [toolCallRoundIds, setToolCallRoundIds] = React.useState<Set<string>>(
    new Set(),
  );

  // 导航状态管理
  const chatMessagesRef = React.useRef<ChatMessageHandle>(null);
  const modalBodyRef = React.useRef<HTMLDivElement>(null);
  const [userMsgIndexes, setUserMsgIndexes] = React.useState<number[]>([]);
  const [currentUserMsgIdx, setCurrentUserMsgIdx] = React.useState<number>(-1);
  const isScrollingRef = React.useRef<boolean>(false);

  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const isSearching = useChatStreamStore((state) => state.isSearching);

  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing || isSearching;
  }, [isStreaming, isProcessing, isTerminalProcessing, isSearching]);

  const handleOpen = () => {
    // 初始化选中所有 user 消息
    const userMessages =
      currentSession?.data?.messages.filter(
        (msg) => msg.role === ChatRole.User,
      ) || [];
    const allUserMessageIds = new Set(
      userMessages
        .map((msg) => msg.id)
        .filter((id): id is string => id !== undefined),
    );
    setSelectedMessageIds(allUserMessageIds);

    // 初始化工具调用选中状态：默认不选中
    setToolCallRoundIds(new Set());

    // 初始化导航状态
    const messages = currentSession?.data?.messages || [];
    const indexes = ChatNavUtils.calculateUserMsgIndexes(messages);
    setUserMsgIndexes(indexes);
    setCurrentUserMsgIdx(indexes.length > 0 ? indexes.length - 1 : -1);

    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    isScrollingRef.current = false;
  };

  /**
   * 根据选中的 user 消息 + 每轮 toolCallRoundIds，
   * 生成最终要收藏的消息列表（工具调用聚合到 assistant 回答之前）。
   *
   * 聚合规则：同一轮对话中若有多次 tool_calls → tool_result 往返，
   * 统一合并为一条「聚合 assistant 消息」放在最终 assistant 回答之前。
   * 结构：user → [toolCallAggregate] → assistantWithContent
   */
  const selectSession = React.useMemo(() => {
    const messages = currentSession?.data?.messages || [];

    // 找到每条 user 消息对应「轮次」的范围 [userIdx, nextUserIdx)
    type Round = {
      userMsg: ChatMessage;
      toolMsgs: ChatMessage[]; // assistant with tool_calls + tool role responses
      answerMsg: ChatMessage | null; // assistant with content
    };

    const rounds: Round[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== ChatRole.User) continue;
      if (msg.id === undefined || !selectedMessageIds.has(msg.id)) continue;

      const includeToolCalls = toolCallRoundIds.has(msg.id);

      // 收集这条 user 之后、下一条 user 之前的所有消息
      const roundMsgs: ChatMessage[] = [];
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].role === ChatRole.User) break;
        roundMsgs.push(messages[j]);
      }

      // 区分工具调用相关消息 vs 最终回答消息
      const toolMsgs: ChatMessage[] = [];
      let answerMsg: ChatMessage | null = null;

      for (const m of roundMsgs) {
        if (m.role === ChatRole.Tool) {
          // tool result，跟随该轮 includeToolCalls 开关
          if (includeToolCalls) toolMsgs.push(m);
        } else if (m.role === ChatRole.Assistant) {
          if (m.tool_calls?.length) {
            // 含 tool_calls 的 assistant 消息，跟随该轮 includeToolCalls 开关
            if (includeToolCalls) toolMsgs.push(m);
          } else {
            // 无 tool_calls 的最终回答
            answerMsg = m;
          }
        }
      }

      rounds.push({ userMsg: cloneDeep(msg), toolMsgs, answerMsg });
    }

    // 展开为最终消息列表
    const result: ChatMessage[] = [];
    for (const round of rounds) {
      result.push(round.userMsg);
      // 工具调用消息（已根据该轮 includeToolCalls 过滤）放在回答之前
      result.push(...round.toolMsgs);
      if (round.answerMsg) result.push(cloneDeep(round.answerMsg));
    }

    return result;
  }, [currentSession?.data?.messages, selectedMessageIds, toolCallRoundIds]);

  // 切换单个消息的选中状态
  const handleToggleMessage = React.useCallback((messageId: string) => {
    setSelectedMessageIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // 切换单轮工具调用的选中状态
  const handleToggleToolCallRound = React.useCallback(
    (userMsgId: string) => {
      setToolCallRoundIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(userMsgId)) {
          newSet.delete(userMsgId);
        } else {
          newSet.add(userMsgId);
        }
        return newSet;
      });
    },
    [],
  );

  // 计算所有有工具调用的轮次 user message id 列表
  const allToolCallUserMsgIds = React.useMemo(() => {
    const messages = currentSession?.data?.messages || [];
    const ids: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== ChatRole.User || !msg.id) continue;
      if (!selectedMessageIds.has(msg.id)) continue;
      if (roundHasToolCalls(messages, i)) {
        ids.push(msg.id);
      }
    }
    return ids;
  }, [currentSession?.data?.messages, selectedMessageIds]);

  // 全局工具调用 checkbox 状态
  const isAllToolCallSelected = React.useMemo(() => {
    if (allToolCallUserMsgIds.length === 0) return false;
    return allToolCallUserMsgIds.every((id) => toolCallRoundIds.has(id));
  }, [allToolCallUserMsgIds, toolCallRoundIds]);

  const isToolCallIndeterminate = React.useMemo(() => {
    if (allToolCallUserMsgIds.length === 0) return false;
    const selectedCount = allToolCallUserMsgIds.filter((id) =>
      toolCallRoundIds.has(id),
    ).length;
    return selectedCount > 0 && selectedCount < allToolCallUserMsgIds.length;
  }, [allToolCallUserMsgIds, toolCallRoundIds]);

  // 全局工具调用 checkbox 切换
  const handleToggleAllToolCalls = React.useCallback(() => {
    if (isAllToolCallSelected) {
      // 取消所有
      setToolCallRoundIds(new Set());
    } else {
      // 全选所有有工具调用的轮次
      setToolCallRoundIds(new Set(allToolCallUserMsgIds));
    }
  }, [isAllToolCallSelected, allToolCallUserMsgIds]);

  // 全选/取消全选
  const handleToggleAll = React.useCallback(() => {
    const userMessages =
      currentSession?.data?.messages.filter(
        (msg) => msg.role === ChatRole.User,
      ) || [];
    const allUserMessageIds = new Set(
      userMessages
        .map((msg) => msg.id)
        .filter((id): id is string => id !== undefined),
    );

    if (selectedMessageIds.size === allUserMessageIds.size) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(allUserMessageIds);
    }
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  // 是否全选
  const isAllSelected = React.useMemo(() => {
    const userMessages =
      currentSession?.data?.messages.filter(
        (msg) => msg.role === ChatRole.User,
      ) || [];
    return (
      userMessages.length > 0 && selectedMessageIds.size === userMessages.length
    );
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  // 是否部分选中
  const isIndeterminate = React.useMemo(() => {
    const userMessages =
      currentSession?.data?.messages.filter(
        (msg) => msg.role === ChatRole.User,
      ) || [];
    return (
      selectedMessageIds.size > 0 &&
      selectedMessageIds.size < userMessages.length
    );
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  // 收藏对话：另存为新会话并打上 is_favorite 标记
  const handleFavorite = async () => {
    if (!currentSession) {
      toast({
        title: '当前会话不存在',
        position: 'top',
        isClosable: true,
        duration: 2000,
        status: 'error',
      });
      return;
    }

    if (selectedMessageIds.size === 0) {
      toast({
        title: '请至少选择一条消息',
        position: 'top',
        isClosable: true,
        duration: 2000,
        status: 'warning',
      });
      return;
    }

    setIsFavoriting(true);
    try {
      const topicDate = DateFormat(new Date().getTime(), 'YYYY-MM-DD HH:mm');
      const topic = currentSession.topic
        ? `${currentSession.topic}`
        : `${topicDate}`;

      const favoriteParams: Parameters<typeof createSession>[0] & {
        chat_repo?: string;
      } = {
        topic,
        chat_type: currentSession.chat_type || 'default',
        data: {
          messages: selectSession,
          model: currentSession.data?.model as string | undefined,
        },
        is_favorite: true,
      };

      // codebase 类型收藏时绑定仓库信息
      if (currentSession.chat_repo) {
        favoriteParams.chat_repo = currentSession.chat_repo;
      }

      await createSession(favoriteParams);

      toast({
        position: 'top',
        isClosable: true,
        duration: 3000,
        status: 'success',
        title: (
          <span>
            收藏成功，可在历史会话中查看
            <Button
              variant="link"
              color="blue.300"
              onClick={() => {
                EventBus.instance.dispatch(
                  EBusEvent.Open_Favorite_History,
                );
              }}
            >
              收藏会话
            </Button>
          </span>
        ),
      });

      // 刷新会话列表，让收藏会话出现在历史列表中
      mutateService(requestChatSessions);

      handleClose();
    } catch (error) {
      console.error('收藏会话失败:', error);
      toast({
        title: '收藏失败，请重试',
        position: 'top',
        isClosable: true,
        duration: 2000,
        status: 'error',
      });
    } finally {
      setIsFavoriting(false);
    }
  };

  React.useImperativeHandle(ref, () => ({
    isOpen: isOpen,
  }));

  // Modal 打开时，滚动到底部并定位到最后一条 user 消息
  React.useEffect(() => {
    if (isOpen && userMsgIndexes.length > 0) {
      const lastIdx = userMsgIndexes.length - 1;
      setCurrentUserMsgIdx(lastIdx);

      setTimeout(() => {
        if (modalBodyRef?.current) {
          modalBodyRef.current.scrollTo({
            top: modalBodyRef.current.scrollHeight,
            behavior: 'auto',
          });
          setTimeout(() => {
            setCurrentUserMsgIdx(lastIdx);
          }, 200);
        }
      }, 100);
    }
  }, [isOpen, userMsgIndexes.length]);

  // 上一组对话
  const handlePrevUserMessage = React.useCallback(() => {
    if (userMsgIndexes.length === 0) return;
    if (currentUserMsgIdx <= 0) return;

    const messages = currentSession?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx - 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => {
        isScrollingRef.current = true;
      },
      onScrollEnd: () => {
        isScrollingRef.current = false;
      },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSession?.data?.messages, currentUserMsgIdx]);

  // 下一组对话
  const handleNextUserMessage = React.useCallback(() => {
    if (userMsgIndexes.length === 0) return;
    if (currentUserMsgIdx >= userMsgIndexes.length - 1) return;

    const messages = currentSession?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx + 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => {
        isScrollingRef.current = true;
      },
      onScrollEnd: () => {
        isScrollingRef.current = false;
      },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSession?.data?.messages, currentUserMsgIdx]);

  // 是否可以上一组
  const canGoPrev = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    return currentUserMsgIdx > 0;
  }, [userMsgIndexes.length, currentUserMsgIdx]);

  // 是否可以下一组
  const canGoNext = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    return currentUserMsgIdx < userMsgIndexes.length - 1;
  }, [userMsgIndexes.length, currentUserMsgIdx]);

  // 置底
  const scrollToBottom = React.useCallback(() => {
    ChatNavUtils.scrollToBottom({
      containerRef: modalBodyRef,
      userMsgIndexes,
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes]);

  return (
    <>
      <Tooltip label="收藏会话">
        <Button
          aria-label="收藏会话"
          size="xs"
          onClick={handleOpen}
          isDisabled={disabled}
          bg="none"
          color="text.default"
        >
          <Icon as={AiOutlineStar} size="xs" className="mr-1" />
          收藏会话
        </Button>
      </Tooltip>
      <Modal
        id="chat-favoriter"
        isCentered
        size="full"
        scrollBehavior="inside"
        isOpen={isOpen}
        onClose={handleClose}
        autoFocus={false}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="lg">收藏会话</ModalHeader>
          <ModalCloseButton />
          <ModalBody fontSize="12px" ref={modalBodyRef} position="relative">
            <div className="markdown-body">
              <ChatMessagesList
                ref={chatMessagesRef}
                containerRef={modalBodyRef}
                isShare
                selectedMessageIds={selectedMessageIds}
                onToggleMessage={handleToggleMessage}
                toolCallRoundIds={toolCallRoundIds}
                onToggleToolCallRound={handleToggleToolCallRound}
              />
            </div>
          </ModalBody>
          <ModalFooter gap={2}>
            <Checkbox
              isChecked={isAllSelected}
              isIndeterminate={isIndeterminate}
              onChange={handleToggleAll}
            >
              全选
            </Checkbox>
            {allToolCallUserMsgIds.length > 0 && (
              <Checkbox
                isChecked={isAllToolCallSelected}
                isIndeterminate={isToolCallIndeterminate}
                onChange={handleToggleAllToolCalls}
              >
                工具调用
              </Checkbox>
            )}
            <Box mr="auto">
              <ChatNavigationButtons
                userMsgIndexes={userMsgIndexes}
                isStreaming={false}
                onPrevMessage={handlePrevUserMessage}
                onNextMessage={handleNextUserMessage}
                onScrollToBottom={scrollToBottom}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
              />
            </Box>
            <Button
              colorScheme="blue"
              color="white"
              size="sm"
              onClick={handleFavorite}
              isDisabled={selectedMessageIds.size === 0}
              isLoading={isFavoriting}
              loadingText="收藏中..."
            >
              收藏对话
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
});

export default ChatFavoriter;