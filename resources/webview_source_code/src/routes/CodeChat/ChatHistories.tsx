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
import { DateFormat } from '../../utils';
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
import { useWorkspaceStore } from '../../store/workspace';
import { useTerminalMessage } from './ChatMessagesList/TermialPanel';
import { UserEvent } from '../../types/report';
import { ChatModel } from '../../services/chatModel';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import { useTaskCompletionStore } from '../../modules/subagent';
interface NewChatSession extends ChatSession {
  disabled?: boolean;
}
export interface ChatHistoriesHandle {
  isOpen: boolean;
  openFavorite: () => void;
}
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
const PAGE_SIZE = 20;

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

  const isSubagentProcessing = useTaskCompletionStore(
    (state) => !state.isSessionComplete(currentSession?._id || ''),
  );

  const updateModel = useChatConfig((state) => state.update);
  const [searchKeyword, setSearchKeyword] = React.useState('');
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const [isMediumScreen] = useMediaQuery(MediumScreenWidth);
  const [isLargerThan340] = useMediaQuery(LargeScreenWidth);
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const { stopRunningTerminal } = useTerminalMessage();
  const setChatType = useChatStore((state) => state.setChatType);

  // ===== 统一分页状态 =====
  const [pagedSessions, setPagedSessions] = React.useState<NewChatSession[]>(
    [],
  );
  // 用 ref 同步记录最新页码，避免 handleScroll 闭包读到陈旧的 page state
  const pageRef = React.useRef(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  // 初始加载（第一页）的 loading 状态
  const [isFirstLoading, setIsFirstLoading] = React.useState(false);

  // ===== 筛选 Tab 状态 =====
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

  // ===== 构建请求参数 =====
  const buildFetchParams = React.useCallback(
    (
      filter: SessionFilterType,
      keyword: string,
      targetPage: number,
    ): Record<string, any> => {
      const params: Record<string, any> = {
        _num: PAGE_SIZE,
        _page: targetPage,
        _sort_by: '-metadata.create_time',
        _exclude: 'data',
      };
      if (keyword.trim()) {
        params.topic = keyword.trim();
      }
      switch (filter) {
        case SessionFilterType.Favorite:
          params.is_favorite = true;
          break;
        case SessionFilterType.CurrentRepo:
          params.chat_type = 'codebase';
          params.is_favorite = false;
          if (workspaceInfo.repoName) {
            params.chat_repo = workspaceInfo.repoName;
          }
          break;
        case SessionFilterType.OtherRepo:
          params.chat_type = 'codebase';
          params.is_favorite = false;
          if (workspaceInfo.repoName) {
            params.exclude_chat_repo = workspaceInfo.repoName;
          }
          break;
        case SessionFilterType.Default:
        default:
          params.chat_type = 'default';
          params.is_favorite = false;
          break;
      }
      return params;
    },
    [workspaceInfo.repoName],
  );

  // ===== 拉取第一页（重置列表） =====
  const fetchFirstPage = React.useCallback(
    async (filter: SessionFilterType, keyword: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(
          createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__),
        );
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsFirstLoading(true);
      setPagedSessions([]);
      setHasMore(true);
      pageRef.current = 1; // 立即同步，避免滚动事件读到陈旧页码
      try {
        const params = buildFetchParams(filter, keyword, 1);
        const data = await getHistories(params, controller.signal);
        const items = data?.items || [];
        setPagedSessions(items);
        if (items.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } catch {
        setPagedSessions([]);
        setHasMore(false);
      } finally {
        setIsFirstLoading(false);
      }
    },
    [buildFetchParams, workspaceInfo.repoName],
  );

  // ===== 拉取下一页（追加列表） =====
  const fetchNextPage = React.useCallback(
    async (filter: SessionFilterType, keyword: string, nextPage: number) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort(
          createAbortReason(ABORT_REASON_CLEANUP, __ABORT_LOC__),
        );
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsLoadingMore(true);
      try {
        const params = buildFetchParams(filter, keyword, nextPage);
        const data = await getHistories(params, controller.signal);
        const items = data?.items || [];
        if (!items.length) {
          setHasMore(false);
        } else {
          setPagedSessions((prev) => [...prev, ...items]);
          pageRef.current = nextPage; // 同步 ref，保证 handleScroll 读到最新页码
          if (items.length < PAGE_SIZE) {
            setHasMore(false);
          }
        }
      } catch {
        // 加载更多失败不清空列表，只停止继续请求
        setHasMore(false);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [buildFetchParams, workspaceInfo.repoName],
  );

  // ===== 面板打开 / Tab 切换 / 搜索词变化时重新拉取第一页 =====
  // 用 ref 存最新的 filter & keyword，供防抖回调读取
  const filterRef = React.useRef(sessionFilter);
  const keywordRef = React.useRef(searchKeyword);
  filterRef.current = sessionFilter;
  keywordRef.current = searchKeyword;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedFetchFirstPage = React.useCallback(
    debounce(() => {
      fetchFirstPage(filterRef.current, keywordRef.current);
    }, 300),
    [fetchFirstPage],
  );

  React.useEffect(() => {
    if (!isOpen) return;
    debouncedFetchFirstPage();
    return () => debouncedFetchFirstPage.cancel();
  }, [isOpen, sessionFilter, searchKeyword, debouncedFetchFirstPage]);

  // ===== 滚动到底部加载下一页 =====
  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isLoadingMore || !hasMore || isFirstLoading) return;
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop <= clientHeight + 20) {
        fetchNextPage(sessionFilter, searchKeyword, pageRef.current + 1);
      }
    },
    [
      isLoadingMore,
      hasMore,
      isFirstLoading,
      fetchNextPage,
      sessionFilter,
      searchKeyword,
    ],
  );

  // ===== 收藏会话打开方法 =====
  const openFavoriteRef = React.useRef(false);
  const openFavorite = React.useCallback(() => {
    openFavoriteRef.current = true;
    setIsOpen(true);
    setSessionFilter(SessionFilterType.Favorite);
  }, []);

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

  // 切换 Tab 时清空搜索关键字
  React.useEffect(() => {
    setSearchKeyword('');
  }, [sessionFilter]);

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

  const { toast } = useCustomToast();

  const updateSessions = React.useCallback(async () => {
    const data = await requestChatSessions(chatType);
    revalidateChatSessions(data.items, chatType);
  }, [revalidateChatSessions, chatType]);

  const handleUpdateTopic = React.useCallback(
    async (id: string, topic: string) => {
      try {
        await updateTopic(id, topic);
        // 同步更新分页列表中对应条目的 topic，无需重新请求
        setPagedSessions((prev) =>
          prev.map((s) => (s._id === id ? { ...s, topic } : s)),
        );
      } catch (error) {
        toast({
          title: toastErrorMessage(error as Error),
          position: 'top',
          isClosable: true,
          status: 'error',
        });
      }
    },
    [updateTopic, toast],
  );

  const handleDelete = React.useCallback(
    async (sessionId: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_REMOVE_SESSION,
      });
      if (!sessionId) return;
      try {
        await removeSession(sessionId);
        await updateSessions();
        // 同步移除分页列表中对应条目，无需重新请求
        setPagedSessions((prev) => prev.filter((s) => s._id !== sessionId));
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
      // 从分页列表或本地 sessions 中查找会话信息
      const nextSession =
        pagedSessions.find((s) => s._id === id) ?? sessions.get(id);
      const model = nextSession?.data?.model;
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
      pagedSessions,
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
        const index = pagedSessions.findIndex(
          (item) => item._id === currentSession?._id,
        );
        scrollToFocusItem(popoverRef.current, index);
      }
    });
  };

  const handleReset = () => {
    setSearchKeyword('');
  };

  const calcScreenWidth = React.useMemo(() => {
    if (isSmallScreen) {
      return { width: '140px' };
    }
    if (isMediumScreen) {
      return { width: '220px' };
    }
    if (isLargerThan340) {
      return {};
    }
  }, [isLargerThan340, isMediumScreen, isSmallScreen]);

  const renderListItem = React.useCallback(
    (item: ChatSession, index: number) => (
      <SessionItemComponent
        key={item._id + (item.topic || '') + index}
        item={item}
        index={index}
        isStreaming={isStreaming}
        isSearching={isProcessing || isTerminalProcessing || isSearching}
        currentSessionId={currentSession?._id}
        onSelect={handleSelectSession}
        onUpdateTopic={handleUpdateTopic}
        onDelete={handleDelete}
      />
    ),
    [
      isStreaming,
      isProcessing,
      isTerminalProcessing,
      isSearching,
      currentSession?._id,
      handleSelectSession,
      handleUpdateTopic,
      handleDelete,
    ],
  );

  const disabled = React.useMemo(() => {
    return (
      isStreaming ||
      isProcessing ||
      isTerminalProcessing ||
      isSubagentProcessing
    );
  }, [isStreaming, isProcessing, isTerminalProcessing, isSubagentProcessing]);

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
              <SessionFilterTabs
                value={sessionFilter}
                repoName={workspaceInfo.repoName}
                onChange={setSessionFilter}
              />
              <Box p="2" pb={0}>
                <Input
                  value={searchKeyword}
                  size="sm"
                  placeholder="输入标题前缀搜索会话"
                  onInput={(e) => {
                    const keyword = e.currentTarget.value;
                    setSearchKeyword(keyword);
                  }}
                />
              </Box>

              <PopoverBody
                m={2}
                mt={0}
                p={2}
                maxH="400px"
                height="auto"
                overflowY="auto"
                onScroll={handleScroll}
              >
                <VStack align="stretch">
                  {isFirstLoading ? (
                    <LoadingState />
                  ) : pagedSessions.length === 0 ? (
                    <EmptyState />
                  ) : (
                    pagedSessions.map((item, index) =>
                      renderListItem(item, index),
                    )
                  )}
                  <Box
                    display="flex"
                    justifyContent="center"
                    fontSize="12px"
                    color="text.default"
                    minH="20px"
                  >
                    {isLoadingMore ? <Spinner size="sm" /> : null}
                    {!hasMore && pagedSessions.length > 0 ? (
                      <Text>没有更多数据了</Text>
                    ) : null}
                  </Box>
                </VStack>
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

const SessionFilterTabs = ({
  value,
  repoName,
  onChange,
}: SessionFilterSelectProps) => {
  const hasRepo = Boolean(repoName);

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

  return (
    <Flex px={4} pt={1} pb={0} gap={0}>
      {options.map((option) => {
        const isSelected = option.value === value;
        const tabItem = (
          <Box
            key={option.value}
            as="button"
            fontSize="xs"
            fontWeight={isSelected ? 'semibold' : 'normal'}
            opacity={option.isDisabled ? 0.4 : 1}
            cursor={option.isDisabled ? 'not-allowed' : 'pointer'}
            borderBottom="1px solid"
            borderColor={isSelected ? 'blue.300' : 'transparent'}
            px={2}
            pb={1}
            pt={0.5}
            bg="transparent"
            color="inherit"
            _hover={
              option.isDisabled
                ? {}
                : {
                    borderColor: isSelected ? 'blue.300' : 'gray.500',
                  }
            }
            onClick={() => {
              if (option.isDisabled) return;
              onChange(option.value);
            }}
          >
            {option.label}
          </Box>
        );

        if (option.isDisabled && option.disabledTooltip) {
          return (
            <Tooltip
              key={option.value}
              label={option.disabledTooltip}
              placement="bottom"
              hasArrow
            >
              {tabItem}
            </Tooltip>
          );
        }
        return tabItem;
      })}
    </Flex>
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