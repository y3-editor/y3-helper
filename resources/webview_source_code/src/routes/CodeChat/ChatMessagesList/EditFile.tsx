import { Box, Button, Icon, IconButton, Menu, MenuButton, MenuItem, MenuList, Spinner, Tooltip } from "@chakra-ui/react";
import MemoCodeBlock from "../../../components/Markdown/CodeBlock";
import { FiCheck, FiCopy, FiLogOut, FiX } from "react-icons/fi";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BroadcastActions, usePostMessage } from "../../../PostMessageProvider";
import { TbReload } from "react-icons/tb";
import { useChatApplyStore } from "../../../store/chatApply";
import { GoArrowSwitch, GoFileDiff } from "react-icons/go";
import { RxCheckCircled, RxCircleBackslash, RxCrossCircled } from "react-icons/rx";
import userReporter from "../../../utils/report";
import { CgMoreO } from "react-icons/cg";
import { countGodeGenerate } from "../../../utils";
import { IDE, useExtensionStore } from "../../../store/extension";
import MemoDiffCodeBlock from "../../../components/Markdown/DiffCodeBlock";
import { diffLines } from "diff";
import { useChatStreamStore } from "../../../store/chat";
import { FaStop } from "react-icons/fa6";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { UserEvent } from "../../../types/report";
import { shallow } from "zustand/shallow";
// import { useTheme } from "../../../ThemeContext";

const btn_xs = {
  height: '24px', // 设置按钮高度
  fontSize: '12px', // 设置字体大小
  padding: '2px 4px', // 设置内边距
  fontWeight: 400,
}

const icon_xs = {
  width: '14px',
  height: '14px',
}

export function EditFile(props: {
  type?: 'edit' | 'replace';
  messageId?: string;
  hasResponse: boolean;
  filePath: string;
  isCreateFile?: boolean;
  updateSnippet?: string;
  replaceSnippet?: string;
  toolCallId: string;
  isLatest: boolean;
}) {
  const { postMessage } = usePostMessage();
  const {
    type = 'edit',
    messageId,
    filePath = '',
    isCreateFile,
    updateSnippet = '',
    replaceSnippet = '',
    toolCallId,
    isLatest
  } = props;
  const chatApplyInfo = useChatApplyStore((state) => state.chatApplyInfo);
  const updateChatApplyItem = useChatApplyStore((state) => state.updateChatApplyItem);
  const [
    acceptEdit,
    rejectEdit
  ] = useChatApplyStore((state) => [
    state.acceptEdit,
    state.rejectEdit
  ], shallow);
  const [displayMode, setDisplayMode] = useState<'diff' | 'update' | 'finalResult'>('diff');
  const targetApplyItem = chatApplyInfo[toolCallId];
  const [isExpanded, setIsExpanded] = useState(!!targetApplyItem);
  //  const { activeTheme } = useTheme();

  const [
    isStreaming,
    setApplying,
    onUserSubmit
  ] = useChatStreamStore(
    (state) => [
      state.isStreaming,
      state.setIsApplying,
      state.onUserSubmit
  ]);

  const {
    finalResult = '',
    applying,
    accepted,
    rejected,
    reverted,
    diffInfo,
    beforeEdit = ''
  } = targetApplyItem || {};

  useEffect(() => {
    if (!targetApplyItem) {
      setIsExpanded(false);
    }
  }, [targetApplyItem])

  // TODO: filePath 优先用 toolCallResult，其次用 toolCall，待优化
  const displayedFilePath = useMemo(() => {
    return filePath || targetApplyItem?.filePath || '';
  }, [filePath, targetApplyItem?.filePath]);

  const displayedCode = useMemo(() => {
    if (displayMode === 'finalResult') {
      return finalResult;
    } else {
      return updateSnippet || replaceSnippet;
    }
  }, [displayMode, finalResult, updateSnippet, replaceSnippet]);

  const ide = useExtensionStore((state) => state.IDE);
  const isVsCodeIDE = ide === IDE.VisualStudioCode;

  // TODO: 可能不需要在此处计算
  const language = useMemo(() => {
    try {
      const fileName = displayedFilePath.split('/').slice(-1)[0];
      return fileName.split('.').slice(-1)[0];
    } catch (error) {
      return 'text';
    }
  }, [displayedFilePath])

  const copyToClipboard = useCallback(
    (text: string) => {
      const {
        generate_lines,
        generate_chars
      } = countGodeGenerate(text);
      userReporter.report({
        event: UserEvent.CODE_CHAT_COPY,
        extends: {
          // session_id: currentSession?._id,
          message_id: messageId,
          generate_lines,
          generate_chars,
          chat_type: 'codebase'
        },
      });
      postMessage({
        type: BroadcastActions.CODE_CHAT_COPY_CODE,
        data: {
          // session_id: currentSession?._id,
          message_id: messageId,
          generate_lines: generate_lines,
          generate_chars: generate_chars,
          content: text,
          chat_type: 'codebase'
        }
      })
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: text,
      });
    },
    [postMessage, messageId],
  );

  const insertToEditor = useCallback(
    (text: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_CODE_INSERT,
        extends: {
          // session_id: currentSession?._id,
          message_id: messageId,
          chat_type: 'codebase',
          ...countGodeGenerate(text),
        },
      });
      postMessage({
        type: BroadcastActions.INSERT_TO_EDITOR,
        data: text,
      });
    },
    [postMessage, messageId],
  );

  const insertWithDiff = useCallback(
    (text: string) => {
      userReporter.report({
        event: UserEvent.CODE_CHAT_CODE_MERGE,
        extends: {
          // session_id: currentSession?._id,
          message_id: messageId,
          chat_type: 'codebase',
          ...countGodeGenerate(text),
        },
      });
      postMessage({
        type: BroadcastActions.INSERT_WITH_DIFF,
        data: text,
      });
    },
    [postMessage, messageId],
  );

  const createFileAndInsertCode = useCallback(
    (language: string, text: string, filePath?: string) => {
      postMessage({
        type: BroadcastActions.CREATE_FILE_AND_INSERT_CODE,
        data: {
          language,
          content: text,
          filePath,
        },
      });
    },
    [postMessage],
  );

  const changedLines = useMemo(() => {
    const lines = { add: 0, delete: 0 };
    if (!finalResult) return lines;
    const diffInfo = diffLines(beforeEdit, finalResult || '')
    diffInfo.forEach(d => {
      if (d.added) {
        lines.add += (d.count || 0)
      } else if (d.removed) {
        lines.delete += (d.count || 0)
      }
    })
    return lines
  }, [beforeEdit, finalResult]);

  const metaData = useMemo(() => {
    return {
      filePath: displayedFilePath,
    }
  }, [displayedFilePath])

  const renderMore = useCallback(() => {
    return <Menu>
      <Tooltip label="更多操作">
        <MenuButton>
          <Button
            variant="ghost"
            aria-label="更多"
            size="sm"
            sx={btn_xs}
            color="text.default"
          >
            <Icon as={CgMoreO} sx={icon_xs} size="sm" mr={1.5} />
            更多
          </Button>
        </MenuButton>
      </Tooltip>
      <MenuList>
        <MenuItem
          onClick={() => copyToClipboard(displayedCode)}
        >
          <Icon
            as={FiCopy}
            size="sm"
            className="mt-[-4px] mr-1"
          />
          复制
        </MenuItem>
        <MenuItem
          onClick={() => insertToEditor(displayedCode)}>
          <Icon
            as={FiLogOut}
            size="sm"
            className="mt-[-4px] mr-1"
          />
          插入
        </MenuItem>
        {isVsCodeIDE ? (
          <>
            <MenuItem onClick={() => insertWithDiff(displayedCode)}>
              <Icon
                as={GoFileDiff}
                size="sm"
                className="mt-[-4px] mr-1"
              />
              与代码块合并
            </MenuItem>
            <MenuItem
              onClick={() =>
                createFileAndInsertCode(
                  language,
                  displayedCode,
                  filePath,
                )
              }
            >
              <Icon as={FiLogOut} size="sm" className="mt-[-4px] mr-1" />
              插入到新文件
            </MenuItem>
          </>
        ) : null}
      </MenuList>
    </Menu>
  }, [copyToClipboard, createFileAndInsertCode, displayedCode, filePath, insertToEditor, insertWithDiff, isVsCodeIDE, language])


  const renderSwitch = useCallback(() => {
    return <Menu>
      <Tooltip label="切换展示">
        <MenuButton>
          <IconButton
            aria-label={'切换展示'}
            size="xs"
            icon={<Icon fontSize='14px' as={GoArrowSwitch} />}
            bg="none"
            padding={1}
            color="text.default"
          />
        </MenuButton>
      </Tooltip>
      <MenuList>
        <MenuItem
          onClick={() => {
            setDisplayMode('diff');
          }}
        >
          修改Diff
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDisplayMode('update');
          }}>
          修改描述
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDisplayMode('finalResult');
          }}>
          最终结果
        </MenuItem>
      </MenuList>
    </Menu>
  }, [])

  const renderActionButtons = useCallback(() => {
    return <>
      {
        !accepted && !rejected && finalResult && (
          <Tooltip label="应用修改">
            <IconButton
              aria-label='应用修改'
              size="xs"
              icon={<Icon fontSize='14px' as={FiCheck} />}
              bg="none"
              padding={1}
              onClick={() => {
                acceptEdit(toolCallId);
              }}
              color="green.400"
            />
          </Tooltip>
        )
      }
      {
        !accepted && !rejected && finalResult && (
          <Tooltip label="拒绝修改">
            <IconButton
              aria-label='拒绝修改'
              size="xs"
              icon={<Icon fontSize='14px' as={FiX} />}
              bg="none"
              padding={1}
              onClick={() => {
                rejectEdit(toolCallId);
                onUserSubmit(
                  '',
                  {
                    event: UserEvent.CODE_CHAT_CODEBASE,
                  },
                  undefined,
                  {
                    [toolCallId]: false
                  }
                );
              }}
              color="red.400"
            />
          </Tooltip>
        )
      }
      {/* {
        accepted && (
          <>
            <Tooltip label="撤销修改">
              <IconButton
                aria-label='撤销修改'
                size="xs"
                icon={<Icon fontSize='14px' as={RxReset} />}
                bg="none"
                padding={1}
                onClick={() => {
                  postMessage({
                    type: BroadcastActions.REVERT_EDIT,
                    data: {
                      item: {
                        toolCallId,
                        filePath,
                        finalResult,
                        isCreateFile: isCreateFile
                      }
                    },
                  });
                }}
                color="red.400"
              />
            </Tooltip>
          </>
        )
      } */}
      {
        !accepted && !rejected && (
          <Tooltip label='ReApply'>
            <IconButton
              aria-label='ReApply'
              size="xs"
              icon={<Icon fontSize='14px' as={TbReload} />}
              bg="none"
              padding={1}
              onClick={() => {
                if (type === 'edit') {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.TOOL_CALL,
                      data: {
                        tool_name: 'edit_file',
                        tool_params: {
                          target_file: filePath,
                          code_edit: updateSnippet,
                          is_create_file: isCreateFile
                        },
                        tool_id: toolCallId,
                      },
                    },
                    '*',
                  );
                  setApplying(true);
                } else {
                  window.parent.postMessage(
                    {
                      type: BroadcastActions.TOOL_CALL,
                      data: {
                        tool_name: 'replace_in_file',
                        tool_params: {
                          target_file: filePath,
                          diff: replaceSnippet,
                          is_create_file: isCreateFile
                        },
                        tool_id: toolCallId,
                      },
                    },
                    '*',
                  );
                  setApplying(true);
                }
                updateChatApplyItem(
                  toolCallId,
                  {
                    applying: true,
                  }
                );
                userReporter.report({
                  event: UserEvent.CODE_CHAT_REAPPLY,
                  extends: {
                    filePath: filePath,
                    editSnippet: updateSnippet,
                    replaceSnippet: replaceSnippet,
                    type,
                    tool_id: toolCallId,
                  },
                });
              }}
              color="text.default"
            />
          </Tooltip>
        )
      }
      {
        !accepted && finalResult && (
          <Tooltip label="diff">
            <Button
              variant="ghost"
              aria-label="diff"
              size="sm"
              sx={btn_xs}
              color="text.default"
              onClick={() => {
                postMessage({
                  type: BroadcastActions.PREVIEW_DIFF_EDIT,
                  data: {
                    filePath,
                    beforeEdit,
                    finalResult,
                    toolCallId,
                    isCreateFile
                  },
                });
              }}
            >
              diff
            </Button>
          </Tooltip>
        )
      }
      {
        !!finalResult && renderSwitch()
      }
      {renderMore()}
    </>
  }, [
    finalResult,
    accepted,
    rejected,
    beforeEdit,
    filePath,
    isCreateFile,
    updateSnippet,
    toolCallId,
    renderMore,
    replaceSnippet,
    type,
    acceptEdit,
    rejectEdit,
    onUserSubmit,
    postMessage,
    renderSwitch,
    setApplying,
    updateChatApplyItem,
  ])

  const renderApplying = useCallback(() => {
    return <>
      <Box display={'flex'} as="span" alignItems={'center'}>
        <Spinner size="xs" mr="2px" />
        Applying
      </Box>
      <Tooltip label="中止">
        <IconButton
          aria-label='中止'
          size="xs"
          icon={<Icon fontSize='14px' as={FaStop} />}
          bg="none"
          padding={1}
          onClick={() => {
            postMessage({
              type: BroadcastActions.CANCEL_APPLY,
              data: {
                toolCallId
              },
            });
            updateChatApplyItem(toolCallId, {
              applying: false
            })
          }}
          color="default"
        />
      </Tooltip>
    </>
  }, [postMessage, toolCallId, updateChatApplyItem])

  return <div className="markdown-body">
    <Box bg="answerBgColor">
      <Box
        h="28px"
        display="flex"
        alignItems="center"
        px="2"
        bg="answerBgColor"
        border="1px"
        borderColor="customBorder"
        borderTopRadius="8px"
        color="text.default"
        fontSize="12px"
      >
        <Box display="flex" alignItems="center" overflow="hidden" minWidth="0" flex="1">
          <IconButton
            aria-label="展开/折叠"
            size="md"
            variant="link"
            icon={isExpanded ? <MdExpandLess /> : <MdExpandMore />}
            onClick={() => setIsExpanded(!isExpanded)}
            minW="18px"
            h="24px"
            p={0}
          />
          <Tooltip label={displayedFilePath} placement="top">
            <Box
              color="blue.300"
              cursor="pointer"
              maxWidth="100%"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              display="inline-block"
              onClick={(e: any) => {
                e.stopPropagation();
                postMessage({
                  type: 'OPEN_FILE',
                  data: {
                    filePath: displayedFilePath,
                    code: updateSnippet,
                  },
                });
              }}
            >
              {displayedFilePath.split('/').slice(-1)[0]}
            </Box>
          </Tooltip>
          {
            (diffInfo) && (
              <Box marginLeft={2} display={'flex'}>
                <Box color={'green.500'} hidden={!changedLines.add} fontWeight={700} fontSize={12}>+{changedLines.add}</Box>
                <Box color={'red.600'} hidden={!changedLines.delete} marginLeft={1} fontWeight={700} fontSize={12}>-{changedLines.delete}</Box>
              </Box>
            )
          }
        </Box>
        <div className="flex items-center ml-auto">
          {
            accepted && (
              <Box color={'green.500'} display={'flex'} alignItems={'center'} ml={1} mr={2} flexShrink={0}>
                <Icon as={RxCheckCircled} />
                <Box fontSize={12} ml={1}>已应用</Box>
              </Box>
            )
          }
          {
            rejected && (
              <Box color={'red.400'} display={'flex'} alignItems={'center'} mr={2} flexShrink={0}>
                <Icon as={RxCrossCircled} />
                <Box fontSize={12} ml={1}>已拒绝</Box>
              </Box>
            )
          }
          {
            reverted && (
              <Box color={'gray.400'} display={'flex'} alignItems={'center'} ml={2}>
                <Icon as={RxCircleBackslash} />
                <Box fontSize={12} ml={1}>已回退</Box>
              </Box>
            )
          }
          {
            applying && renderApplying()
          }
          {
            isLatest && !isStreaming && !applying && renderActionButtons()
          }
        </div>
      </Box>
    </Box>
    <pre>
      {
        isExpanded && displayMode === 'diff' && !!diffInfo && (
          <MemoDiffCodeBlock
            language={language}
            value={diffInfo.content || ''}
            addedLines={diffInfo.added || []}
            removedLines={diffInfo.removed || []}
            collapsable={true}
            metaData={metaData}
          />
        )
      }
      {
        isExpanded && (displayMode !== 'diff' || !diffInfo) && (
          <MemoCodeBlock
            language={language}
            value={displayedCode}
            collapsable={true}
            metaData={metaData}
          />
        )
      }
    </pre>
    {/* {
      !accepted && !rejected && !reverted && finalResult && (
        <Box
          display="flex"
          alignItems='center'
          border="1px"
          borderRadius="8px"
          borderColor="customBorder"
          bg="questionsBgColor"
          p="3"
          boxSizing="border-box"
        >
          <Box as='span'
            color={
              activeTheme === ThemeStyle.Light ? '#000000' : '#ccccccef'
            }
           >代码修改待确认</Box>
          <Flex ml='auto' mt={0} gap={3}>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                acceptEdit(toolCallId)
              }}
              color='#776fff'
              padding={'4px'}
              _hover={{ color: '#FFF', bg: '#776fff' }}
            >
              应用
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                  rejectEdit(toolCallId);
                  onUserSubmit(
                    '',
                    {
                      event: UserEvent.CODE_CHAT_CODEBASE,
                    },
                    undefined,
                    {
                      [toolCallId]: false
                    }
                  );
              }}
              color='#776fff'
              padding={'4px'}
              _hover={{ color: '#FFF', bg: '#776fff' }}
            >
              拒绝
            </Button>
          </Flex>
        </Box>
      )
    } */}
  </div>
}
