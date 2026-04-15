import * as React from 'react';
import {
  Box,
  Collapse,
  Flex,
  Icon,
  IconButton,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import {
  useMemo,
  useRef,
  useState,
  createElement,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { RiArrowDownSLine, RiFile3Line } from 'react-icons/ri';
import { RxCheckCircled, RxReset } from 'react-icons/rx';
import { LuFileCheck } from 'react-icons/lu';
import type { IconType } from 'react-icons';
import type {
  DockTabActionCtx,
  DockTabItem,
  DockTabHelpers,
  DockTabRender,
} from '../../../types/dock-tabs';
import userReporter from '../../../utils/report';
import { ChatFileItem, useChatApplyStore } from '../../../store/chatApply';
import { UserEvent } from '../../../types/report';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import useCustomToast from '../../../hooks/useCustomToastWithUseCallback';
import { RiCalendarTodoLine } from 'react-icons/ri';
import { GrTransaction } from "react-icons/gr";

type ChatBottomTabsProps<TApi = unknown> = {
  items: DockTabItem<TApi>[];
  defaultActiveKey?: string;
  activeKey?: string;
  defaultExpanded?: boolean;
  onChange?: (key: string) => void;
};

export type ChatBottomTabsRef = {
  setExpanded: (expanded: boolean) => void;
};

// Tab 图标映射
const TAB_ICONS: Record<string, IconType> = {
  Changes: GrTransaction,
  Plan: RiCalendarTodoLine,
};

interface ChangesListItemProps {
  filePath: string;
  chatFileItem: ChatFileItem;
  onPreview: (item: ChatFileItem, filePath: string) => void;
  onRevert: (item: ChatFileItem) => void;
  onSave: (item: ChatFileItem) => void;
}

/**
 * 单个文件变更项组件
 */
function ChangesListItem({
  filePath,
  chatFileItem,
  onPreview,
  onRevert,
  onSave,
}: ChangesListItemProps) {
  const { accepted, diffLines, autoApply } = chatFileItem;

  // 获取文件名
  const fileName = useMemo(() => {
    const paths = filePath.replace(/\\/g, '/').split('/');
    return paths[paths.length - 1] || filePath;
  }, [filePath]);

  return (
    <Box
      className="group flex items-center justify-between cursor-pointer"
      onClick={() => onPreview(chatFileItem, filePath)}
      px={2}
      py={1}
      borderRadius="4px"
      bg="listBgColor"
      _hover={{
        bg: 'blue.300',
      }}
    >
      <Flex className="items-center flex-1 min-w-0 gap-2" borderRadius="md">
        <Icon as={RiFile3Line} color="gray.400" boxSize="14px" flexShrink={0} />
        <Tooltip label={filePath} placement="top" openDelay={500}>
          <Text className="truncate text-sm" color="text.default">
            {fileName}
          </Text>
        </Tooltip>
        {/* 变更行数显示 */}
        {diffLines && (
          <Flex className="items-center gap-1 ml-2" flexShrink={0}>
            {diffLines.add > 0 && (
              <Text className="text-xs font-semibold text-green-500">
                +{diffLines.add}
              </Text>
            )}
            {diffLines.delete > 0 && (
              <Text className="text-xs font-semibold text-red-500">
                -{diffLines.delete}
              </Text>
            )}
          </Flex>
        )}
        {/* 已应用标识 */}
        {accepted && (
          <Flex
            className="items-center gap-0.5 text-green-500 text-xs ml-2"
            flexShrink={0}
          >
            <Icon as={RxCheckCircled} boxSize="12px" />
            <Text>已应用</Text>
            {autoApply && (
              <Text className="text-[10px] bg-[rgba(255,255,255,0.1)] px-1 rounded">
                Auto
              </Text>
            )}
          </Flex>
        )}
      </Flex>
      {
        accepted && (
          <Tooltip label="保留">
            <IconButton
              aria-label="保留"
              size="sm"
              variant="ghost"
              icon={<Icon as={LuFileCheck} boxSize="18px" />}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              p={0}
              m={0}
              minW="auto"
              w="24px"
              h="24px"
              color='text.default'
              onClick={(e) => {
                e.stopPropagation()
                onSave(chatFileItem)
              }}
            />
          </Tooltip>
        )
      }
      {/* 操作按钮 - 仅回退 */}
      {accepted && (
        <Tooltip label="回退修改">
          <IconButton
            aria-label="回退修改"
            size="xs"
            variant="ghost"
            icon={<Icon as={RxReset} color="red.400" boxSize="14px" />}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onRevert(chatFileItem);
            }}
            minW="auto"
            w="24px"
            h="24px"
          />
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * Changes 列表组件 - 新的列表展示样式
 */
function ChangesListContent() {
  const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);
  const clearChatApplyInfoByFilePath = useChatApplyStore((state) => state.clearChatApplyInfoByFilePath);
  const { postMessage } = usePostMessage();

  const fileCount = useMemo(
    () => Object.keys(chatFileInfo).length,
    [chatFileInfo],
  );

  const handlePreview = useCallback(
    (item: ChatFileItem, filePath: string) => {
      postMessage({
        type: 'PREVIEW_DIFF_FILE',
        data: {
          filePath,
          beforeEdit: item.originalContent,
          finalResult: item.finalResult,
          isCreateFile: item.isCreateFile,
        },
      });
    },
    [postMessage],
  );

  const handleRevert = useCallback(
    (item: ChatFileItem) => {
      postMessage({
        type: BroadcastActions.REVERT_EDIT,
        data: { item },
      });
      userReporter.report({
        event: UserEvent.CODE_CHAT_REVERT_EDIT,
        extends: { item },
      });
    },
    [postMessage],
  );

  const handleSave = useCallback((item: ChatFileItem) => {
    clearChatApplyInfoByFilePath(item.filePath);
    userReporter.report({
      event: UserEvent.CODE_CHAT_SAVE_EDIT,
      extends: { item },
    });
  }, [clearChatApplyInfoByFilePath]);

  if (fileCount === 0) {
    return (
      <Box textAlign="center" color="gray.500" py={4}>
        暂无文件变更
      </Box>
    );
  }

  return (
    <Box className="max-h-[120px] overflow-y-auto flex flex-col gap-y-1 px-2">
      {Object.keys(chatFileInfo).map((filePath) => (
        <ChangesListItem
          key={filePath}
          filePath={filePath}
          chatFileItem={chatFileInfo[filePath]}
          onPreview={handlePreview}
          onRevert={handleRevert}
          onSave={handleSave}
        />
      ))}
    </Box>
  );
}

/**
 * Changes 标签头部操作按钮
 */
function ChangesHeaderActions() {
  const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);
  const clearChatFileInfo = useChatApplyStore(
    (state) => state.clearChatFileInfo,
  );
  const { postMessage } = usePostMessage();
  const { toast } = useCustomToast();

  const hasChanges = useMemo(
    () => Object.keys(chatFileInfo).length > 0,
    [chatFileInfo],
  );

  const handleBatchRevert = useCallback(() => {
    const items: ChatFileItem[] = [];
    Object.keys(chatFileInfo).forEach((filePath) => {
      const chatFileItem = chatFileInfo[filePath];
      if (chatFileItem.finalResult && chatFileItem.accepted) {
        items.push(chatFileItem);
      }
    });
    if (items.length) {
      postMessage({
        type: BroadcastActions.BATCH_REVERT_EDIT,
        data: { items },
      });
    } else {
      toast({ title: '无待回退修改' });
    }
  }, [chatFileInfo, postMessage, toast]);

  const handleBatchConfirm = useCallback(() => {
    clearChatFileInfo();
    userReporter.report({
      event: UserEvent.CODE_CHAT_BATCH_CONFIRM_EDIT,
    });
  }, [clearChatFileInfo]);

  if (!hasChanges) return null;

  return (
    <Flex alignItems="center" gap={1}>
      <Tooltip label="全部回退">
        <IconButton
          aria-label="全部回退"
          size="xs"
          variant="ghost"
          icon={<Icon as={RxReset} boxSize="14px" />}
          p={0}
          m={0}
          minW="auto"
          w="22px"
          h="22px"
          color="text.default"
          onClick={handleBatchRevert}
        />
      </Tooltip>
      <Tooltip label="全部保留">
        <IconButton
          aria-label="全部保留"
          size="xs"
          variant="ghost"
          icon={<Icon as={LuFileCheck} boxSize="14px" />}
          p={0}
          m={0}
          minW="auto"
          w="22px"
          h="22px"
          color="text.default"
          onClick={handleBatchConfirm}
        />
      </Tooltip>
    </Flex>
  );
}

function ChatBottomTabsV2Component<TApi = unknown>(
  props: ChatBottomTabsProps<TApi>,
  ref: React.Ref<ChatBottomTabsRef>,
) {
  const { items, defaultActiveKey, defaultExpanded = true, onChange } = props;
  const [expanded, setExpandedState] = useState<boolean>(defaultExpanded);
  const clearChatFileInfo = useChatApplyStore(
    (state) => state.clearChatFileInfo,
  );
  const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);

  const setExpanded = React.useCallback((expanded: boolean) => {
    setExpandedState(expanded);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      setExpanded,
    }),
    [setExpanded],
  );

  const initialKey = useMemo(
    () => defaultActiveKey || items?.[0]?.key || '',
    [defaultActiveKey, items],
  );
  const [activeKey, setActiveKey] = useState<string>(initialKey);
  const apiMapRef = useRef<Record<string, TApi>>({});
  const [dynamicActions, setDynamicActions] = useState<
    Record<string, React.ReactNode>
  >({});
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  const actionCtx: DockTabActionCtx = useMemo(
    () => ({
      activeKey,
      apiMap: apiMapRef.current,
      updateId: forceUpdateCounter,
    }),
    [activeKey, forceUpdateCounter],
  );

  const visibleItems = useMemo(() => {
    console.debug('forceUpdateCounter:', forceUpdateCounter);
    return items.filter((i) => (i.isVisible ? i.isVisible() : true));
  }, [items, forceUpdateCounter]);

  const anyTabLocked = useMemo(
    () => visibleItems.some((item) => item.isLocked?.(actionCtx)),
    [visibleItems, actionCtx],
  );

  useEffect(() => {
    if (
      visibleItems.length &&
      !visibleItems.find((it) => it.key === activeKey)
    ) {
      setActiveKey(visibleItems[0]?.key || '');
    }
  }, [activeKey, visibleItems]);

  useEffect(() => {
    if (props.activeKey !== undefined) {
      setActiveKey(props.activeKey);
    }
  }, [props.activeKey]);

  // 当前活动 Tab 的配置
  const activeItem = useMemo(
    () => visibleItems.find((it) => it.key === activeKey),
    [visibleItems, activeKey],
  );

  const isChangesTab = activeKey === 'Changes';
  const hasChanges = Object.keys(chatFileInfo).length > 0;

  if (!visibleItems.length) {
    return null;
  }

  // Tab 图标按钮渲染
  const renderTabIcon = (it: DockTabItem<TApi>) => {
    const isActive = activeKey === it.key;
    const isOtherTabLocked = anyTabLocked && !isActive;
    const isDisabled = isOtherTabLocked;
    const TabIcon = TAB_ICONS[it.key] || GrTransaction;

    return (
      <Tooltip key={it.key} label={it.tooltip || it.key} placement="top">
        <IconButton
          aria-label={it.tooltip || it.key}
          size="xs"
          variant="ghost"
          icon={<Icon as={TabIcon} boxSize="14px" />}
          color={isActive ? 'white' : 'gray.400'}
          bg={isActive ? 'blue.500' : 'transparent'}
          _hover={{
            bg: isActive ? 'blue.500' : 'whiteAlpha.100',
          }}
          onClick={() => {
            if (!isDisabled) {
              setActiveKey(it.key);
              onChange?.(it.key);
              // 切换 Tab 时，如果当前是折叠状态，则自动展开
              if (!expanded) {
                setExpandedState(true);
              }
            }
          }}
          isDisabled={isDisabled}
          opacity={isDisabled ? 0.4 : 1}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
          borderRadius="4px"
          w="24px"
          h="24px"
          minW="24px"
        />
      </Tooltip>
    );
  };

  // 统一布局结构，使用 Collapse 实现平滑过渡动画
  return (
    <Box
      className="w-full"
      border="1px"
      borderRadius="8px"
      bg="themeBgColor"
      borderColor="customBorder"
      boxSizing="border-box"
      overflow="hidden"
    >
      {/* Header 区域 - 始终显示 */}
      <Flex alignItems="center" px={2} py={1.5} gap={2}>
        {/* Tab 图标 - 水平排列 */}
        <Flex gap={0.5}>{visibleItems.map((it) => renderTabIcon(it))}</Flex>

        {/* 标题 */}
        <Text fontWeight="bold" fontSize="sm" color="text.primary">
          {activeItem?.key || ''}
        </Text>

        {/* 提示文字 */}
        {isChangesTab && hasChanges && (
          <Box className="text-xs" color="gray.500">
            建议及时
            <Box
              as="span"
              px={1}
              cursor="pointer"
              color="blue.300"
              _hover={{ textDecoration: 'underline' }}
              onClick={() => {
                clearChatFileInfo();
                userReporter.report({
                  event: UserEvent.CODE_CHAT_BATCH_CONFIRM_EDIT,
                });
              }}
            >
              归档
            </Box>
            确定的改动
          </Box>
        )}

        {/* 操作按钮 */}
        <Flex ml="auto" alignItems="center" gap={1}>
          {isChangesTab ? (
            <ChangesHeaderActions />
          ) : (
            (dynamicActions[activeKey] ??
              items.find((it) => it.key === activeKey)?.actions?.(actionCtx) ??
              null)
          )}

          {/* 折叠/展开按钮 */}
          <Tooltip label={expanded ? '折叠' : '展开'}>
            <IconButton
              aria-label={expanded ? '折叠' : '展开'}
              size="xs"
              variant="ghost"
              icon={
                <Icon
                  as={RiArrowDownSLine}
                  boxSize="14px"
                  sx={{
                    transition: 'transform 0.2s ease-in-out',
                    transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)',
                  }}
                />
              }
              onClick={() => setExpandedState(!expanded)}
              isDisabled={anyTabLocked}
              opacity={anyTabLocked ? 0.4 : 1}
              cursor={anyTabLocked ? 'not-allowed' : 'pointer'}
              color="gray.400"
              _hover={{ bg: 'whiteAlpha.100' }}
              borderRadius="4px"
              w="22px"
              h="22px"
            />
          </Tooltip>
        </Flex>
      </Flex>

      {/* 可折叠的内容区域 - 使用 Collapse 实现动画 */}
      <Collapse in={expanded} animateOpacity>
        {/* Tab 内容 */}
        <Box maxH="120px" overflowY="auto" pb={2}>
          {items.map((it) => {
            const helpers: DockTabHelpers = {
              setActions: (node) =>
                setDynamicActions((prev) => ({
                  ...prev,
                  [it.key]: node,
                })),
              triggerUpdate: () => setForceUpdateCounter((prev) => prev + 1),
              expanded: expanded,
              setExpanded: setExpanded,
            };

            // 对于 Changes tab 使用新的列表组件
            if (it.key === 'Changes') {
              return (
                <Collapse key={it.key} in={activeKey === it.key} animateOpacity>
                  <ChangesListContent />
                </Collapse>
              );
            }

            return (
              <Collapse key={it.key} in={activeKey === it.key} animateOpacity>
                {typeof it.render === 'function'
                  ? (it.render as DockTabRender<TApi>)((inst) => {
                    apiMapRef.current[it.key] =
                      inst || apiMapRef.current[it.key];
                  }, helpers)
                  : createElement(it.render, {
                    ref: (inst: TApi) => {
                      apiMapRef.current[it.key] =
                        inst || apiMapRef.current[it.key];
                    },
                    ...helpers,
                  })}
              </Collapse>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

const ChatBottomTabsV2 = forwardRef(ChatBottomTabsV2Component) as (<
  TApi = unknown,
>(
  props: ChatBottomTabsProps<TApi> & { ref?: React.Ref<ChatBottomTabsRef> },
) => JSX.Element | null) & { displayName?: string };

ChatBottomTabsV2.displayName = 'ChatBottomTabsV2';

export default ChatBottomTabsV2;
