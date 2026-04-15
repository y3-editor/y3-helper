import {
  forwardRef,
  MouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Flex,
  Icon,
  IconButton,
  Tag,
  TagLabel,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import {
  RiFile3Line,
  RiFileList2Line,
  RiNodeTree,
} from 'react-icons/ri';
import { FiCheck } from 'react-icons/fi';
import { RxCheckCircled, RxReset } from 'react-icons/rx';
import { ChatFileItem, useChatApplyStore } from '../../../../store/chatApply';
import { BroadcastActions, usePostMessage } from '../../../../PostMessageProvider';
import Tree, { TreeNode } from '../../../../components/Tree';
import useCustomToast from '../../../../hooks/useCustomToastWithUseCallback';
import userReporter from '../../../../utils/report';
import { UserEvent } from '../../../../types/report';
import type { DockTabHelpers } from '../../../../types/dock-tabs';
import { LuFileCheck } from 'react-icons/lu';

enum EDisplayMode {
  TREE,
  LIST,
}

// export type ChatApplyTabApi = {
//   displayMode: EDisplayMode;
//   fileCount: number;
//   hasChanges: boolean;
// };

// TODO: ts 类型问题处理
const ChatApplyTab = forwardRef<any, DockTabHelpers>(
  function ChatApplyTab(props, ref) {
    const { setActions, triggerUpdate } = props;
    const curTriggerUpdate = useRef(triggerUpdate);
    const curSetActions = useRef(setActions);
    curTriggerUpdate.current = triggerUpdate;
    curSetActions.current = setActions;

    const chatFileInfo = useChatApplyStore((state) => state.chatFileInfo);
    const clearChatFileInfo = useChatApplyStore((state) => state.clearChatFileInfo);
    const clearChatApplyInfoByFilePath = useChatApplyStore((state) => state.clearChatApplyInfoByFilePath);

    const [displayMode, setDisplayMode] = useState<EDisplayMode>(EDisplayMode.TREE);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const { postMessage } = usePostMessage();
    const { toast } = useCustomToast();

    const fileCount = useMemo(() => Object.keys(chatFileInfo).length, [chatFileInfo]);
    const hasChanges = useMemo(() => fileCount > 0, [fileCount]);

    useImperativeHandle(
      ref,
      () => ({
        displayMode,
        fileCount,
        hasChanges,
      }),
      [displayMode, fileCount, hasChanges],
    );

    const renderChangedLines = useCallback((chatFileItem: ChatFileItem) => {
      if (!chatFileItem) return null;
      const { diffLines } = chatFileItem;
      if (!diffLines) return null;
      return (
        <div className="flex ml-2">
          <div className={`text-green-500 ${!diffLines.add && 'hidden'} mr-1 text-xs font-bold`}>
            +{diffLines.add}
          </div>
          <div className={`text-red-600 ${!diffLines.delete && 'hidden'} text-xs font-bold`}>
            -{diffLines.delete}
          </div>
        </div>
      );
    }, []);

    const renderActionButtons = useCallback((chatFileItem: ChatFileItem) => {
      const { accepted, filePath } = chatFileItem;
      return (
        <Flex alignItems='center'>
          {!accepted && (
            <Tooltip label="应用修改">
              <IconButton
                aria-label="应用修改"
                size="xl"
                icon={<Icon color="green.500" as={FiCheck} />}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: 实现应用修改逻辑
                }}
                color="text.default"
              />
            </Tooltip>
          )}
          {
            accepted && (
              <Tooltip label="保留">
                <IconButton
                  aria-label="保留"
                  size="sm"
                  variant="ghost"
                  icon={<Icon as={LuFileCheck} boxSize="18px" />}
                  p={0}
                  m={0}
                  minW="auto"
                  w="24px"
                  h="24px"
                  color='text.default'
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation()
                    clearChatApplyInfoByFilePath(filePath);
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_CONFIRM_EDIT,
                    });
                  }}
                />
              </Tooltip>
            )
          }
          {accepted && (
            <Tooltip label="回退修改">
              <IconButton
                aria-label="回退修改"
                size="xl"
                icon={<Icon color="red.400" as={RxReset} />}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation();
                  postMessage({
                    type: BroadcastActions.REVERT_EDIT,
                    data: {
                      item: chatFileItem,
                    },
                  });
                  userReporter.report({
                    event: UserEvent.CODE_CHAT_REVERT_EDIT,
                    extends: {
                      item: chatFileItem,
                    },
                  });
                }}
                color="text.default"
              />
            </Tooltip>
          )}
        </Flex>
      );
    }, [clearChatApplyInfoByFilePath, postMessage]);

    const [treeData, defaultExpandedKeys] = useMemo(() => {
      const result: TreeNode[] = [];
      let defaultExpandKeys: string[] = [];
      const nodeRecord: Record<string, TreeNode> = {};

      Object.keys(chatFileInfo).map((filePath: string) => {
        const chatFileItem = chatFileInfo[filePath];
        const { accepted, autoApply } = chatFileItem;
        const curPath = filePath.replace(/\\/g, '/');
        const paths = curPath.split('/').filter((i) => !!i.trim());

        paths.reduce((path: string, fileName: string, index: number, self) => {
          const curPath = path + `${index === 0 ? '' : '/'}${fileName}`;
          const isLeaf = self.length === index + 1;
          const node = {
            key: curPath,
            title: (
              <div className="my-[2px] cm-hover-box">
                {!isLeaf ? (
                  <Tooltip label={fileName}>
                    <div className="truncate" style={{ width: `calc(100vw - ${84 + (index + 1) * 16}px)` }}>{fileName}</div>
                  </Tooltip>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2" style={{ width: `calc(100vw - ${84 + (index + 1) * 16}px)` }}>
                      <Icon
                        className={'mt-1 ml-2'}
                        as={RiFile3Line}
                        color={'gray.400'}
                      />
                      <Tooltip label={fileName}>
                        <div className="truncate">{fileName}</div>
                      </Tooltip>
                      {isLeaf && (
                        <span className="mt-[4px]">
                          {renderChangedLines(chatFileItem)}
                        </span>
                      )}
                      {accepted && (
                        <div className="text-green-500 flex items-center scale-[.8] space-x-1">
                          <Icon as={RxCheckCircled} />
                          <span className="text-nowrap">已应用</span>
                          <Tag hidden={!autoApply} size="sm" variant="subtle">
                            <TagLabel>Auto</TagLabel>
                          </Tag>
                        </div>
                      )}
                    </div>
                    <span className={`hover-visible ml-auto`}>
                      {renderActionButtons(chatFileItem)}
                    </span>
                  </div>
                )}
              </div>
            ),
            children: [],
            isLeaf,
            extra: {
              chatFileItem: chatFileItem,
            },
          };

          if (!nodeRecord[curPath] && curPath) {
            nodeRecord[curPath] = node;
            if (nodeRecord[path] && path) {
              if (!Array.isArray(nodeRecord[path].children))
                nodeRecord[path].children = [];
              if (nodeRecord[path].children.every((i) => i.key !== path)) {
                nodeRecord[path].children.push(node);
              }
            }
            if (index === 0) {
              result.push(node);
            }
            if (!isLeaf) {
              defaultExpandKeys.push(curPath);
            }
          }
          return curPath;
        }, '');
      });

      defaultExpandKeys = Array.from(new Set(defaultExpandKeys));
      return [result, defaultExpandKeys];
    }, [renderActionButtons, renderChangedLines, chatFileInfo]);

    useEffect(() => {
      setExpandedKeys(defaultExpandedKeys);
    }, [defaultExpandedKeys]);

    const renderList = useCallback(() => {
      return Object.keys(chatFileInfo).map((filePath: string, index) => {
        const chatFileItem = chatFileInfo[filePath];
        const { accepted, originalContent, finalResult, isCreateFile } = chatFileItem;
        const path = filePath;
        const paths = path.split('/');
        let displayPath = '';

        if (paths.length) {
          if (paths[0]) displayPath = paths[0];
          else if (paths[1]) displayPath = paths[1];
          if (paths.length > 1) {
            displayPath += `/.../${paths[paths.length - 1]}`;
          }
        }

        return (
          <Box py={1} key={path + index}>
            <Box
              className="hover:bg-[#232323] w-full cursor-pointer flex cm-hover-box"
              onClick={() => {
                postMessage({
                  type: 'PREVIEW_DIFF_FILE',
                  data: {
                    filePath,
                    beforeEdit: originalContent,
                    finalResult,
                    isCreateFile,
                  },
                });
              }}
            >
              <div
                className="space-x-1 relative leading-6 py-1 flex items-center flex-1 w-full"
              >
                <Icon className="mt-1 ml-2" as={RiFile3Line} color={'gray.400'} />
                <Tooltip label={path}>
                  <span className="truncate">{displayPath}</span>
                </Tooltip>
                {renderChangedLines(chatFileItem)}
                {accepted && (
                  <div className="text-green-500 flex items-center scale-[.8]">
                    <Icon as={RxCheckCircled} mr={1} />
                    <span className="text-nowrap">已应用</span>
                  </div>
                )}
              </div>
              <span className={`hover-visible ml-[10px]`}>
                {renderActionButtons(chatFileItem)}
              </span>
            </Box>
          </Box>
        );
      });
    }, [postMessage, renderActionButtons, renderChangedLines, chatFileInfo]);

    const actionsNode = useMemo(() => {
      if (!hasChanges) return null;

      return (
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip label={displayMode === EDisplayMode.TREE ? '列表视图' : '树形视图'}>
            <IconButton
              aria-label="切换显示模式"
              size="sm"
              variant="ghost"
              icon={<Icon as={displayMode === EDisplayMode.TREE ? RiFileList2Line : RiNodeTree} boxSize="18px" />}
              p={0}
              m={0}
              minW="auto"
              w="24px"
              h="24px"
              color='text.default'
              onClick={() => setDisplayMode(displayMode === EDisplayMode.LIST ? EDisplayMode.TREE : EDisplayMode.LIST)}
            />
          </Tooltip>
          <Tooltip label="全部回退">
            <IconButton
              aria-label="全部回退"
              size="sm"
              variant="ghost"
              icon={<Icon as={RxReset} boxSize="18px" />}
              p={0}
              m={0}
              minW="auto"
              w="24px"
              h="24px"
              color='text.default'
              onClick={() => {
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
                    data: {
                      items: items,
                    },
                  });
                } else {
                  toast({
                    title: '无待回退修改',
                  });
                }
              }}
            />
          </Tooltip>
          <Tooltip label="全部保留">
            <IconButton
              aria-label="全部保留"
              size="sm"
              variant="ghost"
              icon={<Icon as={LuFileCheck} boxSize="18px" />}
              p={0}
              m={0}
              minW="auto"
              w="24px"
              h="24px"
              color='text.default'
              onClick={() => {
                clearChatFileInfo();
                userReporter.report({
                  event: UserEvent.CODE_CHAT_BATCH_CONFIRM_EDIT,
                });
              }}
            />
          </Tooltip>
        </Box>
      );
    }, [hasChanges, displayMode, chatFileInfo, postMessage, toast, clearChatFileInfo]);

    useEffect(() => {
      curSetActions.current?.(actionsNode);
    }, [actionsNode]);

    useEffect(() => {
      curTriggerUpdate.current?.();
    }, [hasChanges, displayMode]);

    if (!hasChanges) {
      return (
        <VStack align="stretch" spacing={2} p={1}>
          <Box textAlign="center" color="gray.500" py={4}>
            暂无文件变更
          </Box>
        </VStack>
      );
    }

    return (
      <VStack align="stretch" spacing={2} px={2} py={1} style={{ width: 'calc(100vw - 18px)' }}>
        <Box>
          {displayMode === EDisplayMode.TREE ? (
            <Tree
              dataSource={treeData}
              selectable
              expandedKeys={expandedKeys}
              onExpand={setExpandedKeys}
              onClick={(node) => {
                if (node.isLeaf) {
                  const {
                    filePath = '',
                    finalResult,
                    isCreateFile,
                    originalContent,
                  } = node?.extra?.chatFileItem || {};
                  postMessage({
                    type: 'PREVIEW_DIFF_FILE',
                    data: {
                      filePath,
                      beforeEdit: originalContent,
                      finalResult,
                      isCreateFile,
                    },
                  });
                }
              }}
            />
          ) : (
            renderList()
          )}
        </Box>
      </VStack>
    );
  },
);

export default ChatApplyTab;
