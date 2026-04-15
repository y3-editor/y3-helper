import { Box, Flex, Avatar, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@chakra-ui/react';
import CodeMakerLogo from '../../../assets/cmlogo.png';
import ChatAssistantMessage from './AssistantMessage';
import { GroupAIMessageProps } from './types';
import ChatMessageActionBar from '../ChatMessageActionBar';
import userReporter from '../../../utils/report';
import { useChatStore, useChatStreamStore } from '../../../store/chat';
import { useCallback, useMemo, useState } from 'react';
import { BroadcastActions, usePostMessage } from '../../../PostMessageProvider';
import { createNewSession } from '../../../utils/chat';
import FileRecommendApplyPanel, { IRecommendFileChangeRecord } from '../FileRecommendApplyPanel';
import { UserEvent } from '../../../types/report';
import { ChatRole } from '../../../types/chat';

export function GroupAIMessage({
  messages,
  isLatest,
  attachs = [],
  onFeedback,
  isShare,
}: GroupAIMessageProps) {
  const message = messages[0];
  const [isShowAction, setIsShowAction] = useState(false);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [removeQA, onNewSession, chatType] = useChatStore((state) => [state.removeQA, state.onNewSession, state.chatType]);
  const currentSession = useChatStore((state) => state.currentSession());
  const { postMessage } = usePostMessage();
  const isStreaming = useChatStreamStore((state) => state.isStreaming);
  const isProcessing = useChatStreamStore((state) => state.isProcessing);
  const isSearching = useChatStreamStore((state) => state.isSearching);
  const showFeedback = useChatStreamStore((state) => state.showFeedback);
  const onUserResubmit = useChatStreamStore((state) => state.onUserResubmit);
  const setStreamRetryCount = useChatStreamStore((state) => state.setStreamRetryCount);
  const [recommendFileChanges, setRecommendFileChanges] = useState<IRecommendFileChangeRecord>({});
  const enableReply = useMemo(() => {
    if (isStreaming || isSearching) return false;
    if (!currentSession?.data?.messages?.length) return false;
    const sendMessages = currentSession?.data?.messages || [];
    for (let i = sendMessages.length - 1; i >= 0; i--) {
      const sendMessage = sendMessages[i];
      if (
        sendMessage.role === ChatRole.User &&
        sendMessage._originalRequestData
      ) {
        return true;
      }
    }
    return false;
  }, [isStreaming, isSearching, currentSession?.data?.messages]);

  const handleCopyToClipboard = useCallback(
    () => {
      let content = '';
      for (const msg of messages) {
        content += msg.content as string;
      }
      userReporter.report({
        event: UserEvent.CODE_CHAT_COPY,
        extends: {
          session_id: currentSession?._id,
          message_id: message.id,
        },
      });
      postMessage({
        type: BroadcastActions.COPY_TO_CLIPBOARD,
        data: content,
      });
    },
    [postMessage, currentSession?._id, message.id, messages],
  );

  const handleNewSession = useCallback(() => {
    if (!currentSession || !message.id) return;
    const newMessages = createNewSession(message, currentSession, chatType);
    void onNewSession(newMessages);
  }, [message, currentSession, onNewSession, chatType]);

  const onRetryClick = useCallback(() => {
    setStreamRetryCount(0)
    onUserResubmit()
  }, [onUserResubmit, setStreamRetryCount])

  const renderActionBar = useMemo(() => {
    if (isShowAction && !isStreaming && !isProcessing && !isSearching) {
      const hideNewSession = false; // 允许所有聊天类型都支持从此处重新发起对话
      const hideRemove = false;
      const hideRetry = isSearching || isStreaming || !isLatest || !enableReply || !!message.revertedFiles;
      const shouldShowFeedback = !isLatest || (isLatest && !showFeedback);
      const feedbackType = message.feedback;

      const isCompressedMessage = message.isCompressed || false;
      const isCompressionSummary = message.isCompressionSummary || false;

      if (isCompressionSummary) return null;
      return (
        <ChatMessageActionBar
          onCopyClick={() => {
            handleCopyToClipboard();
          }}
          onNewSessionClick={() => {
            handleNewSession();
          }}
          onRemoveClick={() => {
            setIsOpenModal(true);
          }}
          onFeedbackClick={onFeedback}
          onRetryClick={onRetryClick}
          hideNewSession={hideNewSession}
          hideRemove={hideRemove}
          hideRetry={hideRetry}
          feedbackType={feedbackType}
          shouldShowFeedback={shouldShowFeedback}
          isCompressedMessage={isCompressedMessage}
          isCompressionSummary={isCompressionSummary}
        />
      );
    } else {
      return null;
    }
  }, [
    isShowAction,
    message,
    isSearching,
    isStreaming,
    isProcessing,
    enableReply,
    handleNewSession,
    handleCopyToClipboard,
    isLatest,
    onRetryClick,
    onFeedback,
    showFeedback,
  ]);

  const data = { message, defaultExpanded: isLatest };

  return (
    <>
      <Box
        pb="0"
        mt="0"
        onMouseMove={() => {
          setIsShowAction(true);
        }}
        onMouseLeave={() => {
          setIsShowAction(false);
        }}
      >
        <Flex gap={2} h={8} mx={4} alignItems="center">
          <Box display="flex" alignItems="center">
            <Avatar w="16px" h="18px" src={CodeMakerLogo} mr="2" />
            <Box flex={1} color="text.secondary" fontSize="12px">
              Y3Maker
            </Box>
          </Box>
          {!isShare && renderActionBar}
        </Flex>
        <Box className="m-2 mx-4 px-0 py-1" color="text.primary">
          {messages.map((message, index) => {
            const isAssistant = message.role === ChatRole.Assistant;
            if (isAssistant && !message.processing) {
              return (
                <ChatAssistantMessage
                  key={(message?.id || '') + index}
                  index={index}
                  message={message}
                  isLatest={isLatest}
                  isRecent={index === messages.length - 1 && isLatest}
                  attachs={attachs}
                  onNewSession={onNewSession}
                  onFeedback={onFeedback}
                  isShare={isShare}
                  setRecommendFileChanges={setRecommendFileChanges}
                />
              );
            }

            return null;
          })}
        </Box>
        {
          !isShare && !isStreaming && !isProcessing && !isSearching &&
          <Flex
            gap={2}
            h={8}
            mx={4}
            mb={4}
            alignItems="center"
            justifyContent="right"
          >
            {renderActionBar}
          </Flex>
        }
      </Box>
      {isLatest && !!Object?.keys(recommendFileChanges)?.length && (
        <FileRecommendApplyPanel
          data={{
            ...data,
            sessionId: currentSession?._id || ''
          }}
          recommendFileChanges={recommendFileChanges}
        />
      )}
      <Modal
        isCentered
        isOpen={isOpenModal}
        onClose={() => setIsOpenModal(false)}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>删除问答</ModalHeader>
          <ModalBody>
            <div>确定删除当前问答吗？</div>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={() => setIsOpenModal(false)}>
              取消
            </Button>
            <Button
              colorScheme="blue"
              color="white"
              mr={3}
              onClick={() => {
                if (!message.id) return;
                removeQA(message.id, messages[messages.length - 1].id);
                setIsOpenModal(false);
              }}
            >
              确定
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
