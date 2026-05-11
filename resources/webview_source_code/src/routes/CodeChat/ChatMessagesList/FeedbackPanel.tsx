import * as React from 'react';
import { Flex, Box, IconButton, Tooltip } from '@chakra-ui/react';
import { TbThumbUp, TbThumbDown } from 'react-icons/tb';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { useTaskCompletionStore } from '../../../modules/subagent';
import { ChatFeedbackType } from '../../../services';
import { useAuthStore } from '../../../store/auth';
import userReporter from '../../../utils/report';
import { FeedbackPool } from '../../../services/useChatStream';
import { FeedbackType, sendBMDocsetFeedback } from '../../../services/docsets';
import Icon from '../../../components/Icon';
import '../../../assets/github-markdown-dark.css';
import { UserEvent } from '../../../types/report';

export default function FeedbackPanel(props: {
  userScrollLock: boolean;
  onCodeBaseFeedback: (feedbackType: ChatFeedbackType) => void;
  submitMessageFeedback: any;
}) {
  const { userScrollLock, onCodeBaseFeedback, submitMessageFeedback } = props;
  const chatType = useChatStore((state) => state.chatType);
  const currentSession = useChatStore((state) => state.currentSession());
  const currentSessionId = currentSession?._id;
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const isMCPProcessing = useChatStreamStore((state) => state.isMCPProcessing);
  const isApplying = useChatStreamStore((state) => state.isApplying);
  const lastMessagePrompt = useChatStore((state) => state.lastMessagePrompt);
  const isTerminalProcessing = useChatStreamStore(
    (state) => state.isTerminalProcessing,
  );
  const isSubagentProcessing = !useTaskCompletionStore(
    (state) => state.isSessionComplete(currentSessionId || ''),
  );
  const setShowFeedback = useChatStreamStore((state) => state.setShowFeedback);
  const lastMessageSearchRecordId = useChatStore(
    (state) => state.lastMessageSearchRecordId,
  );
  const username = useAuthStore((state) => state.username);
  const [shouldShowFeedback, setShouldShowFeedback] = React.useState(false);
  const prevStreamState = React.useRef(isStreaming);
  const feedbackRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (
      isStreaming ||
      isSearching ||
      isProcessing ||
      isMCPProcessing ||
      isApplying ||
      isTerminalProcessing ||
      isSubagentProcessing
    ) {
      setShouldShowFeedback(false);
    }
    if (
      prevStreamState.current &&
      !isStreaming &&
      !isProcessing &&
      !isMCPProcessing &&
      !isApplying &&
      !isTerminalProcessing &&
      !isSubagentProcessing
    ) {
      setShouldShowFeedback(true);
      if (!userScrollLock) {
        setTimeout(() => {
          if (feedbackRef.current) {
            // 使用最近的可滚动容器 scrollTo，避免 scrollIntoView 冒泡导致外层 #root 被滚动
            const container = feedbackRef.current.closest('#code-chat-body');
            if (container) {
              container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth',
              });
            }
          }
        });
      }
    }
    prevStreamState.current = isStreaming;
  }, [
    isStreaming,
    isSearching,
    isProcessing,
    isMCPProcessing,
    isApplying,
    userScrollLock,
    isTerminalProcessing,
    isSubagentProcessing,
  ]);

  React.useEffect(() => {
    setShowFeedback(shouldShowFeedback);
  }, [setShowFeedback, shouldShowFeedback]);

  const resetFeedback = () => {
    FeedbackPool.clear();
    setShouldShowFeedback(false);
  };

  const latestMessage =
    currentSession?.data?.messages[currentSession?.data.messages.length - 1];

  const handleUpVote = () => {
    if (chatType === 'codebase') {
      onCodeBaseFeedback(ChatFeedbackType.UpVote);
    } else {
      submitMessageFeedback(latestMessage?.id, ChatFeedbackType.UpVote);
      userReporter.report({
        event: UserEvent.CODE_CHAT_UP_VOTE,
        extends: {
          session_id: currentSession?._id,
          message_id: latestMessage?.id,
          chat_type: chatType,
        },
      });
      if (lastMessageSearchRecordId && lastMessagePrompt) {
        sendBMDocsetFeedback(
          `docset_${lastMessagePrompt._id}`,
          lastMessageSearchRecordId,
          FeedbackType.up,
          username || '',
        );
      }
    }

    resetFeedback();
  };

  const handleDownVote = () => {
    if (chatType === 'codebase') {
      onCodeBaseFeedback(ChatFeedbackType.DownVote);
    } else {
      submitMessageFeedback(latestMessage?.id, ChatFeedbackType.DownVote);
      userReporter.report({
        event: UserEvent.CODE_CHAT_DOWN_VOTE,
        extends: {
          session_id: currentSession?._id,
          message_id: latestMessage?.id,
          chat_type: chatType,
        },
      });
      if (lastMessageSearchRecordId && lastMessagePrompt) {
        sendBMDocsetFeedback(
          `docset_${lastMessagePrompt._id}`,
          lastMessageSearchRecordId,
          FeedbackType.down,
          username || '',
        );
      }
    }

    resetFeedback();
  };

  if (!currentSession?.data?.messages.length) {
    return null;
  }

  return (
    <div>
      {shouldShowFeedback && (
        <Flex
          p="1"
          mt={4}
          // backgroundColor="whiteAlpha.50"
          alignItems="center"
          justifyContent="center"
          ref={feedbackRef}
          backgroundColor="listBgColor"
          color="text.secondary"
        >
          <Box>该答案是否对你有所帮助？</Box>
          <Tooltip label="赞">
            <IconButton
              variant="ghost"
              aria-label="赞"
              icon={<Icon as={TbThumbUp} size="sm" />}
              onClick={handleUpVote}
            />
          </Tooltip>
          <Tooltip label="踩">
            <IconButton
              variant="ghost"
              aria-label="踩"
              icon={<Icon as={TbThumbDown} size="sm" />}
              onClick={handleDownVote}
            />
          </Tooltip>
        </Flex>
      )}
    </div>
  );
}