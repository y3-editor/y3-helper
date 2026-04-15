import * as React from 'react';
import {
  CircularProgress,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Spinner,
  Flex,
} from '@chakra-ui/react';
import { useChatStore } from '../../store/chat';
import { useChatConfig } from '../../store/chat-config';
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

interface TokenUsageIndicatorProps {
  visible?: boolean;
}

const COMPRESSION_THRESHOLD =
  DEFAULT_COMPRESSION_CONFIG.thresholds.compressionThreshold;

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

  if (!visible || currentTokens === 0 || maxTokens === 0) {
    return null;
  }

  const progressColor = 'blue.400';

  return (
    <Popover trigger="hover" placement="top-start" openDelay={0} closeDelay={200}>
      <PopoverTrigger>
        <Flex
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          px={2}
          borderRadius="md"
          border="1px solid"
          borderColor={isDark ? '#404040' : 'blackAlpha.100'}
          bg={isDark ? 'transparent' : '#EEF0F2'}
          _hover={{
            opacity: 0.8,
            color: '#776fff',
          }}
          transition="all 0.2s"
          h="32px"
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
        </Flex>
      </PopoverTrigger>
      <PopoverContent
        bg={isDark ? '#1E1E1E' : '#FFFFFF'}
        border="1px solid"
        borderColor={isDark ? '#333333' : '#E5E7EB'}
        borderRadius="lg"
        width="auto"
        minW="200px"
        boxShadow="xl"
        _focus={{ boxShadow: 'xl' }}
      >
        <PopoverBody px={4} py={2} textAlign="left">
          <Text fontSize="xs" color={isDark ? '#808080' : '#666'}>
            上下文窗口（达到100%触发总结）
          </Text>
          {/* <Text fontSize="md" lineHeight="1.4"> */}
            {/* 已占用 {percentage}% */}
          {/* </Text> */}
          {isCompressing && (
            <Text fontSize="xs" color="blue.400" mt={2} lineHeight="1">
              正在自动总结上下文...
            </Text>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

export default TokenUsageIndicator;
