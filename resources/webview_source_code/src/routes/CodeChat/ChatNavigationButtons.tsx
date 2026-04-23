import * as React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@chakra-ui/react';
import { FaAngleDoubleDown, FaAngleUp, FaAngleDown } from 'react-icons/fa';
import Icon from '../../components/Icon';
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
    <Box display="flex" alignItems="center" gap="2" color="text.default">
      {/* 上/下导航按钮组 - 组合在一个圆角容器内 */}
      {!isStreaming && (
        <Box
          display="flex"
          alignItems="center"
          borderRadius="md"
          // bg="darkerButtonBgColor"
        >
          <Tooltip label="上一组对话">
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="To previous user message"
              icon={<Icon as={FaAngleUp} size="xs" />}
              onClick={onPrevMessage}
              onMouseEnter={handleMouseEnter}
              isDisabled={isPrevDisabled}
              borderRadius="md"
              color="text.default"
            />
          </Tooltip>
          <Tooltip label="下一组对话">
            <IconButton
              size="xs"
              variant="ghost"
              aria-label="To next user message"
              icon={<Icon as={FaAngleDown} size="xs" />}
              onClick={onNextMessage}
              onMouseEnter={handleMouseEnter}
              isDisabled={isNextDisabled}
              borderRadius="md"
              color="text.default"
            />
          </Tooltip>
        </Box>
      )}
      {!isStreaming && <Divider h="14px" orientation="vertical" />}
      <Box display="flex" alignItems="center">
        <Tooltip label="置底" placement="top">
          <Box as="span" display="inline-flex" cursor="pointer" onClick={onScrollToBottom}>
            <Icon as={FaAngleDoubleDown} size="xxs" />
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatNavigationButtons;