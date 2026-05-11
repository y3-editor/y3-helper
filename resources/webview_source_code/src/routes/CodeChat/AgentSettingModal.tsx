import * as React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Flex,
  Text,
  Badge,
  Grid,
  Icon,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  Button,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { AiOutlineCheck, AiOutlineDown } from 'react-icons/ai';
import { SiOpenai } from 'react-icons/si';
import { useChatConfig } from '../../store/chat-config';
import { useAuthStore } from '../../store/auth';
import { useConfigStore } from '../../store/config';
import { ThemeStyle, useTheme } from '../../ThemeContext';
import { BUILTIN_AGENTS } from '../../modules/subagent/agents';
import { ChatModel, ChatModelType, IChatModelConfig } from '../../services/chatModel';

// 模型图标（与 ChatModelSelector 保持一致）
import gptIcon from '../../assets/model/gpt.png';
import claude3Icon from '../../assets/model/claude3.png';
import geminiIcon from '../../assets/model/gemini.png';
import qwenIcon from '../../assets/model/qwen.png';
import deepseekIcon from '../../assets/model/deepseek-avatar.png';
import kimiIcon from '../../assets/model/kimi.png';
import glmIcon from '../../assets/model/zhipu.png';

const ModelIconMap: Partial<Record<ChatModel, string>> = {
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
  [ChatModel.Claude46]: claude3Icon,
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
};

interface AgentSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** 占位值：表示用户未配置，回退到 agent 默认 */
const INHERIT_VALUE = '';

/**
 * explore agent 推荐模型列表 (使用 useModel 值)
 * 这些模型经过筛选,具备快速响应和成本友好的特点
 */
const EXPLORE_RECOMMENDED_MODELS = [
  'claude-haiku-4-5-20251001',
  'MiniMax-M2.7',
  'MiniMax-M2.5',
  'glm-5',
  'claude-sonnet-4-5-20250929',
  'kimi-k2.5',
  'gpt-4o-mini-2024-07-18',
];

/**
 * 判断模型是否为 thinking 模型
 * @param config - 模型配置对象
 * @returns true 表示是 thinking 模型,false 表示不是
 *
 * 判断逻辑:
 * 1. config.hasThinking === true
 * 2. config.title 包含 "thinking" (不区分大小写)
 */
function isThinkingModel(config: IChatModelConfig | undefined): boolean {
  if (!config) return false;
  return config.hasThinking === true ||
    (!!config.title && config.title.toLowerCase().includes('thinking'));
}

/**
 * 根据 agent 类型返回允许的模型列表
 * @param agentName - agent 名称
 * @param _chatModels - 完整的模型配置对象
 * @returns 允许的模型 useModel 值集合,或 null 表示无特殊限制
 *
 * 模型过滤策略:
 * - explore: 仅允许 EXPLORE_RECOMMENDED_MODELS 中的 5 个快速模型,且排除所有 thinking 模型
 * - general: 允许所有非 thinking 模型 (hasThinking !== true 或 title 不含 "thinking")
 * - 其他: 无特殊限制,展示所有可用模型
 */
function getAgentAllowedModels(
  agentName: string,
  _chatModels: Record<string, IChatModelConfig>,
): Set<string> | null {
  if (agentName === 'explore') {
    return new Set(EXPLORE_RECOMMENDED_MODELS);
  }

  if (agentName === 'general') {
    // 返回 null 表示"允许所有非 thinking 模型"
    // 在过滤逻辑中额外检查 config.hasThinking !== true
    return null;
  }

  // 其他 agent 类型不限制
  return null;
}

// ---- 单个 Agent 的模型选择器 ----
/**
 * AgentModelPicker - 子代理模型选择器组件
 *
 * 为不同类型的 agent 提供模型选择功能,并根据 agent 类型自动过滤可选模型:
 * - explore agent: 仅显示 5 个推荐的快速响应模型,且排除所有 thinking 模型
 * - general agent: 显示所有非 thinking 模型 (排除 hasThinking === true)
 * - 其他 agent: 显示所有可用模型
 *
 * UI 特性:
 * - explore 推荐模型会显示绿色 "推荐" Badge
 * - 用户选择不推荐的模型时显示橙色警告提示
 * - 模型列表为空时显示友好提示信息
 * - 支持通过 code 或 useModel 匹配模型
 */
interface AgentModelPickerProps {
  agentName: string;
  agentDefaultModel?: string;
}

const AgentModelPicker: React.FC<AgentModelPickerProps> = ({
  agentName,
  // agentDefaultModel,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoverModel, setHoverModel] = React.useState('');

  // key 为 code
  const chatModels = useChatConfig((state) => state.chatModels);
  // 使用的是 useModel
  const subagentModelConfig = useChatConfig((state) => state.subagentModelConfig);
  const setSubagentModelConfig = useChatConfig((state) => state.setSubagentModelConfig);
  const username = useAuthStore((state) => state.username);
  const authExtends = useAuthStore((state) => state.authExtends);
  const configState = useConfigStore.getState();
  const codeChatModelsSetting = configState.config.codeChatModelsSetting;

  const selectedModel = subagentModelConfig?.[agentName] || INHERIT_VALUE;

  /**
   * 将存储的 useModel 值反查回 chatModels 的 code（key）
   * 用于 UI 高亮和 title 显示
   *
   * 优先级: code 直接匹配 > 非 thinking 模型的 useModel > thinking 模型的 useModel
   */
  const selectedModelCode = React.useMemo(() => {
    if (!selectedModel) return INHERIT_VALUE;
    // 若 code 直接命中（无 useModel 字段的模型），直接返回
    if (chatModels[selectedModel]) return selectedModel;

    // 否则遍历反查 useModel === selectedModel 的 code
    // 优先匹配非 thinking 模型,避免混淆
    const matchingKeys = Object.keys(chatModels).filter(
      (key) => chatModels[key]?.useModel === selectedModel
    );

    if (matchingKeys.length === 0) return selectedModel;

    // 优先返回非 thinking 模型
    const nonThinkingKey = matchingKeys.find(
      (key) => !chatModels[key]?.hasThinking
    );

    return nonThinkingKey || matchingKeys[0];
  }, [selectedModel, chatModels]);

  /** 过滤出当前用户可用且已启用的模型配置列表 */
  const displayModels = React.useMemo(() => {
    // 1. 先按原有逻辑过滤(权限、enabled、chatType、codeChatModelsSetting)
    let filtered = Object.values(chatModels).filter((config) => {
      if (!config?.enabled) return false;
      // 仅展示支持 codebase 或 all 的模型（与仓库智聊场景一致）
      if (![ChatModelType.CODEBASE, ChatModelType.ALL].includes(config.chatType))
        return false;
      const authInfo = config.authInfo;
      if (authInfo?.allowAll) return true;
      if (authInfo?.allowedUsers?.includes(username || '')) return true;
      if (authInfo?.allowedDepartments?.includes(authExtends.department || ''))
        return true;
      return false;
    }).filter((config) => {
      // 尊重 codeChatModelsSetting 的显示控制
      const title = config.title || '';
      if (!Object.prototype.hasOwnProperty.call(codeChatModelsSetting, title)) return true;
      return codeChatModelsSetting[title] !== false;
    });

    // 2. 根据 agent 类型进一步过滤
    const allowedModels = getAgentAllowedModels(agentName, chatModels);

    if (agentName === 'explore' && allowedModels) {
      // explore: 仅保留推荐模型 (同时检查 code 和 useModel),且排除 thinking 模型
      filtered = filtered.filter((config) =>
        (allowedModels.has(config.code) ||
        (config.useModel && allowedModels.has(config.useModel))) &&
        !isThinkingModel(config)
      );
    } else if (agentName === 'general') {
      // general: 排除 thinking 模型
      filtered = filtered.filter((config) => !isThinkingModel(config));
    }

    return filtered;
  }, [chatModels, username, authExtends, codeChatModelsSetting, agentName]);

  // const getDefaultLabel = () => {
  //   if (!agentDefaultModel || agentDefaultModel === 'inherit') return '';
  //   return chatModels[agentDefaultModel]?.title || agentDefaultModel;
  // };

  const getSelectedLabel = () => {
    if (!selectedModel) return `默认`;
    return chatModels[selectedModelCode]?.title || selectedModel;
  };

  const handleSelect = (config: IChatModelConfig | '') => {
    // 直接从 config 取 useModel，若无则回退到 code
    const useModelValue = config ? (config.useModel || config.code) : INHERIT_VALUE;
    setSubagentModelConfig(agentName, useModelValue);
    setIsOpen(false);
  };

  /** 检查当前选择的模型是否不在推荐列表中 */
  const isModelNotRecommended = React.useMemo(() => {
    if (!selectedModel) return false; // "默认" 选项,不显示警告

    const allowedModels = getAgentAllowedModels(agentName, chatModels);

    // explore: 检查是否在推荐列表中
    if (agentName === 'explore' && allowedModels) {
      // 检查当前选择的模型是否在过滤后的列表中
      const isInDisplayList = displayModels.some(
        (config) =>
          config.code === selectedModelCode ||
          (config.useModel && config.useModel === selectedModel)
      );
      return !isInDisplayList;
    }

    // general: 检查是否为 thinking 模型
    if (agentName === 'general') {
      const selectedConfig = chatModels[selectedModelCode];
      return isThinkingModel(selectedConfig);
    }

    return false;
  }, [selectedModel, selectedModelCode, agentName, chatModels, displayModels]);

  const renderModelRow = (config: IChatModelConfig) => {
    const isSelected = selectedModelCode === config.code;
    const icon = ModelIconMap[config.code as ChatModel] || config.icon || '';
    const tags = config.tags || [];
    const title = config.title || config.code;

    return (
      <Box
        key={config.code}
        pl={4}
        pr={2}
        py={1}
        my={1}
        alignItems="center"
        cursor="pointer"
        _hover={{ bg: 'blue.300' }}
        bg={isSelected ? 'blue.300' : 'none'}
        onClick={() => handleSelect(config)}
        onMouseEnter={() => setHoverModel(config.code)}
        onMouseLeave={() => setHoverModel('')}
      >
        <Grid w="full" alignItems="center" templateColumns="auto 1fr auto">
          {icon ? (
            <Box
              as="img"
              src={icon}
              alt="model"
              w="16px"
              h="16px"
              mr={2}
              objectFit="contain"
            />
          ) : (
            <Icon as={SiOpenai} w="16px" h="16px" mr={2} />
          )}
          <Text isTruncated title={title} fontSize="12px">
            {title}
            {tags.length > 0 &&
              tags.map((tag, idx) => (
                <Box
                  key={idx}
                  as="span"
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
                    isSelected || hoverModel === config.code ? 'white' : 'blue.300'
                  }
                  borderColor={
                    isSelected || hoverModel === config.code ? 'white' : 'blue.300'
                  }
                >
                  {tag}
                </Box>
              ))}
            {/* explore agent 推荐模型 Badge */}
            {agentName === 'explore' &&
              (EXPLORE_RECOMMENDED_MODELS.includes(config.code) ||
                (config.useModel && EXPLORE_RECOMMENDED_MODELS.includes(config.useModel))) && (
                <Badge
                  ml={2}
                  colorScheme="green"
                  fontSize="xs"
                  px={1.5}
                  py={0.5}
                  borderRadius="sm"
                  variant="solid"
                >
                  推荐
                </Badge>
              )}
          </Text>
          <Icon
            as={AiOutlineCheck}
            size="xs"
            color="#746cec"
            visibility={isSelected ? 'visible' : 'hidden'}
          />
        </Grid>
      </Box>
    );
  };

  return (
    <Popover
      isLazy
      placement="bottom-end"
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="outline"
          rightIcon={<Icon as={AiOutlineDown} w="10px" h="10px" />}
          onClick={() => setIsOpen((prev) => !prev)}
          fontWeight="normal"
          fontSize="13px"
          minW="180px"
          justifyContent="space-between"
        >
          <Text isTruncated maxW="160px">
            {getSelectedLabel()}
          </Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent w="300px" fontSize="12px">
        <PopoverBody display="flex" flexDirection="column" py="2" px="0">
          {/* 默认选项：继承 */}
          <Box
            pl={4}
            pr={2}
            py={1}
            my={1}
            cursor="pointer"
            _hover={{ bg: 'blue.300' }}
            bg={!selectedModel ? 'blue.300' : 'none'}
            onClick={() => handleSelect(INHERIT_VALUE)}
          >
            <Grid w="full" alignItems="center" templateColumns="auto 1fr auto">
              <Box w="16px" h="16px" mr={2} />
              <Text fontSize="12px">默认</Text>
              <Icon
                as={AiOutlineCheck}
                size="xs"
                color="#746cec"
                visibility={!selectedModel ? 'visible' : 'hidden'}
              />
            </Grid>
          </Box>

          <VStack
            align="stretch"
            maxH="calc(100vh - 500px)"
            overflowY="auto"
            spacing={0}
            css={{
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(128,128,128,0.3)',
                borderRadius: '2px',
              },
              'scrollbar-width': 'thin',
              'scrollbar-color': 'rgba(128,128,128,0.3) transparent',
            }}
          >
            {displayModels.length > 0 ? (
              displayModels.map((config) => renderModelRow(config))
            ) : (
              <Text fontSize="sm" color="gray.500" p={4} textAlign="center">
                无可用模型,请选择"默认"选项
              </Text>
            )}
          </VStack>

          {/* 不推荐模型警告提示 */}
          {isModelNotRecommended && (
            <Alert status="warning" mt={2} mx={2} fontSize="xs" borderRadius="md">
              <AlertIcon boxSize="12px" />
              <Text fontSize="xs">
                所选模型 {chatModels[selectedModelCode]?.title || selectedModel} 不再推荐用于此
                agent,建议切换到推荐模型
              </Text>
            </Alert>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

// ---- 主 Modal ----
const AgentSettingModal: React.FC<AgentSettingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeTheme } = useTheme();
  const isDark = activeTheme !== ThemeStyle.Light;
  const cardBg = isDark ? '#1e1e1e' : '#fff';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalOverlay />
      <ModalContent h="100vh" maxH="100vh">
        <ModalHeader>子代理配置</ModalHeader>
        <ModalCloseButton />
        <ModalBody overflowY="auto">
          <Text fontSize="sm" color="gray.500" mb={4}>
            为内置子代理指定独立的 LLM 模型。选择"默认"则根据当前主模型自动选择。
          </Text>

          {BUILTIN_AGENTS.map((agent) => (
            <Box
              key={agent.name}
              mb={3}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              bg={cardBg}
            >
              <Flex alignItems="flex-start" justifyContent="space-between" gap={4}>
                {/* 左侧：名称 + 描述 */}
                <Box flex={1} minW={0}>
                  <Flex alignItems="center" gap={2} mb={1}>
                    <Text
                      fontWeight="medium"
                      fontSize="md"
                      color={isDark ? '#e0e0e0' : '#222'}
                    >
                      {agent.name}
                    </Text>
                    <Badge
                      fontSize="10px"
                      px={1.5}
                      py={0.5}
                      borderRadius="sm"
                      colorScheme="gray"
                      textTransform="none"
                      fontWeight="normal"
                    >
                      Built-in
                    </Badge>
                  </Flex>
                  <Text
                    fontSize="xs"
                    color="gray.500"
                    noOfLines={2}
                    wordBreak="break-word"
                  >
                    {agent.description}
                  </Text>
                </Box>

                {/* 右侧：模型选择器 */}
                <Box flexShrink={0}>
                  <Text fontSize="xs" color="gray.500" mb={1}>
                    使用模型
                  </Text>
                  <AgentModelPicker
                    agentName={agent.name}
                    agentDefaultModel={agent.model}
                  />
                </Box>
              </Flex>
            </Box>
          ))}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AgentSettingModal;