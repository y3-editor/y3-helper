import { Text, Box } from '@chakra-ui/react';
import NavKeyboardShortcut from './NavKeyBoardShortcut';
export default function VisualStudioShortcuts() {
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
            ></NavKeyboardShortcut>
            <NavKeyboardShortcut
              label="主动触发补全"
              value="Alt + \"
            ></NavKeyboardShortcut>
          </Box>
        </Box>
      </Box>
      <Box w="full" h="1px" bg="#ffffff" opacity="0.08"></Box>
    </>
  );
}
