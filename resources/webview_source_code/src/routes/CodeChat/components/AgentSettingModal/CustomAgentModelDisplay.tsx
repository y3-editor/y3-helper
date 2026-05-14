import * as React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { useChatConfig } from '../../../../store/chat-config';
import { CLAUDE_ALIAS_MAP } from '../../../../modules/subagent/constants';
import { resolveModelCodeByUseModel } from '../ModelPicker';

const INHERIT_VALUE = '';

const CUSTOM_AGENT_MODEL_DISPLAY_WIDTH = '180px';

interface CustomAgentModelDisplayProps {
  model?: string;
  isDark: boolean;
}

const CustomAgentModelDisplay: React.FC<CustomAgentModelDisplayProps> = ({
  model,
  isDark,
}) => {
  const chatModels = useChatConfig((state) => state.chatModels);

  const { displayText, isInherit, isUnavailable } = React.useMemo(() => {
    const trimmed = (model || '').trim();

    if (!trimmed || trimmed.toLowerCase() === 'inherit') {
      return { displayText: 'inherit', isInherit: true, isUnavailable: false };
    }

    // 1. 先尝试 Claude 短别名解析（D4 决策：优先走别名映射）
    if (Object.prototype.hasOwnProperty.call(CLAUDE_ALIAS_MAP, trimmed)) {
      const useModel = CLAUDE_ALIAS_MAP[trimmed];
      // 从 chatModels 中查找匹配 useModel 的条目
      const matched = Object.values(chatModels).find(
        (c) => c?.useModel === useModel || c?.code === useModel,
      );
      if (matched) {
        return {
          displayText: matched.title || trimmed,
          isInherit: false,
          isUnavailable: false,
        };
      }
      // 别名解析后在 chatModels 中仍无匹配 → 不可用
      return {
        displayText: trimmed,
        isInherit: false,
        isUnavailable: true,
      };
    }

    // 2. 原有逻辑：直接按 useModel/code 查找
    const code = resolveModelCodeByUseModel(trimmed, chatModels);
    const title = chatModels[code]?.title || chatModels[trimmed]?.title;
    const isAvailable = Object.values(chatModels).some(
      (c) => c?.useModel === trimmed || c?.code === trimmed,
    );
    return {
      displayText: title || trimmed,
      isInherit: false,
      isUnavailable: !isAvailable,
    };
  }, [model, chatModels]);

  return (
    <Box
      minW={CUSTOM_AGENT_MODEL_DISPLAY_WIDTH}
      maxW={CUSTOM_AGENT_MODEL_DISPLAY_WIDTH}
      px={2.5}
      py={1.5}
      borderRadius="md"
      borderWidth="1px"
      borderColor={
        isUnavailable
          ? isDark
            ? 'yellow.600'
            : 'yellow.300'
          : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'gray.200'
      }
      bg={
        isUnavailable
          ? isDark
            ? 'rgba(236,201,75,0.08)'
            : 'yellow.50'
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'gray.50'
      }
      title={isUnavailable ? `模型 ${displayText} 不可用` : displayText}
    >
      <Text
        fontSize="12px"
        fontWeight="500"
        color={
          isUnavailable
            ? isDark
              ? 'yellow.400'
              : 'yellow.600'
            : isInherit
              ? isDark
                ? 'gray.500'
                : 'gray.400'
              : isDark
                ? 'gray.200'
                : 'gray.700'
        }
        fontStyle={isInherit ? 'italic' : 'normal'}
        textDecoration={isUnavailable ? 'line-through' : 'none'}
        noOfLines={1}
        wordBreak="break-all"
        textAlign="center"
      >
        {displayText}
      </Text>
    </Box>
  );
};

export { INHERIT_VALUE };
export default CustomAgentModelDisplay;