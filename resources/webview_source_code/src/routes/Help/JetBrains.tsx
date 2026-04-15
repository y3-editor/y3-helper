import * as React from 'react';
import { usePostMessage } from '../../PostMessageProvider';
import { Text, Box, Button } from '@chakra-ui/react';
import NavKeyboardShortcut from './NavKeyBoardShortcut';

export default function VisualStudioCodeShortcuts() {
  const { postMessage } = usePostMessage();
  const openGlobalKeybindings = React.useCallback(
    (key?: string) => {
      postMessage({
        type: 'OPEN_GLOBAL_KEYBINDINGS',
        data: {
          key,
        },
      });
    },
    [postMessage],
  );

  return (
    <>
      <Box my="6" alignItems="start" display="flex">
        <Text fontSize="16px" fontWeight="bold" minW="72px" mr="4">
          快捷键
        </Text>
        <Box>
          <Box display="flex" gap="4" flexWrap="wrap">
            <NavKeyboardShortcut
              label="接受代码补全"
              value="Tab"
              onClick={() => {
                openGlobalKeybindings('Accept Inline Suggestion');
              }}
            ></NavKeyboardShortcut>
            <NavKeyboardShortcut
              label="主动触发补全"
              value="Alt + \"
              onClick={() => {
                openGlobalKeybindings('Trigger Inline Suggestion');
              }}
            ></NavKeyboardShortcut>
            <NavKeyboardShortcut
              label="触发自适应多行补全"
              value="Ctrl/Command + Alt + \"
              onClick={() => {
                openGlobalKeybindings('codemaker.trigger-automatic-suggestion');
              }}
            ></NavKeyboardShortcut>
            <NavKeyboardShortcut
              label="生成代码"
              value="Ctrl/Command + Alt + k"
              onClick={() => {
                openGlobalKeybindings('Y3Maker: Generate');
              }}
            ></NavKeyboardShortcut>
          </Box>
          <Button
            color="white"
            borderRadius="16px"
            colorScheme="blue.300"
            bg="blue.300"
            mt="6"
            // size="sm"
            onClick={() => openGlobalKeybindings()}
            h="32px"
            fontSize="12px"
          >
            更多自定义快捷键
          </Button>
        </Box>
      </Box>
      <Box w="full" h="1px" bg="#ffffff" opacity="0.08"></Box>
    </>
  );
}
