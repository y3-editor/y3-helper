import React from 'react';
import { Box, Tooltip } from '@chakra-ui/react';

interface CodeBlockNumberLabelProps {
  /** 序号 */
  number: number;
  /** 点击回调 */
  onClick?: (number: number) => void;
  /** 是否可点击 */
  clickable?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 代码块序号标签组件
 * 用于在引用窗口中显示代码块按发送顺序的序号
 */
const CodeBlockNumberLabel: React.FC<CodeBlockNumberLabelProps> = ({
  number,
  onClick,
  clickable = true,
  style = {}
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickable && onClick) {
      onClick(number);
    }
  };

  return (
    <Tooltip 
      label={clickable ? `点击插入引用${number}到输入框` : `引用${number}`} 
      placement="top"
      fontSize="xs"
    >
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        width="18px"
        height="18px"
        fontSize="10px"
        fontWeight="bold"
        color="white"
        bg={clickable ? "blue.500" : "gray.400"}
        borderRadius="50%"
        cursor={clickable ? "pointer" : "default"}
        mr={2}
        flexShrink={0}
        transition="all 0.2s"
        _hover={clickable ? {
          bg: "blue.600",
          transform: "scale(1.1)"
        } : {}}
        _active={clickable ? {
          transform: "scale(0.95)"
        } : {}}
        onClick={handleClick}
        style={style}
      >
        {number}
      </Box>
    </Tooltip>
  );
};

export default CodeBlockNumberLabel;