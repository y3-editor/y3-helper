// src/components/CollapsibleSection.tsx
import React, { useState } from 'react';
import { Box, Icon, BoxProps } from '@chakra-ui/react';
import { FaAngleDown, FaAngleRight } from 'react-icons/fa';

interface CollapsibleSectionProps extends BoxProps {
  /** 折叠部分的标题 */
  title: string;
  /** 默认是否折叠 */
  defaultCollapsed?: boolean;
  /** 折叠部分的内容 */
  children: React.ReactNode;
  /** 标题的颜色 */
  titleColor?: string;
  /** 内容的样式类名 */
  contentClassName?: string;
  /** 是否使用引用样式 */
  useQuote?: boolean;
}

const CollapsibleMessage: React.FC<CollapsibleSectionProps> = ({
  title,
  defaultCollapsed = true,
  children,
  titleColor = 'text.primary',
  contentClassName = '',
  useQuote = false,
  ...boxProps
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <Box {...boxProps}>
      <Box
        cursor="pointer"
        color="text.default"
        onClick={() => setIsCollapsed(!isCollapsed)}
        display="flex"
        alignItems="center"
        mb="1"
      >
        {!isCollapsed ? (
          <Icon as={FaAngleDown} size="xs" />
        ) : (
          <Icon as={FaAngleRight} size="xs" />
        )}
        <Box ml="1" color={titleColor}>
          {title}
        </Box>
      </Box>
      
      {!isCollapsed && useQuote && (
        <blockquote className={`border-l-4 border-gray-300 pl-4 my-0 mx-0 text-gray-600 italic whitespace-pre-line ${contentClassName}`}>
          {children}
        </blockquote>
      )}
      {!isCollapsed && !useQuote && (
        <Box className={contentClassName}>
          {children}
        </Box>
      )}
    </Box>
  );
};

export default CollapsibleMessage;