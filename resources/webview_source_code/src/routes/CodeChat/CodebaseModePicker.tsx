import * as React from 'react';
import {
  Box,
  Flex,
  Text,
  Image,
  Select,
  Button,
  VStack,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
} from '@chakra-ui/react';
import { RepeatIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { CodebaseChatMode } from '../../store/chat';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import CodeMakerLogo from '../../assets/codemaker-logo.png';
import { useWorkspaceStore } from '../../store/workspace';
import useCustomToast from '../../hooks/useCustomToast';
import { CODEBASE_CHAT_SAMPLES } from '../../const';
import { selectIsSpecStaging, useAuthStore } from '../../store/auth';

/** 模式卡片配置 */
interface ModeCardConfig {
  /** 卡片标识，'vibe' 或 'spec'（spec 包含 openspec/speckit 子模式） */
  mode: 'vibe' | 'spec';
  title: string;
  description: string;
  /** 适用场景列表，每项包含 emoji 和文字 */
  features: { emoji: string; text: string }[];
  /** 提示，每项包含 emoji 和文字 */
  tips: { emoji: string; text: string }[];
  /** 是否有子模式 */
  hasSubModes?: boolean;
  /** 子模式列表 */
  subModes?: {
    value: CodebaseChatMode;
    label: string;
    features: { emoji: string; text: string }[];
    tips: { emoji: string; text: string }[];
  }[];
}

const MODE_CARDS: ModeCardConfig[] = [
  {
    mode: 'vibe',
    title: 'Vibe',
    description: '边聊边写，先跑起来再优化的直觉式编程',
    features: [
      { emoji: '', text: '通过对话描述想法，无需文档' },
      { emoji: '', text: '基于反馈进行增量式改进和功能扩展' },
      { emoji: '', text: '适合：原型开发、探索性编程、小型项目' },
    ],
    tips: []
  },
  {
    mode: 'spec',
    title: 'Spec',
    description: '先规划后实现，按工程标准逐步构建的结构化编程。',
    features: [], // 默认为空，由子模式提供
    tips: [], // 默认为空，由子模式提供
    hasSubModes: true,
    subModes: [
      {
        value: 'openspec',
        label: 'OpenSpec',
        features: [
          { emoji: '', text: '遵循 Proposal-Spec-Design-Tasks 流程' },
          { emoji: '', text: '重视文档完整性和代码质量' },
          { emoji: '', text: '适合：大型项目、团队协作、生产环境' },
        ],
        tips: []
      },
      {
        value: 'speckit',
        label: 'SpecKit',
        features: [
          { emoji: '', text: '遵循 Spec-Design-Tasks 流程' },
          { emoji: '', text: '重视文档完整性和代码质量' },
          { emoji: '', text: '适合：大型项目、团队协作、生产环境' },
        ],
        tips: [
          { emoji: '', text: '使用 /speckit.specify 指令创建提案' },
        ]
      },
    ],
  },
];

/** 随机获取 count 个推荐问题 */
const getRandomExamples = (examples: typeof CODEBASE_CHAT_SAMPLES, count = 4) => {
  const shuffled = [...examples].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

/** 分类样式映射 */
const getCategoryMap = (
  isLight: boolean
): Record<string, { label: string; bg: string; color: string }> => {
  if (isLight) {
    return {
      repo: { label: '📝 理解', bg: '#E3F2FD', color: '#1976D2' },
      search: { label: '🔍 搜索', bg: '#FFF3E0', color: '#F57C00' },
      gen: { label: '⚡ 生成', bg: '#F3E5F5', color: '#7B1FA2' },
      run: { label: '🚀 构建', bg: '#E8F5E8', color: '#388E3C' },
    };
  } else {
    return {
      repo: { label: '📝 理解', bg: '#2A3441', color: '#7BA7D1' },
      search: { label: '🔍 搜索', bg: '#3A2F1A', color: '#D4B16A' },
      gen: { label: '⚡ 生成', bg: '#2F1F3A', color: '#B08FFF' },
      run: { label: '🚀 构建', bg: '#1F3A2F', color: '#4FD1C7' },
    };
  }
};

interface CodebaseModePickerProps {
  /** 当前选中的模式（本地状态） */
  selectedMode: CodebaseChatMode | undefined;
  /** 选择模式的回调 */
  onSelectMode: (mode: CodebaseChatMode) => void;
  /** 推荐问题点击后填充输入框 */
  onFillInput?: (prompt: string) => void;
}

/**
 * 仓库智聊模式选择器组件
 * 在新建 codebase 会话时显示，让用户选择 Vibe Coding 或 Spec-Driven 模式
 */
function CodebaseModePicker({
  selectedMode,
  onSelectMode,
  onFillInput,
}: CodebaseModePickerProps) {
  const { activeTheme } = useTheme();
  const isLight = activeTheme === ThemeStyle.Light;
  const { toast } = useCustomToast();
  const workspaceInfo = useWorkspaceStore((state) => state.workspaceInfo);
  const categoryMap = getCategoryMap(isLight);

  // 是否显示推荐问题面板
  const [showRecommendQuestions, setShowRecommendQuestions] = React.useState(false);
  // 随机推荐问题
  const [randomCodebaseExamples, setRandomCodebaseExamples] = React.useState(
    () => getRandomExamples(CODEBASE_CHAT_SAMPLES)
  );

  const isSpecStaging = useAuthStore(selectIsSpecStaging);

  /** 获取当前 spec 子模式 */
  const getCurrentSpecMode = (): CodebaseChatMode => {
    if (selectedMode === 'openspec' || selectedMode === 'speckit') {
      return selectedMode;
    }
    return 'openspec'; // 默认
  };

  /** 检查卡片是否选中 */
  const isCardSelected = (cardMode: 'vibe' | 'spec'): boolean => {
    if (cardMode === 'vibe') {
      return selectedMode === 'vibe';
    }
    // spec 卡片：选中 openspec 或 speckit 时都算选中
    if (cardMode === 'spec') {
      return selectedMode === 'openspec' || selectedMode === 'speckit';
    }
    return false;
  };

  /** 获取当前选中模式的索引 (0: vibe, 1: spec, -1: 未选中) */
  const getSelectedCardIndex = (): number => {
    if (selectedMode === 'vibe') {
      return 0;
    }
    if (selectedMode === 'openspec' || selectedMode === 'speckit') {
      return 1;
    }
    return -1;
  };

  /** 获取当前应该显示的 features 列表 */
  const getCardFeatures = (card: ModeCardConfig): { emoji: string; text: string }[] => {
    // 如果是 spec 模式，根据当前选中的子模式返回对应 features
    if (card.hasSubModes && card.subModes) {
      const currentSpecMode = getCurrentSpecMode();
      const subMode = card.subModes.find((sub) => sub.value === currentSpecMode);
      return subMode?.features || [];
    }
    return card.features;
  };

  /** 获取当前应该显示的 tips 列表 */
  const getCardTips = (tip: ModeCardConfig): { emoji: string; text: string }[] => {
    // 如果是 spec 模式，根据当前选中的子模式返回对应 tips
    if (tip.hasSubModes && tip.subModes) {
      const currentSpecMode = getCurrentSpecMode();
      const subMode = tip.subModes.find((sub) => sub.value === currentSpecMode);
      return subMode?.tips || [];
    }
    return tip.features;
  };

  const selectedCardIndex = getSelectedCardIndex();

  /** 刷新随机推荐问题 */
  const refreshRandomExamples = () => {
    setRandomCodebaseExamples(getRandomExamples(CODEBASE_CHAT_SAMPLES));
  };

  /** 提交推荐问题 */
  const submitPrompt = (prompt: string) => {
    if (!workspaceInfo.repoName) {
      toast({
        title: `未识别到仓库信息，请先打开代码仓库后使用本功能`,
        status: 'warning',
        duration: 2000,
      });
      return;
    }
    if (onFillInput) {
      onFillInput(prompt);
    }
  };

  // 模式选择器页面
  return (
    <Box className="py-4 px-2 flex flex-col h-full justify-center">
      {/* Header */}
      <Flex alignItems="center" justifyContent="center" mb={2}>
        <Image
          src={CodeMakerLogo}
          alt="CodeMaker Logo"
          width="28px"
          height="28px"
        />
        <Text
          color="blue.300"
          fontSize="20px"
          fontWeight="bold"
          lineHeight="1"
          style={{ marginBottom: 0, marginTop: '3px' }}
        >
          odeMaker Coding Agent
        </Text>
      </Flex>

      {/* Subtitle */}
      <Text
        color="text.default"
        fontSize="14px"
        mb={4}
        textAlign="center"
        style={{ marginBottom: '16px' }}
      >
        让开发像聊天一样简单！
      </Text>

      {/* Mode Cards - 左右两列布局 */}
      {isSpecStaging && (
              <Flex gap={3} alignItems="stretch">
        {MODE_CARDS.map((card) => {
          const isSelected = isCardSelected(card.mode);
          const currentSpecMode = getCurrentSpecMode();

          return (
            <Box
              key={card.mode}
              flex={1}
              p={4}
              borderRadius="12px"
              border="1px solid"
              {...(card.mode === 'spec' ? { 'data-tour': 'spec-mode-card' } : {})}
              borderColor={isSelected ? 'blue.400' : 'transparent'}
              bg={
                isLight
                  ? isSelected
                    ? 'blue.50'
                    : 'gray.50'
                  : isSelected
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(255, 255, 255, 0.05)'
              }
              cursor="pointer"
              transition="all 0.2s"
              _hover={{
                borderColor: isSelected ? 'blue.400' : 'blue.200',
                transform: 'translateY(-2px)',
                boxShadow: 'md',
              }}
              onClick={() => {
                if (card.hasSubModes) {
                  onSelectMode(currentSpecMode);
                } else if (card.mode === 'vibe') {
                  onSelectMode('vibe');
                }
              }}
            >
              {/* 第一行：标题 + 下拉选择器（右对齐） */}
              <Flex align="center" justify="space-between" mb={3}>
                <Text
                  fontSize="16px"
                  fontWeight="bold"
                  color={isSelected ? 'blue.500' : 'text.default'}
                  style={{ marginBottom: 0 }}
                >
                  {card.title}
                </Text>
                {/* Spec 模式下拉选择器 - 无边框样式 */}
                {card.hasSubModes && card.subModes && (
                  <Select
                    size="xs"
                    w="auto"
                    h="24px"
                    fontSize="12px"
                    fontWeight="normal"
                    value={currentSpecMode}
                    onChange={(e) => {
                      e.stopPropagation();
                      onSelectMode(e.target.value as CodebaseChatMode);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    border="none"
                    bg="transparent"
                    color="text.default"
                    _hover={{ color: 'gray.300' }}
                    _focus={{ boxShadow: 'none' }}
                    cursor="pointer"
                    pl={0}
                    textAlign="right"
                    iconColor="text.default"
                    sx={{
                      '& > option': {
                        textAlign: 'left',
                      },
                    }}
                  >
                    {card.subModes.map((sub) => (
                      <option key={sub.value} value={sub.value}>
                        {sub.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Flex>

              {/* 第二行：描述 */}
              <Text
                fontSize="12px"
                color="text.default"
                fontWeight="normal"
                style={{ marginBottom: 0, opacity: 0.6 }}
              >
                {card.description}
              </Text>
            </Box>
          );
        })}
      </Flex>
      )}

      {/* 适用场景 - 使用 Grid 布局让两侧内容同时渲染占位，避免切换时跳动 */}
      {isSpecStaging && selectedCardIndex >= 0 && (
        <Flex gap={3} mt={4}>
          {MODE_CARDS.map((card, index) => {
            const isVisible = index === selectedCardIndex;
            return (
              <Box
                key={card.mode}
                flex={1}
                visibility={isVisible ? 'visible' : 'hidden'}
                opacity={isVisible ? 1 : 0}
              >
                <Text
                  fontSize="12px"
                  color="text.default"
                  mb={2}
                  style={{ marginBottom: '8px' }}
                >
                  适用场景：
                </Text>
                <Box>
                  {getCardFeatures(card).map((feature, idx) => (
                    <Flex key={idx} align="center" mb={1}>
                      <Text fontSize="12px" mr={1} style={{ marginBottom: 0 }}>
                        •
                      </Text>
                      {feature.emoji && (
                        <Text
                          fontSize="12px"
                          mr={1.5}
                          style={{ marginBottom: 0 }}
                        >
                          {feature.emoji}
                        </Text>
                      )}
                      <Text
                        fontSize="12px"
                        color="text.default"
                        style={{ marginBottom: 0 }}
                      >
                        {feature.text}
                      </Text>
                    </Flex>
                  ))}
                  {/* Vibe 模式添加推荐问题入口 */}
                  {card.mode === 'vibe' && getCardTips(card).length > 0 && (
                    <Flex align="center" mt={2}>
                      <Button
                        fontSize="12px"
                        color="blue.400"
                        cursor="pointer"
                        variant="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRecommendQuestions(!showRecommendQuestions);
                        }}
                        style={{ marginBottom: 0 }}
                      >
                        推荐问题
                        <ChevronUpIcon
                          boxSize={4}
                          ml={1}
                          transition="transform 0.2s"
                          transform={showRecommendQuestions ? 'rotate(180deg)' : 'rotate(0deg)'}
                        />
                      </Button>
                    </Flex>
                  )}
                </Box>
                {card.mode !== 'vibe' && (
                  <>
                    <Text
                      fontSize="12px"
                      color="text.default"
                      mb={2}
                      mt={2}
                      style={{ marginBottom: '8px' }}
                    >
                      使用指引:
                    </Text>
                    <Box>
                      {getCardTips(card).map((tip, idx) => (
                        <Flex key={idx} align="center" mb={1}>
                          <Text fontSize="12px" mr={1} style={{ marginBottom: 0 }}>
                            •
                          </Text>
                          {tip.emoji && (
                            <Text
                              fontSize="12px"
                              mr={1.5}
                              style={{ marginBottom: 0 }}
                            >
                              {tip.emoji}
                            </Text>
                          )}
                          <Text
                            fontSize="12px"
                            color="text.default"
                            style={{ marginBottom: 0 }}
                          >
                            {tip.text}
                          </Text>
                        </Flex>
                      ))}
                    </Box>
                  </>
                )}
              </Box>
            );
          })}
        </Flex>
      )}

      {/* 推荐问题底部抽屉 */}
      <Drawer
        isOpen={showRecommendQuestions && selectedMode === 'vibe'}
        placement="bottom"
        onClose={() => setShowRecommendQuestions(false)}
        autoFocus={false}
        blockScrollOnMount={false}
      >
        <DrawerOverlay bg="blackAlpha.400" />
        <DrawerContent
          borderTopRadius="16px"
          bg={isLight ? 'white' : '#1a1a2e'}
          maxH="50vh"
        >
          <DrawerBody p={4}>
            {/* 拖拽指示条 */}
            <Flex justify="center" mb={3}>
              <Box
                w="40px"
                h="4px"
                bg={isLight ? 'gray.300' : 'gray.600'}
                borderRadius="full"
              />
            </Flex>

            {/* 面板头部 */}
            <Flex justifyContent="space-between" alignItems="center" mb={3}>
              <Flex alignItems="center">
                <Text
                  fontSize="14px"
                  fontWeight="bold"
                  color="text.default"
                  style={{ marginBottom: 0 }}
                >
                  推荐问题
                </Text>
                <Text
                  fontSize="12px"
                  color={isLight ? 'gray.500' : 'gray.400'}
                  ml={2}
                  style={{ marginBottom: 0 }}
                >
                  点击选择快速提问
                </Text>
              </Flex>
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshRandomExamples}
                fontSize="12px"
                color="blue.400"
                fontWeight="normal"
                p={1}
                h="auto"
                minW="auto"
              >
                <RepeatIcon boxSize={3} mr={1} />
                换一换
              </Button>
            </Flex>

            {/* 推荐问题列表 */}
            <VStack spacing={0}>
              {randomCodebaseExamples.map((example, idx) => (
                <Box key={example.id} w="full">
                  <Flex
                    align="center"
                    w="full"
                    py={2}
                    px={2}
                    borderRadius="8px"
                    _hover={{
                      bg: isLight ? 'gray.50' : 'rgba(255, 255, 255, 0.08)',
                    }}
                    cursor="pointer"
                    onClick={() => {
                      submitPrompt(example.prompt);
                      setShowRecommendQuestions(false);
                    }}
                  >
                    {/* 短标签 */}
                    <Box
                      minW="48px"
                      px={2}
                      py={0.5}
                      borderRadius="6px"
                      bg={categoryMap[example.category]?.bg}
                      color={categoryMap[example.category]?.color}
                      fontSize="11px"
                      fontWeight="bold"
                      textAlign="center"
                      mr={3}
                      as="span"
                      display="inline-block"
                    >
                      {categoryMap[example.category]?.label}
                    </Box>
                    {/* 问题描述 */}
                    <Text
                      fontSize="13px"
                      flex="1"
                      color="text.default"
                      _hover={{ color: 'blue.300' }}
                      style={{ marginBottom: '0px' }}
                    >
                      {example.description}
                    </Text>
                  </Flex>
                  {/* 底部分割线，最后一项不显示 */}
                  {idx !== randomCodebaseExamples.length - 1 && (
                    <Box
                      w="full"
                      borderBottom={`1px dashed ${isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)'}`}
                    />
                  )}
                </Box>
              ))}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

export default CodebaseModePicker;