import * as React from 'react';
import {
  Box,
  Grid,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  useOutsideClick,
  Tooltip,
  useMediaQuery,
  Icon,
} from '@chakra-ui/react';
import {
  useChatStreamStore,
  useChatAttach,
  useChatStore,
} from '../../store/chat';
import useCustomToast from '../../hooks/useCustomToast';
import { AttachType } from '../../store/attaches';
import { SmallScreenWidth } from '../../const';
import { AiOutlineCheck } from 'react-icons/ai';
import { SiOpenai } from 'react-icons/si';
import { validateBeforeChat } from '../../utils/validateBeforeChat';
import { useAuthStore } from '../../store/auth';
import { useConfigStore } from '../../store/config';
// import { useTheme } from '../../ThemeContext';
import { useMCPModelRestriction } from '../../hooks/useMCPModelRestriction';
import MiniButton from '../../components/MiniButton';

// 导入模型图片
import gptIcon from '../../assets/model/gpt.png';
import claude3Icon from '../../assets/model/claude3.png';
import geminiIcon from '../../assets/model/gemini.png';
import qwenIcon from '../../assets/model/qwen.png';
import deepseekIcon from '../../assets/model/deepseek-avatar.png';
import kimiIcon from '../../assets/model/kimi.png';
import glmIcon from '../../assets/model/zhipu.png';
import { BAI_CHUAN, ChatModel, ChatModelType, ParseImgType } from '../../services/chatModel';
import { useChatConfig } from '../../store/chat-config';
import { useExtensionStore } from '../../store/extension';

// 模型图标映射
const ModelIconMap: Record<ChatModel, any> = {
  [ChatModel.Claude45Opus20251101]: claude3Icon,
  [ChatModel.Claude45Opus20251101Thinking]: claude3Icon,
  [ChatModel.QWen]: qwenIcon,
  [ChatModel.QWenOld]: qwenIcon,
  [ChatModel.GPT4o]: gptIcon,
  [ChatModel.GPT5]: gptIcon,
  [ChatModel.GPT51]: gptIcon,
  [ChatModel.GPT51Codex]: gptIcon,
  [ChatModel.Gpt4]: gptIcon,
  [ChatModel.DEEPSEEK]: deepseekIcon,
  [ChatModel.DeepseekReasoner0120]: deepseekIcon,
  [ChatModel.DeepseekReasonerDistilled0206]: deepseekIcon,
  [ChatModel.Gemini2]: geminiIcon,
  [ChatModel.QWen2]: qwenIcon,
  [ChatModel.GPTo3]: gptIcon,
  [ChatModel.DeepseekReasonerPrivate0218]: deepseekIcon,
  [ChatModel.Claude37Sonnet]: claude3Icon,
  [ChatModel.Claude37SonnetThinking]: claude3Icon,
  [ChatModel.QWQPlus]: qwenIcon,
  [ChatModel.QWQPlus0306]: qwenIcon,
  [ChatModel.Gpt41]: gptIcon,
  [ChatModel.Gemini25]: geminiIcon,
  [ChatModel.Gemini3Flash]: geminiIcon,
  [ChatModel.Gemini3Pro]: geminiIcon,
  [ChatModel.QWen3]: qwenIcon,
  [ChatModel.QWen3Thinking]: qwenIcon,
  [ChatModel.Claude4Opus20250514]: claude3Icon,
  [ChatModel.Claude4Opus20250514Thinking]: claude3Icon,
  [ChatModel.Claude4Sonnet20250514]: claude3Icon,
  [ChatModel.Claude45Sonnet20250929]: claude3Icon,
  [ChatModel.Claude45Sonnet20250929Thinking]: claude3Icon,
  [ChatModel.Claude4Sonnet20250514Thinking]: claude3Icon,
  [ChatModel.KimiK2]: kimiIcon,
  [ChatModel.DeepseekYDV3]: deepseekIcon,
  [ChatModel.DeepseekYDR1]: deepseekIcon,
  [ChatModel.DeepseekYDV31]: deepseekIcon,
  [ChatModel.DeepseekYDR31]: deepseekIcon,
  [ChatModel.Qwen3CoderPlus]: qwenIcon,
  [ChatModel.Glm45]: glmIcon,
  [ChatModel.Claude45Haiku20251001]: claude3Icon,
  [ChatModel.Glm46]: glmIcon,
  [ChatModel.Glm47]: glmIcon,
  [ChatModel.Glm5]: glmIcon,
  [ChatModel.Claude46Opus]: claude3Icon
};

const ChatModelSelector = () => {
  const [isSmallScreen] = useMediaQuery(SmallScreenWidth);
  const [isExtraSmallScreen] = useMediaQuery('(max-width: 380px)');
  const [isAbove460px] = useMediaQuery('(min-width: 461px)');
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const [prePromptCodeBlock, onRemovePrePromptCodeBlock] = useChatStreamStore(
    (state) => [state.prePromptCodeBlock, state.onRemovePrePromptCodeBlock],
  );
  const [isOpenPopover, setIsOpenPopover] = React.useState(false);
  const selectedModel = useChatConfig((state) => state.config.model);
  const updateChatConfig = useChatConfig((state) => state.update);
  const setNormalChatModel = useChatConfig((state) => state.setNormalChatModel);
  const setCodebaseChatModel = useChatConfig((state) => state.setCodebaseChatModel);
  const attachs = useChatAttach((state) => state.attachs);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useCustomToast();
  const [hoverModel, setHoverModel] = React.useState<string>('');
  const chatType = useChatStore((state) => state.chatType);
  const onNewSession = useChatStore((state) => state.onNewSession);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const sessions = useChatStore((state) => state.sessions);
  const updateModel = useChatStore((state) => state.updateModel)
  const authExtends = useAuthStore((state) => state.authExtends);
  const username = useAuthStore((state) => state.username);
  const chatModels = useChatConfig((state) => state.chatModels);

  const currentSession = React.useMemo(() => {
    if (!sessions.size || !currentSessionId) {
      return;
    }
    return sessions.get(currentSessionId);
  }, [sessions, currentSessionId]);

  const modelList = React.useMemo(() => {
    return Object.keys(chatModels) as ChatModel[]
  }, [chatModels])

  const displayModels = React.useMemo(() => {
    return modelList.filter(model => {
      if (!chatModels[model]?.enabled) {
        return false
      }
      const authInfo = chatModels[model]?.authInfo
      if (authInfo?.allowAll) return true
      if (authInfo?.allowedUsers?.includes(username || '')) {
        return true
      }
      if (authInfo?.allowedDepartments?.includes(authExtends.department || '')) {
        return true
      }
      return false
    })
  }, [authExtends.department, chatModels, modelList, username])

  const ChatModelNameMap = React.useMemo(() => {
    return modelList.reduce((pre, model) => {
      pre[model] = chatModels[model]?.title || ''
      return pre
    }, {} as Record<string | ChatModel, string>)
  }, [chatModels, modelList])

  const ChatModelTag = React.useMemo(() => {
    return modelList.reduce((pre, model) => {
      pre[model] = chatModels[model]?.tags || []
      return pre
    }, {} as Record<string | ChatModel, string[]>)
  }, [chatModels, modelList])

  const privateModels = React.useMemo(() => (
    modelList.filter((model: string) => chatModels[model]?.isPrivate)
  ), [chatModels, modelList]) as ChatModel[]

  const publicModels = React.useMemo(() => (
    modelList.filter((model: string) => !chatModels[model]?.isPrivate)
  ), [chatModels, modelList])

  // 使用 MCP 模型限制 hook
  useMCPModelRestriction({
    selectedModel,
    chatType,
    privateModels: privateModels
  });


  const configState = useConfigStore.getState();
  const codeChatModelsSetting = configState.config.codeChatModelsSetting;

  // 根据模型枚举值判断是否显示该模型
  const shouldDisplayModel = React.useCallback(
    (model: ChatModel): boolean => {
      const modelName = ChatModelNameMap[model];

      // 如果模型设置中没有该模型，默认显示
      if (!Object.prototype.hasOwnProperty.call(codeChatModelsSetting, modelName)) {
        return true;
      }
      // 如果设置中有该模型，根据其值决定是否显示
      return codeChatModelsSetting[modelName] !== false;
    },
    [ChatModelNameMap, codeChatModelsSetting]
  );

  // 获取要显示的模型列表
  const getDisplayedModels = React.useCallback(() => {
    return displayModels.filter(model => shouldDisplayModel(model));
  }, [displayModels, shouldDisplayModel]);

  // 渲染模型标签
  const renderModelTags = React.useCallback((model: ChatModel) => {
    if (!ChatModelTag[model] || ChatModelTag[model].length === 0) {
      return null;
    }

    return (
      <>
        {ChatModelTag[model].map((tag, index) => (
          <Box
            key={index}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            ml="2"
            px="2"
            borderRadius="md"
            borderWidth="1px"
            fontSize="xs"
            h="20px"
            color={
              model === hoverModel || model === selectedModel
                ? 'white'
                : 'blue.300'
            }
            borderColor={
              model === hoverModel || model === selectedModel
                ? 'white'
                : 'blue.300'
            }
          >
            {tag}
          </Box>
        ))}
      </>
    );
  }, [ChatModelTag, hoverModel, selectedModel]);

  // 获取过滤后的模型列表 - 基于类型、权限和场景进行过滤
  const getFilteredModels = React.useCallback(
    (modelType: 'public' | 'private') => {
      const isPublic = modelType === 'public';
      const targetModels = isPublic ? publicModels : privateModels;
      const displayedModels = getDisplayedModels();
      const isCodebaseChat = chatType === 'codebase';
      return displayedModels.filter(model => {
        // 首先判断是否属于目标类型模型
        if (!targetModels.includes(model)) {
          return false;
        }
        // codebase 对话仅支持指定模型
        if (isCodebaseChat && ![ChatModelType.CODEBASE, ChatModelType.ALL].includes(chatModels[model]?.chatType)) {
          return false;
        }
        if (!isCodebaseChat && ![ChatModelType.NORMAL, ChatModelType.ALL].includes(chatModels[model]?.chatType)) {
          return false
        }
        return true;
      });
    },
    [publicModels, privateModels, getDisplayedModels, chatType, chatModels]
  );

  const fixedModel = useExtensionStore((state) => state.fixedModel);

  React.useEffect(() => {
    updateChatConfig((config) => {
      // Y3Helper: 有 fixedModel 时，直接锁定到用户配置的模型，不做任何回退
      if (fixedModel) {
        config.model = fixedModel as ChatModel;
        if (chatType === 'codebase') {
          setCodebaseChatModel(config.model);
        } else {
          setNormalChatModel(config.model);
        }
        return;
      }

      const sessionModel = currentSession?.data?.model;

      if (chatType === 'codebase') {
        const hasCodebaseModel = [ChatModelType.CODEBASE, ChatModelType.ALL].includes(chatModels[sessionModel as ChatModel]?.chatType);
        // 仓库智聊: 优先使用会话最后一条消息的模型
        if (hasCodebaseModel && sessionModel && displayModels.includes(sessionModel)) {
          config.model = sessionModel;
        } else if (!hasCodebaseModel || !displayModels.includes(config.model)) {
          if (config.model === ChatModel.DeepseekYDV3) {
            config.model = ChatModel.DeepseekYDV31;
          } else {
            // 如果会话模型不可用,使用默认模型
            config.model = ChatModel.Glm5;
          }
        }
        setCodebaseChatModel(config.model);
      } else {
        // 普通聊天: 优先使用会话最后一条消息的模型
        if (sessionModel && displayModels.includes(sessionModel)) {
          config.model = sessionModel;
        } else if (!displayModels.includes(config.model)) {
          // 如果会话模型不可用,使用默认模型
          config.model = ChatModel.Glm5;
        }

        // 如果有会话模型,进行一些兼容性转换
        if (sessionModel) {
          const messageLength = currentSession?.data?.messages?.length || 0;

          // 如果会话有消息但模型不同，说明用户可能刚刚切换了模型
          // 在这种情况下，我们应该尊重用户的选择，不自动重置
          if (messageLength > 0 && config.model !== sessionModel) {
            // 检查这是否是一个合理的模型切换（例如，从不支持图片到支持图片的模型）
            const configModelSupportsImages = [ParseImgType.BASE64, ParseImgType.URL].includes(chatModels[config.model]?.parseImgType)
            const sessionModelSupportsImages = [ParseImgType.BASE64, ParseImgType.URL].includes(chatModels[sessionModel]?.parseImgType);

            // 如果用户切换到了支持图片的模型，保持用户的选择
            if (configModelSupportsImages && !sessionModelSupportsImages) {
              return;
            }

            // 如果用户在同类型模型间切换（都支持或都不支持图片），也保持用户的选择
            if (configModelSupportsImages === sessionModelSupportsImages) {
              return;
            }
          }

          // 兼容性转换: 旧模型自动升级
          if (![ChatModelType.NORMAL, ChatModelType.ALL].includes(chatModels[sessionModel as ChatModel]?.chatType)
            || !chatModels[sessionModel]?.enabled
          ) {
            config.model = ChatModel.Glm5;
          } else if (sessionModel === ChatModel.QWenOld) {
            config.model = ChatModel.QWen;
          } else if (sessionModel === BAI_CHUAN) {
            config.model = ChatModel.QWen;
          } else if (sessionModel === ChatModel.DeepseekYDV3) {
            config.model = ChatModel.DeepseekYDV31;
          }
          setNormalChatModel(config.model);
        }
      }
    });
  }, [fixedModel, updateChatConfig, currentSession?.data?.model, chatType, currentSession?.data?.messages?.length, displayModels, chatModels, setCodebaseChatModel, setNormalChatModel]);

  const handleChangeModel = React.useCallback(
    (model: ChatModel) => {
      // 正在生成会话，不允许切换模型
      if (isStreaming || isSearching) {
        toast({
          title: 'Y3Maker 正在回复，请稍后再切换会话',
          status: 'warning',
          position: 'top',
          isClosable: true,
        });
        return;
      }

      const sessionModel = currentSession?.data?.model;
      const messageLength = currentSession?.data?.messages?.length;
      updateChatConfig((config) => {
        config.model = model;
      });

      // 同时更新对应聊天类型的缓存模型
      if (chatType === 'codebase') {
        setCodebaseChatModel(model);
      } else {
        setNormalChatModel(model);
      }
      if (publicModels.includes(model)) {
        // 切换到公共的模型的时候，需要验证一下有没有带上 c 和 lpc 的代码块，如有就删掉
        prePromptCodeBlock?.forEach((code, index) => {
          const isNext = validateBeforeChat(
            code.language,
            model,
            authExtends.c_unrestrict,
          );
          if (!isNext) {
            onRemovePrePromptCodeBlock(index);
          }
        });
      }
      // 会话有模型，并且有对话长度的时候才需要分辨公/私模型
      if (sessionModel && messageLength) {
        if ([ChatModel.Gemini3Pro, ChatModel.Gemini25].includes(model) && sessionModel !== ChatModel.Gemini3Pro) {
          onNewSession();
        } else if ([ChatModel.Gemini3Pro, ChatModel.Gemini25].includes(sessionModel) && model.includes('claude') && model.includes('thinking')) {
          onNewSession();
        } else if (privateModels.includes(model)) {
          // 如果是私有模型，判断当前会话的模型是否是私有模型，如果不是，就新建会话
          if (!privateModels.includes(sessionModel)) {
            onNewSession();
          } else {
            // 如果是私有模型，并且当前会话的模型也是私有模型，就直接更新模型
            updateModel(model);
          }
        } else if (publicModels.includes(model)) {
          // 如果是公有模型，判断当前会话的模型是否是公有模型，如果不是，就新建会话
          if (!publicModels.includes(sessionModel)) {
            onNewSession();
          } else {
            // 如果是公有模型，并且当前会话的模型也是公有模型，就直接更新模型
            updateModel(model);
          }
        }
      } else {
        // 如果会话没有模型并且也没有回话长度，直接更新
        updateModel(model);
      }
      setIsOpenPopover(false);
    },
    [
      publicModels,
      privateModels,
      updateChatConfig,
      chatType,
      setCodebaseChatModel,
      setNormalChatModel,
      isStreaming,
      toast,
      isSearching,
      onNewSession,
      prePromptCodeBlock,
      authExtends.c_unrestrict,
      onRemovePrePromptCodeBlock,
      updateModel,
      currentSession?.data?.model,
      currentSession?.data?.messages?.length
    ],
  );

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

  const isDisabledAttachs = React.useMemo(() => {
    if (!attachs) return false;
    return (
      attachs.attachType === AttachType.Docset ||
      attachs.attachType === AttachType.NetworkModel
    );
  }, [attachs]);

  // 模型工具提示
  const modelTooltip = React.useMemo(() => {
    if (selectedModel === ChatModel.DeepseekReasonerDistilled0206) {
      return 'DeepSeek-R1-70b（私有部署）';
    }
    return selectedModel ? ChatModelNameMap[selectedModel] : selectedModel;
  }, [ChatModelNameMap, selectedModel]);

  const getIcon = React.useCallback((model: ChatModel) => {
    if (ModelIconMap[model]) {
      return ModelIconMap[model]
    } else if (chatModels[model]?.icon) {
      return chatModels[model]?.icon
    }
    return ''
  }, [chatModels])

  return (
    <div id="chat-model-selector" data-tour="chat-model-selector" ref={popoverRef}>
      <Popover isLazy placement="top" isOpen={isOpenPopover}>
        <PopoverTrigger>
          <MiniButton
            onClick={() => {}}
            isDisabled={isDisabledAttachs}
            w={isExtraSmallScreen ? '16px' : 'auto'}
            minW={isExtraSmallScreen ? '16px' : 'auto'}
            maxW={isExtraSmallScreen ? '16px' : isAbove460px ? 'none' : '100px'}
            overflow="visible"
            display="flex"
            alignItems="center"
            aria-label="选择模型"
            cursor="default"
          >
            <Tooltip label={modelTooltip} >
              <Box
                display="flex"
                alignItems="center"
                w="100%"
                h="100%"
              >
                {isExtraSmallScreen ? (
                  // 超小屏幕只显示模型图标
                  getIcon(selectedModel) ? (
                    <Box
                      as="img"
                      src={getIcon(selectedModel)}
                      alt="model"
                      w="18px"
                      h="18px"
                      objectFit="contain"
                    />
                  ) : (
                    <Icon as={SiOpenai} w="16px" h="16px" />
                  )
                ) : (
                  <>
                    {selectedModel && ChatModelNameMap[selectedModel] ? (
                      <Box
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        flex="1"
                        minW="0"
                      >
                        {ChatModelNameMap[selectedModel]}
                      </Box>
                    ) : (
                      <Box
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        flex="1"
                        minW="0"
                      >
                        <Text fontSize="12px">选择模型</Text>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Tooltip>
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent w={isSmallScreen ? '140px' : '300px'} fontSize="12px">
          <PopoverBody display="flex" flexDirection="column" py="2" px="0">
            <VStack
              flex={1}
              align="stretch"
              maxH="calc(100vh - 400px)"
              overflowY="scroll"
              spacing={3}
              css={{
                '&::-webkit-scrollbar': {
                  width: '4px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(128, 128, 128, 0.3)',
                  borderRadius: '2px',
                  '&:hover': {
                    background: 'rgba(128, 128, 128, 0.5)',
                  },
                },
                'scrollbar-width': 'thin',
                'scrollbar-color': 'rgba(128, 128, 128, 0.3) transparent',
              }}
            >
              {/* 公有模型部分 */}
              <Box>
                {getFilteredModels('public').map((model) => (
                  <Box
                    pl={4}
                    pr={2}
                    py={1}
                    my={1}
                    alignItems="center"
                    cursor="pointer"
                    _hover={{ bg: 'blue.300' }}
                    bg={selectedModel === model ? 'blue.300' : 'none'}
                    key={model}
                    onClick={() => handleChangeModel(model)}
                    // borderRadius="8px"
                    onMouseEnter={() => setHoverModel(model)}
                    onMouseLeave={() => setHoverModel('')}
                  >
                    <Grid w="full" alignItems="center" templateColumns="auto 1fr auto">
                      {getIcon(model) && (
                        <Box
                          as="img"
                          src={getIcon(model)}
                          alt="model"
                          w="16px"
                          h="16px"
                          mr={2}
                          objectFit="contain"
                        />
                      )}
                      <Text isTruncated title={ChatModelNameMap[model]}>
                        {ChatModelNameMap[model]}
                        {renderModelTags(model)}
                      </Text>
                      {selectedModel === model && (
                        <Icon as={AiOutlineCheck} size="xs" color="#746cec" />
                      )}
                    </Grid>
                  </Box>
                ))}
              </Box>
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </div>
  )
};

export default ChatModelSelector;
