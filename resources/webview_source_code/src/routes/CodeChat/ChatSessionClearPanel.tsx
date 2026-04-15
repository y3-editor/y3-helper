import * as React from 'react';
import {
  Box,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@chakra-ui/react';
import userReporter from '../../utils/report';

import { useChatStore, useChatSessionTracker } from '../../store/chat';
import { UserEvent } from '../../types/report';

const ChatSessionClearPanel = (props: { messageID: string }) => {
  const { messageID } = props;
  const [isOpenModal, setIsOpenModal] = React.useState(false);
  const [onNewSession, clearSession] = useChatStore((state) => [
    state.onNewSession,
    state.clearSession,
  ]);
  const removeSessionID = useChatSessionTracker(
    (state) => state.removeSessionID,
  );

  const resetMessage = React.useCallback(async () => {
    await clearSession();
    removeSessionID(messageID);
  }, [messageID, clearSession, removeSessionID]);

  return (
    <>
      <Box
        mt="2"
        color="text.default"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        fontSize="12px"
      >
        当前会话数较多，建议
        <Text
          color="blue.300"
          _hover={{
            cursor: 'pointer',
          }}
          onClick={() => {
            setIsOpenModal(true);
          }}
        >
          一键清除
        </Text>
        或
        <Text
          color="blue.300"
          _hover={{
            cursor: 'pointer',
          }}
          onClick={() => {
            userReporter.report({
              event: UserEvent.CODE_CHAT_NEW_SESSION,
            });
            onNewSession();
          }}
        >
          新建对话
        </Text>
        以保持流畅使用
      </Box>
      <Modal
        isCentered
        isOpen={isOpenModal}
        onClose={() => setIsOpenModal(false)}
        trapFocus={false}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>清除会话</ModalHeader>
          <ModalBody>
            <div>确定清除当前会话吗？</div>
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
                resetMessage();
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
};

export default ChatSessionClearPanel;
