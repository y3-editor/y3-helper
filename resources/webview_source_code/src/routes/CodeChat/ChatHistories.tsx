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
// import { mutateService } from '../../hooks/useService';
import { getHistories } from '../../services/chat';
import { debounce, isNumber } from 'lodash';
import { ABORT_REASON_CLEANUP, createAbortReason } from '../../utils/abort';
import { MdInbox } from 'react-icons/md';
import {
  SmallScreenWidth,
  MediumScreenWidth,
  LargeScreenWidth,
} from '../../const';
import { BsDatabase } from 'react-icons/bs';
import { Select } from 'chakra-react-select';
import { RiArrowDownSLine } from 'react-icons/ri';
import { useWorkspaceStore } from '../../store/workspace';
import { useTerminalMessage } from './ChatMessagesList/TermialPanel';
import { UserEvent } from '../../types/report';
import { ChatModel } from '../../services/chatModel';
import EventBus, { EBusEvent } from '../../utils/eventbus';
interface NewChatSession extends ChatSession {
  disabled?: boolean;
}
export interface ChatHistoriesHandle {
  isOpen: boolean;
  openFavorite: () => void;
}
enum SearchField {
  Topic = 'topic',
  Content = 'topic_content',
}

const searchOptions = [
  { label: '内容', value: SearchField.Content },
  { label: '标题', value: SearchField.Topic },
];

// 历史会话筛选类型
enum SessionFilterType {
  CurrentRepo = 'currentRepo',
  OtherRepo = 'otherRepo',
  Default = 'default',
  Favorite = 'favorite',
}

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
                <Text
                  title={item.topic || DEFAULT_TOPIC}
                  fontSize="sm"
                  isTruncated
                  maxW="160px"
                >
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
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
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
  const [loading, setLoading] = React.useState(false);
  const [searchField, setSearchField] = React.useState(searchOptions[0]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scrollLoading, setScrollLoading] = React.useState(false);
  const [isNext, setIsNext] = React.useState(true);
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const { stopRunningTerminal } = useTerminalMessage();
  const setChatType = useChatStore((state) => state.setChatType);

  // ===== 收藏筛选状态 =====
  // 计算默认筛选类型：根据当前 chatType 和是否有仓库决定
  const getDefaultFilterType = React.useCallback((): SessionFilterType => {
    if (chatType === 'codebase') {
      return workspaceInfo.repoName
        ? SessionFilterType.CurrentRepo
        : SessionFilterType.OtherRepo;
    }
    return SessionFilterType.Default;
  }, [chatType, workspaceInfo.repoName]);

  const [sessionFilter, setSessionFilter] =
    React.useState<SessionFilterType>(getDefaultFilterType);

  // 跨类型会话数据：当筛选类型与当前 chatType 不同时，从接口拉取
  const [crossTypeSessions, setCrossTypeSessions] = React.useState<
    ChatSession[]
  >([]);
  const [crossTypeLoading, setCrossTypeLoading] = React.useState(false);

  // 判断当前筛选是否需要跨类型查询
  // 只要筛选类型与当前 chatType 不匹配，或者是收藏/仓库筛选，都从接口拉取
  const isFilterCrossType = React.useCallback(
    (filter: SessionFilterType): boolean => {
      if (filter === SessionFilterType.Favorite) return true;
      if (filter === SessionFilterType.Default && chatType !== 'default')
        return true;
      // 仓库相关筛选：始终从接口拉取，确保能拿到跨仓库的数据
      if (
        filter === SessionFilterType.CurrentRepo ||
        filter === SessionFilterType.OtherRepo
      ) {
        return true;
      }
      return false;
    },
    [chatType],
  );

  // 切换筛选类型时，若跨类型则从接口拉取数据
  React.useEffect(() => {
    if (!isOpen) return;
    if (!isFilterCrossType(sessionFilter)) {
      setCrossTypeSessions([]);
      return;
    }
    const controller = new AbortController();
    const fetchCrossType = async () => {
      setCrossTypeLoading(true);
      try {
        let data;
        if (sessionFilter === SessionFilterType.Favorite) {
          data = await getHistories(
            {
              _num: 200,
              _page: 1,
              _sort_by: '-metadata.create_time',
              _exclude: 'data',
              is_favorite: true,
            },
            controller.signal,
          );
        } else {
          const apiChatType =
            sessionFilter === SessionFilterType.Default
              ? 'default'
              : 'codebase';
          data = await getHistories(
            {
              _num: 200,
              _page: 1,
              _sort_by: '-metadata.create_time',
              _exclude: 'data',
              chat_type: apiChatType,
            },
            controller.signal,
          );
        }
        setCrossTypeSessions(data?.items || []);
      } catch {
        setCrossTypeSessions([]);
      } finally {
        setCrossTypeLoading(false);
      }
    };
    fetchCrossType();
    return () => controller.abort();
  }, [isOpen, sessionFilter, isFilterCrossType]);

  // 打开面板时重置筛选类型
  React.useEffect(() => {
    if (isOpen) {
      if (openFavoriteRef.current) {
        openFavoriteRef.current = false;
        return;
      }
      if (currentSession?.is_favorite) {
        setSessionFilter(SessionFilterType.Favorite);
      } else {
        setSessionFilter(getDefaultFilterType());
      }
    }
  }, [isOpen, getDefaultFilterType, currentSession?.is_favorite]);

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
        setCrossTypeSessions((prev) => prev.filter((s) => s._id !== sessionId));
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
    [removeSession, updateSessions, setCrossTypeSessions, toast],
  );

  // 排序 & 根据筛选类型过滤
  const renderSessions = React.useMemo(() => {
    const source: ChatSession[] = isFilterCrossType(sessionFilter)
      ? crossTypeSessions
      : Array.from(sessions.values());
    const sorted = [...source].sort((a, b) =>
      alphabeticalCompare(b.metadata.create_time, a.metadata.create_time),
    );
    switch (sessionFilter) {
      case SessionFilterType.CurrentRepo:
        return sorted.filter(
          (s) =>
            !s.is_favorite &&
            s.chat_type === 'codebase' &&
            s.chat_repo === workspaceInfo.repoName,
        );
      case SessionFilterType.OtherRepo:
        return sorted.filter(
          (s) =>
            !s.is_favorite &&
            s.chat_type === 'codebase' &&
            s.chat_repo !== workspaceInfo.repoName,
        );
      case SessionFilterType.Default:
        return sorted.filter(
          (s) => !s.is_favorite && s.chat_type === 'default',
        );
      case SessionFilterType.Favorite:
        return sorted.filter((s) => s.is_favorite === true);
      default:
        return sorted;
    }
  }, [
    sessions,
    sessionFilter,
    workspaceInfo.repoName,
    crossTypeSessions,
    isFilterCrossType,
  ]);

  // 收藏会话打开方法
  const openFavoriteRef = React.useRef(false);
  const openFavorite = React.useCallback(() => {
    openFavoriteRef.current = true;
    setIsOpen(true);
    setSessionFilter(SessionFilterType.Favorite);
  }, []);

  // 监听收藏跳转事件
  React.useEffect(() => {
    EventBus.instance.on(EBusEvent.Open_Favorite_History, openFavorite);
    return () => {
      EventBus.instance.off(EBusEvent.Open_Favorite_History, openFavorite);
    };
  }, [openFavorite]);

  React.useImperativeHandle(ref, () => ({
    isOpen: isOpen,
    openFavorite,
  }));

  const handleSelectSession = React.useCallback(
    (id: string) => {
      if (isStreaming || isProcessing || isTerminalProcessing || isSearching) {
        toast({
          title: 'CodeMaker 正在回复，请稍后再切换会话',
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
      // 从本地 sessions 或跨类型数据中查找会话信息
      const nextSession =
        sessions.get(id) ?? crossTypeSessions.find((s) => s._id === id);
      const model = nextSession?.data?.model;
      // 如果会话有模型，直接用模型即可
      if (model) {
        updateModel((config) => {
          config.model = model as ChatModel;
          return config;
        });
      }
      stopRunningTerminal();
      // 联动外部 chatType：选中会话时根据会话类型同步
      const sessionChatType = nextSession?.chat_type;
      if (sessionChatType && sessionChatType !== chatType) {
        setChatType(sessionChatType);
      }
      selectSession(id);
    },
    [
      isStreaming,
      isProcessing,
      isTerminalProcessing,
      isSearching,
      currentSession?._id,
      sessions,
      crossTypeSessions,
      selectSession,
      toast,
      updateModel,
      stopRunningTerminal,
      chatType,
      setChatType,
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
        abortControllerRef.current.abort(
          createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__),
        );
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

  const handleReset = () => {
    setSearchKeyword('');
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

    // 无搜索关键词：直接展示筛选后的列表
    if (!searchKeyword.trim().length) {
      if (!renderSessions.length) return <EmptyState />;
      return renderSessions.map((item, index) => (
        <SessionItem key={item._id} item={item} index={index} />
      ));
    }

    // 有搜索关键词
    if (!filterSessions.length) return <EmptyState />;
    return filterSessions.map((item, index) => (
      <SessionItem key={item._id} item={item} index={index} />
    ));
  }, [
    loading,
    crossTypeLoading,
    searchKeyword,
    renderSessions,
    currentSession?._id,
    handleDelete,
    handleSelectSession,
    isStreaming,
    isProcessing,
    isTerminalProcessing,
    isSearching,
    updateTopic,
    filterSessions,
  ]);

  const loadMore = React.useCallback(
    async (page: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(
          createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__),
        );
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
              <PopoverHeader
                fontWeight="bold"
                border="0"
                display="flex"
                alignItems="center"
                gap={2}
                pr="32px"
              >
                历史会话
                <SessionFilterSelect
                  value={sessionFilter}
                  repoName={workspaceInfo.repoName}
                  onChange={setSessionFilter}
                />
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

// 筛选选项配置
interface SessionFilterOption {
  label: string;
  value: SessionFilterType;
  isDisabled?: boolean;
  disabledTooltip?: string;
}

interface SessionFilterSelectProps {
  value: SessionFilterType;
  repoName: string | undefined;
  onChange: (filter: SessionFilterType) => void;
}

const SessionFilterSelect = ({
  value,
  repoName,
  onChange,
}: SessionFilterSelectProps) => {
  const hasRepo = Boolean(repoName);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const options: SessionFilterOption[] = [
    {
      label: '当前仓库',
      value: SessionFilterType.CurrentRepo,
      isDisabled: !hasRepo,
      disabledTooltip: '未识别到仓库，请先打开文件夹',
    },
    {
      label: '其他仓库',
      value: SessionFilterType.OtherRepo,
    },
    {
      label: '普通聊天',
      value: SessionFilterType.Default,
    },
    {
      label: '收藏会话',
      value: SessionFilterType.Favorite,
    },
  ];

  const currentOption = options.find((o) => o.value === value);

  const filterRef = React.useRef<HTMLDivElement>(null);

  // 点击外部区域时关闭下拉
  React.useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  return (
    <Box position="relative" ref={filterRef}>
      <Button
        size="xs"
        variant="outline"
        rightIcon={<Icon as={RiArrowDownSLine} size="xs" />}
        fontWeight="normal"
        borderRadius="md"
        px={2}
        minW="80px"
        onClick={(e) => {
          e.stopPropagation();
          setIsFilterOpen((prev) => !prev);
        }}
      >
        {currentOption?.label ?? '筛选'}
      </Button>
      {isFilterOpen && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          mt={1}
          minW="120px"
          w="auto"
          zIndex="200"
          bg="panelBgColor"
          borderRadius="md"
          boxShadow="lg"
          border="1px solid"
          borderColor="inherit"
          p={1}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            const itemBox = (
              <Box
                key={option.value}
                px={3}
                py={1.5}
                borderRadius="md"
                fontSize="sm"
                cursor={option.isDisabled ? 'not-allowed' : 'pointer'}
                opacity={option.isDisabled ? 0.4 : 1}
                bg={isSelected ? 'blue.300' : 'transparent'}
                _hover={
                  option.isDisabled
                    ? {}
                    : { bg: isSelected ? 'blue.300' : 'blue.200' }
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (option.isDisabled) return;
                  onChange(option.value);
                  setIsFilterOpen(false);
                }}
              >
                {option.label}
              </Box>
            );

            return option.isDisabled && option.disabledTooltip ? (
              <Tooltip
                key={option.value}
                label={option.disabledTooltip}
                placement="right"
                hasArrow
              >
                {itemBox}
              </Tooltip>
            ) : (
              itemBox
            );
          })}
        </Box>
      )}
    </Box>
  );
};

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

export default ChatHistories;