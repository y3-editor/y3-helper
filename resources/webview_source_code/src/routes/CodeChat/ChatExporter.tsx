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
  Checkbox,
} from '@chakra-ui/react';
import { TbShare3 } from 'react-icons/tb';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { ChatMessageContent, codemakerApiRequest } from '../../services';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import userReporter from '../../utils/report';
import useCustomToast from '../../hooks/useCustomToast';
import Icon from '../../components/Icon';
import { DateFormat } from '../../utils';
import ChatMessagesList from './ChatMessagesList';
import ChatNavigationButtons from './ChatNavigationButtons';
import { CODEMAKER_UI } from '../CodeCoverage/const';
import { UserEvent } from '../../types/report';
import { ChatRole } from '../../types/chat';
import { ChatMessageHandle } from './ChatMessagesList/types';
import * as ChatNavUtils from './chatNavigationUtils';
import { cloneDeep, unionBy } from 'lodash';
import type { ChatMessage } from '../../services';
import SessionModalFooter from './SessionModalFooter';
import { useTaskCompletionStore } from '../../modules/subagent';

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

export interface ChatExporterHandle {
  isOpen: boolean;
}
const ChatExporter = React.forwardRef<ChatExporterHandle>((_, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const currentSession = useChatStore((state) => state.currentSession());

  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();

  // 消息选择状态管理
  const [selectedMessageIds, setSelectedMessageIds] = React.useState<Set<string>>(new Set());

  // 每轮工具调用的选中状态：key 是 user message id
  const [toolCallRoundIds, setToolCallRoundIds] = React.useState<Set<string>>(
    new Set(),
  );

  // 独立的导航状态管理（不使用 Hook，避免与外面的页面状态冲突）
  const chatMessagesRef = React.useRef<ChatMessageHandle>(null);
  const modalBodyRef = React.useRef<HTMLDivElement>(null);
  const [userMsgIndexes, setUserMsgIndexes] = React.useState<number[]>([]);
  const [currentUserMsgIdx, setCurrentUserMsgIdx] = React.useState<number>(-1);
  const isScrollingRef = React.useRef<boolean>(false);

  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore((state) => state.isTerminalProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const isSubagentProcessing = useTaskCompletionStore(
    (state) => !state.isSessionComplete(currentSession?._id || ''),
  );


  const disabled = React.useMemo(() => {
    return (
      isStreaming ||
      isProcessing ||
      isTerminalProcessing ||
      isSearching ||
      isSubagentProcessing
    );
  }, [
    isStreaming,
    isProcessing,
    isTerminalProcessing,
    isSearching,
    isSubagentProcessing,
  ]);

  const handleOpen = () => {
    userReporter.report({
      event: UserEvent.CODE_CHAT_EXPORT_SESSION,
    });

    // 初始化选中所有 user 消息
    const userMessages = currentSession?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    const allUserMessageIds = new Set(userMessages.map(msg => msg.id).filter((id): id is string => id !== undefined));
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
    // 清理滚动标志
    isScrollingRef.current = false;
  };


  /**
   * 根据选中的 user 消息 + 每轮 toolCallRoundIds，
   * 生成最终要导出的消息列表。
   * 与 ChatFavoriter 保持一致的轮次过滤逻辑。
   */
  const selectSession = React.useMemo(() => {
    const messages = currentSession?.data?.messages || [];

    type Round = {
      userMsg: ChatMessage;
      toolMsgs: ChatMessage[];
      answerMsg: ChatMessage | null;
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
          if (includeToolCalls) toolMsgs.push(m);
        } else if (m.role === ChatRole.Assistant) {
          if (m.tool_calls?.length) {
            if (includeToolCalls) toolMsgs.push(m);
          } else {
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
      result.push(...round.toolMsgs);
      if (round.answerMsg) result.push(cloneDeep(round.answerMsg));
    }

    return result;
  }, [currentSession?.data?.messages, selectedMessageIds, toolCallRoundIds]);

  const sessionContent = React.useMemo(() => {
    return selectSession
      .map((message) => {
        let prefixLabel = '## 对话消息';
        if (message.role === ChatRole.Assistant) {
          prefixLabel = '## 来自 CodeMaker 的消息';
        } else if (message.role === ChatRole.Tool) {
          prefixLabel = '## 工具调用结果';
        } else {
          prefixLabel = '## 来自你的消息';
        }

        let content = '';

        if (typeof message.content === 'string') {
          content = `${prefixLabel}\n${message.content}`.replace(
            /```(.+):(.+)\n/g,
            '```$1 fileName=$2\n',
          );
        } else {
          if (Array.isArray(message.content)) {
            let newContent = `${prefixLabel}\n`;
            message.content.forEach((o) => {
              if (o.type === ChatMessageContent.ImageUrl) {
                const newUrl = o.image_url.url.replace(
                  'https://cm-img.s3v2.nie.netease.com',
                  `${window.origin}/proxy/img`,
                );
                newContent += `![image](${newUrl})\n`;
              } else {
                newContent += `${o.text}\n`;
              }
            });
            content = newContent.replace(/```(.+):(.+)\n/g, '```$1 fileName=$2\n');
          }
        }

        // 添加 webSearch 参考链接
        if (message.webSearch?.length) {
          const webSearchLinks = message.webSearch
            .map((i) => i.web)
            .filter((webItem) => webItem?.uri);
          if (webSearchLinks.length) {
            content += '\n\n> 参考链接：\n';
            webSearchLinks.forEach((item, index) => {
              content += `> ${index + 1}: [${item.title}](${item.uri})\n`;
            });
          }
        }

        // 添加 bmSearch 参考链接
        if (message.bmSearch?.length) {
          let bmSearchLinks = [];
          if (message.bmMark) {
            const formatBmSearch = message.bmSearch.map((i, index) => ({
              ...i,
              rank: index + 1,
            }));
            bmSearchLinks = formatBmSearch.filter((i) =>
              message.bmSearchSourcesIndex?.includes(i.rank),
            );
          } else {
            const filterSearch = message.bmSearch.filter((i) => i.attributes?.url);
            bmSearchLinks = unionBy(filterSearch, 'attributes.url').map((i, index) => ({
              ...i,
              rank: index + 1,
            }));
          }

          if (bmSearchLinks.length) {
            content += '\n\n> 参考链接：\n';
            bmSearchLinks.forEach((item) => {
              if (item.attributes?.url) {
                content += `> ${item.rank}: [${item.attributes.filename}](${item.attributes.url})\n`;
              } else {
                content += `> ${item.rank}: ${item.attributes?.filename}\n`;
              }
            });
          }
        }

        return content;
      })
      .join('\n\n');
  }, [selectSession]);

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
      setToolCallRoundIds(new Set());
    } else {
      setToolCallRoundIds(new Set(allToolCallUserMsgIds));
    }
  }, [isAllToolCallSelected, allToolCallUserMsgIds]);

  // 全选/取消全选
  const handleToggleAll = React.useCallback(() => {
    const userMessages = currentSession?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    const allUserMessageIds = new Set(userMessages.map(msg => msg.id).filter((id): id is string => id !== undefined));

    if (selectedMessageIds.size === allUserMessageIds.size) {
      // 如果已经全选，则取消全选
      setSelectedMessageIds(new Set());
    } else {
      // 否则全选
      setSelectedMessageIds(allUserMessageIds);
    }
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  // 检查是否全选
  const isAllSelected = React.useMemo(() => {
    const userMessages = currentSession?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    return userMessages.length > 0 && selectedMessageIds.size === userMessages.length;
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  // 检查是否部分选中
  const isIndeterminate = React.useMemo(() => {
    const userMessages = currentSession?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    return selectedMessageIds.size > 0 && selectedMessageIds.size < userMessages.length;
  }, [currentSession?.data?.messages, selectedMessageIds.size]);

  const handleCopy = () => {
    try {
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: sessionContent,
      });
      toast({
        title: '复制成功',
        position: 'top',
        isClosable: true,
        duration: 1000,
        status: 'success',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownload = () => {
    const filenameDate = DateFormat(new Date().getTime(), 'YYYY-MM-DD_HHmm');
    const filename = `CodeMaker会话${filenameDate}.md`;
    try {
      postMessage({
        type: BroadcastActions.EXPORT_FILE,
        data: {
          content: sessionContent,
          filename,
        },
      });
    } catch (error) {
      console.error(error);
    }
  };

  const createHistory = async () => {
    const cloneCurrentSession:any = cloneDeep(currentSession);
    if (!cloneCurrentSession) return null;

    cloneCurrentSession.data.messages = selectSession;
    cloneCurrentSession.topic = `分享会话 - ${DateFormat(new Date().getTime(), 'YYYY-MM-DD HH:mm')}`;
    cloneCurrentSession.chat_type = 'tmp_share';

    try {
      const response = await codemakerApiRequest.post<any>(
        `/chat/chat_histories`,
        cloneCurrentSession,
      );
      return response.data._id;
    } catch (error) {
      console.error('创建分享会话请求失败:', error);
      return null;
    }
  };

  const shareLink = async () => {
    // 参数验证
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

    try {
      // 判断是否需要创建临时会话
      const totalUserMessages = currentSession?.data?.messages.filter(msg => msg.role === ChatRole.User).length || 0;
      const isFullUserSelection = selectedMessageIds.size === totalUserMessages;
      // 检查是否有工具调用被排除（存在工具调用轮次但未全选）
      const hasToolCallDeselected = allToolCallUserMsgIds.length > 0 &&
        allToolCallUserMsgIds.some((id) => !toolCallRoundIds.has(id));
      // 只有全选消息且工具调用也全选时，才能直接使用原会话
      const needsNewSession = !isFullUserSelection || hasToolCallDeselected;

      let sessionIdToShare: string;

      if (needsNewSession) {
        // 部分选择或工具调用未全选：先创建新的会话
        const newHistoryId = await createHistory();
        if (!newHistoryId) {
          throw new Error('创建分享会话失败');
        }
        sessionIdToShare = newHistoryId;
      } else {
        // 完全全选：使用当前会话 ID
        sessionIdToShare = currentSession._id;
      }

      // 统一调用分享接口生成分享 ID
      const response = await codemakerApiRequest.post<any>(
        `/chat/chat_histories/${sessionIdToShare}/share`,
        {
          origin_history_id: currentSession._id,
        },
      );
      const shareId = response.data._id;

      // 生成分享链接并复制到剪贴板
      const url = `${CODEMAKER_UI}/share/${shareId}`;
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: url,
      });

      toast({
        title: '分享链接已复制到剪贴板',
        position: 'top',
        isClosable: true,
        duration: 2000,
        status: 'success',
      });

      // 上报用户行为
      userReporter.report({
        event: UserEvent.CODE_CHAT_EXPORT_SESSION,
      });
    } catch (error) {
      console.error('分享链接请求失败:', error);
      toast({
        title: '分享链接失败，请重试',
        position: 'top',
        isClosable: true,
        duration: 2000,
        status: 'error',
      });
    }
  };

  React.useImperativeHandle(ref, () => ({
    isOpen: isOpen,
  }));

  // 当 Modal 打开时，重置导航状态到最后一条消息并滚动到底部
  React.useEffect(() => {
    if (isOpen && userMsgIndexes.length > 0) {
      const lastIdx = userMsgIndexes.length - 1;

      // 立即设置到最后一条
      setCurrentUserMsgIdx(lastIdx);

      // 滚动到底部
      setTimeout(() => {
        if (modalBodyRef?.current) {
          modalBodyRef.current.scrollTo({
            top: modalBodyRef.current.scrollHeight,
            behavior: 'auto',
          });

          // 滚动完成后，再次确认设置为最后一条（避免滚动过程中被其他逻辑改变）
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

    // 直接使用 currentUserMsgIdx，不依赖 DOM 检测
    if (currentUserMsgIdx <= 0) return;

    const messages = currentSession?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx - 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => { isScrollingRef.current = true; },
      onScrollEnd: () => { isScrollingRef.current = false; },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSession?.data?.messages, currentUserMsgIdx]);

  // 下一组对话
  const handleNextUserMessage = React.useCallback(() => {
    if (userMsgIndexes.length === 0) return;

    // 直接使用 currentUserMsgIdx，不依赖 DOM 检测
    if (currentUserMsgIdx >= userMsgIndexes.length - 1) return;

    const messages = currentSession?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx + 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => { isScrollingRef.current = true; },
      onScrollEnd: () => { isScrollingRef.current = false; },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSession?.data?.messages, currentUserMsgIdx]);

  // 检查是否可以上一组
  const canGoPrev = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    // 基于 currentUserMsgIdx 判断
    return currentUserMsgIdx > 0;
  }, [userMsgIndexes.length, currentUserMsgIdx]);

  // 检查是否可以下一组
  const canGoNext = React.useCallback(() => {
    if (userMsgIndexes.length <= 1) return false;
    // 基于 currentUserMsgIdx 判断
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

  // 置顶
  const scrollToTop = React.useCallback(() => {
    ChatNavUtils.scrollToTop({
      containerRef: modalBodyRef,
      chatMessagesRef,
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, []);

  return (
    <>
      <Tooltip label="分享会话">
        <Button
          aria-label="分享会话"
          size="xs"
          onClick={handleOpen}
          isDisabled={disabled}
          bg="none"
          color="text.default"
        >
          <Icon as={TbShare3} size="xs" className='mr-1' />分享会话
        </Button>
      </Tooltip>
      <Modal
        id="chat-exporter"
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
          <ModalHeader fontSize="lg">分享会话</ModalHeader>
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
          <SessionModalFooter
            checkboxes={
              <>
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
              </>
            }
            navigationButtons={
              <ChatNavigationButtons
                userMsgIndexes={userMsgIndexes}
                isStreaming={false}
                onPrevMessage={handlePrevUserMessage}
                onNextMessage={handleNextUserMessage}
                onScrollToBottom={scrollToBottom}
                onScrollToTop={scrollToTop}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
              />
            }
            actionButtons={
              <>
                <Button
                  colorScheme="blue"
                  color="white"
                  size="sm"
                  onClick={shareLink}
                  isDisabled={selectedMessageIds.size === 0}
                >
                  复制链接
                </Button>
                <Button
                  colorScheme="blue"
                  color="white"
                  size="sm"
                  onClick={handleDownload}
                  isDisabled={selectedMessageIds.size === 0}
                >
                  下载文件
                </Button>
                <Button
                  size="sm"
                  onClick={handleCopy}
                  isDisabled={selectedMessageIds.size === 0}
                >
                  全部复制
                </Button>
              </>
            }
          />
        </ModalContent>
      </Modal>
    </>
  );
});

export default ChatExporter;