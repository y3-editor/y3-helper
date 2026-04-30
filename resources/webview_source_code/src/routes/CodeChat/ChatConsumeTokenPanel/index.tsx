import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Flex,
  Link,
  Box,
  Tooltip,
  Icon,
  Collapse,
} from '@chakra-ui/react';
import { useTheme, ThemeStyle } from '../../../ThemeContext';
import { useChatStore } from '../../../store/chat';
import { useExtensionStore } from '../../../store/extension';
import { useMemo, useState } from 'react';
import { usePostMessage } from '../../../PostMessageProvider';
import MiniButton from '../../../components/MiniButton';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import {
  formatTokenCount,
  calculateChildrenTotalTokens,
} from '../../../utils/consumedTokensCalculator';
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
    <Flex alignItems="center" gap={2} py={0.5}>
      <Box w="10px" h="10px" borderRadius="2px" flexShrink={0} bg={color} />
      <Flex
        fontSize="xs"
        fontFamily="mono"
        color={isDark ? '#C8C8C8' : '#333'}
        whiteSpace="nowrap"
        gap={1}
      >
        <Text>{label}</Text>
        <Tooltip label={tooltip}>
          <Text hidden={!tooltip} mx={1}>
            <Icon
              as={AiOutlineQuestionCircle}
              size="sm"
              style={{ zoom: 0.9 }}
            />
          </Text>
        </Tooltip>
        <Text>:</Text>
        <Text as="span" fontWeight="semibold">
          {formatTokens(value)}
        </Text>
        <Text>tokens</Text>
        <Text as="span" color={isDark ? '#888' : '#999'}>
          ({pct}%)
        </Text>
      </Flex>
    </Flex>
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

  const sortedSessions = useMemo(
    () =>
      childrenSummary
        .filter((session) => session.consumedTokens) // 过滤掉没有 token 统计的会话
        .map((session) => [session.name, session] as const)
        .sort(([, a], [, b]) => {
          const aTotal =
            (a.consumedTokens?.input || 0) + (a.consumedTokens?.output || 0);
          const bTotal =
            (b.consumedTokens?.input || 0) + (b.consumedTokens?.output || 0);
          return bTotal - aTotal;
        }),
    [childrenSummary],
  );

  const sessionCount = sortedSessions.length;
  const totalTokens = calculateChildrenTotalTokens(childrenSummary);
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
      >
        <Box w="10px" h="10px" borderRadius="2px" flexShrink={0} bg="#f59e0b" />
        <Flex
          fontSize="xs"
          fontFamily="mono"
          color={isDark ? '#C8C8C8' : '#333'}
          whiteSpace="nowrap"
          flex={1}
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
          <Text>:</Text>
          <Text fontWeight="semibold">{formatTokens(totalTokens)}</Text>
          <Text>tokens</Text>
          <Text color={isDark ? '#888' : '#999'}>({pct}%)</Text>
          <Icon
            as={expanded ? MdKeyboardArrowDown : MdKeyboardArrowRight}
            color={isDark ? '#666' : '#bbb'}
            boxSize={3.5}
            ml="auto"
            flexShrink={0}
          />
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
            const sessionTotal =
              (stats.consumedTokens?.input || 0) +
              (stats.consumedTokens?.output || 0);
            const sessionPct =
              pctBase > 0 ? ((sessionTotal / pctBase) * 100).toFixed(1) : '0.0';
            return (
              <Flex key={stats.id} alignItems="center" gap={2} py={0.5}>
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="50%"
                  flexShrink={0}
                  bg={getAgentColor(sessionName)}
                />
                <Flex
                  fontSize="xs"
                  fontFamily="mono"
                  color={isDark ? '#C8C8C8' : '#444'}
                  whiteSpace="nowrap"
                  flex={1}
                  alignItems="center"
                  gap={1}
                >
                  <Tooltip
                    label={sessionName.length > 20 ? sessionName : undefined}
                    placement="top"
                  >
                    <Text
                      color={isDark ? '#aaa' : '#666'}
                      flexShrink={0}
                      maxW="140px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      cursor={sessionName.length > 20 ? 'default' : 'inherit'}
                    >
                      {sessionName}
                    </Text>
                  </Tooltip>
                  <Text fontWeight="semibold">
                    {formatTokens(sessionTotal)}
                  </Text>
                  <Text color={isDark ? '#888' : '#999'}>({sessionPct}%)</Text>
                </Flex>
              </Flex>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function ChatConsumeTokenPanel() {
  const { activeTheme } = useTheme();
  const { postMessage } = usePostMessage();
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
    ? calculateChildrenTotalTokens(childrenSummary)
    : 0;

  // 检查 Subagent 功能是否启用
  const subagentEnable = useExtensionStore((state) => state.subagentEnable);
  const effectiveChildrenSummary =
    subagentEnable && childrenSummary ? childrenSummary : null;
  const effectiveChildrenTotalTokens = subagentEnable ? childrenTotalTokens : 0;

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
              mb={1}
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
              <Text>会话消耗 Tokens 将根据</Text>
              <Link
                color="blue.300"
                px="1"
                cursor="pointer"
                onClick={() => {
                  postMessage({
                    type: 'OPEN_IN_BROWSER',
                    data: { url: 'https://modelspace.netease.com/model_app' },
                  });
                }}
              >
                模型单价
              </Link>
              <Text>转换为消耗积分</Text>
            </Flex>
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}