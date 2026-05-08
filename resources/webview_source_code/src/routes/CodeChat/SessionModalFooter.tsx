import * as React from 'react';
import { Box, Flex, ModalFooter, useMediaQuery } from '@chakra-ui/react';
import { MediumScreenWidth } from '../../const';

interface SessionModalFooterProps {
  checkboxes: React.ReactNode;
  navigationButtons: React.ReactNode;
  actionButtons: React.ReactNode;
}

/**
 * 分享/收藏 Modal 的共用 Footer 组件。
 * - 正常屏（> 340px）：单行横向排列
 * - 小屏（≤ 340px）：两行布局
 *   - 第一行：Checkbox 组 + 导航按钮（左对齐）
 *   - 第二行：操作按钮组（右对齐）
 */
function SessionModalFooter({
  checkboxes,
  navigationButtons,
  actionButtons,
}: SessionModalFooterProps) {
  const [isSmallScreen] = useMediaQuery(MediumScreenWidth);

  if (isSmallScreen) {
    return (
      <ModalFooter flexDirection="column" alignItems="stretch" gap={2} py={2}>
        {/* 第一行：Checkbox + 导航按钮 */}
        <Flex alignItems="center" gap={2} flexWrap="wrap">
          {checkboxes}
          <Box ml="auto">{navigationButtons}</Box>
        </Flex>
        {/* 第二行：操作按钮（右对齐） */}
        <Flex justifyContent="flex-end" gap={2} flexWrap="wrap">
          {actionButtons}
        </Flex>
      </ModalFooter>
    );
  }

  return (
    <ModalFooter gap={2}>
      {checkboxes}
      <Box mr="auto">{navigationButtons}</Box>
      {actionButtons}
    </ModalFooter>
  );
}

export default SessionModalFooter;
