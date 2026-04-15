import * as React from 'react';
import {
  Box,
  useOutsideClick,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  Tooltip,
  useMediaQuery,
  Flex,
  Text,
  Icon,
} from '@chakra-ui/react';
import MiniButton from '../../components/MiniButton';
import { useChatStore, useChatStreamStore } from '../../store/chat';
import type { ChatType } from '../../store/chat';
import { AiOutlineDown } from 'react-icons/ai';
import { BsCheck2 } from 'react-icons/bs';
import { IDE, useExtensionStore } from '../../store/extension';
import useCustomToast from '../../hooks/useCustomToast';
import type { IconType } from 'react-icons';
import { RiChat1Line } from 'react-icons/ri';
import { IoCodeSlashOutline } from 'react-icons/io5';
import { usePanelContext } from '../../context/PanelContext';

interface ChatTypeOption {
  label: string;
  value: ChatType;
  icon: IconType;
  description: string;
  shortLabel: string;
}

const BASE_CHAT_TYPE_OPTIONS: ChatTypeOption[] = [
  {
    label: 'Chat 普通聊天',
    value: 'default',
    shortLabel: '普通聊天',
    icon: RiChat1Line,
    description: '解答基础代码与技术问题',
  },
];

const CODEBASE_OPTION: ChatTypeOption = {
  label: 'Agent 仓库智聊',
  shortLabel: '仓库智聊',
  value: 'codebase',
  icon: IoCodeSlashOutline,
  description: '可规划、读写代码、调用工具的Coding Agent',
};

const ChatTypeSelector = () => {
  const { isPanelMode } = usePanelContext();
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [isOpenPopover, setIsOpenPopover] = React.useState(false);
  const chatType = useChatStore((state) => state.chatType);
  const setChatType = useChatStore((state) => state.setChatType);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const isSearching = useChatStreamStore((state) => state.isSearching);

  const ide = useExtensionStore((state) => state.IDE);
  const codeMakerVersion = useExtensionStore((state) => state.codeMakerVersion);
  const { toast } = useCustomToast();

  // 小屏幕检测，与 ChatModelSelector 保持一致
  const [isExtraSmallScreen] = useMediaQuery('(max-width: 380px)');

  // 根据 IDE 类型动态计算可用的聊天类型选项
  const chatTypeOptions = React.useMemo(() => {
    if (ide === IDE.VisualStudioCode || ide === IDE.JetBrains) {
      return [...BASE_CHAT_TYPE_OPTIONS, CODEBASE_OPTION];
    }
    return BASE_CHAT_TYPE_OPTIONS;
  }, [ide]);

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
      setIsOpenPopover(false);
    },
  });

  // 切换 Popover 显示状态
  const handleTogglePopover = React.useCallback(() => {
    if (isStreaming || isProcessing) return;
    setIsOpenPopover((prev) => !prev);
  }, [isStreaming, isProcessing]);

  // 选择聊天类型
  const handleSelectType = React.useCallback(
    (type: ChatType) => {
      // JetBrains 版本检查
      if (type === 'codebase' && ide === IDE.JetBrains) {
        if (
          !codeMakerVersion ||
          (!codeMakerVersion.includes('203') &&
            !codeMakerVersion.includes('231') &&
            !codeMakerVersion.includes('242'))
        ) {
          toast({
            title: '当前版本不支持仓库智聊，需要 IDE 版本 2020.3 以上',
            status: 'info',
          });
          return;
        }
      }
      setChatType(type);
      setIsOpenPopover(false);
    },
    [setChatType, ide, codeMakerVersion, toast],
  );

  // 获取当前选中类型的显示文本
  const currentLabel = React.useMemo(() => {
    return (
      chatTypeOptions.find((opt) => opt.value === chatType)?.label ||
      chatType
    );
  }, [chatType, chatTypeOptions]);

  const currentDescription = React.useMemo(() => {
    return (
      chatTypeOptions.find((opt) => opt.value === chatType)?.description || ''
    );
  }, [chatType, chatTypeOptions]);

  // 获取当前聊天类型对应的图标（从 chatTypeOptions 中获取）
  const currentIcon = React.useMemo(() => {
    return (
      chatTypeOptions.find((opt) => opt.value === chatType)?.icon || RiChat1Line
    );
  }, [chatType, chatTypeOptions]);

  return (
    <Box
      id="chat-type-selector"
      ref={popoverRef}
      data-tour="chat-type-selector"
    >
      <Popover isLazy placement="top" isOpen={isOpenPopover}>
        <PopoverTrigger>
          <MiniButton
            aria-label="模式"
            onClick={handleTogglePopover}
            isDisabled={isStreaming || isProcessing}
            w={isExtraSmallScreen ? '20px' : 'auto'}
            minW={isExtraSmallScreen ? '20px' : 'auto'}
            color="blue.300"
            disabled={disabled || isPanelMode}
          >
            <Tooltip label={currentDescription}>
              <Box display="flex" alignItems="center">
                {isExtraSmallScreen ? (
                  // 小屏幕只显示图标
                  <Box as={currentIcon} w="14px" h="14px" />
                ) : (
                  // 正常屏幕显示文本和下拉箭头
                  <>
                    {currentLabel}
                    <Icon
                      as={AiOutlineDown}
                      w="10px"
                      h="10px"
                      ml={0.5}
                      flexShrink={0}
                    />
                  </>
                )}
              </Box>
            </Tooltip>
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w="auto" borderRadius="8px">
          <PopoverBody p="0">
            <VStack spacing={0.5} align="stretch" w="full">
              {chatTypeOptions.map((option) => {
                const isSelected = chatType === option.value;
                return (
                  <Flex
                    key={option.value}
                    bg={isSelected ? 'blue.500' : 'transparent'}
                    borderRadius="6px"
                    px="2"
                    py="1.5"
                    cursor="pointer"
                    alignItems="flex-start"
                    _hover={{ bg: isSelected ? 'blue.500' : 'whiteAlpha.100' }}
                    onClick={() => handleSelectType(option.value)}
                  >
                    {/* 左侧图标 */}
                    <Box
                      as={option.icon}
                      w="14px"
                      h="14px"
                      flexShrink={0}
                      mt="1px"
                      mr="2"
                    />
                    {/* 中间标题和描述 */}
                    <Box flex="1" minW="0">
                      <Text fontSize="13px" fontWeight="500" lineHeight="1.3">
                        {option.label}
                      </Text>
                      <Text
                        fontSize="11px"
                        opacity={0.6}
                        lineHeight="1.3"
                        noOfLines={2}
                        mt="1"
                      >
                        {option.description}
                      </Text>
                    </Box>
                    {/* 右侧勾选图标 */}
                    {isSelected && (
                      <Box
                        as={BsCheck2}
                        w="14px"
                        h="14px"
                        flexShrink={0}
                        ml="1.5"
                        mt="1px"
                      />
                    )}
                  </Flex>
                );
              })}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  );
};

export default ChatTypeSelector;
