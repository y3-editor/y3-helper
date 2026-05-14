import * as React from 'react';
import {
  Box,
  Button,
  Grid,
  Icon,
  Text,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  Divider,
  Badge,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { AiOutlineCheck, AiOutlineDown } from 'react-icons/ai';
import { SiOpenai } from 'react-icons/si';
import { IChatModelConfig } from '../../../services/chatModel';

/**
 * 通用模型选择器（受控组件）
 *
 * 设计原则：
 * - 完全受控：不依赖任何 store，调用方负责状态管理
 * - 高定制：通过 props 注入推荐模型、警告渲染、占位符等
 * - 低耦合：不感知 agent 业务逻辑，由调用方过滤 displayModels 和提供 recommendedModels
 *
 * 使用场景：
 * - AgentSettingModal: 内置 agent 模型配置（受 store 控制）
 * - CreateAgentView: 创建 agent 时为 frontmatter.model 字段选模型
 * - 其他需要"模型下拉 + 默认（继承）选项"的场景
 */
export interface ModelPickerProps {
  /** 当前选中的模型值（推荐传 useModel 值；空字符串表示"默认/继承"） */
  value: string;
  /** 选中变化时的回调；空字符串表示"默认/继承" */
  onChange: (value: string) => void;
  /** 已过滤后的可选模型列表（调用方负责按 agent 类型 / 权限过滤） */
  displayModels: IChatModelConfig[];
  /** 完整的 chatModels（用于反查 code 与显示 title） */
  chatModels: Record<string, IChatModelConfig>;
  /** 主题：暗色 */
  isDark: boolean;
  /** 触发器宽度（默认 160px） */
  triggerMinWidth?: string | number;
  /** "默认/继承"按钮显示文本（默认："默认（跟随全局）"） */
  inheritLabel?: string;
  /** 选中"默认/继承"时按钮显示文本（默认："默认"） */
  inheritButtonText?: string;
  /** 是否展示"默认/继承"项（默认 true） */
  showInheritOption?: boolean;
  /** 推荐模型列表（命中时显示绿色"推荐" Badge） */
  recommendedModels?: string[];
  /** 当前选中的模型不被推荐时的提示文案；为空则不显示 */
  notRecommendedWarning?: string;
  /** Popover 弹层最大高度（默认 calc(100vh - 480px)） */
  menuMaxHeight?: string;
  /** Popover 弹层放置方向（默认 bottom-end） */
  placement?:
    | 'bottom-end'
    | 'bottom-start'
    | 'bottom'
    | 'top-end'
    | 'top-start'
    | 'top';
  /** 空列表提示文案（默认"无可用模型，请选择'默认'选项"） */
  emptyHint?: string;
}

/**
 * 将存储的 useModel 值反查回 chatModels 的 code（key）
 * 优先级：code 直接命中 > 非 thinking 模型的 useModel > thinking 模型的 useModel
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveModelCodeByUseModel(
  selectedModel: string,
  chatModels: Record<string, IChatModelConfig>,
): string {
  if (!selectedModel) return '';
  if (chatModels[selectedModel]) return selectedModel;

  const matchingKeys = Object.keys(chatModels).filter(
    (key) => chatModels[key]?.useModel === selectedModel,
  );
  if (matchingKeys.length === 0) return selectedModel;

  const nonThinkingKey = matchingKeys.find(
    (key) => !chatModels[key]?.hasThinking,
  );
  return nonThinkingKey || matchingKeys[0];
}

const ModelPicker: React.FC<ModelPickerProps> = ({
  value,
  onChange,
  displayModels,
  chatModels,
  isDark,
  triggerMinWidth = '160px',
  inheritLabel = '默认（跟随全局）',
  inheritButtonText = '默认',
  showInheritOption = true,
  recommendedModels,
  notRecommendedWarning,
  menuMaxHeight = 'calc(100vh - 480px)',
  placement = 'bottom-end',
  emptyHint = "无可用模型，请选择'默认'选项",
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoverModel, setHoverModel] = React.useState('');

  const selectedModelCode = React.useMemo(
    () => resolveModelCodeByUseModel(value, chatModels),
    [value, chatModels],
  );

  const getSelectedLabel = () => {
    if (!value) return inheritButtonText;
    return chatModels[selectedModelCode]?.title || value;
  };

  const handleSelect = (config: IChatModelConfig | '') => {
    const useModelValue = config ? config.useModel || config.code : '';
    onChange(useModelValue);
    setIsOpen(false);
  };

  const hoverBg = isDark ? 'rgba(66,153,225,0.12)' : 'blue.50';
  const selectedBg = isDark ? 'rgba(66,153,225,0.2)' : 'blue.100';
  const triggerBg = isDark ? 'rgba(255,255,255,0.05)' : 'gray.50';
  const triggerHoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'gray.100';
  const triggerBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'gray.200';
  const popoverBg = isDark ? '#242424' : '#fff';
  const popoverBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'gray.200';

  const renderModelRow = (config: IChatModelConfig) => {
    const isSelected = selectedModelCode === config.code;
    const isHovered = hoverModel === config.code;
    const icon = config.icon || '';
    const tags = config.tags || [];
    const title = config.title || config.code;
    const isRecommended = !!(
      recommendedModels &&
      (recommendedModels.includes(config.code) ||
        (config.useModel && recommendedModels.includes(config.useModel)))
    );

    return (
      <Box
        key={config.code}
        pl={3}
        pr={2}
        py={1.5}
        mx={1}
        borderRadius="md"
        alignItems="center"
        cursor="pointer"
        transition="background 0.15s"
        _hover={{ bg: hoverBg }}
        bg={isSelected ? selectedBg : 'transparent'}
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
              w="14px"
              h="14px"
              mr={2}
              objectFit="contain"
              borderRadius="sm"
            />
          ) : (
            <Icon
              as={SiOpenai}
              w="14px"
              h="14px"
              mr={2}
              color={isDark ? 'gray.400' : 'gray.500'}
            />
          )}
          <Text
            isTruncated
            title={title}
            fontSize="12px"
            color={isDark ? 'gray.200' : 'gray.700'}
          >
            {title}
            {tags.length > 0 &&
              tags.map((tag) => (
                <Box
                  key={tag}
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  ml="2"
                  px="1.5"
                  borderRadius="sm"
                  borderWidth="1px"
                  fontSize="10px"
                  h="16px"
                  color={isSelected || isHovered ? 'blue.400' : 'blue.300'}
                  borderColor={
                    isSelected || isHovered ? 'blue.400' : 'blue.300'
                  }
                >
                  {tag}
                </Box>
              ))}
            {isRecommended && (
              <Badge
                ml={2}
                colorScheme="green"
                fontSize="9px"
                px={1}
                py={0}
                borderRadius="sm"
                variant="subtle"
              >
                推荐
              </Badge>
            )}
          </Text>
          <Icon
            as={AiOutlineCheck}
            w="12px"
            h="12px"
            color="blue.300"
            visibility={isSelected ? 'visible' : 'hidden'}
          />
        </Grid>
      </Box>
    );
  };

  return (
    <Popover
      isLazy
      placement={placement}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="unstyled"
          rightIcon={
            <Icon
              as={AiOutlineDown}
              w="10px"
              h="10px"
              color={isDark ? 'gray.400' : 'gray.500'}
              transition="transform 0.2s"
              transform={isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
            />
          }
          onClick={() => setIsOpen((prev) => !prev)}
          fontWeight="normal"
          fontSize="12px"
          minW={triggerMinWidth}
          h="30px"
          px={3}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          bg={triggerBg}
          border="1px solid"
          borderColor={triggerBorderColor}
          borderRadius="md"
          color={isDark ? 'gray.300' : 'gray.600'}
          _hover={{ bg: triggerHoverBg }}
          transition="all 0.15s"
        >
          <Text isTruncated maxW="130px">
            {getSelectedLabel()}
          </Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        w="260px"
        fontSize="12px"
        bg={popoverBg}
        borderColor={popoverBorderColor}
        boxShadow={
          isDark
            ? '0 8px 24px rgba(0,0,0,0.4)'
            : '0 8px 24px rgba(0,0,0,0.12)'
        }
        borderRadius="lg"
        _focus={{ outline: 'none' }}
      >
        <PopoverBody display="flex" flexDirection="column" py={2} px={0}>
          {showInheritOption && (
            <>
              <Box
                pl={3}
                pr={2}
                py={1.5}
                mx={1}
                borderRadius="md"
                cursor="pointer"
                transition="background 0.15s"
                _hover={{ bg: hoverBg }}
                bg={!value ? selectedBg : 'transparent'}
                onClick={() => handleSelect('')}
              >
                <Grid
                  w="full"
                  alignItems="center"
                  templateColumns="auto 1fr auto"
                >
                  <Box w="14px" h="14px" mr={2} />
                  <Text
                    fontSize="12px"
                    color={isDark ? 'gray.300' : 'gray.600'}
                    fontStyle="italic"
                  >
                    {inheritLabel}
                  </Text>
                  <Icon
                    as={AiOutlineCheck}
                    w="12px"
                    h="12px"
                    color="blue.300"
                    visibility={!value ? 'visible' : 'hidden'}
                  />
                </Grid>
              </Box>
              <Divider
                my={1}
                borderColor={isDark ? 'rgba(255,255,255,0.08)' : 'gray.100'}
              />
            </>
          )}

          <VStack
            align="stretch"
            maxH={menuMaxHeight}
            overflowY="auto"
            spacing={0}
            css={{
              '&::-webkit-scrollbar': { width: '3px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: 'rgba(128,128,128,0.25)',
                borderRadius: '2px',
              },
              'scrollbar-width': 'thin',
              'scrollbar-color': 'rgba(128,128,128,0.25) transparent',
            }}
          >
            {displayModels.length > 0 ? (
              displayModels.map((config) => renderModelRow(config))
            ) : (
              <Text
                fontSize="xs"
                color={isDark ? 'gray.500' : 'gray.400'}
                p={4}
                textAlign="center"
              >
                {emptyHint}
              </Text>
            )}
          </VStack>

          {notRecommendedWarning && (
            <Alert
              status="warning"
              mt={2}
              mx={2}
              mb={1}
              fontSize="xs"
              borderRadius="md"
              py={1.5}
              px={2}
            >
              <AlertIcon boxSize="11px" />
              <Text fontSize="xs" lineHeight="1.4">
                {notRecommendedWarning}
              </Text>
            </Alert>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export default ModelPicker;