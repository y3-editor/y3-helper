import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Flex,
  Box,
  Tooltip,
  Icon,
  Collapse,
} from '@chakra-ui/react';
import { useTheme, ThemeStyle } from '../../../ThemeContext';
import { useChatStore } from '../../../store/chat';
import { useChatConfig } from '../../../store/chat-config';
import { useMemo, useState } from 'react';
import MiniButton from '../../../components/MiniButton';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { formatTokenCount } from '../../../utils/consumedTokensCalculator';
import type { ChildSession } from '../../../utils/consumedTokensCalculator';

/** 基于 agent 名称 hash 稳定分配颜色 */
function getAgentColor(agentName: string): string {
  const colors = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
  ];
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    hash = ((hash << 5) - hash + agentName.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}

/** 格式化 token 数量为可读字符串 */
function formatTokens(n: number): string {
  return formatTokenCount(n);
}

/** 单行 token 条目 */
interface TokenRowProps {
  color: string;
  label: string;
  value: number;
  total: number;
  isDark: boolean;
  tooltip?: string;
}

function TokenRow({
  color,
  label,
  value,
  total,
  isDark,
  tooltip,
}: TokenRowProps) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <Flex alignItems="center" gap={2} py={0.5} justifyContent="space-between">
      {/* 左侧：色块 + 标签 */}
      <Flex alignItems="center" gap={2} flex={1} minW={0}>
        <Box w="10px" h="10px" borderRadius="2px" flexShrink={0} bg={color} />
        <Flex
          fontSize="xs"
          whiteSpace="nowrap"
          alignItems="center"
          gap={1}
        >
          <Text fontFamily="monospace">{label}</Text>
          {tooltip && (
            <Tooltip label={tooltip}>
              <Text as="span" mx={0.5} lineHeight={1}>
                <Icon
                  as={AiOutlineQuestionCircle}
                  size="sm"
                  style={{ zoom: 0.9 }}
                />
              </Text>
            </Tooltip>
          )}
        </Flex>
      </Flex>
      {/* 右侧：数值 + 百分比 */}
      <Flex
        fontSize="xs"
        fontFamily="mono"
        whiteSpace="nowrap"
        alignItems="center"
        gap={1}
        flexShrink={0}
      >
        <Text fontWeight="semibold" color={isDark ? '#E0E0E0' : '#111'}>
          {formatTokens(value)}
        </Text>
        <Text w="44px" textAlign="right" color={isDark ? '#888' : '#999'}>
          ({pct}%)
        </Text>
      </Flex>
    </Flex>
  );
}

/** 判断是否有缓存相关的 token 数据（Claude 模型特有） */
function hasCacheTokens(consumedTokens?: {
  cacheCreationInputTokens?: number;
  readCacheTokens?: number;
}): boolean {
  if (!consumedTokens) return false;
  return (
    (consumedTokens.cacheCreationInputTokens || 0) > 0 ||
    (consumedTokens.readCacheTokens || 0) > 0
  );
}

/** 计算单个 Subagent session 的 token 总和 */
function calculateSubagentSessionTotal(consumedTokens?: {
  cacheCreationInputTokens?: number;
  promptTokens?: number;
  readCacheTokens?: number;
}): number {
  if (!consumedTokens) return 0;

  // 如果有缓存相关数据（Claude 模型），使用三项相加
  if (hasCacheTokens(consumedTokens)) {
    return (
      (consumedTokens.cacheCreationInputTokens || 0) +
      (consumedTokens.promptTokens || 0) +
      (consumedTokens.readCacheTokens || 0)
    );
  }

  // 非 Claude 模型只使用 promptTokens
  return consumedTokens.promptTokens || 0;
}

/** 计算所有 Subagent 的 token 总和 */
function calculateSubagentTotalTokens(childrenSummary: ChildSession[]): number {
  return childrenSummary.reduce(
    (total, session) => total + calculateSubagentSessionTotal(session.consumedTokens),
    0
  );
}

/** 子会话 Token 折叠展示区域 */
interface ChildSessionTokenSectionProps {
  childrenSummary: ChildSession[];
  pctBase: number;
  isDark: boolean;
}

function ChildSessionTokenSection({
  childrenSummary,
  pctBase,
  isDark,
}: ChildSessionTokenSectionProps) {
  const [expanded, setExpanded] = useState(false);
  // 记录展开的 session id
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const sortedSessions = useMemo(
    () =>
      childrenSummary
        .filter((session) => session.consumedTokens) // 过滤掉没有 token 统计的会话
        .map((session) => [session.name, session] as const)
        .sort(([, a], [, b]) => {
          const aTotal = calculateSubagentSessionTotal(a.consumedTokens);
          const bTotal = calculateSubagentSessionTotal(b.consumedTokens);
          return bTotal - aTotal;
        }),
    [childrenSummary],
  );

  const sessionCount = sortedSessions.length;
  const totalTokens = calculateSubagentTotalTokens(childrenSummary);
  const pct = pctBase > 0 ? ((totalTokens / pctBase) * 100).toFixed(1) : '0.0';

  return (
    <Box>
      {/* 汇总行，可点击展开 */}
      <Flex
        alignItems="center"
        gap={2}
        py={0.5}
        cursor="pointer"
        onClick={() => setExpanded((v) => !v)}
        _hover={{ opacity: 0.8 }}
        userSelect="none"
        justifyContent="space-between"
      >
        {/* 左侧：色块 + 标签 + session 徽标 + 展开箭头 */}
        <Flex alignItems="center" gap={2} flex={1} minW={0}>
          <Box w="10px" h="10px" borderRadius="2px" flexShrink={0} bg="#f59e0b" />
          <Flex
            fontSize="xs"
            color={isDark ? '#C8C8C8' : '#333'}
            whiteSpace="nowrap"
            alignItems="center"
            gap={1}
          >
            <Text>Subagent</Text>
            <Text
              fontSize="10px"
              px="5px"
              py="1px"
              borderRadius="3px"
              bg={isDark ? '#3a3219' : '#fef3c7'}
              color={isDark ? '#f59e0b' : '#92400e'}
              fontWeight="medium"
              lineHeight="1.4"
            >
              {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </Text>
            <Icon
              as={expanded ? MdKeyboardArrowDown : MdKeyboardArrowRight}
              color={isDark ? '#666' : '#bbb'}
              boxSize={3.5}
              flexShrink={0}
            />
          </Flex>
        </Flex>
        {/* 右侧：数值 + 百分比 */}
        <Flex
          fontSize="xs"
          fontFamily="mono"
          whiteSpace="nowrap"
          alignItems="center"
          gap={1}
          flexShrink={0}
        >
          <Text fontWeight="semibold" color={isDark ? '#E0E0E0' : '#111'}>
            {formatTokens(totalTokens)}
          </Text>
          <Text w="44px" textAlign="right" color={isDark ? '#888' : '#999'}>
            ({pct}%)
          </Text>
        </Flex>
      </Flex>

      {/* 展开详情 */}
      <Collapse in={expanded} animateOpacity>
        <Box
          mt={1}
          ml={4}
          pl={2.5}
          borderLeft="1px solid"
          borderColor={isDark ? '#3a3a3a' : '#e5e7eb'}
        >
          {sortedSessions.map(([sessionName, stats]) => {
            const ct = stats.consumedTokens;
            const sessionTotal = calculateSubagentSessionTotal(ct);
            const sessionPct =
              pctBase > 0 ? ((sessionTotal / pctBase) * 100).toFixed(1) : '0.0';
            const isSessionExpanded = expandedSessions.has(stats.id);

            // 根据是否有缓存数据决定显示的行
            const hasCache = hasCacheTokens(ct);
            const detailRows = hasCache
              ? [
                  {
                    color: '#60a5fa',
                    label: 'Cache Creation',
                    value: ct?.cacheCreationInputTokens || 0,
                  },
                  {
                    color: '#34d399',
                    label: 'Prompt Tokens',
                    value: ct?.promptTokens || 0,
                  },
                  {
                    color: '#a78bfa',
                    label: 'Read Cache',
                    value: ct?.readCacheTokens || 0,
                  },
                ]
              : [
                  {
                    color: '#34d399',
                    label: 'Prompt Tokens',
                    value: ct?.promptTokens || 0,
                  },
                ];

            return (
              <Box key={stats.id}>
                {/* Session 汇总行 */}
                <Flex
                  alignItems="center"
                  gap={2}
                  py={0.5}
                  justifyContent="space-between"
                  cursor="pointer"
                  onClick={() => toggleSessionExpand(stats.id)}
                  _hover={{ opacity: 0.8 }}
                  userSelect="none"
                >
                  {/* 左侧：圆点 + 名称 + 展开箭头 */}
                  <Flex alignItems="center" gap={2} flex={1} minW={0}>
                    <Box
                      w="6px"
                      h="6px"
                      borderRadius="50%"
                      flexShrink={0}
                      bg={getAgentColor(sessionName)}
                    />
                    <Tooltip
                      label={sessionName.length > 20 ? sessionName : undefined}
                      placement="top"
                    >
                      <Text
                        fontSize="xs"
                        color={isDark ? '#aaa' : '#666'}
                        flexShrink={0}
                        maxW="140px"
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        cursor={sessionName.length > 20 ? 'default' : 'pointer'}
                      >
                        {sessionName}
                      </Text>
                    </Tooltip>
                    <Icon
                      as={
                        isSessionExpanded
                          ? MdKeyboardArrowDown
                          : MdKeyboardArrowRight
                      }
                      color={isDark ? '#666' : '#bbb'}
                      boxSize={3}
                      flexShrink={0}
                    />
                  </Flex>
                  {/* 右侧：数值 + 百分比 */}
                  <Flex
                    fontSize="xs"
                    fontFamily="mono"
                    whiteSpace="nowrap"
                    alignItems="center"
                    gap={1}
                    flexShrink={0}
                  >
                    <Text
                      fontWeight="semibold"
                      color={isDark ? '#E0E0E0' : '#111'}
                    >
                      {formatTokens(sessionTotal)}
                    </Text>
                    <Text
                      w="44px"
                      textAlign="right"
                      color={isDark ? '#888' : '#999'}
                    >
                      ({sessionPct}%)
                    </Text>
                  </Flex>
                </Flex>

                <Flex>
                  <Box
                    ml={3}
                    pl={2}
                    borderLeft="1px solid"
                    borderColor={isDark ? '#2a2a2a' : '#f0f0f0'}
                    mt={1}
                  >
                    <Text
                      fontSize="xs"
                      color={isDark ? '#888' : '#888'}
                      fontFamily="monospace"
                      isTruncated
                      maxW={240}
                    >
                      {stats.extra?.description}
                    </Text>
                  </Box>
                </Flex>

                {/* Session 内部详细展开 */}
                <Collapse in={isSessionExpanded} animateOpacity>
                  <Box
                    ml={3}
                    pl={2}
                    borderLeft="1px solid"
                    borderColor={isDark ? '#2a2a2a' : '#f0f0f0'}
                  >
                    {detailRows.map((row) => {
                      const rowPct =
                        sessionTotal > 0
                          ? ((row.value / sessionTotal) * 100).toFixed(1)
                          : '0.0';
                      return (
                        <Flex
                          key={row.label}
                          alignItems="center"
                          gap={2}
                          py={0.5}
                          justifyContent="space-between"
                        >
                          <Flex alignItems="center" gap={2} flex={1} minW={0}>
                            <Box
                              w="6px"
                              h="6px"
                              borderRadius="1px"
                              flexShrink={0}
                              bg={row.color}
                            />
                            <Text
                              fontSize="xs"
                              color={isDark ? '#888' : '#888'}
                              fontFamily="monospace"
                            >
                              {row.label}
                            </Text>
                          </Flex>
                          <Flex
                            fontSize="xs"
                            fontFamily="mono"
                            whiteSpace="nowrap"
                            alignItems="center"
                            gap={1}
                            flexShrink={0}
                          >
                            <Text color={isDark ? '#ccc' : '#333'}>
                              {formatTokens(row.value)}
                            </Text>
                            <Text
                              w="44px"
                              textAlign="right"
                              color={isDark ? '#666' : '#aaa'}
                            >
                              ({rowPct}%)
                            </Text>
                          </Flex>
                        </Flex>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function ChatConsumeTokenPanel() {
  const { activeTheme } = useTheme();
  // const { postMessage } = usePostMessage(); // Y3: 已移除内部链接，不再需要
  const isDark = activeTheme === ThemeStyle.Dark;
  const chatType = useChatStore((state) => state.chatType);

  const currentSession = useChatStore((state) => state.currentSession());
  const ct = currentSession?.data?.consumedTokens;

  const promptTokens = useMemo(() => ct?.input || 0, [ct?.input]);
  const completionTokens = useMemo(
    () => ct?.output || 0,
    [ct?.output],
  );
  const compressTokens = useMemo(
    () =>
      (ct?.comporessPromptTokens || 0) + (ct?.comporessCompletionTokens || 0),
    [ct?.comporessPromptTokens, ct?.comporessCompletionTokens],
  );
  const systemTokens = useMemo(() => ct?.systemTokens || 0, [ct?.systemTokens]);
  const systemToolTokens = useMemo(
    () => ct?.systemToolTokens || 0,
    [ct?.systemToolTokens],
  );

  const readCacheTokens = useMemo(
    () => ct?.readCacheTokens || 0,
    [ct?.readCacheTokens],
  );
  const messageTokens = useMemo(
    () => promptTokens + completionTokens,
    [promptTokens, completionTokens],
  );
  const skillTokens = useMemo(() => ct?.skillTokens || 0, [ct?.skillTokens]);
  const ruleTokens = useMemo(() => ct?.ruleTokens || 0, [ct?.ruleTokens]);
  const mcpTokens = useMemo(() => ct?.mcpTokens || 0, [ct?.mcpTokens]);

  // 直接读取，避免 useMemo dep 写可选链引起的类型告警
  const childrenSummary = ct?.children ?? null;
  const childrenTotalTokens = childrenSummary
    ? calculateSubagentTotalTokens(childrenSummary)
    : 0;

  // 检查 Subagent 功能是否启用，且仅在 codebase 模式下展示
  const enableSubagent = useChatConfig((state) => state.enableSubagent);
  const isCodebaseMode = chatType === 'codebase';
  const effectiveChildrenSummary =
    enableSubagent && isCodebaseMode && childrenSummary ? childrenSummary : null;
  const effectiveChildrenTotalTokens =
    enableSubagent && isCodebaseMode ? childrenTotalTokens : 0;

  const totalTokens = useMemo(() => {
    if (chatType === 'codebase') {
      // 对于 codebase 类型，计算主Agent所有细分项的总和
      const mainAgentTokens = messageTokens + compressTokens + systemTokens +
        systemToolTokens + readCacheTokens + skillTokens +
        ruleTokens + mcpTokens;
      return mainAgentTokens + effectiveChildrenTotalTokens;
    } else {
      // 对于非 codebase 类型，使用简化的 input + output
      const mainAgentTokens = (ct?.input || 0) + (ct?.output || 0);
      return mainAgentTokens + effectiveChildrenTotalTokens;
    }
  }, [
    chatType,
    messageTokens,
    compressTokens,
    systemTokens,
    systemToolTokens,
    readCacheTokens,
    skillTokens,
    ruleTokens,
    mcpTokens,
    effectiveChildrenTotalTokens,
    ct?.input,
    ct?.output,
  ]);

  const displayTokens = useMemo(() => formatTokens(totalTokens), [totalTokens]);
  const pctBase = useMemo(
    () => (totalTokens > 0 ? totalTokens : 1),
    [totalTokens],
  );

  const tokenRows = useMemo<TokenRowProps[]>(() => {
    if (chatType === 'codebase') {
      return [
        {
          color: '#94a3b8',
          label: 'System prompt',
          value: systemTokens,
          total: pctBase,
          isDark,
        },
        {
          color: '#60a5fa',
          label: 'System tools',
          value: systemToolTokens,
          total: pctBase,
          isDark,
          tooltip: '当前只有Claude系列模型才支持系统工具定义预览',
        },
        {
          color: '#34d399',
          label: 'Messages',
          value: messageTokens,
          total: pctBase,
          isDark,
        },
        {
          color: '#a78bfa',
          label: 'Read Cache',
          value: readCacheTokens,
          total: pctBase,
          isDark,
          tooltip:
            '目前仅 Claude 系列模型支持请求缓存功能，可缓存的内容包括：系统提示词（SystemPrompt）、系统工具（SystemTools）、上传的文件等。当请求命中缓存时，能有效减少 token 消耗，降低使用成本',
        },
        {
          color: '#fb7185',
          label: 'Mcp tokens',
          value: mcpTokens,
          total: pctBase,
          isDark,
        },
        {
          color: '#fbbf24',
          label: 'Skill tokens',
          value: skillTokens,
          total: pctBase,
          isDark,
        },
        {
          color: '#fdba74',
          label: 'Rule tokens',
          value: ruleTokens,
          total: pctBase,
          isDark,
        },
      ];
    } else {
      return [
        {
          color: '#94a3b8',
          label: 'Input Tokens',
          value: ct?.input || 0,
          total: pctBase,
          isDark,
        },
        {
          color: '#60a5fa',
          label: 'Output Tokens',
          value: ct?.output || 0,
          total: pctBase,
          isDark,
        },
      ];
    }
  }, [
    chatType,
    systemTokens,
    pctBase,
    isDark,
    systemToolTokens,
    messageTokens,
    readCacheTokens,
    mcpTokens,
    skillTokens,
    ruleTokens,
    ct?.input,
    ct?.output,
  ]);

  if (!totalTokens) return null;

  return (
    <Popover
      placement="top-start"
      trigger="hover"
      openDelay={0}
      closeDelay={200}
    >
      <PopoverTrigger>
        <MiniButton
          _hover={{ opacity: 0.8, color: '#776fff' }}
          transition="all 0.2s"
          color={isDark ? '#808080' : '#999'}
        >
          Tokens: {displayTokens}
        </MiniButton>
      </PopoverTrigger>
      <PopoverContent
        bg={isDark ? '#1E1E1E' : '#FFFFFF'}
        border="1px solid"
        borderColor={isDark ? '#333333' : '#E5E7EB'}
        boxShadow="xl"
        _focus={{ boxShadow: 'xl' }}
        borderRadius="lg"
        width="auto"
        minW="280px"
      >
        <PopoverBody px={4} py={3}>
          <Flex direction="column" gap={1}>
            <Text
              fontSize="xs"
              color={isDark ? '#AAAAAA' : '#555'}
              mb={2}
              fontWeight="medium"
            >
              本次会话消耗 Tokens 分布：
            </Text>

            {tokenRows.map((row) => (
              <TokenRow key={row.label} {...row} />
            ))}

            {/* 子会话独立折叠区，不混入 tokenRows */}
            {effectiveChildrenSummary && effectiveChildrenTotalTokens > 0 && (
              <ChildSessionTokenSection
                childrenSummary={effectiveChildrenSummary}
                pctBase={pctBase}
                isDark={isDark}
              />
            )}

            <Box
              borderTop="1px solid"
              borderColor={isDark ? '#333' : '#E5E7EB'}
              mt={1}
              pt={1}
            />

            <Flex
              fontSize="xs"
              color={isDark ? '#808080' : '#666'}
              flexWrap="wrap"
              alignItems="center"
            >
              <Text>会话消耗 Tokens</Text>
            </Flex>
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}