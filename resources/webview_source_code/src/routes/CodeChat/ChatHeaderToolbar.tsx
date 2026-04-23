import * as React from 'react';
import ChatHistories, { ChatHistoriesHandle } from './ChatHistories';
import ChatDelete from './ChatDelete';
import {
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  useOutsideClick,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Box,
} from '@chakra-ui/react';
import { TbPlus, TbDotsVertical } from 'react-icons/tb';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import { useWorkspaceStore } from '../../store/workspace';
import userReporter from '../../utils/report';
import Icon from '../../components/Icon';
import useCustomToast from '../../hooks/useCustomToast';
import ChatPromptPanel from './ChatPromptPanel';
import { FaAngleLeft } from 'react-icons/fa';
import { useConfigStore } from '../../store/config';
import { useTerminalMessage } from './ChatMessagesList/TermialPanel';
import { UserEvent } from '../../types/report';
import { shallow } from 'zustand/shallow';
import { debounce } from 'lodash';
// import { TfiMenuAlt } from 'react-icons/tfi';
import ChatSearch from './ChatSearch';
import { AiOutlineClear } from 'react-icons/ai';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import ParallelSessionIcon from '../../components/Icon/ParallelSessionIcon';
import { useChatConfig } from '../../store/chat-config';

function ChatHeaderToolbar() {
  const chatType = useChatStore((state) => state.chatType);
  const currentSession = useChatStore((state) => state.currentSession());
  const [createNewSession, clearSession] = useChatStore(
    (state) => [state.onNewSession, state.clearSession],
    shallow,
  );
  const selectedModel = useChatConfig((state) => state.config.model);
  const { postMessage } = usePostMessage();
  // const codebaseChatMode = useChatStore((state) => state.codebaseChatMode);
  // const activeChangeId = useChatStore((state) => state.activeChangeId);
  // const activeFeatureId = useChatStore((state) => state.activeFeatureId);
  // const setSpecNavCollapsed = useChatStore(
  //   (state) => state.setSpecNavCollapsed,
  // );
  // const isSpecFrameworkInitialized = useWorkspaceStore(
  //   (state) => state.isSpecFrameworkInitialized,
  // );
  const { stopRunningTerminal } = useTerminalMessage();

  // const ide = useExtensionStore((state) => state.IDE);
  // const codeMakerVersion = useExtensionStore((state) => state.codeMakerVersion);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const [isOpenPopover, setIsOpenPopover] = React.useState(false);
  const [isOpenModal, setIsOpenModal] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const historyRef = React.useRef<ChatHistoriesHandle>(null);
  const { toast } = useCustomToast();
  const [isOpenPromptSelectionModal, setIsOpenPromptSelectionModal] =
    React.useState(false);
  const chatPromptConfig = useConfigStore((state) => state.config);
  const updateChatPromptConfig = useConfigStore((state) => state.updateConfig);

  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  // const startTour = useTourStore((state) => state.startTour);
  const disabled = React.useMemo(() => {
    return isStreaming || isProcessing || isTerminalProcessing || isSearching;
  }, [isStreaming, isProcessing, isTerminalProcessing, isSearching]);

  useOutsideClick({
    ref: popoverRef,
    handler: (e) => {
      if (
        popoverRef &&
        popoverRef.current &&
        popoverRef.current.contains(e.target as Node)
      ) {
        return;
      }
      const historyIsOpen = historyRef.current?.isOpen;
      if (historyIsOpen) {
        return;
      }
      setIsOpenPopover(false);
    },
  });

  const handleCreateNewSession = React.useCallback(() => {
    userReporter.report({
      event: UserEvent.CODE_CHAT_NEW_SESSION,
    });
    stopRunningTerminal();
    createNewSession();
  }, [createNewSession, stopRunningTerminal]);

  const handleCreateParallelSession = React.useCallback(() => {
    postMessage({
      type: BroadcastActions.OPEN_PARALLEL_SESSION,
      data: {
        chatType,
        selectedModel,
      },
    });
  }, [chatType, selectedModel, postMessage]);

  const handleCreateSession = React.useMemo(
    () =>
      debounce(() => {
        const isEmptySession = currentSession?.data?.messages.length === 0;
        const hasWorkspace = !!workspaceInfo.repoName;
        const sessionRepo = currentSession?.chat_repo;
        const isRepoMismatch =
          sessionRepo && sessionRepo !== workspaceInfo.repoName;

        // 处理空会话的情况
        if (isEmptySession) {
          if (hasWorkspace) {
            // 有工作区的情况
            if (isRepoMismatch) {
              // 仓库不匹配，允许新建会话切换到当前仓库
              if (chatPromptConfig.skipPromptMask || chatType === 'codebase') {
                handleCreateNewSession();
              } else {
                setIsOpenPromptSelectionModal(true);
              }
              return;
            } else {
              // 当前会话为空且仓库匹配，没必要新建会话
              toast({
                title: '当前已是新对话',
                status: 'info',
              });
              return;
            }
          } else {
            // 没有工作区的情况
            if (sessionRepo) {
              // 当前会话关联了仓库但没有打开工作区，直接允许新建会话
              // 继续执行新建会话逻辑
            } else {
              // 当前会话为空且没有关联仓库，没必要新建会话
              toast({
                title: '当前已是新对话',
                status: 'info',
              });
              return;
            }
          }
        }

        // 非空会话，正常新建会话流程
        if (chatPromptConfig.skipPromptMask || chatType === 'codebase') {
          handleCreateNewSession();
        } else {
          setIsOpenPromptSelectionModal(true);
        }
      }, 300),
    [
      chatPromptConfig.skipPromptMask,
      chatType,
      currentSession?.chat_repo,
      currentSession?.data?.messages.length,
      handleCreateNewSession,
      toast,
      workspaceInfo.repoName,
    ],
  );

  return (
    <div className="flex flex-row-reverse gap-2 items-center p-2 box-border">
      <div className="flex flex-row-reverse gap-1 items-center w-full">
        <div ref={popoverRef} className="inline-block relative">
          <Popover isOpen={isOpenPopover} placement="left" isLazy>
            <PopoverTrigger>
              <IconButton
                variant="ghost"
                aria-label="更多操作"
                size="xs"
                icon={<Icon as={TbDotsVertical} size="sm" />}
                onClick={() => setIsOpenPopover((prev) => !prev)}
                color="text.default"
                data-tour="more-actions"
              />
            </PopoverTrigger>
            <PopoverContent w="90px">
              <PopoverBody py="1" pl="0" pr="1">
                <VStack align="center" overflowY="auto" p="0">
                  <ChatDelete />
                  <Button
                    aria-label="清空会话"
                    size="xs"
                    isDisabled={disabled}
                    onClick={() => {
                      setIsOpenModal(true);
                    }}
                    bg="none"
                    color="text.default"
                  >
                    <Icon as={AiOutlineClear} size="sm" className="mr-1" />{' '}
                    清空会话
                  </Button>
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </div>
        <ChatHistories ref={historyRef} />
        <Tooltip label="新建并行会话" data-tour="parallel-session">
          <IconButton
            aria-label="新建并行会话"
            size="xs"
            isDisabled={disabled}
            icon={<ParallelSessionIcon size={16} />}
            onClick={handleCreateParallelSession}
            bg="none"
            color="text.default"
          />
        </Tooltip>
        <Tooltip label="新建会话">
          <IconButton
            aria-label="新建会话"
            size="xs"
            isDisabled={disabled}
            icon={<Icon as={TbPlus} size="sm" />}
            onClick={handleCreateSession}
            bg="none"
            color="text.default"
            data-tour="create-session"
          />
        </Tooltip>
        {/* 搜索组件 - 放在最后，在 flex-row-reverse 中显示在最左侧 */}
        <Box>
          <ChatSearch />
        </Box>
      </div>
      <Modal
        isCentered
        isOpen={isOpenModal}
        onClose={() => setIsOpenModal(false)}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>清除会话</ModalHeader>
          <ModalBody>
            <div>确定清除当前会话吗？</div>
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
                clearSession();
                setIsOpenModal(false);
              }}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal
        // isCentered
        isOpen={isOpenPromptSelectionModal}
        onClose={() => setIsOpenPromptSelectionModal(false)}
        // trapFocus={false}
        size="full"
      >
        <ModalContent w="full" h="full" display="flex" flexDirection="column">
          <Box
            w="full"
            h="12"
            p="4"
            display="flex"
            justifyContent="space-between"
          >
            <Button
              aria-label="返回上一层"
              variant="ghost"
              size="xs"
              color="text.default"
              onClick={() => {
                setIsOpenPromptSelectionModal(false);
              }}
            >
              <Icon as={FaAngleLeft} mr="1" size="xs" /> 返回
            </Button>
            <Button
              aria-label="不再显示"
              variant="ghost"
              size="xs"
              color="text.default"
              onClick={() => {
                setIsOpenPromptSelectionModal(false);
                updateChatPromptConfig((config) => {
                  config.skipPromptMask = true;
                  return config;
                });
                handleCreateNewSession();
              }}
            >
              不再显示
            </Button>
          </Box>
          <ModalBody
            flex="1"
            display="flex"
            flexDirection="column"
            overflow="hidden"
            p="0"
          >
            <Box flex="1" overflow="auto" p="4">
              <ChatPromptPanel
                onSelect={() => {
                  setIsOpenPromptSelectionModal(false);
                  handleCreateNewSession();
                }}
              />
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}

if (process.env.NODE_ENV === 'development') {
  (ChatHeaderToolbar as any).whyDidYouRender = true;
}

export default ChatHeaderToolbar;
