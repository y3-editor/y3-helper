import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Text,
  Flex,
  Link,
} from '@chakra-ui/react';
import { useTheme, ThemeStyle } from "../../../ThemeContext";
import { useChatStore } from '../../../store/chat';
import { useMemo } from 'react';
import { usePostMessage } from '../../../PostMessageProvider';


export default function ChatConsumeTokenPanel() {
  const { activeTheme } = useTheme();
  const { postMessage } = usePostMessage();
  const isDark = activeTheme === ThemeStyle.Dark;

  const currentSession = useChatStore((state) => state.currentSession());

  const totalTokens = useMemo(() => {
    return ((currentSession?.data?.consumedTokens?.input || 0) + ((currentSession?.data?.consumedTokens?.output || 0))) || 0;
  }, [currentSession?.data?.consumedTokens?.input, currentSession?.data?.consumedTokens?.output])

  const displayTokens = useMemo(() => {
    const billion = 1000 * 1000 * 1000;
    const million = 1000 * 1000;
    const thousand = 1000;

    if (totalTokens >= billion) {
      // 超过十亿，显示为B (billion)
      return (totalTokens / billion).toFixed(0) + 'B';
    } else if (totalTokens >= million) {
      // 超过百万，显示为M (million)
      return (totalTokens / million).toFixed(0) + 'M';
    } else if (totalTokens >= thousand) {
      // 超过千，显示为k (kilo)
      return (totalTokens / 1000).toFixed(0) + 'K';
    } else {
      // 小于1000，显示原始值
      return totalTokens
    }
  }, [totalTokens])

  if (!totalTokens) return null

  return (
    <Popover placement="top-start" trigger="hover" openDelay={0} closeDelay={200}>
      <PopoverTrigger>
        <Flex
          px={2}
          alignItems={'center'}
          justifyContent={'center'}
          cursor="pointer"
          borderRadius="md"
          border="1px solid"
          bg={isDark ? 'transparent' : '#EEF0F2'}
          borderColor={isDark ? '#404040' : 'blackAlpha.100'}
          fontFamily="monospace"
          fontSize="xs"
          h="32px"
          _hover={{
            opacity: 0.8,
            color: '#776fff',
          }}
          transition="all 0.2s"
          color={isDark ? '#808080' : '#999'}
        >
          Tokens: {displayTokens}
        </Flex>
      </PopoverTrigger>
      <PopoverContent
        bg={isDark ? '#1E1E1E' : '#FFFFFF'}
        border="1px solid"
        borderColor={isDark ? '#333333' : '#E5E7EB'}
        boxShadow="xl"
        // width="260px"
        _focus={{ boxShadow: "xl" }}
        borderRadius="lg"
      >
        <PopoverBody px={4} py={2}>
          <Flex direction="column" alignItems="flex-start" justifyContent={'center'} >
            <Flex alignItems={'center'}>
              <Flex fontSize="xs" color={isDark ? '#808080' : '#666'} mb={0.5}>
                <Text>本次会话消耗（将根据</Text>
                <Link
                  color="blue.300"
                  px="1"
                  onClick={() => {
                    postMessage({
                      type: 'OPEN_IN_BROWSER',
                      data: {
                        url: 'http://localhost:3001',
                      },
                    });
                  }}
                >
                  模型单价
                </Link>
                <Text>转换为消耗积分）</Text>
              </Flex>
            </Flex>
            <Text fontSize="md">
              {/* {displayMount} 积分 ({(cost || 0)?.toFixed(2)} 元) */}
              {/* Tokens: {totalTokens} */}
            </Text>
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover >
  );
}
