import * as React from 'react';
import { Button, VStack } from '@chakra-ui/react';
import { useChatStore } from '../../store/chat';

const ChatRecommendation = (props: {
  questions: string[];
  onSubmit: (prompt: string) => void;
  onFillInput?: (prompt: string) => void;
  scrollToBottom?: () => void;
}) => {
  const { questions = [], onSubmit, onFillInput, scrollToBottom } = props;
  const chatType = useChatStore((state) => state.chatType);

  const handleClick = (question: string) => {
    // codebase模式：填充到输入框
    // 普通聊天模式：直接发送
    if (chatType === 'codebase' && onFillInput) {
      onFillInput(question);
    } else {
      onSubmit(question);
    }
  };

  /** 组件更新后，自动滚动到底部 */
  React.useEffect(() => {
    if (scrollToBottom) {
      scrollToBottom();
    }
  }, [scrollToBottom]);

  return (
    <div>
      <VStack p={2} opacity={0.6}>
        {questions.map((question) => (
          <Button
            h="32px"
            w="60%"
            p={4}
            mt="2"
            textAlign="center"
            justifyContent="center"
            whiteSpace="normal"
            onClick={() => handleClick(question)}
            key={question}
            borderRadius="8px"
            bg="questionsBgColor"
            borderColor="customBorder"
            borderWidth="1px"
            _hover={{ borderColor: 'blue.300', color: 'blue.300' }}
          >
            {question}
          </Button>
        ))}
      </VStack>
    </div>
  );
};

export default ChatRecommendation;
