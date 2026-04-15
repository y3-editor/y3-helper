import { ReactNode } from 'react';
import * as React from 'react';
import {
  Box,
  Text,
  useColorModeValue,
  Flex,
  Switch,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Spinner,
} from '@chakra-ui/react';

export interface TaskItem {
  id: string;
  title: string;
  completed?: boolean;
}

export interface AutoConfigItem {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tip?: ReactNode;
  isLoading?: boolean;
}

interface TaskProgressPanelProps {
  title?: string;
  headerContent?: ReactNode;
  children?: ReactNode; // 中间内容区域
  footerContent?: ReactNode;
  showBorder?: boolean; // 是否显示边框
  autoConfigItems?: AutoConfigItem[]; // 自动配置项列表
  showHeader?: boolean; // 是否显示头部
}

const TaskProgressPanel = ({
  title = '任务执行进度',
  headerContent,
  children,
  footerContent,
  showBorder = true,
  autoConfigItems = [],
  showHeader = true,
}: TaskProgressPanelProps) => {
  const [tooltipStates, setTooltipStates] = React.useState<Record<number, boolean>>({});
  const tooltipTimersRef = React.useRef<Record<number, NodeJS.Timeout>>({});

  // 统一背景色 - 参考截图的深色背景
  const bgColor = useColorModeValue('#f8f9fa', '#1f1f1f');
  const borderColor = useColorModeValue('#e2e8f0', '#3a3a3a');
  const titleColor = useColorModeValue('#2d3748', '#e2e8f0');
  const checkboxTextColor = useColorModeValue('#4a5568', '#a0aec0');
  const popoverBg = useColorModeValue('white', 'gray.700');
  const popoverBorderColor = useColorModeValue('gray.200', 'gray.600');

  const handleMouseEnter = (index: number) => () => {
    // 清除任何待执行的隐藏定时器
    if (tooltipTimersRef.current[index]) {
      clearTimeout(tooltipTimersRef.current[index]);
      delete tooltipTimersRef.current[index];
    }
    setTooltipStates(prev => ({ ...prev, [index]: true }));
  };

  const handleMouseLeave = (index: number) => () => {
    // 延迟隐藏，给用户时间移动鼠标到 tooltip 上
    if (tooltipTimersRef.current[index]) {
      clearTimeout(tooltipTimersRef.current[index]);
    }
    tooltipTimersRef.current[index] = setTimeout(() => {
      setTooltipStates(prev => ({ ...prev, [index]: false }));
      delete tooltipTimersRef.current[index];
    }, 200);
  };

  const handleTooltipMouseEnter = (index: number) => () => {
    // 鼠标进入 tooltip 时，清除隐藏定时器，保持显示
    if (tooltipTimersRef.current[index]) {
      clearTimeout(tooltipTimersRef.current[index]);
      delete tooltipTimersRef.current[index];
    }
  };

  const handleTooltipMouseLeave = (index: number) => () => {
    // 鼠标离开 tooltip 时，立即隐藏
    if (tooltipTimersRef.current[index]) {
      clearTimeout(tooltipTimersRef.current[index]);
    }
    setTooltipStates(prev => ({ ...prev, [index]: false }));
  };

  React.useEffect(() => {
    return () => {
      Object.values(tooltipTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <Box
      border={showBorder ? "1px solid" : "none"}
      borderColor={showBorder ? borderColor : "transparent"}
      borderRadius="4px"
      overflow="hidden"
      w="full"
      mt={2}
      mb={2}
      bg={bgColor}
    >
      {/* 头部区域 */}
      {showHeader && (
        <Box
          px={2}
          py={1}
          borderBottom={showBorder ? "1px solid" : "none"}
          borderColor={showBorder ? borderColor : "transparent"}
          fontSize="12px"
        >
          {headerContent ? (
            <Text fontSize="12px" mb="0 !important" fontWeight="400" color={titleColor} noOfLines={1}>
              {headerContent}
            </Text>
          ) : (
            <Text fontSize="12px" mb="0 important" fontWeight="600" color={titleColor}>
              {title}
            </Text>
          )}
        </Box>
      )}

      {/* 中间内容 - 任务列表 */}
      <Box
        sx={{
          '& .chakra-accordion': {
            borderWidth: '0 !important',
            background: 'transparent !important',
          },
          '& .chakra-accordion__item': {
            borderWidth: '0 !important',
            borderTopWidth: '0 !important',
            borderBottomWidth: '0 !important',
            background: 'transparent !important',
          },
          '& .chakra-accordion__button': {
            background: 'transparent !important',
            px: '8px !important',
            py: '2px !important',
            minHeight: '20px !important',
            fontSize: '12px !important',
          },
          '& .chakra-accordion__panel': {
            background: 'transparent !important',
            px: '8px !important',
            py: '4px !important',
            fontSize: '12px !important',
          },
        }}
      >
        {children || (
          <Box px={2} py={1}>
            <Text fontSize="12px" color="gray.500" textAlign="center" py={1}>
              暂无内容
            </Text>
          </Box>
        )}
      </Box>

      {/* 底部按钮区域 */}
      {(footerContent || autoConfigItems.length > 0) && (
        <Box
          px={2}
          py={1}
          borderTop={showBorder ? "1px solid" : "none"}
          borderColor={showBorder ? borderColor : "transparent"}
        >
          <Flex alignItems="center" justifyContent="space-between" gap={2} minHeight="18px">
            <Flex flex="1" alignItems="center">
              {footerContent}
            </Flex>
            {autoConfigItems.length > 0 && (
              <Flex gap={2} alignItems="center" flexShrink={0}>
                {autoConfigItems.map((item, index) => (
                  <Box
                    key={index}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    gap={1}
                    onClick={(e) => e.stopPropagation()}
                    position="relative"
                  >
                    <Box fontSize="12px" color={checkboxTextColor}>
                      {item.label}
                    </Box>
                    <Popover
                      isOpen={tooltipStates[index]}
                      placement="top"
                      isLazy
                      closeOnBlur={false}
                    >
                      <PopoverTrigger>
                        <Box position="relative">
                          <Switch
                            isChecked={item.checked}
                            onMouseEnter={handleMouseEnter(index)}
                            onMouseLeave={handleMouseLeave(index)}
                            onChange={(e) => {
                              e.stopPropagation();
                              item.onChange(e.target.checked);
                            }}
                            size="sm"
                            isDisabled={item.isLoading}
                            sx={{
                              'span.chakra-switch__track': {
                                bg: item.checked ? '#7c7cff' : 'gray.300',
                              },
                              'span.chakra-switch__track[data-checked]': {
                                bg: '#7c7cff',
                              },
                            }}
                          />
                          {item.isLoading && (
                            <Spinner
                              size="xs"
                              position="absolute"
                              top="50%"
                              left="50%"
                              transform="translate(-50%, -50%)"
                              color="#7c7cff"
                            />
                          )}
                        </Box>
                      </PopoverTrigger>
                      {item.tip && (
                        <PopoverContent
                          onMouseEnter={handleTooltipMouseEnter(index)}
                          onMouseLeave={handleTooltipMouseLeave(index)}
                          bg={popoverBg}
                          borderColor={popoverBorderColor}
                          width="auto"
                          maxW="300px"
                        >
                          <PopoverArrow bg={popoverBg} />
                          <PopoverBody fontSize="12px">
                            {item.tip}
                          </PopoverBody>
                        </PopoverContent>
                      )}
                    </Popover>
                  </Box>
                ))}
              </Flex>
            )}
          </Flex>
        </Box>
      )}
    </Box>
  );
};

export default TaskProgressPanel;
