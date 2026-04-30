import * as React from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Spinner,
  Flex,
  IconButton,
  Icon,
  Tooltip,
} from '@chakra-ui/react';
import { useChatStore } from '../../store/chat';
import { useChatConfig } from '../../store/chat-config';
import { useWorkspaceStore, getEffectiveRules } from '../../store/workspace';
import { useExtensionStore, IDE } from '../../store/extension';
import { versionCompare } from '../../utils/common';
import {
  getCompressSessionStatus,
  subscribeCompressStatus,
} from '../../services/compressionService';
import {
  DEFAULT_COMPRESSION_CONFIG,
  SessionStatus,
} from '../../types/contextCompression';
import { ChatMessage } from '../../services';
import { useTheme, ThemeStyle } from '../../ThemeContext';
import MiniButton from '../../components/MiniButton';
import { PromptLinkMgr } from '../../store/workspace/pomptLinkMgr';
import { TbRefresh } from 'react-icons/tb';
import { formatTokenCount } from '../../utils/consumedTokensCalculator';

interface TokenUsageIndicatorProps {
  visible?: boolean;
}

const COMPRESSION_THRESHOLD =
  DEFAULT_COMPRESSION_CONFIG.thresholds.compressionThreshold;

// 简单的 token 估算：字符数 / 4（GPT 模型的粗略估算）
function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

interface TokenBreakdownItem {
  name: string;
  tokens: number;
  percentage: number;
  color: string;
}

// 获取详细的 token 分布
function getTokenBreakdown(
  messageToken: number,
  inputMaxToken: number,
): TokenBreakdownItem[] {
  const maxMessageTokens = inputMaxToken;
  if (maxMessageTokens === 0) {
    return [];
  }

  // 获取 system prompt 和 system tools
  let systemTokens = 0;
  let systemToolTokens = 0;
  const promptLink = new PromptLinkMgr();

  try {
    const workspaceStore = useWorkspaceStore.getState();
    const extensionStore = useExtensionStore.getState();

    const rules = workspaceStore.rules;
    const teamRules = workspaceStore.teamRules;
    const selectedRules = workspaceStore.selectedRules;
    const ide = extensionStore.IDE;
    const pluginVersion = extensionStore.codeMakerVersion || '';

    let isOldVersion = true;
    if (
      ide === IDE.VisualStudioCode &&
      versionCompare('2.8.0', pluginVersion) >= 0
    ) {
      isOldVersion = false;
    }
    if (ide === IDE.JetBrains) {
      isOldVersion = false;
    }

    const effectiveRules = getEffectiveRules({
      selectedRules: [
        ...teamRules,
        ...rules.filter((rule) => selectedRules.includes(rule.filePath)),
      ],
      mentionPaths: [], // TokenIndicator 不需要考虑 attachFiles
      codebaseCustomPrompt: workspaceStore.workspaceInfo?.codebaseCustomPrompt || '',
      code_style: workspaceStore.devSpace?.code_style || '',
      oldVersion: isOldVersion,
    });
    // 获取 system prompt
    const codebaseChatSystemPrompt = workspaceStore.getCodebaseChatSystemPrompt({
      effectiveRules,
      promptLink,
    });
    systemTokens = estimateTokenCount(codebaseChatSystemPrompt || '');

    // 获取 system tools
    const codebaseChatTools = workspaceStore.getCodebaseChatTools();
    systemToolTokens = estimateTokenCount(JSON.stringify(codebaseChatTools || []));
  } catch (error) {
    // 如果获取失败，使用估算值
    console.warn('Failed to get system prompt/tools:', error);
    systemTokens = 4000;
    systemToolTokens = 0;
  }

  // 从 PromptLinkMgr 获取各段 prompt 并计算 token 数
  const mcpTokens = estimateTokenCount(promptLink.mcpPrompt || '');
  const skillTokens = estimateTokenCount(promptLink.skillPrompt || '');
  const ruleTokens = estimateTokenCount(promptLink.rulePrompt || '');

  systemTokens = systemTokens - mcpTokens - skillTokens - ruleTokens;
  // systemTokens 已经是扣除 mcp/skill/rule 后的纯 system prompt 部分
  const allSystemEstimates = systemTokens + systemToolTokens + mcpTokens + skillTokens + ruleTokens;
  // messageToken 来自 API，已包含所有 system 内容，减去估算的 system 部分得到纯对话消息
  const conversationTokens = Math.max(0, messageToken - allSystemEstimates);
  const totalUsed = maxMessageTokens;
  const freeSpace = Math.max(0, maxMessageTokens - messageToken);

  const breakdown: TokenBreakdownItem[] = [
    {
      name: 'System prompt',
      tokens: systemTokens,
      percentage: (systemTokens / totalUsed) * 100,
      color: '#8B9DC3', // 灰蓝色
    },
    {
      name: 'System tools',
      tokens: systemToolTokens,
      percentage: (systemToolTokens / totalUsed) * 100,
      color: '#3B82F6', // 蓝色
    },
    {
      name: 'Mcp tokens',
      tokens: mcpTokens,
      percentage: (mcpTokens / totalUsed) * 100,
      color: '#EF4444', // 红色
    },
    {
      name: 'Skill tokens',
      tokens: skillTokens,
      percentage: (skillTokens / totalUsed) * 100,
      color: '#F59E0B', // 黄色
    },
    {
      name: 'Rule tokens',
      tokens: ruleTokens,
      percentage: (ruleTokens / totalUsed) * 100,
      color: '#F97316', // 橙色
    },
    {
      name: 'Messages',
      tokens: conversationTokens,
      percentage: (conversationTokens / totalUsed) * 100,
      color: '#10B981', // 绿色
    },
    {
      name: 'Free space',
      tokens: freeSpace,
      percentage: (freeSpace / totalUsed) * 100,
      color: '#999', // 灰色
    },
  ];

  // 只返回有 token 的项
  return breakdown.filter(item => item.tokens > 0);
}


// 格式化百分比（如：0.415 -> "41.5%"）
function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

// Token 分布项组件
function TokenBreakdownItem({
  item,
  isDark,
}: {
  item: TokenBreakdownItem;
  isDark: boolean;
}) {
  return (
    <Flex
      justifyContent="space-between"
      alignItems="center"
      py={1}
      fontSize="xs"
    >
      <Flex alignItems="center" gap={2}>
        <Box
          w="8px"
          h="8px"
          borderRadius="sm"
          bg={item.color}
          flexShrink={0}
        />
        <Text fontFamily="monospace">
          {item.name}
        </Text>
      </Flex>
      <Flex gap={2} alignItems="center">
        <Text color={isDark ? '#C0C0C0' : '#333'} fontFamily="monospace">
          {formatTokenCount(item.tokens)}
        </Text>
        <Text
          color={isDark ? '#808080' : '#999'}
          fontFamily="monospace"
          minW="45px"
          textAlign="right"
        >
          ({formatPercentage(item.percentage)})
        </Text>
      </Flex>
    </Flex>
  );
}

function getLatestTokenUsage(messages: ChatMessage[] | undefined): number {
  if (!messages?.length) return 0;

  let hasOutdatedTokens = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.usage) {
      const isOutdatedTokens = msg.isOutdatedTokens || false;
      if (isOutdatedTokens) {
        hasOutdatedTokens = true;
        break;
      }
      const totalTokens =
        msg.usage.total_tokens ||
        (msg.usage.prompt_tokens || 0) +
        (msg.usage.completion_tokens || 0) +
        (msg.usage.cache_creation_input_tokens || 0) +
        (msg.usage.cache_read_input_tokens || 0);
      if (totalTokens > 0) {
        return totalTokens;
      }
    }
  }

  if (hasOutdatedTokens) {
    let latestCompressedMsgIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.isCompressionSummary) {
        latestCompressedMsgIdx = i;
        break;
      }
    }

    if (
      latestCompressedMsgIdx !== -1 &&
      messages[latestCompressedMsgIdx].compressionMetadata
    ) {
      return (
        4063 + messages[latestCompressedMsgIdx].compressionMetadata!
          .compressedTokenCount +
        messages.slice(latestCompressedMsgIdx + 1).reduce((sum, msg) => {
          return sum + (msg.group_tokens || 0);
        }, 0)
      );
    }
  }

  return 0;
}

export function TokenUsageIndicator({
  visible = true,
}: TokenUsageIndicatorProps) {
  const { activeTheme } = useTheme();
  const isDark = activeTheme === ThemeStyle.Dark;

  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const currentTokens = useChatStore((state) => {
    if (!state.currentSessionId) return 0;
    const messages = state.sessions.get(state.currentSessionId)?.data?.messages;
    return getLatestTokenUsage(messages);
  });

  const model = useChatConfig((state) => state.config.model);
  const codebaseModelMaxTokens = useChatConfig(
    (state) => state.codebaseModelMaxTokens,
  );

  const [compressStatus, setCompressStatus] = React.useState<SessionStatus>(
    SessionStatus.INITIAL,
  );
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!currentSessionId) return;

    void getCompressSessionStatus(currentSessionId).then((status) => {
      setCompressStatus(status);
    });

    const unsubscribe = subscribeCompressStatus((sessionId, status) => {
      if (sessionId === currentSessionId) {
        setCompressStatus(status);
      }
    });

    return unsubscribe;
  }, [currentSessionId]);

  const maxTokens = React.useMemo(() => {
    return codebaseModelMaxTokens[model] || 0;
  }, [codebaseModelMaxTokens, model]);

  // 计算相对于压缩阈值的百分比（达到92%时显示100%）
  const percentage = React.useMemo(() => {
    if (maxTokens === 0) return 0;
    const actualPercentage = (currentTokens / maxTokens) * 100;
    // 映射到 0-100%，其中 92% 的实际使用率 = 100% 的显示进度
    const mappedPercentage =
      (actualPercentage / (COMPRESSION_THRESHOLD * 100)) * 100;
    return Math.min(100, Math.round(mappedPercentage));
  }, [currentTokens, maxTokens]);

  const isCompressing = compressStatus === SessionStatus.COMPRESSING;

  // 使用 useMemo 缓存 token 分布计算结果，refreshKey 变化时重新计算
  const tokenBreakdown = React.useMemo(() => {
    if (refreshKey >= 0) return getTokenBreakdown(currentTokens, maxTokens);
    return []
  }, [currentTokens, maxTokens, refreshKey]);

  // 刷新 token 分布数据
  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    // 触发重新计算
    setRefreshKey(prev => prev + 1);
    // 模拟刷新延迟，给用户反馈
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  }, []);

  if (!visible || currentTokens === 0 || maxTokens === 0) {
    return null;
  }

  const progressColor = 'blue.400';

  return (
    <>
      <Popover trigger="hover" placement="top-start" openDelay={0} closeDelay={200}>
        <PopoverTrigger>
          <MiniButton
            bg={isDark ? 'transparent' : '#EEF0F2'}
            _hover={{
              opacity: 0.8,
              color: '#776fff',
            }}
            transition="all 0.2s"
            fontFamily="monospace"
            fontSize="xs"
          >
            {isCompressing ? (
              <Flex alignItems="center" gap={2}>
                <Spinner size="xs" />
                <Text fontSize="xs" lineHeight="1">
                  总结中
                </Text>
              </Flex>
            ) : (
              <Flex alignItems="center" gap={2}>
                <CircularProgress
                  value={percentage}
                  size="16px"
                  thickness="12px"
                  color={progressColor}
                  trackColor={isDark ? 'whiteAlpha.300' : 'blackAlpha.200'}
                />
                <Text fontSize="xs" color={isDark ? '#808080' : '#999'} lineHeight="1">
                  {percentage}%
                </Text>
              </Flex>
            )}
          </MiniButton>
        </PopoverTrigger>
        <PopoverContent
          bg={isDark ? '#1E1E1E' : '#FFFFFF'}
          border="1px solid"
          borderColor={isDark ? '#333333' : '#E5E7EB'}
          borderRadius="lg"
          width="auto"
          minW="300px"
          maxW="450px"
          boxShadow="xl"
          _focus={{ boxShadow: 'xl' }}
        >
          <PopoverBody px={4} pb={3} textAlign="left">
            {/* 标题行 - 带刷新按钮 */}
            <Flex justifyContent="space-between" alignItems="center" mb={1}>
              <Text fontSize="xs" color={isDark ? '#AAAAAA' : '#666'}>
                上下文窗口（达到100%触发总结）
              </Text>
              <Tooltip label={'获取最新上下文占比'}>
                <IconButton
                  aria-label="回复"
                  variant="ghost"
                  isLoading={isRefreshing}
                  icon={<Icon as={TbRefresh} size="sm" />}
                  size="sm"
                  color="text.default"
                  onClick={handleRefresh}
                />
              </Tooltip>
            </Flex>

            {/* Token 分布列表 */}
            <Box>
              {tokenBreakdown.map((item, index) => (
                <TokenBreakdownItem key={index} item={item} isDark={isDark} />
              ))}
            </Box>

            {/* 压缩状态提示 */}
            {isCompressing && (
              <Text fontSize="xs" color="blue.400" mt={3} lineHeight="1">
                正在自动总结上下文...
              </Text>
            )}

          </PopoverBody>
        </PopoverContent>
      </Popover>
      <Divider h="14px" mx="1" orientation="vertical" />
    </>
  );
}

export default TokenUsageIndicator;