import * as React from 'react';
import { Box, IconButton, Tooltip } from '@chakra-ui/react';
import { ChevronUpIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { FaAngleDoubleDown } from 'react-icons/fa';

export interface ChatNavigationButtonsProps {
  userMsgIndexes: number[];
  isStreaming?: boolean;
  onPrevMessage: () => void;
  onNextMessage: () => void;
  onScrollToBottom: () => void;
  canGoPrev?: () => boolean;
  canGoNext?: () => boolean;
}

const ChatNavigationButtons: React.FC<ChatNavigationButtonsProps> = ({
  userMsgIndexes,
  isStreaming = false,
  onPrevMessage,
  onNextMessage,
  onScrollToBottom,
  canGoPrev,
  canGoNext,
}) => {
  // 使用 state 来触发重新渲染
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // 鼠标悬停时更新按钮状态
  const handleMouseEnter = React.useCallback(() => {
    forceUpdate();
  }, []);

  // 默认：只要有多条用户消息，按钮就可用
  const hasMultipleMessages = userMsgIndexes.length > 1;

  // 如果提供了检查函数，使用检查函数的结果
  const isPrevDisabled = canGoPrev ? !canGoPrev() : !hasMultipleMessages;
  const isNextDisabled = canGoNext ? !canGoNext() : !hasMultipleMessages;

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {!isStreaming && (
        <>
          <Tooltip label="上一组对话">
            <IconButton
              size="sm"
              aria-label="To previous user message"
              icon={<ChevronUpIcon boxSize={6} />}
              onClick={onPrevMessage}
              onMouseEnter={handleMouseEnter}
              isDisabled={isPrevDisabled}
            />
          </Tooltip>
          <Tooltip label="下一组对话">
            <IconButton
              size="sm"
              aria-label="To next user message"
              icon={<ChevronDownIcon boxSize={6} />}
              onClick={onNextMessage}
              onMouseEnter={handleMouseEnter}
              isDisabled={isNextDisabled}
            />
          </Tooltip>
        </>
      )}

      <Tooltip label="置底">
        <IconButton
          size="sm"
          aria-label="To bottom"
          icon={<FaAngleDoubleDown size={14} />}
          onClick={onScrollToBottom}
        />
      </Tooltip>
    </Box>
  );
};

export default ChatNavigationButtons;
