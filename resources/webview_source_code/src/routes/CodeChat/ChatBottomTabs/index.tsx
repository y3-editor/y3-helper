import * as React from 'react';
import { Box, Collapse, Icon, IconButton, Tooltip } from '@chakra-ui/react';
import {
  useMemo,
  useRef,
  useState,
  createElement,
  isValidElement,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { RiArrowDownSLine } from 'react-icons/ri';
import type { IconType } from 'react-icons';
import type {
  DockTabActionCtx,
  DockTabItem,
  DockTabHelpers,
  DockTabRender,
} from '../../../types/dock-tabs';
import userReporter from '../../../utils/report';
import { useChatApplyStore } from '../../../store/chatApply';
import { UserEvent } from '../../../types/report';

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

function ChatBottomTabsComponent<TApi = unknown>(
  props: ChatBottomTabsProps<TApi>,
  ref: React.Ref<ChatBottomTabsRef>
) {
  const { items, defaultActiveKey, defaultExpanded = true, onChange } = props;
  const [expanded, setExpandedState] = useState<boolean>(defaultExpanded);
  const clearChatFileInfo = useChatApplyStore((state) => state.clearChatFileInfo);
  const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);

  const setExpanded = React.useCallback((expanded: boolean) => {
    setExpandedState(expanded);
  }, []);

  useImperativeHandle(ref, () => ({
    setExpanded,
  }), [setExpanded]);

  const initialKey = useMemo(
    () => defaultActiveKey || items?.[0]?.key || '',
    [defaultActiveKey, items],
  );
  const [activeKey, setActiveKey] = useState<string>(initialKey);
  const apiMapRef = useRef<Record<string, TApi>>({});
  const [dynamicActions, setDynamicActions] = useState<
    Record<string, React.ReactNode>
  >({});
  const contentRef = useRef<HTMLDivElement | null>(null);
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
    // forceUpdateCounter 用于强制更新
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

  if (visibleItems.length) {
    return (
      <Box
        className="w-full"
        border="1px"
        borderRadius="8px"
        bg="questionsBgColor"
        borderColor="customBorder"
        boxSizing="border-box"
      >
        <Box display="flex" alignItems="center" gap={0.5} px={1.5} py={0.5}>
          <IconButton
            aria-label={expanded ? '折叠' : '展开'}
            size="xs"
            variant="ghost"
            icon={
              <Icon
                as={RiArrowDownSLine}
                sx={{
                  transition: 'transform 0.3s ease',
                  transform: expanded ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              />
            }
            onClick={() => setExpandedState((v: boolean) => !v)}
            isDisabled={anyTabLocked}
            opacity={anyTabLocked ? 0.4 : 1}
            cursor={anyTabLocked ? 'not-allowed' : 'pointer'}
            p={0}
            m={0}
            minW="auto"
            w="20px"
            h="20px"
          />
          {visibleItems.map((it) => {
            const isOtherTabLocked = anyTabLocked && activeKey !== it.key;
            const isDisabled = isOtherTabLocked;

            return (
              <Tooltip key={it.key} label={it.tooltip || it.key}>
                {it.icon ? (
                  <IconButton
                    aria-label={it.tooltip || it.key}
                    size="xs"
                    variant="ghost"
                    icon={<Icon as={it.icon as IconType} boxSize="14px" />}
                    color={activeKey === it.key ? 'blue.300' : 'text.default'}
                    onClick={() => {
                      if (!isDisabled) {
                        setActiveKey(it.key);
                        onChange?.(it.key);
                      }
                    }}
                    isDisabled={isDisabled}
                    opacity={isDisabled ? 0.4 : 1}
                    cursor={isDisabled ? 'not-allowed' : 'pointer'}
                    bg="whiteAlpha.100"
                    _hover={{
                      bg: isDisabled ? 'whiteAlpha.100' : 'whiteAlpha.200',
                    }}
                    p={0}
                    m={0}
                    minW="auto"
                    w="20px"
                    h="20px"
                  />
                ) : (
                  <Box
                    key={it.key}
                    color={activeKey === it.key ? 'blue.300' : 'text.default'}
                    onClick={() => {
                      if (!isDisabled) {
                        setActiveKey(it.key);
                        onChange?.(it.key);
                      }
                    }}
                    opacity={isDisabled ? 0.4 : 1}
                    cursor={isDisabled ? 'not-allowed' : 'pointer'}
                    _hover={{
                      bg: isDisabled ? 'whiteAlpha.100' : 'whiteAlpha.200',
                    }}
                    px={1.5}
                    py={1}
                    minW="auto"
                    textAlign="center"
                    borderColor="blue.300"
                    borderBottom={activeKey === it.key ? '2px solid' : 'none'}
                  >
                    {isValidElement(it.title) ? it.title : it.title}
                  </Box>
                )}
              </Tooltip>
            );
          })}

          <Box ml="auto" display="flex" alignItems="center" gap={0.5}>
            {dynamicActions[activeKey] ??
              items.find((it) => it.key === activeKey)?.actions?.(actionCtx) ??
              null}
          </Box>
        </Box>

        <Collapse in={expanded} animateOpacity style={{ overflow: 'hidden' }}>
        {
          Object.keys(chatFileInfo).length && activeKey== 'Changes' ? (
            <Box ml={2} mt={0.5} mb={0.5} color={'#666'} fontSize={'12px'}>
              当前会话未归档的Changes，建议
              <Box className='inline' px={1} cursor={'pointer'} color={'blue.300'}
                onClick={() => {
                  clearChatFileInfo();
                  userReporter.report({
                    event: UserEvent.CODE_CHAT_BATCH_CONFIRM_EDIT
                  })
                }}

              >点击全部保留</Box>
              及时归档确定的改动
          </Box>
          ) : null
        }
          <Box
            ref={contentRef}
            px={0}
            pb={0}
            pt={0}
            maxH="120px"
            overflowY="auto"
          >
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
  return null;
}

const ChatBottomTabs = forwardRef(ChatBottomTabsComponent) as (<TApi = unknown>(
  props: ChatBottomTabsProps<TApi> & { ref?: React.Ref<ChatBottomTabsRef> }
) => JSX.Element | null) & { displayName?: string };

ChatBottomTabs.displayName = 'ChatBottomTabs';

export default ChatBottomTabs;