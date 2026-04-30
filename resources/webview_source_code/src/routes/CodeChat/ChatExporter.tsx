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
  const currentSesion = useChatStore((state) => state.currentSession());

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

  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing || isSearching;
  }, [isStreaming, isProcessing, isTerminalProcessing, isSearching]);

  const handleOpen = () => {
    userReporter.report({
      event: UserEvent.CODE_CHAT_EXPORT_SESSION,
    });

    // 初始化选中所有 user 消息
    const userMessages = currentSesion?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    const allUserMessageIds = new Set(userMessages.map(msg => msg.id).filter((id): id is string => id !== undefined));
    setSelectedMessageIds(allUserMessageIds);

    // 初始化工具调用选中状态：默认不选中
    setToolCallRoundIds(new Set());

    // 初始化导航状态
    const messages = currentSesion?.data?.messages || [];
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


  const selectSession = React.useMemo(() => {
    const messages = currentSesion?.data?.messages || [];

    return cloneDeep(messages).filter((message, index) => {
      // 如果是 user 消息，检查是否被选中
      if (message.role === ChatRole.User) {
        return message.id !== undefined && selectedMessageIds.has(message.id);
      }

      // 对于非 user 消息（assistant, tool），检查它前面最近的 user 消息是否被选中
      // 向前查找最近的 user 消息
      for (let i = index - 1; i >= 0; i--) {
        if (messages[i].role === ChatRole.User) {
          const userId = messages[i].id;
          // 如果找到的 user 消息被选中，则包含当前消息
          if (userId !== undefined && selectedMessageIds.has(userId)) {
            // 还需要检查当前消息和该 user 消息之间是否有其他 user 消息
            // 如果有，说明当前消息属于后面的对话组，不应包含
            let hasUserBetween = false;
            for (let j = i + 1; j < index; j++) {
              if (messages[j].role === ChatRole.User) {
                hasUserBetween = true;
                break;
              }
            }
            return !hasUserBetween;
          }
          // 如果找到的 user 消息未被选中，则不包含当前消息
          return false;
        }
      }
      return false;
    });
  }, [currentSesion?.data?.messages, selectedMessageIds]);

  const sessionContent = React.useMemo(() => {
    const messages = currentSesion?.data?.messages || [];

    return messages
      .filter((message, index) => {
        // 如果是 user 消息，检查是否被选中
        if (message.role === ChatRole.User) {
          return message.id !== undefined && selectedMessageIds.has(message.id);
        }

        // 对于非 user 消息（assistant, tool），检查它前面最近的 user 消息是否被选中
        // 向前查找最近的 user 消息
        for (let i = index - 1; i >= 0; i--) {
          if (messages[i].role === ChatRole.User) {
            const userId = messages[i].id;
            // 如果找到的 user 消息被选中，则包含当前消息
            if (userId !== undefined && selectedMessageIds.has(userId)) {
              // 还需要检查当前消息和该 user 消息之间是否有其他 user 消息
              // 如果有，说明当前消息属于后面的对话组，不应包含
              let hasUserBetween = false;
              for (let j = i + 1; j < index; j++) {
                if (messages[j].role === ChatRole.User) {
                  hasUserBetween = true;
                  break;
                }
              }
              return !hasUserBetween;
            }
            // 如果找到的 user 消息未被选中，则不包含当前消息
            return false;
          }
        }
        return false;
      })
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
  }, [currentSesion?.data?.messages, selectedMessageIds]);

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
    const messages = currentSesion?.data?.messages || [];
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
  }, [currentSesion?.data?.messages, selectedMessageIds]);

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
    const userMessages = currentSesion?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    const allUserMessageIds = new Set(userMessages.map(msg => msg.id).filter((id): id is string => id !== undefined));

    if (selectedMessageIds.size === allUserMessageIds.size) {
      // 如果已经全选，则取消全选
      setSelectedMessageIds(new Set());
    } else {
      // 否则全选
      setSelectedMessageIds(allUserMessageIds);
    }
  }, [currentSesion?.data?.messages, selectedMessageIds.size]);

  // 检查是否全选
  const isAllSelected = React.useMemo(() => {
    const userMessages = currentSesion?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    return userMessages.length > 0 && selectedMessageIds.size === userMessages.length;
  }, [currentSesion?.data?.messages, selectedMessageIds.size]);

  // 检查是否部分选中
  const isIndeterminate = React.useMemo(() => {
    const userMessages = currentSesion?.data?.messages.filter(msg => msg.role === ChatRole.User) || [];
    return selectedMessageIds.size > 0 && selectedMessageIds.size < userMessages.length;
  }, [currentSesion?.data?.messages, selectedMessageIds.size]);

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
    const cloneCurrentSession:any = cloneDeep(currentSesion);
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
    if (!currentSesion) {
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


      // 判断是否全选
      const totalUserMessages = currentSesion?.data?.messages.filter(msg => msg.role === ChatRole.User).length || 0;
      const isFullSelection = selectedMessageIds.size === totalUserMessages;

      let sessionIdToShare: string;

      if (!isFullSelection) {
        // 部分选择：先创建新的会话
        const newHistoryId = await createHistory();
        if (!newHistoryId) {
          throw new Error('创建分享会话失败');
        }
        sessionIdToShare = newHistoryId;
      } else {
        // 全选：使用当前会话 ID
        sessionIdToShare = currentSesion._id;
      }

      // 统一调用分享接口生成分享 ID
      const response = await codemakerApiRequest.post<any>(
        `/chat/chat_histories/${sessionIdToShare}/share`,
        {},
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

    const messages = currentSesion?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx - 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => { isScrollingRef.current = true; },
      onScrollEnd: () => { isScrollingRef.current = false; },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSesion?.data?.messages, currentUserMsgIdx]);

  // 下一组对话
  const handleNextUserMessage = React.useCallback(() => {
    if (userMsgIndexes.length === 0) return;

    // 直接使用 currentUserMsgIdx，不依赖 DOM 检测
    if (currentUserMsgIdx >= userMsgIndexes.length - 1) return;

    const messages = currentSesion?.data?.messages || [];
    ChatNavUtils.scrollToUserMessage({
      targetIdx: currentUserMsgIdx + 1,
      userMsgIndexes,
      messages,
      chatMessagesRef,
      onScrollStart: () => { isScrollingRef.current = true; },
      onScrollEnd: () => { isScrollingRef.current = false; },
      onUpdateCurrentIdx: setCurrentUserMsgIdx,
    });
  }, [userMsgIndexes, currentSesion?.data?.messages, currentUserMsgIdx]);

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
            <Button size="sm" onClick={handleCopy} isDisabled={selectedMessageIds.size === 0}>
              全部复制
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
});

export default ChatExporter;