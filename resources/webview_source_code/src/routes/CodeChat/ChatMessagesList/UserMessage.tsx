import { useCallback, useMemo, useState, useRef } from 'react';
import { useAuthStore } from "../../../store/auth";
import { FileItem, FolderItem, IMultiAttachment, useChatAttach, useChatStore, useChatStreamStore } from "../../../store/chat";
import { ChatMessage, ChatMessageProps } from "./types";
import { ChatMessageAttachType, ChatMessageContent, ChatMessageContentImageUrl, ChatMessageContentText, CodeBaseMeta, MultipleAttach, NetworkModelAttach } from '../../../services';
import { mentionRegexGlobal } from '../../../utils/chatMention';
import { Avatar, Box, Button, ButtonGroup, Checkbox, Flex, IconButton, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverFooter, PopoverHeader, PopoverTrigger, Tag, TagLabel, TagLeftIcon, Tooltip, useOutsideClick } from '@chakra-ui/react';
import { TbSparkles } from 'react-icons/tb';
import { RiFileAddLine, RiFileEditLine } from 'react-icons/ri';
import { AttachType, CodeBase } from '../../../store/attaches';
import { FaAdjust, FaRegFile, FaRegFolder } from 'react-icons/fa';
import UserImg from '../../../assets/user.png';
import ImagePreview from '../../../components/ImagePreview';
import UserMarkdown from '../../../components/Markdown/UserMarkdown';
import ChatCodeBlock from '../ChatCodeBlock';
import { TbArrowBackUp, TbBriefcase, TbDatabase } from 'react-icons/tb';
import { Docset, DocsetMeta } from '../../../services/docsets';
import { IoIosGitNetwork } from 'react-icons/io';
import { GrBook } from 'react-icons/gr';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import Icon from '../../../components/Icon';
import { createNewSession } from '../../../utils/chat';
import { useFilteredAttach } from '../ChatTypeAhead/Attach/Hooks/useFilteredAttach';
import { useChatConfig } from '../../../store/chat-config';

export default function ChatUserMessage(
  props: ChatMessageProps & {
    message: ChatMessage;
    isShare?: boolean;
    selectedMessageIds?: Set<string>;
    onToggleMessage?: (messageId: string) => void;
  },
) {
  const { message, isShare, selectedMessageIds, onToggleMessage } = props;
  const username = useAuthStore((state) => state.username);
  const displayName = useAuthStore((state) => state.displayName);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);

  const [isShowAction, setIsShowAction] = useState(false);
  const currentSession = useChatStore((state) => state.currentSession());
  const onNewSession = useChatStore((state) => state.onNewSession);
  const chatType = useChatStore((state) => state.chatType);
  const updateAttachs = useChatAttach((state) => state.update);
  const [isOpen, setIsOpen] = useState(false);
  const { postMessage } = usePostMessage();
  const ref = useRef<HTMLDivElement>(null);
  const filterAttachHook = useFilteredAttach()
  const enableCodeMapSearch = useChatConfig((state) => state.enableCodeMapSearch);
  const enableKnowledgeLibSearch = useChatConfig((state) => state.enableKnowledgeLibSearch);

  const attachType = useMemo(() => {
    if (!message?.attachs?.length) return '';
    switch (message.attachs[0].type) {
      case ChatMessageAttachType.Docset: {
        return '知识库';
      }
      case ChatMessageAttachType.CodeBase: {
        return '代码地图';
      }
      case ChatMessageAttachType.NetworkModel: {
        return '联网';
      }
    }
  }, [message.attachs]);

  const hasShortPrombt = useMemo(() => {
    return !!message?.shortcutPrompt?._id
  }, [message?.shortcutPrompt?._id])

  const content = useMemo(() => {
    let markdownContent = ''
    if (typeof message.content === 'string') {
      markdownContent = message.content;
    } else {
      markdownContent = (message.content[0] as ChatMessageContentText).text;
    }
    if (message.skillPrompt) {
      markdownContent = markdownContent.replace(/<activated_skill[\s\S]*?<\/activated_skill>\s*/g, '').trim();
    }
    try {
      markdownContent = markdownContent.replace(mentionRegexGlobal, (_, mention) => {
        return "`" + `@${mention}` + "`"
      })
    } catch (err) { console.error(err) }
    return markdownContent
  }, [message.content, message.skillPrompt]);

  const images = useMemo(() => {
    if (typeof message.content === 'string') return;
    return message.content
      .filter((i) => i.type === ChatMessageContent.ImageUrl)
      .map((i) => (i as ChatMessageContentImageUrl).image_url.url);
  }, [message.content]);

  useOutsideClick({
    ref: ref,
    handler: () => setIsOpen(false),
  });

  const hasAttach = useMemo(() => {
    if (message.pluginApp) return true
    if (message.mcpPrompt) return true
    if (message.skillPrompt) return true
    if (hasShortPrombt) return true
    if (message?.attachs?.length) {
      const multiAttachs = message?.attachs?.find((attach) => attach.type === ChatMessageAttachType.MultiAttachment)
      if (!multiAttachs) return true
      const { attachs } = multiAttachs as MultipleAttach
      if (!attachs) return false
      const { dataSource } = attachs as IMultiAttachment
      if (!dataSource.filter(i => ![AttachType.ImageUrl].includes(i.attachType)).length) return false
      return true
    }
    return false
  }, [message.pluginApp, message.mcpPrompt, message.skillPrompt, message?.attachs, hasShortPrombt])

  const handleNewSession = useCallback(() => {
    if (!currentSession || !message.id) return;
    const newMessages = createNewSession(message, currentSession, chatType, true);
    void onNewSession(newMessages);
  }, [message, currentSession, onNewSession, chatType]);

  const isCompressionSummary = message.isCompressionSummary || false;

  // 检查消息是否被选中
  const isSelected = useMemo(() => {
    return message.id !== undefined && (selectedMessageIds?.has(message.id) ?? false);
  }, [selectedMessageIds, message.id]);

  // 切换选中状态
  const handleToggle = useCallback(() => {
    if (onToggleMessage && message.id !== undefined) {
      onToggleMessage(message.id);
    }
  }, [onToggleMessage, message.id]);

  // 在分享模式下是否显示 checkbox
  const showCheckbox = isShare && selectedMessageIds !== undefined && onToggleMessage !== undefined;

  const renderAction = useMemo(() => {
    return (isShowAction || isOpen) && !isShare ? (
      <Box display="flex" alignItems="center" fontSize={'14px'}>
        <Tooltip label="编辑">
          <IconButton
            aria-label="编辑"
            variant="ghost"
            icon={<Icon as={RiFileEditLine} size="sm" />}
            isDisabled={isStreaming || isSearching}
            onClick={() => {
              props.onResetPrompt?.(content.replace(/`/g, ""))
              const originalAttachs = message?._originalRequestData?.attachs
              if (originalAttachs) {
                if (chatType === 'codebase') {
                  if (!enableKnowledgeLibSearch) {
                    filterAttachHook.filterAttachesByAttachType(originalAttachs, [AttachType.Docset, AttachType.CodeBase])
                    return
                  } else if (!enableCodeMapSearch) {
                    filterAttachHook.filterAttachesByAttachType(originalAttachs, [AttachType.CodeBase])
                    return
                  }
                }
                updateAttachs(originalAttachs)
              }
            }}
            color="text.default"
          />
        </Tooltip>
        {!message.isCompressed && (
          <Tooltip label="从此处重新发起对话">
            <IconButton
              aria-label="从此处重新发起对话"
              variant="ghost"
              size="sm"
              icon={<Icon as={RiFileAddLine} size="sm" />}
              isDisabled={isStreaming || isSearching}
              onClick={() => {
                if (message._originalRequestData?.attachs) {
                  updateAttachs(message._originalRequestData?.attachs);
                }
                props.onResetPrompt?.(content);
                handleNewSession();
              }}
              color="text.default"
            />
          </Tooltip>
        )}
        {
          message.checkPointFiles && (
            <Tooltip label="回退文件">
              <div ref={ref}>
                <Popover placement="bottom" closeOnBlur={true} isOpen={isOpen} isLazy>
                  <PopoverTrigger>
                    <IconButton
                      aria-label="回退文件"
                      variant="ghost"
                      size="sm"
                      icon={<Icon as={TbArrowBackUp} size="sm" />}
                      isDisabled={isStreaming || isSearching}
                      onClick={() => {
                        setIsOpen(true);
                      }}
                      color="text.default"
                    />
                  </PopoverTrigger>
                  <PopoverContent>
                    <PopoverHeader pt={4} fontWeight="bold" border="0">
                      回退文件修改
                    </PopoverHeader>
                    <PopoverArrow />
                    <PopoverBody>
                      <Box mb="1">确定回退吗？以下文件都会被恢复到这次发送前的状态，包括你手动修改的内容：</Box>
                      <Box>
                        {Object.keys(message.checkPointFiles).map((filePath) => (
                          <Box color="#776fff" key={filePath}>{filePath}</Box>
                        ))}
                      </Box>
                    </PopoverBody>
                    <PopoverFooter
                      border="0"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      pb={4}
                    >
                      <ButtonGroup size="sm">
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                          取消
                        </Button>
                        <Button
                          colorScheme="blue"
                          color="white"
                          onClick={() => {
                            const checkPointFiles = message.checkPointFiles || {};
                            const filePaths = Object.keys(checkPointFiles);
                            if (filePaths.length) {
                              postMessage({
                                type: BroadcastActions.BATCH_REVERT_EDIT,
                                data: {
                                  items: filePaths.map((path) => {
                                    const { content, filePath, isCreateFile } = checkPointFiles[path] || {};
                                    return {
                                      filePath,
                                      originalContent: content,
                                      isCreateFile
                                    }
                                  })
                                }
                              })
                            }
                            setIsOpen(false);
                          }}
                        >
                          确定
                        </Button>
                      </ButtonGroup>
                    </PopoverFooter>
                  </PopoverContent>
                </Popover>
              </div>
            </Tooltip>
          )
        }
      </Box>
    ) : null;
  }, [isShowAction, isOpen, isShare, isStreaming, isSearching, message.isCompressed, message.checkPointFiles, message._originalRequestData?.attachs, props, content, chatType, updateAttachs, enableKnowledgeLibSearch, enableCodeMapSearch, filterAttachHook, handleNewSession, postMessage]);

  const renderMultiAttach = useCallback((attach: MultipleAttach) => {
    if (attach.type !== ChatMessageAttachType.MultiAttachment) return null
    const { attachs } = attach as MultipleAttach
    const { dataSource } = attachs as IMultiAttachment
    if (!dataSource.length) return null
    // 兼容旧格式展示
    const newDataSource: any[] = []
    dataSource.forEach((item: any) => {
      if (item.attachType === AttachType.File) {
        if (Array.isArray(item?.attachFiles)) {
          item.attachFiles.forEach((file: any) => {
            newDataSource.push({
              ...file,
              attachType: AttachType.File
            })
          })
        } else {
          newDataSource.push(item)
        }
      } else if (item.attachType === AttachType.Folder) {
        if (Array.isArray(item?.attachFolders)) {
          item.attachFolders.forEach((folder: any) => {
            newDataSource.push({
              ...folder,
              attachType: AttachType.Folder
            })
          })
        } else {
          newDataSource.push(item)
        }
      } else {
        newDataSource.push(item)
      }
    })
    return (
      <Box display="flex" alignItems="center">
        {/* <span className="mr-1">检索: </span> */}
        <span className='space-x-2 flex'>
          {newDataSource.map(d => {
            switch (d?.attachType) {
              case AttachType.Problems: {
                return (
                  <Flex gap={1} alignItems="center" isTruncated>
                    <FaAdjust />
                    问题
                  </Flex>
                )
              }
              case AttachType.Folder: {
                const folder = d as FolderItem
                return (
                  <Flex gap={1} alignItems="center" isTruncated>
                    <FaRegFolder />
                    {folder.fileName}
                  </Flex>
                )
              }
              case AttachType.File: {
                const file = d as FileItem
                return (
                  <Flex gap={1} alignItems="center" isTruncated>
                    <FaRegFile />
                    {file.fileName}
                  </Flex>
                )
              }
              case AttachType.CodeBase: {
                const codebase = d as CodeBase
                return (
                  <Flex gap={1} alignItems="center" isTruncated>
                    <Box className='text-sm' style={{ zoom: .8 }}>代码地图</Box>
                    {codebase.label}
                  </Flex>
                )
              }
              case AttachType.Docset: {
                const docset = d as Docset
                return (
                  <Flex gap={1} alignItems="center" isTruncated>
                    <span className='text-sm' style={{ zoom: .8 }}>知识库</span>
                    <TbBriefcase />
                    {docset.name}
                  </Flex>
                )
              }
              default: return null
            }
          })}
        </span>
      </Box>
    )
  }, [])

  if (isCompressionSummary) {
    return (
      <Box
        textAlign="center"
        fontSize="xs"
        color="gray.400"
        opacity={0.5}
        my={2}
        userSelect="none"
      >
        Memory: 上文信息已总结
      </Box>
    );
  }

  return (
    <>
      <Flex gap={2} alignItems="flex-start">
        {showCheckbox && (
          <Checkbox
            isChecked={isSelected}
            onChange={handleToggle}
            mt={4}
            size="md"
          />
        )}
        <Box flex={1} width="full">
          <Box
            px={3}
            py={1}
            mb={message.rules?.length || message.attachs?.length || message.pluginApp || message.mcpPrompt || message.skillPrompt || hasShortPrombt ? 0 : 4}
            bg="questionsBgColor"
            borderColor="customBorder"
            borderWidth="1px"
            borderRadius="8px"
            width="full"
            borderBottomRadius={
              message.rules?.length ||
                message.attachs?.length ||
                message.pluginApp ||
                message.mcpPrompt ||
                message.skillPrompt ||
                hasShortPrombt
                ? 'none'
                : '8px'
            }
            onMouseMove={() => {
              setIsShowAction(true);
            }}
            onMouseLeave={() => {
              setIsShowAction(false);
            }}
          >
            <Flex gap={2} h={8} alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center">
                <Avatar w="16px" h="16px" src={UserImg} mr="2" />
                <Box flex={1} color="text.secondary" fontSize="12px">
                  {displayName || username}
                </Box>
              </Box>
              <Box>{renderAction}</Box>
            </Flex>
            <Box
              className="mx-0 p-2 px-0"
              color="text.primary"
              data-content={message.content}
            >
              {images?.length ? (
                <Box display="flex" gap="2" mb="2">
                  {images?.map((i) => (
                    <ImagePreview w="144px" h="144px" key={i} url={i} />
                  ))}
                </Box>
              ) : null}
              <UserMarkdown data={{ message }} CodeRender={ChatCodeBlock}>
                {content}
              </UserMarkdown>
            </Box>
          </Box>
          {hasAttach || !!message?.rules?.length ? (
            <Box
              // p={2}
              px={4}
              py={1}
              gap={2}
              mb={4}
              borderBottomRadius="8px"
              display="flex"
              border="1px"
              bg="questionsBgColor"
              borderColor="customBorder"
              color="text.muted"
              isTruncated
              fontSize="12px"
              borderTop="0px"
            >
              {message.pluginApp && (
                <Flex>
                  <div>
                    <span className="mr-1">插件:</span>
                  </div>
                  <div>
                    <Flex gap={1} alignItems="center" isTruncated>
                      {message.pluginApp.app_name}
                    </Flex>
                  </div>
                </Flex>
              )}
              {message.mcpPrompt && (
                <Flex>
                  <div>
                    <span className="mr-1">MCP:</span>
                  </div>
                  <div>
                    <Flex gap={1} alignItems="center" isTruncated>
                      {message.mcpPrompt.title || `/mcp.${message.mcpPrompt.serverName}.${message.mcpPrompt.promptName}`}
                    </Flex>
                  </div>
                </Flex>
              )}
              {message.skillPrompt && (
                <Flex gap={2} alignItems="center">
                  <Tag
                    size="sm"
                    colorScheme="purple"
                    variant="subtle"
                    borderRadius="full"
                  >
                    <TagLeftIcon as={TbSparkles} />
                    <TagLabel>
                      {message.skillPrompt.title || `/${message.skillPrompt.skillName}`}
                    </TagLabel>
                  </Tag>
                  {message.skillPrompt.source && (
                    <Box as="span" fontSize="11px" color="text.muted">
                      {message.skillPrompt.source}
                    </Box>
                  )}
                </Flex>
              )}
              {hasShortPrombt && (
                <Flex>
                  <div>
                    <span className="mr-1" style={{ zoom: .8 }}>快捷指令:</span>
                  </div>
                  <div>
                    <Flex gap={1} alignItems="center" isTruncated>
                      {message?.shortcutPrompt?.title}
                    </Flex>
                  </div>
                </Flex>
              )}
              {currentSession?.chat_type === 'default' &&
                message.attachs?.length && (
                  <Flex>
                    {message.attachs?.map((attach) => {
                      switch (attach.type) {
                        case ChatMessageAttachType.Docset: {
                          const { _id, name } = attach as DocsetMeta;
                          return (
                            <Box display="flex" alignItems="center" key={_id}>
                              <Flex gap={1} alignItems="center" isTruncated>
                                <span className="mr-1">检索: </span>
                                <span>{attachType}</span>
                                <TbBriefcase />
                                {name}
                              </Flex>
                            </Box>
                          );
                        }
                        case ChatMessageAttachType.CodeBase: {
                          const { collection } = attach as CodeBaseMeta;
                          return (
                            <Box
                              display="flex"
                              alignItems="center"
                              key={collection}
                            >
                              <Flex gap={1} alignItems="center" isTruncated>
                                <span className="mr-1">检索: </span>
                                <span>{attachType}</span>
                                <TbDatabase />
                                {collection}
                              </Flex>
                            </Box>
                          );
                        }
                        case ChatMessageAttachType.MultiAttachment: {
                          return renderMultiAttach(attach as MultipleAttach)
                        }
                        case ChatMessageAttachType.NetworkModel: {
                          const { model } = attach as NetworkModelAttach;
                          return (
                            <Box display="flex" alignItems="center" key={model}>
                              <Flex gap={1} alignItems="center" isTruncated>
                                <span className="mr-1">搜索: </span>
                                <span>{attachType}</span>
                                <IoIosGitNetwork />
                              </Flex>
                            </Box>
                          );
                        }
                        case ChatMessageAttachType.KnowledgeAugmentation: {
                          return (
                            <Box
                              display="flex"
                              alignItems="center"
                              key={'KnowledgeAugmentation'}
                            >
                              <Flex gap={1} alignItems="center" isTruncated>
                                <span className="mr-1">检索: </span>
                                <GrBook />
                                {'知识增强'}
                              </Flex>
                            </Box>
                          );
                        }
                      }
                    })}
                  </Flex>
                )}
              {
                currentSession?.chat_type === 'codebase' && !!message.rules?.length && (
                  <Tooltip placement="top" label={<Box>
                    {
                      message.rules.map((rule, index) => {
                        return <Box>{index + 1}. {rule.name}</Box>
                      })
                    }
                  </Box>}>
                    <Flex gap={1} alignItems="center">
                      <span className="mr-1">生效Rules: {message.rules?.length}</span>
                    </Flex>
                  </Tooltip>
                )
              }
              {currentSession?.chat_type === 'codebase' &&
                message.attachs?.length && (
                  <Flex gap={1} alignItems="center">
                    {message.attachs?.map((attach) => renderMultiAttach(attach as any))}
                  </Flex>
                )}

            </Box>
          ) : <Box mb={4} />}
        </Box>
      </Flex>
    </>
  );
}
