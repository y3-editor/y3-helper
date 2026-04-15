import * as React from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Box,
  Portal,
  // Text,
  Flex,
} from '@chakra-ui/react';
import { useChatConfig } from '../../store/chat-config';
// import { useTheme } from '../../ThemeContext';
import { ChatModel } from '../../services/chatModel';
import MiniButton from '../../components/MiniButton';

interface MaxTokenPopoverProps {
  currentToken: number;
  prefix?: string;
}
const MaxTokenPopover = (props: MaxTokenPopoverProps) => {
  const { currentToken, prefix } = props;
  // 模拟 Tooltip hover 效果
  const [isOpen, setIsOpen] = React.useState(false);
  const [model, responseTokens, modelMaxTokenMap] = useChatConfig((state) => [
    state.config.model,
    state.config.max_tokens,
    state.modelMaxToken,
  ]);
  // const { activeTheme } = useTheme();
  // const isLight = activeTheme === 'light';
  const modelMaxToken = React.useMemo(() => {
    // Claude37SonnetThinking 和 Claude37Sonnet 用的模型一样，所以这里直接返回 Claude37Sonnet
    if (model === ChatModel.Claude37SonnetThinking) {
      return modelMaxTokenMap[ChatModel.Claude37Sonnet];
    } else if (model == ChatModel.Claude4Sonnet20250514Thinking) {
      return modelMaxTokenMap[ChatModel.Claude4Sonnet20250514];
    } else if (model == ChatModel.Claude45Sonnet20250929Thinking) {
      return modelMaxTokenMap[ChatModel.Claude45Sonnet20250929];
    } else if (
      [
        ChatModel.Claude45Opus20251101,
        ChatModel.Claude45Opus20251101Thinking,
      ].includes(model)
    ) {
      return 32000;
    }
    return modelMaxTokenMap[model];
  }, [model, modelMaxTokenMap]);

  const isExceedsMaxTokenCount = currentToken + responseTokens > modelMaxToken;

  const maxToken = React.useMemo(() => {
    return modelMaxToken - responseTokens;
  }, [modelMaxToken, responseTokens]);

  return (
    <Popover placement="top-start" isOpen={isOpen} onClose={close}>
      <PopoverTrigger>
        <MiniButton
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          // bg={isLight ? '#F2F2F2' : '#2C2C2C'}
          // h="28px"
          // minH="28px"
          // display="inline-flex"
          // alignItems="center"
          // px="2"
          // borderRadius="4px"
          // _hover={{
          //   cursor: 'pointer',
          //   bg: isLight ? '#F2F2F2' : '#2C2C2C',
          // }}
        >
          <Flex
            alignItems="center"
            gap={1}
            color={isExceedsMaxTokenCount ? 'warning' : 'text.default'}
            _hover={{
              color: isExceedsMaxTokenCount ? 'warning' : '#746cec',
            }}
          >
            {prefix}
            {currentToken}
          </Flex>
        </MiniButton>
      </PopoverTrigger>
      <Portal>
        <PopoverContent maxW="220px">
          <PopoverBody color="text.default" fontSize="12px">
            {isExceedsMaxTokenCount ? (
              <Box>
                当前上下文与输入内容超过可用 Token 数 {maxToken}
                ，请减少内容，或在右侧的配置修改单次回复限制
              </Box>
            ) : (
              <Box>
                <Box>当前已使用 {currentToken} 个 Token</Box>
                <Box>最多支持使用 {maxToken} 个 Token</Box>
              </Box>
            )}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

export default MaxTokenPopover;
