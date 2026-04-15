import * as React from 'react';
import {
  Flex,
  Box,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverCloseButton,
  PopoverBody,
  IconButton,
  VStack,
  Button,
  Spacer,
  Tooltip,
  Input,
  PopoverArrow,
  PopoverFooter,
  ButtonGroup,
  useMediaQuery,
  Portal,
  Spinner,
} from '@chakra-ui/react';
import { ChatIcon } from '@chakra-ui/icons';
import { TbClockHour3, TbCheck } from 'react-icons/tb';
import { RiFileEditLine, RiDeleteBinLine } from 'react-icons/ri';
import { IoMdClose } from 'react-icons/io';
import {
  useChatStore,
  useChatStreamStore,
  DEFAULT_TOPIC,
  requestChatSessions,
  ChatSession,
} from '../../store/chat';
import { DateFormat, alphabeticalCompare } from '../../utils';
import userReporter from '../../utils/report';
import useCustomToast from '../../hooks/useCustomToast';
import Icon from '../../components/Icon';
import { scrollToFocusItem } from './ChatTypeAhead/utils';
import { toastErrorMessage } from '../../utils';
import { useChatConfig } from '../../store/chat-config';
import { getHistories } from '../../services/chat';
import { debounce, isNumber } from 'lodash';
import { MdInbox } from 'react-icons/md';
import {
  SmallScreenWidth,
  MediumScreenWidth,
  LargeScreenWidth,
} from '../../const';
import { BsDatabase } from 'react-icons/bs';
import { ChatMessageContent } from '../../services/index';
import { useCodeChatContext } from './CodeChatProvider';
import { Select } from 'chakra-react-select';
import { RiArrowDownSLine } from 'react-icons/ri';
import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '../../store/workspace';
import CustomCollapse from '../../components/Collapse';
import { useTerminalMessage } from './ChatMessagesList/TermialPanel';
import { UserEvent } from '../../types/report';
import { ChatModel } from '../../services/chatModel';

interface NewChatSession extends ChatSession {
  disabled?: boolean;
}
export interface ChatHistoriesHandle {
  isOpen: boolean;
}
interface SearchMessageResult extends ChatSession {
  content: string;
  messageId: string;
  role: string;
  messages: [];
  context: string;
}
enum SearchField {
  Topic = 'topic',
  Content = 'topic_content',
}

const searchOptions = [
  { label: '内容', value: SearchField.Content },
  { label: '标题', value: SearchField.Topic },
];

interface SessionItemProps {
  item: ChatSession;
  index: number;
  isStreaming: boolean;
  isSearching: boolean;
  currentSessionId: string | undefined;
  onSelect: (id: string) => void;
  onUpdateTopic: (id: string, topic: string) => Promise<void>;
  onDelete: (id: string) => void;
}

const SessionItemComponent = React.memo(
  ({
    item,
    index,
    isStreaming,
    isSearching,
    currentSessionId,
    onSelect,
    onUpdateTopic,
    onDelete,
  }: SessionItemProps) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(item.topic || '');
    const updateTime = item.metadata?.update_time;
    const messageLength = isNumber(item.message_count)
      ? item.message_count
      : item.data?.messages.length;
    const [removeConfirmOpen, setRemoveConfirmOpen] = React.useState(false);

    const isDisabled = isStreaming || isSearching;

    return (
      <Box
        data-index={index}
        h="full"
        w="full"
        borderRadius="8px"
        px={2}
        my={1}
        onClick={(e) => {
          if (isDisabled) return;
          e.stopPropagation();
          onSelect(item._id);
        }}
        _hover={isDisabled ? {} : { backgroundColor: 'blue.300' }}
        bg={currentSessionId === item._id ? 'blue.300' : 'panelBgColor'}
        opacity={isDisabled ? 0.5 : 1}
        cursor={isDisabled ? 'not-allowed' : 'pointer'}
      >
        <Box textAlign="left" w="full" py={2} flex={1}>
          <Flex justify="space-between" align="center" mb={1}>
            {isEditing ? (
              <>
                <Input
                  type="text"
                  value={editValue}
                  border="1px solid #fff"
                  maxW="160px"
                  onChange={(e) => {
                    e.stopPropagation();
                    setEditValue(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
                <Box>
                  <IconButton
                    aria-label="确定"
                    variant="ghost"
                    size="xs"
                    icon={<Icon as={TbCheck} size="sm" />}
                    className="mr-1"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onUpdateTopic(item._id, editValue);
                      setIsEditing(false);
                    }}
                  />
                  <IconButton
                    aria-label="取消"
                    variant="ghost"
                    size="xs"
                    icon={<Icon as={IoMdClose} size="sm" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                  />
                </Box>
              </>
            ) : (
              <Box
                w="full"
                display="flex"
                justifyContent="space-between"
                minH="20px"
              >
                <Text fontSize="sm" isTruncated maxW="160px">
                  <ChatIcon w={8} fontSize="sm" />
                  {item.topic || DEFAULT_TOPIC}
                </Text>

                {!(item as NewChatSession)?.disabled && (
                  <Box>
                    <IconButton
                      aria-label="编辑"
                      variant="ghost"
                      size="xs"
                      icon={<Icon as={RiFileEditLine} size="sm" />}
                      isDisabled={isStreaming || isSearching}
                      color="text.default"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                        setEditValue(item.topic || '');
                      }}
                    />
                    <Popover
                      placement="bottom"
                      closeOnBlur={true}
                      strategy="fixed"
                      isOpen={removeConfirmOpen}
                      isLazy
                    >
                      <PopoverTrigger>
                        <IconButton
                          aria-label="删除会话"
                          size="xs"
                          icon={<Icon as={RiDeleteBinLine} size="sm" />}
                          bg="none"
                          isDisabled={isStreaming || isSearching}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveConfirmOpen(true);
                          }}
                          color="text.default"
                        />
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverHeader pt={4} fontWeight="bold" border="0">
                          删除当前会话
                        </PopoverHeader>
                        <PopoverArrow />
                        <PopoverBody>
                          确定删除吗？删除后会话将不可恢复。
                        </PopoverBody>
                        <PopoverFooter
                          border="0"
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          pb={4}
                        >
                          <ButtonGroup size="sm">
                            <Button
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemoveConfirmOpen(false);
                              }}
                            >
                              取消
                            </Button>
                            <Button
                              colorScheme="blue"
                              color="white"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item._id);
                                setRemoveConfirmOpen(false);
                              }}
                            >
                              删除
                            </Button>
                          </ButtonGroup>
                        </PopoverFooter>
                      </PopoverContent>
                    </Popover>
                  </Box>
                )}
              </Box>
            )}
          </Flex>
          {item?.chat_type === 'codebase' && item?.chat_repo && (
            <Box display="flex" alignItems="center" pl={2} mb={2}>
              <Flex gap={1} alignItems="center" isTruncated>
                <BsDatabase fontSize={12} />
                <Text ml={1} fontSize={12}>
                  {item?.chat_repo || '-'}
                </Text>
              </Flex>
            </Box>
          )}

          <Flex>
            <Text fontSize="xs" opacity="0.5" pl={2} isTruncated>
              {updateTime &&
                DateFormat(new Date(updateTime), 'YYYY-MM-DD HH:mm:ss')}
            </Text>
            <Spacer />
            {messageLength ? (
              <Text fontSize="xs" opacity="0.5" pr={2}>
                {messageLength} 条对话
              </Text>
            ) : null}
          </Flex>
        </Box>
      </Box>
    );
  },
);
const ChatHistories = React.forwardRef((_, ref) => {
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore((state) => state.isTerminalProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [
    sessions,
    currentSession,
    selectSession,
    updateTopic,
    removeSession,
    revalidateChatSessions,
    chatType,
  ] = useChatStore((state) => [
    state.sessions,
    state.currentSession(),
    state.selectSession,
    state.updateTopic,
    state.removeSession,
    state.revalidateChatSessions,
    state.chatType,
  ]);

  const updateModel = useChatConfig((state) => state.update);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const [searchSessions, setSearchSessions] = React.useState<NewChatSession[]>(
    [],
  );
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const [isMediumScreen] = useMediaQuery(MediumScreenWidth);
  const [isLargerThan340] = useMediaQuery(LargeScreenWidth);
  const [selectedMessageId, setSelectedMessageId] = React.useState('');
  const { chatMessagesRef } = useCodeChatContext();
  const [loading, setLoading] = React.useState(false);
  const [searchField, setSearchField] = React.useState(searchOptions[0]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scrollLoading, setScrollLoading] = React.useState(false);
  const [isNext, setIsNext] = React.useState(true);
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const [currentRepoOpen, setCurrentRepoOpen] = React.useState(true);
  const [otherRepoOpen, setOtherRepoOpen] = React.useState(true);
  const { stopRunningTerminal } = useTerminalMessage();

  const updateSessions = React.useCallback(async () => {
    const data = await requestChatSessions();
    revalidateChatSessions(data.items, chatType);
  }, [revalidateChatSessions, chatType]);

  const { toast } = useCustomToast();

  const handleDelete = React.useCallback(
    async (sessionId: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_REMOVE_SESSION,
      });
      if (!sessionId) {
        return;
      }
      try {
        await removeSession(sessionId);
        await updateSessions();
        toast({
          title: '删除成功',
          position: 'top',
          isClosable: true,
          duration: 1000,
          status: 'success',
        });
      } catch (error) {
        console.log(error);
        toast({
          title: toastErrorMessage(error as Error),
          position: 'top',
          isClosable: true,
          status: 'error',
        });
      }
    },
    [removeSession, updateSessions, toast],
  );

  // 排序
  const renderSessions = React.useMemo(
    () =>
      Array.from(sessions.values())
        .sort((a, b) =>
          alphabeticalCompare(b.metadata.create_time, a.metadata.create_time),
        )
        .filter((session) => session.chat_type === chatType),
    [sessions, chatType],
  );

  React.useImperativeHandle(ref, () => ({
    isOpen: isOpen,
  }));

  const handleSelectSession = React.useCallback(
    (id: string) => {
      if (isStreaming || isProcessing || isTerminalProcessing || isSearching) {
        toast({
          title: 'Y3Maker 正在回复，请稍后再切换会话',
          status: 'warning',
          position: 'top',
          isClosable: true,
        });
        return;
      }
      if (currentSession?._id === id) {
        toast({
          title: '当前已是所选对话',
          status: 'info',
        });
        return;
      }
      const nextSession = sessions.get(id);
      const model = nextSession?.data?.model;
      // 如果会话有模型，直接用模型即可
      if (model) {
        updateModel((config) => {
          config.model = model as ChatModel;
          return config;
        });
      }
      stopRunningTerminal();
      selectSession(id);
    },
    [
      isStreaming,
      isProcessing,
      isTerminalProcessing,
      isSearching,
      currentSession?._id,
      sessions,
      selectSession,
      toast,
      updateModel,
      stopRunningTerminal,
    ],
  );

  const handleSelectSessionAndScrollToMessage = React.useCallback(
    (session: SearchMessageResult) => {
      if (isStreaming || isProcessing || isTerminalProcessing || isSearching) {
        toast({
          title: 'Y3Maker 正在回复，请稍后再切换会话',
          status: 'warning',
          position: 'top',
          isClosable: true,
        });
        return;
      }
      const nextSession = sessions.get(session._id);
      if (nextSession?._id !== currentSession?._id) {
        const model = nextSession?.data?.model;
        if (model) {
          updateModel((config) => {
            config.model = model as ChatModel;
            return config;
          });
        }
        selectSession(session._id, () => {
          setTimeout(() => {
            chatMessagesRef.current?.scrollToMessage(
              session.role,
              session.messageId,
              searchKeyword,
            );
          }, 0);
        });
      } else {
        // 如果是在本次会话中，直接定位到改会话即可
        chatMessagesRef.current?.scrollToMessage(
          session.role,
          session.messageId,
          searchKeyword,
        );
      }

      setSelectedMessageId(`${session.role}-${session.messageId}`);
    },
    [
      isStreaming,
      isProcessing,
      isTerminalProcessing,
      isSearching,
      selectSession,
      sessions,
      updateModel,
      toast,
      chatMessagesRef,
      currentSession,
      searchKeyword,
    ],
  );

  const handleOpenPopover = () => {
    userReporter.report({
      event: UserEvent.CODE_CHAT_VIEW_SESSIONS,
    });
    setIsOpen((prev) => !prev);
    setTimeout(() => {
      if (!isOpen && popoverRef.current) {
        const index = renderSessions.findIndex(
          (item) => item._id === currentSession?._id,
        );
        scrollToFocusItem(popoverRef.current, index);
      }
    });
  };

  const resetLoadMore = React.useCallback(() => {
    setIsNext(true);
    setCurrentPage(1);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedGetSessions = React.useCallback(
    debounce(async (keyword: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        setLoading(true);
        setSearchSessions([]);
        const params = {
          _num: 10,
          _page: 1,
          _sort_by: '-metadata.create_time',
          [searchField.value]: keyword.trim(),
          chat_type: chatType,
        };
        if (searchField.value === SearchField.Topic) {
          params._exclude = 'data';
        }
        const data = await getHistories(params, controller.signal);
        setLoading(false);
        setSearchSessions(data?.items || []);
        resetLoadMore();
      } catch (error) {
        setSearchSessions([]);
        setLoading(false);
        console.error(error);
      }
    }, 500),
    [searchField, chatType],
  );

  React.useEffect(() => {
    if (!searchKeyword.trim()) return;
    debouncedGetSessions(searchKeyword);
    return () => {
      debouncedGetSessions.cancel();
    };
  }, [searchKeyword, debouncedGetSessions]);

  const filterSessions = React.useMemo(() => {
    if (!searchKeyword.trim()) return renderSessions;
    return Array.from(searchSessions.values())
      .filter((session) => session.chat_type === chatType)
      .map((session) => ({ ...session, disabled: true }));
  }, [searchKeyword, renderSessions, searchSessions, chatType]);

  const searchMessages: SearchMessageResult[] = React.useMemo(() => {
    if (!searchKeyword.trim()) return [];
    return filterSessions.flatMap((session) =>
      (session.data?.messages || []).map((message) => {
        let content = '';
        if (message.content instanceof Array) {
          content =
            message.content.find((i) => i.type === ChatMessageContent.Text)
              ?.text || '';
        } else {
          content = message.content;
        }
        const context = extractContext(content, searchKeyword);
        return {
          ...session,
          messages: [], // 清空原有的messages数组
          content,
          messageId: message.id || '',
          role: message.role,
          context,
        };
      }),
    );
  }, [filterSessions, searchKeyword]);

  const handleReset = () => {
    setSearchKeyword('');
    setSelectedMessageId('');
    chatMessagesRef.current?.removeAllHighlights();
  };

  const calcScreenWidth = React.useMemo(() => {
    if (isSmallScreen) {
      return {
        width: '140px',
      };
    }
    if (isMediumScreen) {
      return {
        width: '220px',
      };
    }
    if (isLargerThan340) {
      return {};
    }
  }, [isLargerThan340, isMediumScreen, isSmallScreen]);

  const renderSearchItem = React.useMemo(() => {
    if (loading) return <LoadingState />;
    const SessionItem = ({
      item,
      index,
    }: {
      item: ChatSession;
      index: number;
    }) => {
      // const updateTime = item.metadata?.update_time;
      // const messageLength = isNumber(item.message_count)
      //   ? item.message_count
      //   : item.data?.messages.length;
      const key = item._id + (item.topic || '') + (item.user || '') + index;

      return (
        <SessionItemComponent
          key={key}
          item={item}
          index={index}
          isStreaming={isStreaming}
          isSearching={isProcessing || isTerminalProcessing || isSearching}
          currentSessionId={currentSession?._id}
          onSelect={handleSelectSession}
          onUpdateTopic={updateTopic}
          onDelete={handleDelete}
        />
      );
    };

    const MessageItem = ({
      item,
      index,
    }: {
      item: SearchMessageResult;
      index: number;
    }) => {
      const updateTime = item.metadata?.update_time;
      const messageId = item.messageId ? item.messageId : nanoid();
      const key = `${item._id}-${item.role}-${messageId}`;
      const isCurrent =
        currentSession?._id === item._id && key === selectedMessageId;

      const isDisabled = isStreaming || isProcessing || isTerminalProcessing || isSearching;

      return (
        <Button
          data-index={index}
          h="full"
          w="full"
          px={2}
          my={1}
          key={key}
          onClick={() => {
            if (isDisabled) return;
            handleSelectSessionAndScrollToMessage(item);
          }}
          isDisabled={isDisabled}
          _hover={isDisabled ? {} : { backgroundColor: 'blue.300' }}
          bg={isCurrent ? 'blue.300' : undefined}
        >
          <Box textAlign="left" w="full" py={2} flex={1}>
            <Flex justify="space-between" align="center" mb={1}>
              <Box
                w="full"
                display="flex"
                justifyContent="space-between"
                minH="20px"
              >
                <Text fontSize="sm" isTruncated maxW="160px">
                  <ChatIcon w={8} fontSize="sm" />
                  {item.context}
                </Text>
              </Box>
            </Flex>
            {item?.chat_type === 'codebase' && item?.chat_repo && (
              <Box display="flex" alignItems="center" pl={2} mb={2}>
                <Flex gap={1} alignItems="center" isTruncated>
                  <BsDatabase fontSize={12} />
                  <Text ml={1} fontSize={12}>
                    {item?.chat_repo || '-'}
                  </Text>
                </Flex>
              </Box>
            )}

            <Flex>
              <Text fontSize="xs" opacity="0.5" pl={2} isTruncated>
                {updateTime &&
                  DateFormat(new Date(updateTime), 'YYYY-MM-DD HH:mm:ss')}
              </Text>
              <Spacer />
            </Flex>
          </Box>
        </Button>
      );
    };

    const RepoSessionsList = ({
      currentRepo,
      otherRepo,
    }: {
      currentRepo: ChatSession[];
      otherRepo: ChatSession[];
    }) => (
      <Box>
        <CustomCollapse
          title="当前仓库会话"
          isOpen={currentRepoOpen}
          onToggle={() => {
            setCurrentRepoOpen(!currentRepoOpen);
          }}
        >
          {currentRepo.map((item, index) => (
            <SessionItem key={item._id} item={item} index={index} />
          ))}
        </CustomCollapse>

        <Box mt="2">
          <CustomCollapse
            title="其他仓库会话"
            isOpen={otherRepoOpen}
            onToggle={() => {
              setOtherRepoOpen(!otherRepoOpen);
            }}
          >
            {otherRepo.map((item, index) => (
              <SessionItem key={item._id} item={item} index={index} />
            ))}
          </CustomCollapse>
        </Box>
      </Box>
    );

    const RepoMessagesList = ({
      currentRepo,
      otherRepo,
    }: {
      currentRepo: SearchMessageResult[];
      otherRepo: SearchMessageResult[];
    }) => (
      <Box>
        <CustomCollapse
          title="当前仓库会话"
          isOpen={currentRepoOpen}
          onToggle={() => {
            setCurrentRepoOpen(!currentRepoOpen);
          }}
        >
          {currentRepo.map((item, index) => (
            <MessageItem
              key={`${item._id}-${index}`}
              item={item}
              index={index}
            />
          ))}
        </CustomCollapse>

        <Box mt="2">
          <CustomCollapse
            title="其他仓库会话"
            isOpen={otherRepoOpen}
            onToggle={() => {
              setOtherRepoOpen(!otherRepoOpen);
            }}
          >
            {otherRepo.map((item, index) => (
              <MessageItem
                key={`${item._id}-${index}`}
                item={item}
                index={index}
              />
            ))}
          </CustomCollapse>
        </Box>
      </Box>
    );
    if (!searchKeyword.trim().length) {
      // 无会话数据时显示空状态
      if (!renderSessions.length) return <EmptyState />;

      // 有会话数据时显示列表
      if (chatType === 'codebase') {
        // 代码库类型的处理逻辑
        const currentRepoList = renderSessions.filter(
          (i) => i.chat_repo === workspaceInfo.repoName,
        );
        const otherRepoList = renderSessions.filter(
          (i) => i.chat_repo !== workspaceInfo.repoName,
        );
        return (
          <RepoSessionsList
            currentRepo={currentRepoList}
            otherRepo={otherRepoList}
          />
        );
      }

      return renderSessions.map((item, index) => (
        <SessionItem key={item._id} item={item} index={index} />
      ));
    }
    // 有搜索关键词的情况
    if (searchField.value === SearchField.Topic && !filterSessions.length)
      return <EmptyState />;
    if (searchField.value !== SearchField.Topic && !searchMessages.length)
      return <EmptyState />;

    if (!searchKeyword.trim().length) {
      if (chatType === 'codebase') {
        const currentRepoList = renderSessions.filter(
          (i) => i.chat_repo === workspaceInfo.repoName,
        );
        const otherRepoList = renderSessions.filter(
          (i) => i.chat_repo !== workspaceInfo.repoName,
        );
        return (
          <RepoSessionsList
            currentRepo={currentRepoList}
            otherRepo={otherRepoList}
          />
        );
      }

      return renderSessions.map((item, index) => (
        <SessionItem key={item._id} item={item} index={index} />
      ));
    }

    if (searchField.value === SearchField.Topic) {
      if (chatType === 'codebase') {
        const currentRepoList = filterSessions.filter(
          (i) => i.chat_repo === workspaceInfo.repoName,
        );
        const otherRepoList = filterSessions.filter(
          (i) => i.chat_repo !== workspaceInfo.repoName,
        );
        return (
          <RepoSessionsList
            currentRepo={currentRepoList}
            otherRepo={otherRepoList}
          />
        );
      }

      return filterSessions.map((item, index) => (
        <SessionItem key={item._id} item={item} index={index} />
      ));
    }

    if (chatType === 'codebase') {
      const currentRepoList = searchMessages.filter(
        (i) => i.chat_repo === workspaceInfo.repoName,
      );
      const otherRepoList = searchMessages.filter(
        (i) => i.chat_repo !== workspaceInfo.repoName,
      );
      return (
        <RepoMessagesList
          currentRepo={currentRepoList}
          otherRepo={otherRepoList}
        />
      );
    }

    return searchMessages.map((item, index) => (
      <MessageItem key={`${item._id}-${index}`} item={item} index={index} />
    ));
  }, [
    loading,
    searchKeyword,
    renderSessions,
    currentSession?._id,
    // editValue,
    // editId,
    handleDelete,
    handleSelectSession,
    // removeId,
    isStreaming,
    isProcessing,
    isTerminalProcessing,
    isSearching,
    updateTopic,
    searchMessages,
    handleSelectSessionAndScrollToMessage,
    selectedMessageId,
    searchField,
    filterSessions,
    workspaceInfo,
    chatType,
    currentRepoOpen,
    otherRepoOpen,
  ]);

  const loadMore = React.useCallback(
    async (page: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      try {
        setScrollLoading(true);
        const params = {
          _num: 10,
          _page: page,
          _sort_by: '-metadata.create_time',
          [searchField.value]: searchKeyword.trim(),
          chat_type: chatType,
        };
        if (searchField.value === SearchField.Topic) {
          params._exclude = 'data';
        }
        const data = await getHistories(params, controller.signal);
        if (!data.items.length) {
          setIsNext(false);
        } else {
          setSearchSessions((prev) => [...prev, ...data.items]);
        }
        setScrollLoading(false);
      } catch (error) {
        setSearchSessions([]);
        setScrollLoading(false);
        console.error(error);
      }
    },
    [searchKeyword, searchField.value, chatType],
  );

  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing;
  }, [isStreaming, isProcessing, isTerminalProcessing]);

  return (
    <Tooltip label="历史会话" isDisabled={isOpen}>
      <div
        className="inline-block relative chat-histories-element"
        ref={popoverRef}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Popover
          placement="bottom-end"
          closeOnBlur={true}
          isOpen={isOpen}
          isLazy
          onClose={() => {
            setIsOpen(false);
            handleReset();
          }}
          matchWidth
        >
          <PopoverTrigger>
            <IconButton
              aria-label="历史会话"
              size="xs"
              icon={<Icon as={TbClockHour3} size="sm" />}
              onClick={handleOpenPopover}
              isDisabled={disabled}
              bg="none"
              color="text.default"
            />
          </PopoverTrigger>
          <Portal>
            <PopoverContent
              style={{
                position: 'absolute',
                right: '-40px',
                ...calcScreenWidth,
              }}
              zIndex="100"
            >
              <PopoverHeader fontWeight="bold" border="0">
                历史会话
              </PopoverHeader>
              <PopoverCloseButton
                onClick={() => {
                  setIsOpen(false);
                  handleReset();
                }}
              />
              <Box p="2" display="flex">
                <Select
                  className="w-[120px]"
                  size="sm"
                  placeholder="请选择搜索类型"
                  value={searchField}
                  options={searchOptions}
                  onChange={(v) => {
                    if (!v) return;
                    setSearchField(v);
                  }}
                  components={{
                    DropdownIndicator: () => (
                      <div className="mr-1">
                        <Icon as={RiArrowDownSLine} size="xs" />
                      </div>
                    ),
                    IndicatorSeparator: () => null,
                  }}
                ></Select>
                <Input
                  value={searchKeyword}
                  size="sm"
                  placeholder="请输入会话名称或对话关键字"
                  onInput={(e) => {
                    const keyword = e.currentTarget.value;
                    setSearchKeyword(keyword);
                  }}
                />
              </Box>

              <PopoverBody
                m={2}
                p={2}
                maxH="400px"
                height="auto"
                overflowY="scroll"
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } =
                    e.currentTarget;
                  if (scrollLoading || !isNext) return;
                  if (
                    scrollHeight - scrollTop <= clientHeight + 20 &&
                    searchKeyword.trim()
                  ) {
                    const nextPage = currentPage + 1;
                    loadMore(nextPage);
                    setCurrentPage(nextPage);
                  }
                }}
              >
                <Box
                  maxH="400px"
                  overflowY="auto"
                  key="auto"
                  onScroll={(e) => {
                    const { scrollTop, scrollHeight, clientHeight } =
                      e.currentTarget;
                    if (scrollLoading || !isNext) return;
                    if (
                      scrollHeight - scrollTop <= clientHeight + 20 &&
                      searchKeyword.trim()
                    ) {
                      const nextPage = currentPage + 1;
                      loadMore(nextPage);
                      setCurrentPage(nextPage);
                    }
                  }}
                >
                  <VStack align="stretch">
                    {renderSearchItem}
                    {searchKeyword.trim().length ? (
                      <Box
                        display="flex"
                        justifyContent="center"
                        fontSize="12px"
                        color="text.default"
                      >
                        {scrollLoading ? <Spinner size="sm" /> : null}
                        {!isNext ? <Text>没有更多数据了</Text> : null}
                      </Box>
                    ) : null}
                  </VStack>
                </Box>
              </PopoverBody>
            </PopoverContent>
          </Portal>
        </Popover>
      </div>
    </Tooltip>
  );
});

const LoadingState = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="300px"
      border="1px solid"
      borderColor="text.muted"
      borderRadius="md"
      p={4}
    >
      <Spinner />
    </Box>
  );
};

const EmptyState = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="300px"
      border="1px solid"
      borderColor="text.muted"
      borderRadius="md"
      p={4}
    >
      <Icon as={MdInbox} boxSize={12} color="gray.400" />
      <Text mt={4} fontSize="lg" color="gray.500">
        暂无数据
      </Text>
    </Box>
  );
};

const extractContext = (text: string, keyword: string): string => {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (index === -1) return text;

  const start = Math.max(0, index - 3);
  const end = Math.min(text.length, index + keyword.length + 10);

  let result = text.slice(start, end);

  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';

  return result;
};
export default ChatHistories;
