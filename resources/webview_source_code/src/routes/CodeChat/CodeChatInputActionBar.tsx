import * as React from 'react';
import {
  IconButton,
  Tooltip,
  Box,
  // Divider,
  Text,
  // useMediaQuery,
  // Popover,
  // PopoverTrigger,
  // PopoverContent,
  // PopoverBody,
  useOutsideClick,
  // VStack,
  HStack,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Flex,
  // MenuDivider,
  Divider,
} from '@chakra-ui/react';
import Icon from '../../components/Icon';
import MiniButton, { MiniMenuButton } from '../../components/MiniButton';
import { AiOutlineDown, AiOutlinePlus, AiOutlineSend } from 'react-icons/ai';
import stopIcon from '../../assets/stop.svg';
import {
  useChatAttach,
  useChatStore,
  useChatStreamStore,
} from '../../store/chat';
import { AttachType } from '../../store/attaches';
import { IDE, useExtensionStore } from '../../store/extension';
import { useWorkspaceStore } from '../../store/workspace';
import { ChatTypeAheadHandle } from './ChatTypeAhead/ChatTypeAhead';
import { TypeAheadMode } from './ChatTypeAhead/const';
import { useMaskStore } from '../../store/mask';
import ChatMaskOldSelector from './ChatMaskOldSelector/ChatMaskOldSelector';
import ChatModelSelector from './ChatModelSelector';
import { useTheme } from '../../ThemeContext';
import { useChatConfig } from '../../store/chat-config';
// import MaxTokenPopover from './MaxTokenPopover';
import ChatConfigButton from './ChatConfigButton';
// import { TbDotsVertical } from 'react-icons/tb';
// import {
//   SmallScreenWidth,
//   MediumScreenWidth,
//   LargeScreenWidth,
// } from '../../const';
import { masks } from './ChatPromptPanel';
import { FaInternetExplorer } from 'react-icons/fa6';
import { HiOutlineDocumentAdd, HiOutlinePhotograph } from 'react-icons/hi';
import { HandleImageUpload } from '../../components/ImageUpload/ImageUpload';
import { GrBook } from 'react-icons/gr';
import userReporter from '../../utils/report';
import ChatAutoToolbar from './ChatAutoToolbar';
import { UserEvent } from '../../types/report';
import ChatFunctionalToolbar from './ChatFunctionalToolbar';
import { isMacOS } from '../../utils';
import { SubmitKey, useConfigStore } from '../../store/config';
import { BroadcastActions } from '../../PostMessageProvider';
import EventBus, { EBusEvent } from '../../utils/eventbus';
import { ChatModel, ParseImgType } from '../../services/chatModel';
import RulesPanel from '../../components/RulesPanel';
// import { useDocsetStore } from '../../store/docset';
// import { usePostMessage } from '../../PostMessageProvider';

interface CodeChatInputActionBarProps {
  triggerPromptProtalRef: React.RefObject<HTMLDivElement>;
  triggerMaskProtalRef: React.RefObject<HTMLDivElement>;
  promptProtalRef: React.RefObject<ChatTypeAheadHandle>;
  tokenNumber: number;
  triggerPluginProtalRef: React.RefObject<HTMLDivElement>;
  handleTriggerPromptTemplate: () => void;
  uploadImgRef: React.RefObject<HandleImageUpload>;
  onSend?: () => void;
  onStop?: () => void;
}

const CodeChatInputActionBar = (props: CodeChatInputActionBarProps) => {
  const {
    // triggerPromptProtalRef,
    handleTriggerPromptTemplate,
    triggerMaskProtalRef,
    promptProtalRef,
    // tokenNumber,
    uploadImgRef,
    onSend,
    onStop,
  } = props;

  // const { isSmallScreen, isMediumScreen } = useResponsiveLayout();
  // const [isOpenPopover, setIsOpenPopover] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { activeTheme } = useTheme();
  const isLight = activeTheme === 'light';
  const attachs = useChatAttach((state) => state.attachs);
  const updateAttach = useChatAttach((state) => state.update);
  // const [ide] = useExtensionStore((state) => [state.IDE]);
  const ide = useExtensionStore((state) => state.IDE);
  const chatModels = useChatConfig((state) => state.chatModels);
  const [mask] = useMaskStore((state) => [
    state.currentMask(),
    state.isDisabledAttachs(),
  ]);
  const config = useChatConfig((state) => state.config);
  const showImage = React.useMemo(() => {
    return chatModels[config.model]?.parseImgType !== ParseImgType.NONE;
  }, [chatModels, config.model]);
  // const [model] = useChatConfig((state) => [
  //   state.config.model,
  //   state.config.max_tokens,
  // ]);
  const chatType = useChatStore((state) => state.chatType);
  const currentSession = useChatStore((state) => state.currentSession());
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const isStreaming = useChatStreamStore((state) => state.isStreaming);

  // 检查仓库智聊是否应该禁用按钮
  const isCodebaseInputDisabled = React.useMemo(() => {
    if (chatType !== 'codebase') return false;
    if (!workspaceInfo.repoName) return true;
    if (
      currentSession?.chat_repo &&
      currentSession.chat_repo !== workspaceInfo.repoName
    )
      return true;
    return false;
  }, [chatType, workspaceInfo.repoName, currentSession?.chat_repo]);

  const lastMessage = React.useMemo(() => {
    const length = currentSession?.data?.messages?.length || 0;
    const lastIdx = length ? length - 1 : -1;
    return lastIdx !== -1 ? currentSession?.data?.messages[lastIdx] : undefined;
  }, [currentSession?.data?.messages]);

  // const renderMaxTokenPopover = React.useMemo(() => {
  //   if (attachs && attachs.attachType !== AttachType.File) return;
  //   if (!chatModels[model]?.hasComputableToken) {
  //     return;
  //   }
  //   return (
  //     <>
  //       <MaxTokenPopover currentToken={tokenNumber}></MaxTokenPopover>
  //     </>
  //   );
  // }, [attachs, chatModels, model, tokenNumber]);

  // 快捷键选项状态
  const [isShortcutMenuOpen, setIsShortcutMenuOpen] = React.useState(false);
  const submitKey = useConfigStore((state) => state.config.submitKey);
  const updateConfig = useConfigStore((state) => state.updateConfig);

  // 根据操作系统判断显示哪些快捷键选项
  const isMac = isMacOS();

  // 快捷键选项列表
  const shortcutOptions = React.useMemo(() => {
    const options = [
      { key: SubmitKey.Enter, label: 'Enter' },
      {
        key: isMac ? SubmitKey.MetaEnter : SubmitKey.CtrlEnter,
        label: isMac ? 'Cmd + Enter' : 'Ctrl + Enter',
      },
      { key: SubmitKey.ShiftEnter, label: 'Shift + Enter' },
      { key: SubmitKey.AltEnter, label: 'Alt + Enter' },
    ];
    return options;
  }, [isMac]);

  // 更新快捷键
  const handleShortcutChange = React.useCallback(
    (key: SubmitKey) => {
      updateConfig((config) => {
        config.submitKey = key;
      });
      setIsShortcutMenuOpen(false);

      // 通知插件快捷键已更新
      window.parent.postMessage(
        {
          type: BroadcastActions.UPDATE_CHAT_SUBMIT_KEY,
          data: { submitKey: key },
        },
        '*',
      );
    },
    [updateConfig],
  );

  const handleUploadDocs = React.useCallback(() => {
    EventBus.instance.dispatch(EBusEvent.Docs_File_Upload);
  }, []);

  // 发送/中止按钮
  const renderSendButton = React.useMemo(() => {
    // const isCodebaseMode = chatType === 'codebase';

    if (isStreaming) {
      return (
        <MiniButton
          aria-label="中止生成"
          tooltip="中止生成"
          icon={
            <Box
              as="img"
              src={stopIcon}
              alt="stop"
              // w="14px"
              // h="14px"
              objectFit="contain"
            />
          }
          onClick={onStop}
          disabled={
            lastMessage?.isAutoCompressingMessage && !lastMessage?.content
          }
        />
      );
    }

    return (
      <HStack spacing={0}>
        {/* 发送按钮 */}
        <Tooltip label="发送消息">
          <IconButton
            size="xs"
            aria-label="发送消息"
            icon={<Icon as={AiOutlineSend} size="xxs" />}
            bg={isLight ? '#F2F2F2' : '#2C2C2C'}
            color="blue.500"
            w="28px"
            h="20px"
            minW="28px"
            minH="20px"
            p="0"
            _hover={{
              bg: 'blue.600',
              color: 'white',
            }}
            onClick={onSend}
            isDisabled={isCodebaseInputDisabled}
            style={{
              opacity: isCodebaseInputDisabled ? 0.4 : 1,
              pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
            }}
            borderRadius="4px 0 0 4px"
          />
        </Tooltip>

        {/* 快捷键下拉按钮 */}
        <Menu
          isOpen={isShortcutMenuOpen}
          onClose={() => setIsShortcutMenuOpen(false)}
          placement="top"
        >
          <Tooltip label="选择快捷键">
            <MenuButton
              as={IconButton}
              size="xs"
              aria-label="选择快捷键"
              icon={
                <Box
                  transform={
                    isShortcutMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }
                  transition="transform 0.2s"
                >
                  <Icon as={AiOutlineDown} size="xxs" />
                </Box>
              }
              bg={isLight ? '#F2F2F2' : '#2C2C2C'}
              color="blue.500"
              w="20px"
              h="20px"
              minW="20px"
              minH="20px"
              p="0"
              _hover={{
                bg: 'blue.600',
                color: 'white',
              }}
              isDisabled={isCodebaseInputDisabled}
              style={{
                opacity: isCodebaseInputDisabled ? 0.4 : 1,
                pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
              }}
              borderRadius="0 4px 4px 0"
              borderLeft="1px solid"
              borderLeftColor="whiteAlpha.300"
              onClick={() => setIsShortcutMenuOpen(!isShortcutMenuOpen)}
            />
          </Tooltip>
          <MenuList minW="180px">
            {shortcutOptions.map((option) => (
              <MenuItem
                key={option.key}
                onClick={() => handleShortcutChange(option.key)}
                bg={submitKey === option.key ? 'blue.500' : 'transparent'}
                color={submitKey === option.key ? 'white' : 'inherit'}
                _hover={{
                  bg:
                    submitKey === option.key
                      ? 'blue.600'
                      : isLight
                        ? 'gray.100'
                        : 'gray.700',
                }}
                fontSize="12px"
              >
                <HStack justify="space-between" w="100%">
                  <Text>{option.label}</Text>
                  {submitKey === option.key && <Text fontSize="sm">✓</Text>}
                </HStack>
              </MenuItem>
            ))}
          </MenuList>
        </Menu>
      </HStack>
    );
  }, [isStreaming, isLight, onSend, isCodebaseInputDisabled, isShortcutMenuOpen, shortcutOptions, onStop, lastMessage?.isAutoCompressingMessage, lastMessage?.content, submitKey, handleShortcutChange]);

  // 非codebase聊天类型的原有逻辑
  const getIconOrName = React.useCallback(
    (name: string | undefined) => {
      const currentMask = masks.find(
        (masksItem) => masksItem._id === mask?._id,
      );
      if (currentMask) {
        return (
          <Box className="flex items-center">
            <Tooltip label={name}>{currentMask.icon}</Tooltip>
            {/* <Box ml={2}>
              <AiOutlineDown size="12px" />
            </Box> */}
            <Box>
              <Icon
                as={AiOutlineDown}
                w="10px"
                h="10px"
                ml={0.5}
                flexShrink={0}
              />
            </Box>
          </Box>
        );
      } else {
        return (
          <Text maxW="80px" isTruncated>
            {name}
          </Text>
        );
      }
    },
    [mask],
  );

  const renderChatMask = React.useMemo(() => {
    if (ide !== IDE.VisualStudio) {
      return (
        <div id="mask-trigger" ref={triggerMaskProtalRef}>
          <MiniButton
            // size="xs"
            onClick={() => {
              promptProtalRef.current?.trigger(TypeAheadMode.Mask);
            }}
          // color="text.secondary"
          // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
          // h="28px"
          // minH="28px"
          // _hover={{
          //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
          //   color: 'blue.300',
          // }}
          // px="2"
          // fontSize="12px"
          // fontWeight="normal"
          >
            {getIconOrName(mask?.name)}
          </MiniButton>
        </div>
      );
    } else {
      return <ChatMaskOldSelector />;
    }
  }, [getIconOrName, ide, mask?.name, promptProtalRef, triggerMaskProtalRef]);

  // const allButtons = React.useMemo(
  //   () => [
  //     {
  //       id: 'shortcut',
  //       visibleOn: ['medium', 'large'],
  //       render: () => (
  //         <div id="shortcut-trigger" ref={triggerPromptProtalRef}>
  //           <Button
  //             size="xs"
  //             display="flex"
  //             alignItems="center"
  //             onClick={handleTriggerPromptTemplate}
  //             color="text.secondary"
  //             bg="none"
  //             _hover={{
  //               bg: 'none',
  //               color: 'blue.300',
  //             }}
  //             px="0"
  //             fontSize="12px"
  //             fontWeight="normal"
  //           >
  //             <Text>/ 指令</Text>
  //           </Button>
  //         </div>
  //       ),
  //     },
  //     {
  //       id: 'mask',
  //       visibleOn: ['medium', 'large'],
  //       render: () => renderChatMask,
  //     },
  //     {
  //       id: 'model',
  //       visibleOn: ['large'],
  //       render: () => <ChatModelSelector />,
  //     },
  //     {
  //       id: 'attach',
  //       visibleOn: ['small', 'medium', 'large'],
  //       render: () => (
  //         <div id="attach-trigger" ref={triggerPromptProtalRef}>
  //           <Button
  //             size="xs"
  //             onClick={() => {
  //               promptProtalRef.current?.trigger(TypeAheadMode.Attach, false);
  //             }}
  //             color="text.secondary"
  //             bg="none"
  //             _hover={{
  //               bg: 'none',
  //               color: 'blue.300',
  //             }}
  //             p="0"
  //             fontSize="12px"
  //             fontWeight="normal"
  //           >
  //             <Text maxW="80px" isTruncated>
  //               @知识
  //             </Text>
  //           </Button>
  //         </div>
  //       ),
  //     },
  //   ],
  //   [
  //     renderChatMask,
  //     triggerPromptProtalRef,
  //     handleTriggerPromptTemplate,
  //     promptProtalRef,
  //   ],
  // );

  // const getCurrentScreenSize = React.useCallback(() => {
  //   if (isSmallScreen) return 'small';
  //   if (isMediumScreen) return 'medium';
  //   return 'large';
  // }, [isSmallScreen, isMediumScreen]);

  // const renderButtons = React.useMemo(() => {
  //   const currentScreenSize = getCurrentScreenSize();
  //   const visibleButtons = allButtons.filter((button) =>
  //     button.visibleOn.includes(currentScreenSize),
  //   );
  //   const hiddenButtons = allButtons.filter(
  //     (button) => !button.visibleOn.includes(currentScreenSize),
  //   );

  //   const renderVisibleButtons = () => (
  //     <>
  //       {visibleButtons.map((button) => (
  //         <React.Fragment key={button.id}>
  //           {button.render()}
  //           <Divider h="14px" orientation="vertical" />
  //         </React.Fragment>
  //       ))}
  //     </>
  //   );

  //   const renderHiddenButtons = () => (
  //     <Popover isOpen={isOpenPopover} placement="top" isLazy>
  //       <PopoverTrigger>
  //         <IconButton
  //           variant="ghost"
  //           aria-label="更多操作"
  //           size="xs"
  //           icon={<Icon as={TbDotsVertical} size="xs" color="text.default" />}
  //           onClick={() => setIsOpenPopover((prev) => !prev)}
  //           color="text.default"
  //         />
  //       </PopoverTrigger>
  //       <PopoverContent w="100px">
  //         <PopoverBody w="100px">
  //           {hiddenButtons.map((button) => (
  //             <Box key={button.id}>{button.render()}</Box>
  //           ))}
  //         </PopoverBody>
  //       </PopoverContent>
  //     </Popover>
  //   );

  //   return (
  //     <>
  //       {renderVisibleButtons()}
  //       {hiddenButtons.length > 0 ? (
  //         <>
  //           {renderHiddenButtons()}
  //           <Divider h="14px" orientation="vertical" />
  //         </>
  //       ) : null}
  //       {renderMaxTokenPopover}
  //     </>
  //   );
  // }, [isOpenPopover, allButtons, renderMaxTokenPopover, getCurrentScreenSize]);

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
      // setIsOpenPopover(false);
    },
  });

  // 渲染codebase聊天类型的UI
  if (chatType === 'codebase') {
    return (
      <Box>
        <Box id="input-toolbox" className="flex justify-between items-center">
          <div ref={popoverRef} className="flex gap-1 items-center">
            {/* 附加信息按钮 */}
            <Menu placement="top">
              <MiniMenuButton
                tooltip="附加信息"
                isDisabled={isCodebaseInputDisabled}
                icon={
                  <Icon
                    as={AiOutlinePlus}
                    size="xs"
                    className="-translate-y-[2px]"
                  />
                }
              ></MiniMenuButton>
              <MenuList>
                <MenuItem
                  onClick={() =>
                    promptProtalRef.current?.trigger(
                      TypeAheadMode.Attach,
                      false,
                    )
                  }
                >
                  <Text>&nbsp;@&nbsp;&nbsp;知识</Text>
                </MenuItem>
                <MenuItem onClick={handleTriggerPromptTemplate}>
                  <Text>&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;指令</Text>
                </MenuItem>
                {showImage && (
                  <MenuItem
                    onClick={() => {
                      if (isCodebaseInputDisabled) return;
                      userReporter.report({
                        event: UserEvent.CODE_CHAT_UPLOAD_IMAGE,
                      });
                      uploadImgRef.current?.handleUpload();
                    }}
                  >
                    <HStack spacing={2}>
                      <Icon as={HiOutlinePhotograph} size="sm" />
                      <Text>图片</Text>
                    </HStack>
                  </MenuItem>
                )}
                <Tooltip label="支持word、pdf、excel、ppt文件">
                  <MenuItem onClick={handleUploadDocs}>
                    <Flex alignItems={'center'}>
                      <Icon as={HiOutlineDocumentAdd} size="sm" />
                      <Text ml={2}>文档</Text>
                    </Flex>
                  </MenuItem>
                </Tooltip>
              </MenuList>
            </Menu>
            <Divider h="14px" mx="1" orientation="vertical" />
            {/* 模型选择器 */}
            <div
              style={{
                opacity: isCodebaseInputDisabled ? 0.4 : 1,
                pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
              }}
            >
              <ChatModelSelector />
            </div>
            <Divider h="14px" mx="1" orientation="vertical" />
            {/* <Divider h="14px" mx="1" orientation="vertical" /> */}

            {/* 知识集选择器 */}
            <RulesPanel />

            <Divider h="14px" mx="1" orientation="vertical" />
            <ChatFunctionalToolbar disabled={isCodebaseInputDisabled} />
            {/* MCP配置 */}
            {/* <Tooltip label="配置MCP"> */}
            {/* <div style={{ opacity: isCodebaseInputDisabled ? 0.4 : 1, pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto' }}>
              <MCPStatus />
            </div> */}
            {/* </Tooltip> */}
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-1">
            {/* <ChatFunctionalToolbar disabled={isCodebaseInputDisabled} /> */}

            {/* Auto配置 */}
            <ChatAutoToolbar disabled={isCodebaseInputDisabled} />

            {/* <Divider h="14px" mx="1" orientation="vertical" /> */}

            {/* 发送/中止按钮 */}
            {renderSendButton}
          </div>
        </Box>
      </Box>
    );
  }

  // 渲染非codebase聊天类型的UI
  return (
    <Box>
      <Box id="input-toolbox" className="flex justify-between items-center">
        <div ref={popoverRef} className="flex gap-1 items-center">
          {/* 附加信息按钮 - 整合/指令、@知识、图片 */}
          <Menu placement="top">
            <MiniMenuButton
              tooltip="附加信息"
              // icon={<Icon as={AiOutlinePlus} />}
              isDisabled={isCodebaseInputDisabled}
              icon={
                <Icon
                  as={AiOutlinePlus}
                  size="xs"
                  className="-translate-y-[2px]"
                />
              }
            ></MiniMenuButton>
            <MenuList>
              <MenuItem
                onClick={() =>
                  promptProtalRef.current?.trigger(TypeAheadMode.Attach, false)
                }
              >
                <Text>&nbsp;@&nbsp;&nbsp;知识</Text>
              </MenuItem>
              <MenuItem onClick={handleTriggerPromptTemplate}>
                <Text>&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;指令</Text>
              </MenuItem>
              {showImage && (
                <MenuItem
                  onClick={() => {
                    userReporter.report({
                      event: UserEvent.CODE_CHAT_UPLOAD_IMAGE,
                    });
                    uploadImgRef.current?.handleUpload();
                  }}
                >
                  <Icon as={HiOutlinePhotograph} mr={2} />
                  <Text>图片</Text>
                </MenuItem>
              )}
              <Tooltip label="支持word、pdf、excel、ppt文件">
                <MenuItem onClick={handleUploadDocs}>
                  <Flex alignItems={'center'}>
                    <Icon as={HiOutlineDocumentAdd} size="sm" />
                    <Text ml={2}>文档</Text>
                  </Flex>
                </MenuItem>
              </Tooltip>
            </MenuList>
          </Menu>
          <Divider h="14px" mx="1" orientation="vertical" />
          {/* 模型选择器 */}
          <ChatModelSelector />
          <Divider h="14px" mx="1" orientation="vertical" />
          {/* 角色选择器 */}
          {renderChatMask}
          {/* <Divider h="14px" mx="1" orientation="vertical" /> */}
          {/* Token数字显示 */}
          {/* {renderMaxTokenPopover} */}
        </div>
        <div className="flex items-center gap-1">
          {/* 联网增强 */}
          <MiniButton
            aria-label="联网增强"
            tooltip="联网增强（开启后，会检索互联网最新资讯增强问答效果）"
            // icon={<Icon as={FaInternetExplorer} />}
            isActive={attachs?.attachType === AttachType.NetworkModel}
            isDisabled={isCodebaseInputDisabled}
            style={{
              opacity: isCodebaseInputDisabled ? 0.4 : 1,
              pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
            }}
            onClick={() => {
              if (isCodebaseInputDisabled) return;
              userReporter.report({
                event: UserEvent.CODE_CHAT_NETWORK_MODEL,
              });
              if (attachs?.attachType === AttachType.NetworkModel) {
                updateAttach(undefined);
              } else {
                updateAttach({
                  attachType: AttachType.NetworkModel,
                  model: ChatModel.Gemini2,
                });
              }
            }}
          >
            <Icon as={FaInternetExplorer} size="xxs" />
          </MiniButton>
          {/* 知识增强 */}
          <MiniButton
            aria-label="知识增强"
            tooltip="知识增强（开启后，会根据问题智能匹配对应的知识库，用知识增强问答效果）"
            // icon={}
            isActive={attachs?.attachType === AttachType.KnowledgeAugmentation}
            isDisabled={isCodebaseInputDisabled}
            style={{
              opacity: isCodebaseInputDisabled ? 0.4 : 1,
              pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
            }}
            onClick={() => {
              if (isCodebaseInputDisabled) return;
              userReporter.report({
                event: UserEvent.CODE_CHAT_KNOWLEDGE_AUGMENTATION,
              });
              if (attachs?.attachType === AttachType.KnowledgeAugmentation) {
                updateAttach(undefined);
              } else {
                updateAttach({
                  attachType: AttachType.KnowledgeAugmentation,
                });
              }
            }}
          >
            <Icon as={GrBook} size="xxs" />
          </MiniButton>
          {attachs?.attachType !== AttachType.Docset && (
            <div
              style={{
                opacity: isCodebaseInputDisabled ? 0.4 : 1,
                pointerEvents: isCodebaseInputDisabled ? 'none' : 'auto',
              }}
            >
              <ChatConfigButton />
            </div>
          )}
          {/* 发送/中止按钮 */}
          {renderSendButton}
        </div>
      </Box>
    </Box>
  );
};

// const useResponsiveLayout = () => {
//   const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
//   const [isMediumScreen] = useMediaQuery(MediumScreenWidth);
//   const [isLargerThan340] = useMediaQuery(LargeScreenWidth);

//   return { isSmallScreen, isMediumScreen, isLargerThan340 };
// };

export default CodeChatInputActionBar;
