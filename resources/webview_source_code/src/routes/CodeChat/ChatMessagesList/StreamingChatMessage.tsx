import * as React from 'react';
import {
  Avatar,
  Box,
  Button,
  Flex,
  Spinner,
} from '@chakra-ui/react';
import { FaAngleRight, FaAngleDown } from 'react-icons/fa6';
import {
  retryLabels,
  useChatStore,
  useChatStreamStore,
} from '../../../store/chat';
import Icon from '../../../components/Icon';
import CodeSearchBlock from '../CodeSearchBlock';
import '../../../assets/github-markdown-dark.css';
import MarkdownRenderer from '../MarkdownRenderer';
import CodeMakerLogo from '../../../assets/cmlogo.png';
import { ChatRole } from './types';

export function StreamingChatMessage() {
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const streamingContent = useChatStreamStore((state) => state.message.content);
  const streamingCodeContent = useChatStreamStore((state) => state.message.codeContent);
  const streamingReasoning = useChatStreamStore((state) => state.message.reasoningContent || state.message.reasoning_content);
  const loadingMessage = useChatStreamStore((state) => state.loadingMessage);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const searchMessage = useChatStreamStore((state) => state.searchMessage);
  const retryType = useChatStreamStore((state) => state.retryType);
  const streamRetryCount = useChatStreamStore((state) => state.streamRetryCount);
  const [expand, setExpand] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const currentSession = useChatStore((state) => state.currentSession());

  const showThinkingContent = React.useMemo(() => {
    return !!(streamingReasoning && (streamingReasoning as string).length);
  }, [streamingReasoning]);

  const isNewMessage = React.useMemo(() => {
    if (!currentSession?.data?.messages?.length) return true;
    const sendMessages = currentSession?.data?.messages || [];
    return sendMessages[sendMessages.length - 1] && sendMessages[sendMessages.length - 1].role === ChatRole.User;
    // 流式过程中currentSession?.data?.messages没有更新地址，导致状态没有更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.data?.messages, isStreaming, isSearching, isProcessing, streamRetryCount])

  if (!isStreaming && !isSearching && !isProcessing) {
    return null;
  }

  const renderContent = ((streamingContent as string) || '') + (streamingCodeContent || '');

  return (
    <div id="streaming-assistant">
      {
        isNewMessage && (
          <Flex gap={2} h={8} mx={4} alignItems="center">
            <Box display="flex" alignItems="center">
              <Avatar w="16px" h="18px" src={CodeMakerLogo} mr="2" />
              <Box flex={1} color="text.secondary" fontSize="12px">
                Y3Maker
              </Box>
            </Box>
          </Flex>
        )
      }
      <Box m="2" p="2" mx="4" px="0">
        {isSearching ? <Box mb="2">正在搜索相关代码....</Box> : ''}
        {searchMessage?.length ? (
          <>
            <Box mb="2">
              搜索返回 {searchMessage.length} 条相关代码段，
              <Button
                color="blue.300"
                variant="link"
                onClick={() => setExpand(!expand)}
              >
                {!expand ? '展开' : '收起'}详情
              </Button>
            </Box>
            {expand ? (
              <>
                {searchMessage.map((item, index) => (
                  <CodeSearchBlock data={item} index={index} key={index} />
                ))}
              </>
            ) : null}
          </>
        ) : (
          ''
        )}
        {(isStreaming || isProcessing) && (
          <Box>
            {showThinkingContent ? (
              <Box>
                <Box
                  cursor="pointer"
                  color="text.default"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  display="flex"
                  alignItems="center"
                  mb="1"
                >
                  {!isCollapsed ? (
                    <Icon as={FaAngleDown} size="xs" />
                  ) : (
                    <Icon as={FaAngleRight} size="xs" />
                  )}
                  <Box ml="1" color="text.primary">
                    思考过程
                  </Box>
                </Box>
                <blockquote className="border-l-4 border-gray-300 pl-4 my-0 mx-0 text-gray-600 italic">
                  <div
                    className={
                      isCollapsed
                        ? "overflow-hidden whitespace-nowrap"
                        : "whitespace-pre-line"
                    }
                    style={isCollapsed ? { direction: 'rtl', textAlign: 'left' } : {}}
                  >
                    <span style={isCollapsed ? { direction: 'ltr' } : {}}>
                      {streamingReasoning}
                    </span>
                  </div>
                </blockquote>
              </Box>
            ) : null}
            <MarkdownRenderer content={renderContent} />
            <Spinner size="xs" />
            {loadingMessage && <span className="ml-1">{loadingMessage}</span>}
            {streamRetryCount > 0 && (
              <span className='ml-2 animate-shimmer text-[#848484]'>
                {retryLabels[retryType]}，正在进行自动重试 ({streamRetryCount} / 3)
              </span>
            )}
          </Box>
        )}
      </Box>
    </div>
  );
}

export default StreamingChatMessage;
