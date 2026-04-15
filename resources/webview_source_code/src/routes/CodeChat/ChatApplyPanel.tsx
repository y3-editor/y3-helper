import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Tag,
  TagLabel,
  Tooltip,
  useMediaQuery,
} from '@chakra-ui/react';
import { RiArrowDownSLine, RiArrowRightSLine, RiFile3Line, RiFileList2Line, RiNodeTree } from 'react-icons/ri';
import { FiCheck, FiPenTool } from 'react-icons/fi';
import { ChatFileItem, useChatApplyStore } from '../../store/chatApply';
import { MediumScreenWidth } from '../../const';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { RxCheckCircled, RxReset } from 'react-icons/rx';
import Tree, { TreeNode } from '../../components/Tree';
import useCustomToast from '../../hooks/useCustomToast';
import userReporter from '../../utils/report';
import { UserEvent } from '../../types/report';

enum EDisplayMode {
  TREE,
  LIST,
}

const ChatApplyPanel = () => {
  const [
    chatFileInfo,
    clearChatFileInfo
  ] = useChatApplyStore((state) => [
    state.chatFileInfo,
    state.clearChatFileInfo
  ]);
  const [expand, setExpand] = useState(true);
  const [isSmallScreen] = useMediaQuery(MediumScreenWidth);
  const [displayMode, setDisplayMode] = useState<EDisplayMode>(EDisplayMode.TREE);
  const { postMessage } = usePostMessage();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const { toast } = useCustomToast();

  const renderChangedLines = useCallback((chatFileItem: ChatFileItem) => {
    if (!chatFileItem) return null;
    const { diffLines } = chatFileItem;
    if (!diffLines) return null;
    return (
      <div className='flex ml-2'>
        <div className={`text-green-500 ${!diffLines.add && 'hidden'} mr-1 text-xs font-bold`}>
          +{diffLines.add}
        </div>
        <div className={`text-red-600 ${!diffLines.delete && 'hidden'} text-xs font-bold`}>
          -{diffLines.delete}
        </div>
      </div>
    )
  }, [])

  const renderActionButtons = useCallback((
    chatFileItem: ChatFileItem,
    // fileOriginalContent?: string
  ) => {
    const {
      accepted,
    } = chatFileItem;
    return (
      <>
        {
          !accepted && (
            <Tooltip label='应用修改'>
              <IconButton
                aria-label="应用修改"
                size="xl"
                icon={<Icon color="green.500" as={FiCheck} />}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation();
                  // postMessage({
                  //   type: BroadcastActions.ACCEPT_FILE_EDIT,
                  //   data: {
                  //     item: chatApplyItem
                  //   },
                  // });
                  // if (taskId) {
                  //   codemakerApiRequest.post('/apply/accept_code_generate', {
                  //     task_id: taskId
                  //   });
                  // }
                }}
                color="text.default"
              />
            </Tooltip>
          )
        }
        {
          accepted && (
            <Tooltip label='回退修改'>
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
                      item: chatFileItem
                    },
                  });
                  userReporter.report({
                    event: UserEvent.CODE_CHAT_REVERT_EDIT,
                    extends: {
                      item: chatFileItem
                    },
                  });
                }}
                color="text.default"
              />
            </Tooltip>
          )
        }
      </>
    )
  }, [postMessage])

  const [treeData, defaultExpandedKeys] = useMemo(() => {
    const result: TreeNode[] = []
    let defaultExpandKeys: string[] = []
    const nodeRecord: Record<string, TreeNode> = {}
    Object.keys(chatFileInfo).map((filePath: string) => {
      const chatFileItem = chatFileInfo[filePath];
      const { accepted, autoApply } = chatFileItem;
      const curPath = filePath.replace(/\\/g, '/')
      const paths = curPath.split('/').filter(i => !!i.trim())
      paths.reduce((path: string, fileName: string, index: number, self) => {
        // 修复模型路径返回不稳定
        const curPath = path + `${index === 0 ? '' : '/'}${fileName}`;
        const isLeaf = self.length === (index + 1);
        const node = {
          key: curPath,
          title: (
            <div
              className='my-[4px] cm-hover-box'
            >
              {
                !isLeaf ? (
                  <Tooltip label={fileName}>
                    <div className='truncate'>{fileName}</div>
                  </Tooltip>
                ) : (
                  <div className='flex items-center justify-between'>
                    <div className='flex space-x-2 truncate'>
                      <Icon
                        className={'mt-1 ml-2'}
                        as={RiFile3Line}
                        color={'gray.400'}
                      />
                      <Tooltip label={fileName}>
                        <div className='truncate'>{fileName}</div>
                      </Tooltip>
                      {isLeaf && (
                        <span className='mt-[4px]'>
                          {renderChangedLines(chatFileItem)}
                        </span>
                      )}
                      {accepted && (
                        <div className='text-green-500 flex items-center scale-[.8] space-x-1'>
                          <Icon as={RxCheckCircled} />
                          <span className='text-nowrap'>已应用</span>
                          <Tag hidden={!autoApply} size="sm" variant="subtle">
                            <TagLabel>Auto</TagLabel>
                          </Tag>
                        </div>
                      )}
                    </div>
                    <span className={`hover-visible ml-auto`}>
                      {
                        renderActionButtons(chatFileItem)
                      }
                    </span>
                  </div>
                )
              }
            </div>
          ),
          children: [],
          isLeaf,
          extra: {
            chatFileItem: chatFileItem
          }
        }
        if (!nodeRecord[curPath] && curPath) {
          nodeRecord[curPath] = node
          // 父节点
          if (nodeRecord[path] && path) {
            if (!Array.isArray(nodeRecord[path].children)) nodeRecord[path].children = []
            if (nodeRecord[path].children.every((i) => i.key !== path)) {
              nodeRecord[path].children.push(node)
            }
          }
          if (index === 0) {
            result.push(node)
          }
          if (!isLeaf) {
            defaultExpandKeys.push(curPath)
          }
        }
        return curPath
      }, '')
    })
    defaultExpandKeys = Array.from(new Set(defaultExpandKeys))
    return [result, defaultExpandKeys]
  }, [renderActionButtons, renderChangedLines, chatFileInfo])

  useEffect(() => {
    setExpandedKeys(defaultExpandedKeys)
  }, [defaultExpandedKeys])

  const renderList = useCallback(() => {
    return Object.keys(chatFileInfo)
      .map((filePath: string, index) => {
        const chatFileItem = chatFileInfo[filePath];
        const { accepted, originalContent, finalResult, isCreateFile } = chatFileItem;
        const path = filePath;
        const paths = path.split('/');
        let displayPath = ''
        if (paths.length) {
          if (paths[0]) displayPath = paths[0]
          else if (paths[1]) displayPath = paths[1]
          if (paths.length > 1) {
            displayPath += `/.../${paths[paths.length - 1]}`
          }
        }
        return (
          <Box py={1} key={path + index}>
            <Box
              className='w-full cursor-pointer flex cm-hover-box'
              onClick={() => {
                postMessage({
                  type: 'PREVIEW_DIFF_FILE',
                  data: {
                    filePath,
                    beforeEdit: originalContent,
                    finalResult,
                    isCreateFile
                  },
                });
              }}
            >
              <div
                style={{ width: 'calc(100% - 80px)' }}
                className='w-full space-x-1 relative leading-6 py-1 flex items-center flex-1'
              >
                <Icon className='mt-1 ml-2' as={RiFile3Line} color={'gray.400'} />
                <Tooltip label={path}>
                  <span className='truncate'>{displayPath}</span>
                </Tooltip>
                {renderChangedLines(chatFileItem)}
                {accepted && (
                  <div className='text-green-500 flex items-center scale-[.8]'>
                    <Icon as={RxCheckCircled} mr={1} />
                    <span className='text-nowrap'>已应用</span>
                  </div>
                )}
              </div>
              <span className={`hover-visible ml-[10px]`}>
                {
                  renderActionButtons(chatFileItem)
                }
              </span>
            </Box>
          </Box>
        )
      })
  }, [postMessage, renderActionButtons, renderChangedLines, chatFileInfo])


  if (!Object.keys(chatFileInfo).length) {
    return null;
  }

  return (
    <Box
      bg="questionsBgColor"
      borderColor="customBorder"
      borderWidth="1px"
      borderRadius="8px"
      marginTop={5}
    >
      <Box
        px={3}
        py={3}
        border="1px"
        borderColor="customBorder"
        borderTopRadius="8px"
        color="text.default"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Box className='truncate'>
          <Icon
            className='cursor-pointer mr-1 w-10'
            as={expand ? RiArrowRightSLine : RiArrowDownSLine}
            size={'xs'}
            onClick={() => setExpand(!expand)}
          />
          <span className='text-[#3e81F7] font-bold px-1'>{Object.keys(chatFileInfo).length}</span>
          <span>个文件变更</span>
        </Box>
        <Box className='space-x-2 flex'>
          <Button
            size={'sm'}
            onClick={() => setDisplayMode(displayMode === EDisplayMode.LIST ? EDisplayMode.TREE : EDisplayMode.LIST)}
          >
            <Icon as={displayMode === EDisplayMode.TREE ? RiFileList2Line : RiNodeTree} size={'xs'} />
            <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>{displayMode === EDisplayMode.TREE ? '列表' : '树层'}</span>
          </Button>
          <Tooltip label='回退后，本次消息的所有应用内容将被撤销'>
            <Button
              size={'sm'}
              onClick={() => {
                const items: ChatFileItem[] = [];
                Object.keys(chatFileInfo).forEach((filePath) => {
                  const chatFileItem = chatFileInfo[filePath];
                  if (chatFileItem.finalResult && chatFileItem.accepted) {
                    items.push(chatFileItem);
                  }
                })
                if (items.length) {
                  postMessage({
                    type: BroadcastActions.BATCH_REVERT_EDIT,
                    data: {
                      items: items
                    }
                  })
                } else {
                  toast({
                    title: '无待回退修改'
                  })
                }
              }}
            >
              <Icon as={RxReset} size={'xs'} />
              <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>全部回退</span>
            </Button>
          </Tooltip>
          <Button
            size={'sm'}
            onClick={() => {
              clearChatFileInfo();
              userReporter.report({
                event: UserEvent.CODE_CHAT_BATCH_CONFIRM_EDIT
              })
            }}
          >
            <Icon as={FiPenTool} size={'xs'} />
            <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>全部保留</span>
          </Button>
        </Box>
      </Box>
      <Box className={!expand ? '' : 'hidden'} py={3} px={4}>
        {
          displayMode === EDisplayMode.TREE
            ? (
              <Tree
                dataSource={treeData}
                selectable
                expandedKeys={expandedKeys}
                onExpand={setExpandedKeys}
                onClick={(node) => {
                  if (node.isLeaf) {
                    const { filePath = '', finalResult, isCreateFile, originalContent } = node?.extra?.chatFileItem || {};
                    postMessage({
                      type: 'PREVIEW_DIFF_FILE',
                      data: {
                        filePath,
                        beforeEdit: originalContent,
                        finalResult,
                        isCreateFile
                      },
                    });
                  }
                }}
              />
            )
            : renderList()
        }
      </Box>
    </Box>
  )
};

export default ChatApplyPanel;
