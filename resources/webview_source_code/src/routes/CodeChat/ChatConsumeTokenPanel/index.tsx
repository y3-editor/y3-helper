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
} from '@chakra-ui/react';
import { useTheme, ThemeStyle } from "../../../ThemeContext";
import { useChatStore } from '../../../store/chat';
import { useMemo } from 'react';
import { usePostMessage } from '../../../PostMessageProvider';
import MiniButton from '../../../components/MiniButton';
import { AiOutlineQuestionCircle } from 'react-icons/ai';

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

function TokenRow({ color, label, value, total, isDark, tooltop }: TokenRowProps) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <Flex alignItems="center" gap={2} py={0.5}>
      <Box
        w="10px"
        h="10px"
        borderRadius="2px"
        flexShrink={0}
        bg={color}
      />
      <Flex
        fontSize="xs"
        fontFamily="mono"
        color={isDark ? '#C8C8C8' : '#333'}
        whiteSpace="nowrap"
      >
        {label}
        <Tooltip label={tooltop}>
          <Box hidden={!tooltop} mx={1}>
            <Icon as={AiOutlineQuestionCircle} size="sm" style={{ zoom: .9 }} />
          </Box>
        </Tooltip>
        :
        <Text as="span" fontWeight="semibold" ml={1}>
          {formatTokens(value)}
        </Text>{' '}
        tokens{' '}
        <Text as="span" color={isDark ? '#888' : '#999'} ml={1}>
          ({pct}%)
        </Text>
      </Flex>
    </Flex>
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
    () => (ct?.comporessPromptTokens || 0) + (ct?.comporessCompletionTokens || 0),
    [ct?.comporessPromptTokens, ct?.comporessCompletionTokens]
  );
  const systemTokens = useMemo(() => ct?.systemTokens || 0, [ct?.systemTokens]);
  const systemToolTokens = useMemo(() => ct?.systemToolTokens || 0, [ct?.systemToolTokens]);
  const readCacheTokens = useMemo(() => ct?.readCacheTokens || 0, [ct?.readCacheTokens]);
  const messageTokens = useMemo(
    () => promptTokens + completionTokens,
    [promptTokens, completionTokens]
  );
  const skillTokens = useMemo(() => ct?.skillTokens || 0, [ct?.skillTokens]);
  const ruleTokens = useMemo(() => ct?.ruleTokens || 0, [ct?.ruleTokens]);
  const mcpTokens = useMemo(() => ct?.mcpTokens || 0, [ct?.mcpTokens]);

  const totalTokens = useMemo(
    () => messageTokens + compressTokens + systemTokens + systemToolTokens + readCacheTokens + skillTokens + ruleTokens + mcpTokens,
    [messageTokens, compressTokens, systemTokens, systemToolTokens, readCacheTokens, skillTokens, ruleTokens, mcpTokens]
  );

  const displayTokens = useMemo(() => formatTokens(totalTokens), [totalTokens]);

  // 用于百分比计算的总量（所有分项之和，避免除以input/output产生误差）
  const pctBase = useMemo(() => {
    return totalTokens > 0 ? totalTokens : 1;
  }, [totalTokens]);

  const chatType = useChatStore((state) => state.chatType);

  const tokenRows = useMemo<TokenRowProps[]>(
    () => {
      if (chatType === 'codebase') {
        return [
          { color: '#94a3b8', label: 'System prompt', value: systemTokens, total: pctBase, isDark },
          { color: '#60a5fa', label: 'System tools', value: systemToolTokens, total: pctBase, isDark, tooltop: '当前只有Claude系列模型支持计算System tools消耗的Tokens' },
          { color: '#34d399', label: 'Messages', value: messageTokens, total: pctBase, isDark },
          { color: '#a78bfa', label: 'Read Cache', value: readCacheTokens, total: pctBase, isDark, tooltop: '当前只有Claude系列模型才支持缓存' },
          { color: '#fb7185', label: 'Mcp tokens', value: mcpTokens, total: pctBase, isDark },
          { color: '#fbbf24', label: 'Skill tokens', value: skillTokens, total: pctBase, isDark },
          { color: '#fdba74', label: 'Rule tokens', value: ruleTokens, total: pctBase, isDark },
        ]
      } else {
        return [
          { color: '#94a3b8', label: 'Input Tokens', value: promptTokens, total: pctBase, isDark },
          { color: '#60a5fa', label: 'Output Tokens', value: completionTokens, total: pctBase, isDark },
        ]
      }
    },
    [chatType, systemTokens, pctBase, isDark, systemToolTokens, messageTokens, readCacheTokens, mcpTokens, skillTokens, ruleTokens, promptTokens, completionTokens]
  );

  if (!totalTokens) return null;

  return (
    <Popover placement="top-start" trigger="hover" openDelay={0} closeDelay={200}>
      <PopoverTrigger>
        <MiniButton
          _hover={{
            opacity: 0.8,
            color: '#776fff',
          }}
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
            {/* 标题 */}
            <Text
              fontSize="xs"
              color={isDark ? '#AAAAAA' : '#555'}
              mb={1}
              fontWeight="medium"
            >
              本次会话消耗 Tokens 分布：
            </Text>

            {/* Token 分项列表 */}
            {tokenRows.map((row) => (
              <TokenRow key={row.label} {...row} />
            ))}

            {/* 分隔线 */}
            <Box
              borderTop="1px solid"
              borderColor={isDark ? '#333' : '#E5E7EB'}
              mt={1}
              pt={1}
            />

            {/* 底部提示 */}
            <Flex fontSize="xs" color={isDark ? '#808080' : '#666'} flexWrap="wrap" alignItems="center">
              <Text>会话消耗 Tokens 将根据</Text>
              <Link
                color="blue.300"
                px="1"
                cursor="pointer"
                onClick={() => {
                  postMessage({
                    type: 'OPEN_IN_BROWSER',
                    data: {
                      url: 'https://modelspace.netease.com/model_app',
                    },
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