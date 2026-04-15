import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Tooltip,
  useMediaQuery,
} from '@chakra-ui/react';
import { RiArrowDownSLine, RiArrowRightSLine, RiFile3Line, RiFileList2Line, RiNodeTree } from 'react-icons/ri';
import { BroadcastActions, usePostMessage } from '../../PostMessageProvider';
import { ChatMessage } from '../../services';
import Tree, { TreeNode } from '../../components/Tree';
import { FiCheck,FiMinusCircle,FiPenTool } from 'react-icons/fi';
import { RxCheckCircled, RxReset } from 'react-icons/rx';
import { AiOutlineDiff } from 'react-icons/ai';
import { useChatStore, useUserActionStore } from '../../store/chat';
import userReporter from '../../utils/report';
import { useWorkspaceStore } from '../../store/workspace';
import { countGodeGenerate } from '../../utils';
import { MediumScreenWidth } from '../../const';
import useCustomToast from '../../hooks/useCustomToast';
import md5 from 'crypto-js/md5';
import { diffLines } from 'diff'
import { UserEvent } from '../../types/report';

export interface IRecommendFileChange {
  codeBlockId: string
  filePath: string
  searchCodes: string[]
  replacedCodes: string[]
  language: string
  createdFilePaths?: string[]
  messageId?: string // 创建文件时，唯一索引
}

export interface IRecommendFileChangeRecord {
  [filePath: string]: {
    [codeBlockId: string]: IRecommendFileChange
  }
}

interface IProps {
  recommendFileChanges: IRecommendFileChangeRecord
  data: {
    message: ChatMessage;
    sessionId: string;
  }
}

enum EPreviewMode {
  TREE,
  LIST,
}

enum EFileApplyStatus {
  UN_APPLIED,
  PART_APPLIED,
  FUll_APPLIED,
}


const FileRecommendApplyPanel = (props: IProps) => {
  const { recommendFileChanges, data } = props
  const [previewMode, setPreviewMode] = useState<EPreviewMode>(EPreviewMode.LIST)
  const [expand, setExpand] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const { postMessage } = usePostMessage();
  const [
    appliedCodeBlocks,
    createdFilePaths
  ] = useUserActionStore((state) => [
    state.appliedCodeBlocks,
    state.createdFilePaths
  ]);
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const [chatType] = useChatStore((state) => [state.chatType]);
  const [isSmallScreen] = useMediaQuery(MediumScreenWidth);
  const { toast } = useCustomToast();

  const messageId = useMemo(() => {
    return data.message.id || ''
  }, [data.message])

  const fileChanges = useMemo(() => {
    const newChanges: IRecommendFileChangeRecord = {}
    Object.keys(recommendFileChanges).forEach(filePath => {
      if (!newChanges[filePath]) newChanges[filePath] = {}
      Object.keys(recommendFileChanges[filePath]).forEach(codeBlockId => {
        const target = recommendFileChanges[filePath][codeBlockId]
        let fixedFilePath = target.filePath
        if (workspaceInfo.workspace && fixedFilePath.includes(workspaceInfo.workspace)) {
          fixedFilePath = fixedFilePath.replace(workspaceInfo.workspace, '').replace(/^\//, '')
        }
        newChanges[filePath][codeBlockId] = {
          ...target,
          filePath: fixedFilePath,
          createdFilePaths: createdFilePaths[messageId] || [],
          messageId: messageId,
        }
      })
    })
    return newChanges
  }, [createdFilePaths, messageId, recommendFileChanges, workspaceInfo.workspace])

  // 获取应用状态
  const getFileApplyStatus = useCallback((
    fileChange: {[codeBlockId: string]: IRecommendFileChange},
  ) => {
    try {
      const appliedBlocks = appliedCodeBlocks?.[messageId] || []
      const existedBlocks: string[] = Object.keys(fileChange||{})
      let changedCount = 0
      appliedBlocks?.forEach((blockId: string) => {
        if (existedBlocks.includes(blockId)) {
          changedCount++
        }
      })
      if (changedCount === 0) return EFileApplyStatus.UN_APPLIED
      else if (changedCount !== existedBlocks.length) return EFileApplyStatus.PART_APPLIED
      return EFileApplyStatus.FUll_APPLIED
    } catch(e) {
      return EFileApplyStatus.UN_APPLIED
    }
  }, [appliedCodeBlocks, messageId])

  const onApplyOrRevertCode = useCallback((
    fileChange: {[codeBlockId: string]: IRecommendFileChange},
    type: 'apply' | 'revert',
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.stopPropagation()
    if (!fileChange) {
      return toast({
        title: `抱歉，暂时无法找到修改文件位置！`,
        status: 'warning',
        duration: 2000,
      });
    }
    const codeBlockIds: string[] = []
    const replaceCodedes: string[] = []
    const searchCodes: string[] = []
    Object.keys(fileChange).forEach(codeId => {
      codeBlockIds.push(codeId)
      if (type === 'apply') {
        replaceCodedes.push(...fileChange[codeId].replacedCodes)
      } else {
        searchCodes.push(...fileChange[codeId].replacedCodes)
      }
    })
    postMessage({
      type: BroadcastActions.APPLY_SINGLE_CHANGES,
      data: {
        type,
        diffId: md5(codeBlockIds.join('-')).toString(),
        codeBlockIds: codeBlockIds,
        fileChange: fileChange
      },
    });
    // 上报应用情况
    if (type === 'apply') {
      userReporter.report({
        event: UserEvent.CODE_CHAT_SINGLE_APPLY_EDIT,
        extends: {
          session_id: data.sessionId,
          message_id: messageId,
          repoUrl: workspaceInfo.repoUrl,
          repoName: workspaceInfo.repoName,
          chat_type: chatType,
          ...countGodeGenerate(replaceCodedes.join('\n')),
        },
      });
    } else if (type === 'revert') {
      userReporter.report({
        event: UserEvent.CODE_CHAT_SINGLE_REVERT_EDIT,
        extends: {
          session_id: data.sessionId,
          message_id: messageId,
          repoUrl: workspaceInfo.repoUrl,
          repoName: workspaceInfo.repoName,
          chat_type: chatType,
          ...countGodeGenerate(searchCodes.join('\n')),
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postMessage, data.sessionId, messageId, workspaceInfo.repoUrl, workspaceInfo.repoName, chatType])


  const renderApplyBtn = useCallback((
    fileChange: {
      [codeBlockId: string]: IRecommendFileChange;
    },
    curPath: string
  ) => {
    const status = getFileApplyStatus(fileChange)
    switch(status) {
      case EFileApplyStatus.PART_APPLIED: {
        return (
          <>
            <Tooltip label='当前部分代码被应用，点击即可全部应用'>
              <IconButton
                aria-label="全部应用"
                size="xl"
                icon={<><Icon as={FiPenTool} color={'green.500'}/><Box marginLeft={1} fontSize={12}>全应用</Box></>}
                bg="none"
                padding={1}
                onClick={(e) => {
                  onApplyOrRevertCode(fileChange, 'apply', e)
                }}
                color="text.default"
              />
            </Tooltip>
            <Tooltip label='撤销应用'>
              <IconButton
                aria-label="撤销应用"
                size="xl"
                icon={<><Icon as={RxReset} color={'red.500'} /><Box marginLeft={1} fontSize={12}>撤销</Box></>}
                bg="none"
                padding={1}
                onClick={(e) => onApplyOrRevertCode(fileChange, 'revert', e)}
                color="text.default"
              />
            </Tooltip>
          </>
        )
      }
      case EFileApplyStatus.FUll_APPLIED: {
        return (
          <>
            <Tooltip label='撤销应用'>
              <IconButton
                aria-label="撤销应用"
                size="xl"
                icon={<><Icon as={RxReset} color={'red.500'} /><Box marginLeft={1} fontSize={12}>撤销</Box></>}
                bg="none"
                padding={1}
                onClick={(e) => onApplyOrRevertCode(fileChange, 'revert', e)}
                color="text.default"
              />
            </Tooltip>
          </>
        )
      }
      default: {
        return (
          <>
            <Tooltip label='查看diff'>
              <IconButton
                aria-label="查看diff"
                size="xl"
                icon={<><Icon as={AiOutlineDiff} /><Box marginLeft={1} fontSize={12}>查看diff</Box></>}
                bg="none"
                padding={1}
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewFileChange(fileChange, curPath)
                }}
                color="text.default"
              />
            </Tooltip>
            <Tooltip label='应用修改'>
              <IconButton
                aria-label="应用修改"
                size="xl"
                icon={<><Icon as={FiCheck} color={'green.500'}/><Box marginLeft={1} fontSize={12}>应用修改</Box></>}
                bg="none"
                padding={1}
                onClick={(e) => onApplyOrRevertCode(fileChange, 'apply', e)}
                color="text.default"
              />
            </Tooltip>
          </>
        )
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getFileApplyStatus, onApplyOrRevertCode])

  const renderChangedLines = useCallback((
    fileChange: {
      [codeBlockId: string]: IRecommendFileChange;
    }
  ) => {
    const status = getFileApplyStatus(fileChange)
    if ([EFileApplyStatus.FUll_APPLIED, EFileApplyStatus.PART_APPLIED].includes(status)) {
      const hasCompleted = status === EFileApplyStatus.FUll_APPLIED
      return (
        <div className={`${hasCompleted ? 'text-green-500' : 'text-yellow-500'} flex items-center scale-[.8]`}>
          <Icon as={hasCompleted ? RxCheckCircled : FiMinusCircle} mr={1}/>
          <span className='text-nowrap'>{ hasCompleted ? '已应用' : '部分应用' }</span>
        </div>
      )
    }
    const changedLines = { add: 0, delete: 0 }
    const curSearchCodes: string[] = []
    const curReplaceCodes: string[] = []
    Object.keys(fileChange||{}).forEach(blockId => {
      curSearchCodes.push(...fileChange[blockId].searchCodes)
      curReplaceCodes.push(...fileChange[blockId].replacedCodes)
    })
    const diffInfo = diffLines(curSearchCodes.join('\n'), curReplaceCodes.join('\n'))
    diffInfo.forEach(d => {
      if (d.added) {
        changedLines.add += (d.count || 0)
      } else if (d.removed) {
        changedLines.delete += (d.count || 0)
      }
    })
    return (
      <div className='flex ml-2'>
        <div className={`text-green-500 ${!changedLines.add && 'hidden'} mr-1 text-xs font-bold`}>
          +{changedLines.add}
        </div>
        <div className={`text-red-600 ${!changedLines.delete && 'hidden'} text-xs font-bold`}>
          -{changedLines.delete}
        </div>
      </div>
    )
  }, [getFileApplyStatus])

  const onApplyAllChanges = useCallback((
    type: 'apply' | 'revert'
  ) => {
    let chars = 0;
    let lines = 0;
    const appliedBlocks = appliedCodeBlocks?.[messageId] || []
    const changes: IRecommendFileChangeRecord = {}
    try {
      Object.keys(fileChanges).forEach(path => {
        Object.keys(fileChanges[path]).forEach(codeBlockId => {
          if (appliedBlocks.includes(codeBlockId)) {
            if (!changes[path]) changes[path] = {}
            const change = fileChanges[path][codeBlockId]
            changes[path][codeBlockId] = change
            const { replacedCodes } = change
            const {
              generate_chars,
              generate_lines
            } = countGodeGenerate(replacedCodes.join('\n'));
            chars += generate_chars;
            lines += generate_lines;
          }
        })
      })
    } catch (err) {
      console.error('批量 apply 统计异常')
    }
    postMessage({
      type: BroadcastActions.BATCH_APPLY_CHANGES,
      data: {
        type,
        fileChanges: type === 'apply' ? fileChanges : changes
      },
    });
    
    userReporter.report({
      event: UserEvent.CODE_CHAT_BATCH_APPLY_EDIT,
      extends: {
        session_id: data.sessionId,
        message_id: messageId,
        repoUrl: workspaceInfo.repoUrl,
        repoName: workspaceInfo.repoName,
        generate_chars: chars,
        generate_lines: lines,
        chat_type: chatType
      },
    });
  }, [appliedCodeBlocks, chatType, data.sessionId, fileChanges, messageId, postMessage, workspaceInfo.repoName, workspaceInfo.repoUrl])

  const onPreviewFileChange = useCallback((
    fileChange: {[codeBlockId: string]: IRecommendFileChange},
    filePath: string
  ) => {
    let curLanguage = ''
    const blockIds: string[] = []
    const curCodes: string[] = []
    const newCodes: string[] = []
    Object.keys(fileChange).forEach(id => {
      const { codeBlockId, searchCodes, replacedCodes, language } = fileChange[id]
      curCodes.push(...searchCodes)
      newCodes.push(...replacedCodes)
      blockIds.push(codeBlockId)
      curLanguage = language
    })
    postMessage({
      type: BroadcastActions.PREVIEW_DIFF_CODE,
      data: {
        diffId: md5(blockIds.join('-')).toString(),
        filePath,
        codeBlockId: blockIds?.[0],
        searchCodes: curCodes,
        replacedCodes: newCodes,
        messageId: messageId || '',
        createdFilePaths: createdFilePaths[messageId] || [],
        language: curLanguage,
        fileChange
      },
    });
  }, [createdFilePaths, messageId, postMessage])

  const [treeData, defaultExpandedKeys] = useMemo(() => {
    const result: TreeNode[] = []
    let defaultExpandKeys: string[] = []
    const nodeRecord: Record<string, TreeNode> = {}
    Object.keys(fileChanges).forEach(p => {
      const curPath = p.replace(/\\/g, '/')
      const paths = curPath.split('/').filter(i => !!i.trim())
      paths.reduce((path: string, fileName: string, index: number, self) => {
        // 修复模型路径返回不稳定
        const curPath = path + `${index===0?'':'/'}${fileName}`
        const isLeaf = self.length === (index + 1)
        let fileChange: {
          [codeBlockId: string]: IRecommendFileChange;
        } = {}
        let realPath = curPath
        if (isLeaf) {
          if (fileChanges[curPath]) {
            fileChange = fileChanges[curPath]
          } else if (fileChanges[ `/${curPath}`] ) {
            fileChange = fileChanges[ `/${curPath}`]
            realPath = `/${curPath}`
          }
        }
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
                      {fileChange && <span className='mt-[4px]'>{renderChangedLines(fileChange||{})}</span>}
                    </div>
                    <span className={`hover-visible ml-auto`}>
                      {
                        renderApplyBtn(fileChange, realPath)
                      }
                    </span>
                  </div>
                )
              }
            </div>
          ),
          children: [],
          isLeaf,
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
  }, [fileChanges, renderApplyBtn, renderChangedLines])

  useEffect(() => {
    setExpandedKeys(defaultExpandedKeys)
  }, [defaultExpandedKeys])

  const renderList = useCallback(() => {
    return Object.keys(fileChanges)
      .map((path: string, index) => {
        const paths = path.split('/')
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
                  type: 'OPEN_FILE',
                  data: {
                    filePath: path,
                    code: '',
                  },
                })
              }}
            >
              <div
                style={{width: 'calc(100% - 80px)'}}
                className='w-full space-x-1 relative leading-6 py-1 flex items-center flex-1'
              >
                <Icon className='mt-1 ml-2' as={RiFile3Line} color={'gray.400'} />
                <Tooltip label={path}>
                  <span className='truncate'>{displayPath}</span>
                </Tooltip>
                {renderChangedLines(fileChanges[path]||{})}
              </div>
              <span className={`hover-visible ml-[10px]`}>
                {renderApplyBtn(fileChanges[path], path)}
              </span>
            </Box>
          </Box>
        )
      })
  }, [fileChanges, postMessage, renderApplyBtn, renderChangedLines])

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
          <span className='text-[#3e81F7] font-bold px-1'>{Object.keys(fileChanges).length}</span>
          <span>个文件变更</span>
        </Box>
        <Box className='space-x-2 flex'>
          <Button
              size={'sm'}
              onClick={() => setPreviewMode(previewMode === EPreviewMode.LIST ? EPreviewMode.TREE : EPreviewMode.LIST)}
            >
            <Icon as={previewMode === EPreviewMode.TREE ? RiFileList2Line : RiNodeTree} size={'xs'} />
            <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>{previewMode === EPreviewMode.TREE ? '列表' : '树层'}</span>
          </Button>
          <Tooltip label='回退后，本次消息的所有应用内容将被撤销'>
            <Button
              size={'sm'}
              onClick={() => onApplyAllChanges('revert')}
            >
              <Icon as={RxReset} size={'xs'} />
              <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>回退全部</span>
            </Button>
          </Tooltip>
          <Button
            size={'sm'}
            onClick={() => onApplyAllChanges('apply')}
          >
            <Icon as={FiPenTool} size={'xs'} />
            <span className={`ml-1 ${isSmallScreen && 'hidden'}`}>应用所有修改</span>
          </Button>
        </Box>
        </Box>
        <Box className={!expand ? '' : 'hidden'} py={3} px={4}>
          {
            previewMode === EPreviewMode.TREE
              ? (
                <Tree
                  dataSource={treeData}
                  selectable
                  expandedKeys={expandedKeys}
                  onExpand={setExpandedKeys}
                  onClick={(node) => {
                    if (node.isLeaf) {
                      postMessage({
                        type: 'OPEN_FILE',
                        data: {
                          filePath: node.key,
                          code: '',
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

export default FileRecommendApplyPanel;
