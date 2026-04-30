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
import { SubagentTokens } from '../../../modules/subagent/types';

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
  const billion = 1_000_000_000;
  const million = 1_000_000;
  const thousand = 1_000;
  if (n >= billion) return (n / billion).toFixed(1) + 'B';
  if (n >= million) return (n / million).toFixed(1) + 'M';
  if (n >= thousand) return (n / thousand).toFixed(1) + 'k';
  return String(n);
}

/** 单行 token 条目 */
interface TokenRowProps {
  color: string;
  label: string;
  value: number;
  total: number;
  isDark: boolean;
  tooltop?: string;
}

function TokenRow({
  color,
  label,
  value,
  total,
  isDark,
  tooltop,
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
        <Tooltip label={tooltop}>
          <Text hidden={!tooltop} mx={1}>
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

/** Subagent Token 折叠展示区域 */
interface SubagentTokenSectionProps {
  subagentTokens: SubagentTokens;
  pctBase: number;
  isDark: boolean;
}

function SubagentTokenSection({
  subagentTokens,
  pctBase,
  isDark,
}: SubagentTokenSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const sortedAgents = useMemo(
    () =>
      Object.entries(subagentTokens.byAgent).sort(
        ([, a], [, b]) =>
          b.promptTokens +
          b.completionTokens -
          (a.promptTokens + a.completionTokens),
      ),
    [subagentTokens.byAgent],
  );

  const agentTypeCount = sortedAgents.length;
  const pct =
    pctBase > 0 ? ((subagentTokens.total / pctBase) * 100).toFixed(1) : '0.0';

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
            {agentTypeCount} agent{agentTypeCount !== 1 ? 's' : ''}
          </Text>
          <Text>:</Text>
          <Text fontWeight="semibold">
            {formatTokens(subagentTokens.total)}
          </Text>
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
          {sortedAgents.map(([agentName, stats]) => {
            const agentTotal = stats.promptTokens + stats.completionTokens;
            const agentPct =
              pctBase > 0 ? ((agentTotal / pctBase) * 100).toFixed(1) : '0.0';
            return (
              <Flex key={agentName} alignItems="center" gap={2} py={0.5}>
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="50%"
                  flexShrink={0}
                  bg={getAgentColor(agentName)}
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
                    label={agentName.length > 20 ? agentName : undefined}
                    placement="top"
                  >
                    <Text
                      color={isDark ? '#aaa' : '#666'}
                      flexShrink={0}
                      maxW="140px"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      cursor={agentName.length > 20 ? 'default' : 'inherit'}
                    >
                      {agentName}
                    </Text>
                  </Tooltip>
                  <Text fontWeight="semibold">{formatTokens(agentTotal)}</Text>
                  <Text color={isDark ? '#888' : '#999'}>({agentPct}%)</Text>
                  <Tooltip
                    label={`${stats.callCount} call${stats.callCount !== 1 ? 's' : ''}`}
                  >
                    <Text
                      ml="auto"
                      fontSize="10px"
                      color={isDark ? '#555' : '#bbb'}
                      cursor="default"
                    >
                      ×{stats.callCount}
                    </Text>
                  </Tooltip>
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

  const currentSession = useChatStore((state) => state.currentSession());
  const ct = currentSession?.data?.consumedTokens;

  const promptTokens = useMemo(() => ct?.input || 0, [ct?.input]);
  const completionTokens = useMemo(() => ct?.output || 0, [ct?.output]);
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
  const subagentTokens = ct?.subagentTokens ?? null;
  const subagentTotalTokens = subagentTokens?.total ?? 0;

  // 检查 Subagent 功能是否启用
  const subagentEnable = useExtensionStore((state) => state.subagentEnable);
  const effectiveSubagentTokens = subagentEnable && subagentTokens ? subagentTokens : null;
  const effectiveSubagentTotalTokens = subagentEnable ? subagentTotalTokens : 0;

  const totalTokens = useMemo(() => {
    const total =
      messageTokens +
      compressTokens +
      systemTokens +
      systemToolTokens +
      readCacheTokens +
      skillTokens +
      ruleTokens +
      mcpTokens +
      effectiveSubagentTotalTokens;

    console.log(
      '🎯 %cToken Panel Total Calculation:',
      'color: #059669; font-weight: bold; background: #D1FAE5; padding: 2px 6px; border-radius: 4px;',
      {
        '🤖 Subagent Tokens': effectiveSubagentTotalTokens,
        '🔧 Subagent Enabled': subagentEnable,
        '💬 Message Tokens': messageTokens,
        '📦 System Tokens': systemTokens,
        '🛠️ System Tool Tokens': systemToolTokens,
        '🗜️ Compress Tokens': compressTokens,
        '💾 Read Cache Tokens': readCacheTokens,
        '⚡ Skill Tokens': skillTokens,
        '📏 Rule Tokens': ruleTokens,
        '🔌 MCP Tokens': mcpTokens,
        '📊 Final Total': total,
      },
    );

    // 如果有 subagent tokens 且功能启用，展示详细信息
    if (effectiveSubagentTokens && effectiveSubagentTotalTokens > 0) {
      console.log(
        '🤖 %cSubagent Token Details:',
        'color: #7C2D12; font-weight: bold; background: #FED7AA; padding: 2px 6px; border-radius: 4px;',
        {
          '📊 Total': effectiveSubagentTokens.total,
          '📥 Input': effectiveSubagentTokens.input,
          '✅ Output': effectiveSubagentTokens.output,
          '💰 Input Cost': effectiveSubagentTokens.inputCost?.toFixed(6) || '0',
          '💰 Output Cost': effectiveSubagentTokens.outputCost?.toFixed(6) || '0',
          '🏷️ By Agent': Object.keys(effectiveSubagentTokens.byAgent).reduce(
            (acc, agentName) => {
              const stats = effectiveSubagentTokens.byAgent[agentName];
              acc[agentName] = {
                promptTokens: stats.promptTokens,
                completionTokens: stats.completionTokens,
                callCount: stats.callCount,
              };
              return acc;
            },
            {} as Record<string, any>,
          ),
          '📝 Recent Tasks Count': effectiveSubagentTokens.recentTasks?.length || 0,
        },
      );
    }

    return total;
  }, [
    messageTokens,
    compressTokens,
    systemTokens,
    systemToolTokens,
    readCacheTokens,
    skillTokens,
    ruleTokens,
    mcpTokens,
    effectiveSubagentTotalTokens,
    effectiveSubagentTokens,
    subagentEnable,
  ]);

  const displayTokens = useMemo(() => formatTokens(totalTokens), [totalTokens]);
  const pctBase = useMemo(
    () => (totalTokens > 0 ? totalTokens : 1),
    [totalTokens],
  );
  const chatType = useChatStore((state) => state.chatType);

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
          tooltop: '当前只有Claude系列模型才支持系统工具定义预览',
        },
        {
          color: '#34d399',
          label: 'Message tools',
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
          tooltop: '当前只有Claude系列模型才支持缓存',
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
          value: promptTokens,
          total: pctBase,
          isDark,
        },
        {
          color: '#60a5fa',
          label: 'Output Tokens',
          value: completionTokens,
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
    promptTokens,
    completionTokens,
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

            {/* Subagent 独立折叠区，不混入 tokenRows */}
            {effectiveSubagentTokens && effectiveSubagentTotalTokens > 0 && (
              <SubagentTokenSection
                subagentTokens={effectiveSubagentTokens}
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